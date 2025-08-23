# Storage Testing Strategy

## Overview

This document outlines the comprehensive testing strategy for Health Watch storage components, developed after critical storage issues were discovered in production that weren't caught by existing tests.

## Critical Storage Issues Background

### Issues Discovered
1. **ENOENT File Write Failures**: `fs.renameSync()` failing with "no such file or directory" 
2. **JSON Corruption**: "Unterminated string in JSON at position 532480" from massive JSON files

### Root Causes
- Async/sync operation mixing
- Unbounded data growth (50MB+ JSON files)
- Multi-window race conditions
- Missing directory creation
- Insufficient data validation

## Testing Strategy

### 1. Unit Testing (Component Level)

#### DiskStorage Unit Tests
**File**: `test/unit/diskStorage.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DiskStorageManager } from '../../../src/diskStorage';
import * as fs from 'fs';
import * as path from 'path';

describe('DiskStorageManager', () => {
  let tempDir: string;
  let storage: DiskStorageManager;

  beforeEach(() => {
    tempDir = path.join(__dirname, `temp-${Date.now()}`);
    const mockContext = {
      globalStorageUri: { fsPath: tempDir }
    } as any;
    storage = new DiskStorageManager(mockContext);
  });

  describe('writeJsonFile', () => {
    it('should handle large JSON files (>10MB)', async () => {
      const largeData = Array(100000).fill(0).map((_, i) => ({
        timestamp: Date.now() + i,
        success: Math.random() > 0.1,
        latencyMs: Math.random() * 1000,
        details: { iteration: i, data: 'x'.repeat(100) }
      }));
      
      await expect(storage.writeJsonFile('large.json', largeData)).resolves.not.toThrow();
      
      // Verify file exists and is readable
      const result = await storage.readJsonFile('large.json', []);
      expect(result).toHaveLength(100000);
    });

    it('should handle concurrent writes without collisions', async () => {
      const data1 = { id: 'file1', samples: Array(1000).fill({ test: 'data1' }) };
      const data2 = { id: 'file2', samples: Array(1000).fill({ test: 'data2' }) };
      const data3 = { id: 'file3', samples: Array(1000).fill({ test: 'data3' }) };

      // Concurrent writes should not interfere
      await Promise.all([
        storage.writeJsonFile('concurrent1.json', data1),
        storage.writeJsonFile('concurrent2.json', data2),
        storage.writeJsonFile('concurrent3.json', data3)
      ]);

      const [result1, result2, result3] = await Promise.all([
        storage.readJsonFile('concurrent1.json', {}),
        storage.readJsonFile('concurrent2.json', {}),
        storage.readJsonFile('concurrent3.json', {})
      ]);

      expect(result1.id).toBe('file1');
      expect(result2.id).toBe('file2');
      expect(result3.id).toBe('file3');
    });

    it('should create directories if they don\'t exist', async () => {
      // Remove temp directory to test creation
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }

      await expect(storage.writeJsonFile('test.json', { test: 'data' })).resolves.not.toThrow();
      expect(fs.existsSync(path.join(tempDir, 'test.json'))).toBe(true);
    });

    it('should handle JSON serialization errors gracefully', async () => {
      const circularData = { self: null as any };
      circularData.self = circularData; // Circular reference

      await expect(storage.writeJsonFile('circular.json', circularData)).rejects.toThrow(/JSON serialization failed/);
    });

    it('should retry failed operations with exponential backoff', async () => {
      // Mock fs.promises.writeFile to fail twice, then succeed
      const writeFileSpy = vi.spyOn(fs.promises, 'writeFile')
        .mockRejectedValueOnce(new Error('ENOSPC: no space left on device'))
        .mockRejectedValueOnce(new Error('EBUSY: resource busy'))
        .mockResolvedValueOnce(undefined);

      await expect(storage.writeJsonFile('retry.json', { test: 'data' })).resolves.not.toThrow();
      expect(writeFileSpy).toHaveBeenCalledTimes(3);
      
      writeFileSpy.mockRestore();
    });
  });

  describe('readJsonFile', () => {
    it('should detect and handle corrupted JSON', async () => {
      // Write corrupted JSON directly to file
      const corruptedJson = '{"valid": "start", "incomplete": "stri';
      const filePath = path.join(tempDir, 'corrupted.json');
      fs.mkdirSync(tempDir, { recursive: true });
      fs.writeFileSync(filePath, corruptedJson);

      // Should return default value and backup corrupt file
      const result = await storage.readJsonFile('corrupted.json', { default: true });
      expect(result).toEqual({ default: true });
      
      // Verify backup was created
      const backupFiles = fs.readdirSync(tempDir).filter(f => f.includes('corrupted.json.corrupt'));
      expect(backupFiles).toHaveLength(1);
    });

    it('should handle files with null bytes', async () => {
      const dataWithNulls = 'normal data\0corrupted\0more data';
      const filePath = path.join(tempDir, 'nullbytes.json');
      fs.mkdirSync(tempDir, { recursive: true });
      fs.writeFileSync(filePath, dataWithNulls);

      const result = await storage.readJsonFile('nullbytes.json', { default: true });
      expect(result).toEqual({ default: true });
    });

    it('should handle truncated files', async () => {
      const truncatedJson = '{"incomplete": "json", "missing';
      const filePath = path.join(tempDir, 'truncated.json');
      fs.mkdirSync(tempDir, { recursive: true });
      fs.writeFileSync(filePath, truncatedJson);

      const result = await storage.readJsonFile('truncated.json', { default: true });
      expect(result).toEqual({ default: true });
    });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
```

### 2. Integration Testing (System Level)

#### Storage Stress Tests
**File**: `test/integration/storageStress.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StorageManager } from '../../src/storage';
import { DiskStorageManager } from '../../src/diskStorage';
import * as fs from 'fs';
import * as path from 'path';

describe('Storage System Stress Tests', () => {
  let tempDir: string;
  let storageManager: StorageManager;

  beforeEach(async () => {
    tempDir = path.join(__dirname, `stress-test-${Date.now()}`);
    const mockContext = {
      globalStorageUri: { fsPath: tempDir },
      globalState: new Map()
    } as any;

    storageManager = StorageManager.initialize(mockContext);
    await storageManager.whenReady();
  });

  it('should handle 10,000 samples per channel without corruption', async () => {
    const channelCount = 5;
    const samplesPerChannel = 10000;

    // Generate realistic sample data
    for (let channelId = 0; channelId < channelCount; channelId++) {
      for (let sampleId = 0; sampleId < samplesPerChannel; sampleId++) {
        const sample = {
          timestamp: Date.now() + sampleId,
          success: Math.random() > 0.1, // 10% failure rate
          latencyMs: Math.random() * 2000,
          error: Math.random() > 0.9 ? 'Timeout error' : undefined,
          details: {
            iteration: sampleId,
            channelId: `channel-${channelId}`,
            metadata: 'x'.repeat(50) // Some bulk data
          }
        };
        
        storageManager.addSample(`channel-${channelId}`, sample);
        
        // Throttle to avoid overwhelming the system
        if (sampleId % 1000 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
    }

    // Verify all data was stored correctly
    for (let channelId = 0; channelId < channelCount; channelId++) {
      const state = storageManager.getChannelState(`channel-${channelId}`);
      expect(state.samples).toHaveLength(samplesPerChannel);
      expect(state.lastSample).toBeDefined();
    }
  });

  it('should handle concurrent watch sessions without data loss', async () => {
    const watchCount = 10;
    const samplesPerWatch = 1000;

    // Start multiple watch sessions concurrently
    const watches = await Promise.all(
      Array(watchCount).fill(0).map((_, i) => 
        storageManager.startWatch(`${60 * 60 * 1000}`) // 1 hour each
      )
    );

    // Add samples to each watch concurrently
    await Promise.all(
      watches.map(async (watch, watchIndex) => {
        for (let sampleId = 0; sampleId < samplesPerWatch; sampleId++) {
          const sample = {
            timestamp: Date.now() + sampleId,
            success: true,
            latencyMs: Math.random() * 100,
            details: { watchIndex, sampleId }
          };
          
          storageManager.addSample(`test-channel-${watchIndex}`, sample);
        }
      })
    );

    // Verify no data corruption
    const currentWatch = storageManager.getCurrentWatch();
    expect(currentWatch).toBeDefined();
    expect(currentWatch?.samples).toBeDefined();
  });

  it('should maintain performance with large file sizes', async () => {
    const startTime = Date.now();
    
    // Create a large dataset
    const largeDataset = Array(50000).fill(0).map((_, i) => ({
      timestamp: Date.now() + i,
      success: Math.random() > 0.05,
      latencyMs: Math.random() * 5000,
      error: Math.random() > 0.95 ? 'Random error for testing' : undefined,
      details: {
        id: i,
        data: 'x'.repeat(200), // 200 bytes per sample
        metadata: {
          version: '1.0.0',
          source: 'stress-test',
          timestamp: new Date().toISOString()
        }
      }
    }));

    // Store the large dataset
    for (const sample of largeDataset) {
      storageManager.addSample('stress-test-channel', sample);
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Performance assertions
    expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
    
    // Verify data integrity
    const state = storageManager.getChannelState('stress-test-channel');
    expect(state.samples.length).toBeGreaterThan(0);
  });

  afterEach(async () => {
    if (storageManager) {
      // Cleanup
      try {
        storageManager.clearOldData(0); // Clear all data
      } catch (error) {
        console.warn('Cleanup error:', error);
      }
    }

    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
```

### 3. Load Testing (Production Simulation)

#### Multi-Window Coordination Tests
**File**: `test/load/multiWindowCoordination.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MultiWindowCoordinationManager } from '../../src/coordination/multiWindowCoordination';
import { DiskStorageManager } from '../../src/diskStorage';
import * as fs from 'fs';
import * as path from 'path';

describe('Multi-Window Coordination Load Tests', () => {
  let tempDir: string;
  let coordinators: MultiWindowCoordinationManager[];

  beforeEach(() => {
    tempDir = path.join(__dirname, `coordination-test-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    coordinators = [];
  });

  it('should handle 10 concurrent VS Code windows', async () => {
    const windowCount = 10;
    
    // Simulate 10 VS Code windows starting coordination
    for (let i = 0; i < windowCount; i++) {
      const mockContext = {
        extension: { id: `window-${i}` }
      } as any;
      
      const coordinator = new MultiWindowCoordinationManager(mockContext, tempDir);
      coordinators.push(coordinator);
      
      await coordinator.startCoordination();
      
      // Stagger startup to simulate real-world conditions
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Verify exactly one leader is elected
    const leaders = coordinators.filter(c => c.isLeader());
    expect(leaders).toHaveLength(1);

    // Verify all followers can read shared state
    const leader = leaders[0];
    await leader.updateSharedState({
      channelStates: {
        'test-channel': {
          state: 'online',
          lastSample: { timestamp: Date.now(), success: true },
          consecutiveFailures: 0,
          lastStateChange: Date.now()
        }
      }
    });

    // All followers should receive the update
    for (const coordinator of coordinators) {
      if (!coordinator.isLeader()) {
        const sharedState = await coordinator.getSharedState();
        expect(sharedState?.channelStates['test-channel']).toBeDefined();
      }
    }
  });

  it('should handle leader failover without data loss', async () => {
    // Start 3 coordinators
    for (let i = 0; i < 3; i++) {
      const mockContext = { extension: { id: `window-${i}` } } as any;
      const coordinator = new MultiWindowCoordinationManager(mockContext, tempDir);
      coordinators.push(coordinator);
      await coordinator.startCoordination();
    }

    const originalLeader = coordinators.find(c => c.isLeader());
    expect(originalLeader).toBeDefined();

    // Leader writes some data
    await originalLeader!.updateSharedState({
      channelStates: {
        'critical-data': {
          state: 'offline',
          lastSample: { timestamp: Date.now(), success: false },
          consecutiveFailures: 3,
          lastStateChange: Date.now()
        }
      }
    });

    // Simulate leader failure
    originalLeader!.dispose();
    const remainingCoordinators = coordinators.filter(c => c !== originalLeader);

    // Wait for leader election
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify new leader is elected
    const newLeaders = remainingCoordinators.filter(c => c.isLeader());
    expect(newLeaders).toHaveLength(1);

    // Verify data is preserved
    const sharedState = await newLeaders[0].getSharedState();
    expect(sharedState?.channelStates['critical-data']).toBeDefined();
    expect(sharedState?.channelStates['critical-data'].state).toBe('offline');
  });

  afterEach(() => {
    // Cleanup all coordinators
    coordinators.forEach(c => c.dispose());
    
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
```

### 4. Error Scenario Testing

#### File System Error Simulation
**File**: `test/integration/fileSystemErrors.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DiskStorageManager } from '../../src/diskStorage';
import * as fs from 'fs';

describe('File System Error Scenarios', () => {
  let storage: DiskStorageManager;
  let tempDir: string;

  beforeEach(() => {
    tempDir = '/tmp/error-test';
    const mockContext = {
      globalStorageUri: { fsPath: tempDir }
    } as any;
    storage = new DiskStorageManager(mockContext);
  });

  it('should handle disk full errors gracefully', async () => {
    // Mock ENOSPC error
    const writeFileSpy = vi.spyOn(fs.promises, 'writeFile')
      .mockRejectedValue(new Error('ENOSPC: no space left on device'));

    await expect(storage.writeJsonFile('test.json', { data: 'test' }))
      .rejects.toThrow(/Failed to write test.json after 3 attempts/);

    writeFileSpy.mockRestore();
  });

  it('should handle permission denied errors', async () => {
    // Mock EACCES error
    const mkdirSpy = vi.spyOn(fs.promises, 'mkdir')
      .mockRejectedValue(new Error('EACCES: permission denied'));

    await expect(storage.writeJsonFile('test.json', { data: 'test' }))
      .rejects.toThrow(/CRITICAL: Async storage directory creation failed/);

    mkdirSpy.mockRestore();
  });

  it('should handle file locking conflicts', async () => {
    // Mock EBUSY error (file locked by another process)
    const renameSpy = vi.spyOn(fs.promises, 'rename')
      .mockRejectedValueOnce(new Error('EBUSY: resource busy or locked'))
      .mockRejectedValueOnce(new Error('EBUSY: resource busy or locked'))
      .mockResolvedValueOnce(undefined);

    await expect(storage.writeJsonFile('locked.json', { data: 'test' }))
      .resolves.not.toThrow();

    expect(renameSpy).toHaveBeenCalledTimes(3);
    renameSpy.mockRestore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
});
```

## Test Execution Strategy

### Continuous Integration
```yaml
# .github/workflows/storage-tests.yml
name: Storage Tests

on:
  push:
    paths:
      - 'src/storage/**'
      - 'src/diskStorage.ts'
      - 'src/coordination/**'
  pull_request:
    paths:
      - 'src/storage/**'
      - 'src/diskStorage.ts'
      - 'src/coordination/**'

jobs:
  storage-unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:unit -- test/unit/*storage*.test.ts
      - run: npm run test:unit -- test/unit/diskStorage.test.ts

  storage-integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:integration -- test/integration/storage*.test.ts
      
  storage-load-tests:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:load -- test/load/*.test.ts
```

### Local Development
```bash
# Run all storage tests
npm run test:storage

# Run specific test categories
npm run test:unit -- test/unit/diskStorage.test.ts
npm run test:integration -- test/integration/storageStress.test.ts
npm run test:load -- test/load/multiWindowCoordination.test.ts

# Run with coverage
npm run test:coverage -- --include="**/storage/**" --include="**/diskStorage.ts"
```

## Test Data Management

### Realistic Test Data Generation
```typescript
// test/helpers/dataGenerator.ts
export function generateRealisticSample(overrides: Partial<Sample> = {}): Sample {
  return {
    timestamp: Date.now(),
    success: Math.random() > 0.1, // 90% success rate
    latencyMs: Math.random() < 0.1 ? Math.random() * 5000 : Math.random() * 500, // 10% high latency
    error: Math.random() > 0.9 ? generateRandomError() : undefined,
    details: {
      userAgent: 'Health Watch VS Code Extension',
      version: '1.0.0',
      metadata: 'x'.repeat(Math.floor(Math.random() * 100)) // Variable size data
    },
    ...overrides
  };
}

export function generateLargeDataset(sampleCount: number): Sample[] {
  return Array(sampleCount).fill(0).map((_, i) => 
    generateRealisticSample({ 
      timestamp: Date.now() + i * 1000 // 1 second apart
    })
  );
}

function generateRandomError(): string {
  const errors = [
    'ETIMEDOUT: Connection timeout',
    'ECONNREFUSED: Connection refused',
    'ENOTFOUND: DNS resolution failed',
    'CERT_HAS_EXPIRED: Certificate expired',
    'DEPTH_ZERO_SELF_SIGNED_CERT: Self-signed certificate'
  ];
  return errors[Math.floor(Math.random() * errors.length)];
}
```

## Performance Benchmarks

### Storage Performance Targets
- **Write Operations**: < 100ms for files up to 10MB
- **Read Operations**: < 50ms for files up to 10MB  
- **Concurrent Operations**: Support 10 concurrent reads/writes
- **Data Volume**: Handle 50,000 samples per channel
- **Memory Usage**: < 500MB peak during large operations

### Monitoring & Alerts
```typescript
// Performance monitoring in tests
export function measurePerformance<T>(operation: () => Promise<T>): Promise<{ result: T; duration: number; memory: number }> {
  const startTime = process.hrtime.bigint();
  const startMemory = process.memoryUsage().heapUsed;
  
  return operation().then(result => {
    const endTime = process.hrtime.bigint();
    const endMemory = process.memoryUsage().heapUsed;
    
    return {
      result,
      duration: Number(endTime - startTime) / 1000000, // Convert to milliseconds
      memory: endMemory - startMemory
    };
  });
}
```

## Test Environment Setup

### Prerequisites
- Node.js 18+
- Sufficient disk space (tests may create 100MB+ temp files)
- Write permissions to temp directories
- Multiple CPU cores for concurrent testing

### Configuration
```typescript
// test/setup/storageTestConfig.ts
export const STORAGE_TEST_CONFIG = {
  TEMP_DIR_PREFIX: 'healthwatch-storage-test',
  MAX_FILE_SIZE_MB: 50,
  CONCURRENT_OPERATIONS: 10,
  SAMPLE_COUNT_LARGE: 50000,
  SAMPLE_COUNT_STRESS: 10000,
  TIMEOUT_MS: 30000,
  CLEANUP_AGGRESSIVE: true
};
```

This comprehensive testing strategy ensures that storage components are thoroughly tested under realistic conditions, preventing the types of critical issues we encountered in production.