# Health Watch - Risk Assessment and Remediation Plan

## Executive Summary

This document provides a comprehensive risk assessment of the Health Watch extension, identifying critical reliability, performance, and maintainability issues with prioritized remediation recommendations.

## Risk Classification

### Critical Risks (Immediate Action Required)

#### R1: Storage Initialization Race Conditions
**Impact**: High | **Probability**: High | **Risk Level**: 🔴 CRITICAL

**Description**: StorageManager constructor calls async `loadState()` without awaiting, creating race conditions where callers may read default/empty state before disk loading completes.

**Evidence**:
```typescript
// src/storage.ts:41-44
constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.diskStorage = DiskStorageManager.initialize(context);
    this.loadState(); // ❌ Async operation not awaited
}
```

**Impact Scenarios**:
- Dashboard shows no channels/data on first load
- Probe execution starts before configuration is loaded
- State corruption if writes occur before load completes

**Remediation**:
```typescript
// ✅ Fixed pattern
static async initialize(context: vscode.ExtensionContext): Promise<StorageManager> {
    const instance = new StorageManager(context);
    await instance.loadState();
    return instance;
}

// Update all callers to await initialization
const storageManager = await StorageManager.initialize(context);
```

**Timeline**: 1-2 days  
**Resources**: 1 developer  
**Validation**: Unit tests for initialization ordering

---

#### R2: Unhandled Promise Rejections in Persistence
**Impact**: High | **Probability**: Medium | **Risk Level**: 🔴 CRITICAL

**Description**: Many storage operations use fire-and-forget async calls, leading to unhandled promise rejections and potential data loss.

**Evidence**:
```typescript
// src/storage.ts:145, 168, 237, etc.
updateChannelState(channelId: string, updates: Partial<ChannelState>): void {
    const state = this.getChannelState(channelId);
    Object.assign(state, updates);
    this.saveState(); // ❌ Promise not handled
}

addOutage(outage: Outage): void {
    this.outages.push(outage);
    this.diskStorage.addOutage(outage); // ❌ Promise not handled
}
```

**Impact Scenarios**:
- Data loss during disk write failures
- Inconsistent state between memory and persistence
- Hidden errors that prevent debugging

**Remediation**:
```typescript
// ✅ Option 1: Make operations async
async addOutage(outage: Outage): Promise<void> {
    this.outages.push(outage);
    await this.diskStorage.addOutage(outage);
}

// ✅ Option 2: Explicit fire-and-forget with error handling
addOutage(outage: Outage): void {
    this.outages.push(outage);
    void this.diskStorage.addOutage(outage).catch(error => {
        console.error('Failed to persist outage:', error);
        // Optionally: retry logic, user notification
    });
}
```

**Timeline**: 2-3 days  
**Resources**: 1 developer  
**Validation**: Integration tests with simulated storage failures

### High Risks (Address Soon)

#### R3: MySQL ENUM Constraint Violations
**Impact**: Medium | **Probability**: High | **Risk Level**: 🟠 HIGH

**Description**: MySQL storage writes arbitrary error text to ENUM columns, causing database insert failures.

**Evidence**:
```typescript
// src/storage/MySQLStorage.ts:176 (before fix)
await this.connection.execute(`
    INSERT INTO health_samples (reason, ...) VALUES (?, ...)
`, [sample.error, ...]);  // ❌ sample.error may not be valid ENUM value
```

**Impact Scenarios**:
- Database insert failures for samples with arbitrary error messages
- Loss of probe results due to constraint violations
- Inconsistent data between memory and database

**Remediation Status**: ✅ **FIXED** - Implemented ENUM validation guard
```typescript
// ✅ Current implementation includes validation
const allowedReasons = new Set(['timeout', 'dns', 'tcp', 'tls', 'http', 'script']);
const reason = rawReason && allowedReasons.has(rawReason) ? rawReason : null;
const note = (!reason && rawReason) || null;
```

**Validation**: Database integration tests with various error types

---

#### R4: Disk Storage Historical Query Limitations
**Impact**: Medium | **Probability**: Medium | **Risk Level**: 🟠 HIGH

**Description**: Disk storage doesn't maintain separate sample history logs, limiting historical queries and data recovery.

**Evidence**:
```typescript
// src/storage/DiskStorageAdapter.ts:78-81
async getSamples(channelId: string, startTime: number, endTime: number): Promise<Sample[]> {
    // ❌ Historical sample retrieval not supported
    console.warn('Historical sample retrieval not efficiently supported by file storage');
    return [];
}
```

**Impact Scenarios**:
- Dashboard can't show historical trends beyond current memory
- Data loss on extension restart (samples only in ChannelState.samples)
- Limited forensic analysis capabilities

**Remediation Options**:
1. **Sample Log Files**: Implement per-channel append-only sample logs
2. **Compressed Timeline**: Store daily/hourly aggregates for historical queries
3. **Database Migration**: Recommend MySQL for deployments requiring history

**Timeline**: 3-5 days  
**Resources**: 1 developer  
**Validation**: Historical query performance tests

---

#### R5: Connection Pool Absence in MySQL Storage
**Impact**: Low | **Probability**: High | **Risk Level**: 🟠 HIGH

**Description**: MySQL storage uses single connection instead of connection pool, limiting scalability and reliability.

**Evidence**:
```typescript
// src/storage/MySQLStorage.ts:20
private connection: mysql.Connection | null = null;
```

**Impact Scenarios**:
- Connection timeouts under high load
- Blocked operations during connection re-establishment
- No failover for connection issues

**Remediation**:
```typescript
// ✅ Recommended implementation
import { createPool, Pool } from 'mysql2/promise';

class MySQLStorage {
    private pool: Pool;
    
    async initialize(): Promise<void> {
        this.pool = createPool({
            host: this.config.host,
            port: this.config.port,
            user: this.config.username,
            password: this.config.password,
            database: this.config.database,
            connectionLimit: this.config.maxConnections || 10,
            acquireTimeout: 60000,
            timeout: 60000
        });
    }
}
```

**Timeline**: 2-3 days  
**Resources**: 1 developer  
**Validation**: Load testing with concurrent operations

### Medium Risks (Plan and Schedule)

#### R6: Synchronous File I/O Blocking
**Impact**: Low | **Probability**: Medium | **Risk Level**: 🟡 MEDIUM

**Description**: DiskStorageManager uses synchronous file operations that can block the extension thread.

**Evidence**:
```typescript
// src/diskStorage.ts:67-71
private async writeJsonFile<T>(filename: string, data: T): Promise<void> {
    try {
        const filePath = this.getFilePath(filename);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8'); // ❌ Sync I/O
    } catch (error) {
        console.error(`Failed to write ${filename}:`, error);
    }
}
```

**Impact Scenarios**:
- UI freezes during large file writes
- Poor user experience during disk operations
- Potential timeout issues with VS Code

**Remediation**:
```typescript
// ✅ Use async file operations
import { promises as fs } from 'fs';

private async writeJsonFile<T>(filename: string, data: T): Promise<void> {
    try {
        const filePath = this.getFilePath(filename);
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error(`Failed to write ${filename}:`, error);
        throw error; // Allow callers to handle errors
    }
}
```

**Timeline**: 1-2 days  
**Resources**: 1 developer  
**Validation**: Performance testing with large datasets

---

#### R7: Missing Database Schema Versioning
**Impact**: Medium | **Probability**: Low | **Risk Level**: 🟡 MEDIUM

**Description**: No database migration system for schema changes, making updates risky.

**Impact Scenarios**:
- Schema changes break existing installations
- Data loss during manual schema updates
- Deployment complexity for database changes

**Remediation**:
```typescript
// ✅ Recommended migration system
class MySQLStorage {
    private readonly CURRENT_SCHEMA_VERSION = 2;
    
    async initialize(): Promise<void> {
        await this.createTables();
        await this.runMigrations();
    }
    
    private async runMigrations(): Promise<void> {
        const currentVersion = await this.getSchemaVersion();
        
        if (currentVersion < 2) {
            await this.migrateToV2(); // Add new columns, indexes
        }
        
        await this.setSchemaVersion(this.CURRENT_SCHEMA_VERSION);
    }
}
```

**Timeline**: 3-4 days  
**Resources**: 1 developer  
**Validation**: Migration testing with sample data

### Low Risks (Monitor and Plan)

#### R8: Memory Usage Growth in Large Deployments
**Impact**: Low | **Probability**: Low | **Risk Level**: 🟢 LOW

**Description**: Bounded collections may still consume significant memory in large deployments.

**Current Bounds**:
- 1000 samples per channel
- 50 watch sessions in history
- 500 outages in memory

**Estimated Memory** (worst case):
- 200 channels × 1000 samples × 200 bytes = ~40MB
- Plus states, watches, outages = ~50-80MB total

**Mitigation**: Already implemented reasonable bounds; monitor in production

---

#### R9: Credential Storage Security
**Impact**: Medium | **Probability**: Low | **Risk Level**: 🟢 LOW

**Description**: Database passwords stored in plaintext configuration files.

**Remediation**:
```typescript
// ✅ Use VS Code SecretStorage
import * as vscode from 'vscode';

class MySQLStorage {
    async initialize(): Promise<void> {
        const password = await vscode.workspace.getConfiguration()
            .get('healthWatch.mysql.password') ||
            await vscode.workspace.secretStorage.get('healthWatch.mysql.password');
    }
}
```

**Timeline**: 1-2 days  
**Resources**: 1 developer

## Remediation Roadmap

### Phase 1: Critical Risk Resolution (Week 1-2)
**Priority**: Immediate  
**Resources**: 1 senior developer  

1. **Fix Storage Initialization Race** (R1)
   - Make StorageManager.initialize() async
   - Update all initialization call sites
   - Add whenReady() method for late access

2. **Handle Promise Rejections** (R2)
   - Review all fire-and-forget async calls
   - Add proper error handling or make operations async
   - Implement retry logic for critical operations

**Success Criteria**:
- No unhandled promise rejections in logs
- Consistent initialization behavior
- All tests pass without race conditions

### Phase 2: High Risk Mitigation (Week 3-4)
**Priority**: High  
**Resources**: 1 developer  

1. **Implement Historical Sample Storage** (R4)
   - Design sample log file format
   - Implement append-only sample persistence
   - Add historical query support

2. **Add MySQL Connection Pooling** (R5)
   - Replace single connection with pool
   - Add connection health monitoring
   - Implement graceful degradation

**Success Criteria**:
- Historical queries work with disk storage
- MySQL storage handles concurrent operations
- Performance tests show improved scalability

### Phase 3: Medium Risk Improvements (Week 5-6)
**Priority**: Medium  
**Resources**: 1 developer

1. **Async File Operations** (R6)
   - Replace sync fs calls with async
   - Add proper error propagation
   - Performance testing

2. **Database Migration System** (R7)
   - Design migration framework
   - Implement schema versioning
   - Add migration rollback capability

**Success Criteria**:
- No blocking file operations
- Safe database schema evolution
- Migration testing validates data integrity

### Phase 4: Security and Monitoring (Week 7-8)
**Priority**: Low  
**Resources**: 1 developer

1. **Credential Security** (R9)
   - Implement SecretStorage integration
   - Add credential migration
   - Update documentation

2. **Enhanced Monitoring**
   - Add structured logging
   - Implement health checks
   - Create monitoring dashboard

## Quick commands

Run small checks and open the risk register quickly from a developer machine.

```powershell
# List High/Critical risks
Select-String -Path docs/developers/architecture/RISK_ASSESSMENT.csv -Pattern "High|Critical" -SimpleMatch

# Open the CSV in VS Code
code docs/developers/architecture/RISK_ASSESSMENT.csv

# Show the last 20 lines of the CSV (PowerShell)
Get-Content docs/developers/architecture/RISK_ASSESSMENT.csv -Tail 20
```

Notes:
- Edit the CSV directly for programmatic workflows. Keep this MD for human-friendly guidance and a remediation roadmap.

**Success Criteria**:
- Secure credential storage
- Comprehensive system monitoring
- Proactive issue detection

## Testing Strategy

### Unit Tests
```typescript
// Example test for initialization fix
describe('StorageManager', () => {
    it('should complete initialization before returning instance', async () => {
        const storage = await StorageManager.initialize(mockContext);
        
        // Should have loaded state
        expect(storage.getChannelIds()).toBeDefined();
        
        // Should not throw on immediate operations
        expect(() => storage.getChannelState('test')).not.toThrow();
    });
});
```

### Integration Tests
```typescript
// Example test for storage reliability
describe('Storage Reliability', () => {
    it('should handle disk write failures gracefully', async () => {
        const storage = await StorageManager.initialize(mockContext);
        
        // Simulate disk failure
        mockDiskStorage.addOutage.mockRejectedValue(new Error('Disk full'));
        
        // Should not throw, should log error
        await expect(storage.addOutage(mockOutage)).resolves.toBeUndefined();
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to persist'));
    });
});
```

### Performance Tests
```typescript
// Example performance test
describe('Storage Performance', () => {
    it('should handle 1000 samples efficiently', async () => {
        const storage = await StorageManager.initialize(mockContext);
        const startTime = Date.now();
        
        // Add 1000 samples
        for (let i = 0; i < 1000; i++) {
            await storage.addSample('channel1', mockSample);
        }
        
        const duration = Date.now() - startTime;
        expect(duration).toBeLessThan(1000); // Should complete in < 1 second
    });
});
```

## Monitoring and Alerting

### Key Metrics
1. **Storage Operation Latency**: Track p95/p99 for read/write operations
2. **Error Rates**: Monitor storage failure frequency and types
3. **Memory Usage**: Track bounded collection sizes and total memory
4. **Disk Usage**: Monitor file sizes and growth rates

### Alert Conditions
- Storage operation failure rate > 5%
- Memory usage > 100MB
- Disk write latency > 500ms
- Unhandled promise rejections detected

### Health Checks
```typescript
class StorageHealthCheck {
    async checkHealth(): Promise<HealthStatus> {
        const checks = await Promise.allSettled([
            this.checkMemoryUsage(),
            this.checkDiskSpace(),
            this.checkDatabaseConnection(),
            this.checkFileIntegrity()
        ]);
        
        return this.aggregateHealth(checks);
    }
}
```

---

*Generated on: August 19, 2025*  
*Risk Assessment Date: Current*  
*Next Review: September 2025*  
*Classification: Internal Development*
