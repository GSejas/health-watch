# Health Watch - Data Entities and Storage Analysis

## Entity Definitions

### Core Data Entities

#### Sample
**Purpose**: Represents a single probe execution result with normalized timestamp and success status.

```typescript
interface Sample {
    timestamp: number;        // Unix timestamp in milliseconds
    success: boolean;         // Probe success status
    latencyMs?: number;       // Response time in milliseconds
    error?: string;           // Error description if failed
    details?: any;            // Additional probe-specific data
}
```

**Legacy Fields**: `t` (timestamp), `ok` (success)  
**Creation Points**:
- `src/storage.ts:150-160` - `addSample()` method
- `src/runner/channelRunner.ts` - Probe result conversion
- `src/storage/MySQLStorage.ts:240-260` - Database normalization

**Storage Mapping**:
- **MySQL**: `health_samples` table with `is_success` boolean column
- **Disk**: Embedded in `ChannelState.samples` array in `channelStates.json`

#### ChannelState
**Purpose**: Maintains runtime state for each monitored channel including recent samples and failure tracking.

```typescript
interface ChannelState {
    id: string;                     // Unique channel identifier
    state: 'online'|'offline'|'unknown'; // Current status
    lastSample?: Sample;            // Most recent probe result
    consecutiveFailures: number;    // Failure streak counter
    lastStateChange: number;        // Timestamp of last state transition
    backoffMultiplier: number;      // Current backoff factor
    samples: Sample[];              // Recent sample history (bounded)
    firstFailureTime?: number;      // Start of current failure streak
}
```

**Legacy Fields**: `lastSuccessTime`, `lastFailureTime`, `totalChecks`, `totalFailures`  
**Creation Points**:
- `src/storage.ts:126-140` - `getChannelState()` default creation
- `src/storage/MySQLStorage.ts:276-298` - Database state reconstruction

**Storage Mapping**:
- **MySQL**: `channel_states` table with summary fields only
- **Disk**: Full object serialization in `channelStates.json`

#### WatchSession
**Purpose**: Tracks monitoring sessions with collected samples across all channels.

```typescript
interface WatchSession {
    id: string;                          // Unique session identifier
    startTime: number;                   // Session start timestamp
    endTime?: number;                    // Session end timestamp (if completed)
    duration: '1h'|'12h'|'forever'|number; // Configured duration
    samples: Map<string, Sample[]>;      // Per-channel sample collections
    isActive: boolean;                   // Whether session is currently running
}
```

**Legacy Fields**: `durationSetting`, `sampleCount`  
**Creation Points**:
- `src/storage.ts:171-187` - `startWatch()` method
- `src/storage.ts:189-212` - `endWatch()` archival

**Storage Mapping**:
- **MySQL**: `watch_sessions` table with metadata only (samples stored separately)
- **Disk**: `currentWatch.json` for active session, `watchHistory.json` for archive

#### Outage
**Purpose**: Records service outages with enhanced impact tracking and legacy compatibility.

```typescript
interface Outage {
    id?: string;                    // Unique outage identifier
    channelId: string;              // Affected channel
    startTime: number;              // Legacy: confirmation timestamp
    endTime?: number;               // Recovery timestamp
    reason: string;                 // Failure categorization
    firstFailureTime?: number;      // Actual impact start time
    confirmedAt?: number;           // Threshold crossed timestamp
    actualDuration?: number;        // Real impact: endTime - firstFailureTime
    failureCount?: number;          // Failures before confirmation
}
```

**Legacy Fields**: `duration`, `durationMs`, `impact`, `isResolved`  
**Creation Points**:
- `src/storage.ts:226-237` - `addOutage()` method
- `src/runner/channelRunner.ts` - Outage detection logic

**Storage Mapping**:
- **MySQL**: `outages` table with all fields persisted
- **Disk**: Array serialization in `outages.json`

### Supporting Entities

#### ProbeResult
**Purpose**: Transient result from probe execution before normalization to Sample.

```typescript
interface ProbeResult {
    success: boolean;      // Probe execution success
    latencyMs: number;     // Response time measurement
    error?: string;        // Error details if failed
    details?: any;         // Probe-specific metadata
}
```

**Usage**: Produced by probe implementations, consumed by ChannelRunner for Sample creation.

#### ChannelInfo
**Purpose**: Channel metadata and current status for UI display.

```typescript
interface ChannelInfo {
    id: string;                              // Channel identifier
    name?: string;                           // Display name
    type: string;                            // Probe type (https, tcp, dns, script)
    state: 'online'|'offline'|'unknown';     // Current status
    isPaused: boolean;                       // Whether monitoring is paused
    isRunning?: boolean;                     // Whether probe is executing
}
```

**Usage**: Derived from configuration and runtime state for dashboard display.

## Storage Architecture

### In-Memory Storage (StorageManager)

**Location**: `src/storage.ts`  
**Purpose**: Canonical runtime state cache with fast access patterns

**Managed Data**:
- `channelStates: Map<string, ChannelState>` - Per-channel runtime state
- `currentWatch: WatchSession | null` - Active monitoring session
- `watchHistory: WatchSession[]` - Completed session archive (bounded)
- `outages: Outage[]` - Recent outage records (bounded)

**Key Methods**:
- `getChannelState(id)` - Retrieves or creates default channel state
- `addSample(channelId, sample)` - Appends sample and triggers persistence
- `startWatch(duration)` - Creates new monitoring session
- `endWatch()` - Archives current session and clears active state

**Persistence Strategy**: Fire-and-forget writes to configured backend

### File-Based Storage (DiskStorageManager)

**Location**: `src/diskStorage.ts`  
**Purpose**: JSON file persistence for local deployments

**File Structure**:
```
<VS Code Global Storage>/
├── channelStates.json    # Map<string, ChannelState> serialized
├── currentWatch.json     # Active WatchSession or null
├── watchHistory.json     # WatchSession[] archive
├── outages.json          # Outage[] records
└── custom_*.json         # Extension custom data
```

**Key Features**:
- Atomic file writes with error recovery
- Bounded collections (100 watch sessions, 500 outages)
- Migration from VS Code GlobalState
- Automatic cleanup of old records

**Limitations**:
- No historical sample querying (samples embedded in ChannelState)
- Synchronous file I/O can block extension
- No transactional consistency across files

### Database Storage (MySQLStorage)

**Location**: `src/storage/MySQLStorage.ts`  
**Purpose**: Scalable structured storage for production deployments

**Table Schema**:

```sql
-- Individual probe samples with full history
CREATE TABLE health_samples (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    channel_id VARCHAR(255) NOT NULL,
    timestamp BIGINT NOT NULL,
    is_success BOOLEAN NOT NULL,
    latency_ms INT NULL,
    status_code INT NULL,
    reason ENUM('timeout','dns','tcp','tls','http','script') NULL,
    note TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_channel_timestamp (channel_id, timestamp)
);

-- Channel state summaries
CREATE TABLE channel_states (
    channel_id VARCHAR(255) PRIMARY KEY,
    state ENUM('online','offline','unknown') NOT NULL,
    last_sample_timestamp BIGINT NULL,
    consecutive_failures INT DEFAULT 0,
    last_success_timestamp BIGINT NULL,
    last_failure_timestamp BIGINT NULL,
    total_checks INT DEFAULT 0,
    total_failures INT DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Monitoring session metadata
CREATE TABLE watch_sessions (
    id VARCHAR(255) PRIMARY KEY,
    start_time BIGINT NOT NULL,
    end_time BIGINT NULL,
    duration_setting VARCHAR(50) NULL,
    is_active BOOLEAN DEFAULT true,
    sample_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Outage tracking with impact analysis
CREATE TABLE outages (
    id VARCHAR(255) PRIMARY KEY,
    channel_id VARCHAR(255) NOT NULL,
    start_time BIGINT NOT NULL,
    end_time BIGINT NULL,
    duration_ms BIGINT NULL,
    reason VARCHAR(255) NULL,
    impact VARCHAR(50) NULL,
    is_resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Key Features**:
- Full sample history with efficient querying
- Proper indexing for time-based queries
- ENUM constraints for data integrity
- Batch operations for performance

**Mapping Considerations**:
- `Sample.success` ↔ `health_samples.is_success` (boolean conversion)
- `Sample.error` ↔ `health_samples.reason` (ENUM validation required)
- `ChannelState.samples` - Not stored in DB (use separate queries)

## Data Flow Patterns

### Sample Ingestion Flow
1. **Probe Execution**: Probe returns `ProbeResult`
2. **Normalization**: ChannelRunner converts to `Sample` with timestamp
3. **State Update**: StorageManager updates `ChannelState.samples` and `lastSample`
4. **Watch Integration**: If active watch, append to `WatchSession.samples`
5. **Persistence**: Background write to disk/database

### Dashboard Data Retrieval
1. **Request**: Dashboard requests channel data
2. **Memory Access**: StorageManager provides `ChannelState` from cache
3. **Window Query**: `getSamplesInWindow()` filters by timestamp range
4. **UI Serialization**: Convert Map structures to plain objects for webview

### Outage Lifecycle
1. **Detection**: ChannelRunner tracks consecutive failures
2. **Confirmation**: Threshold crossed, create `Outage` with impact tracking
3. **Recording**: StorageManager persists to backend
4. **Recovery**: First success triggers `updateOutage()` with duration calculation
5. **Analysis**: Dashboard computes MTTR and availability metrics

## Data Consistency and Reliability

### Current Issues
- **Race Conditions**: Async `loadState()` in constructor not awaited
- **Lost Writes**: Fire-and-forget persistence may fail silently
- **Incomplete Mapping**: MySQL ENUM violations on arbitrary error text
- **Sample History**: Disk storage doesn't maintain queryable sample history

### Recommended Improvements
1. **Initialization Safety**: Make `StorageManager.initialize()` async and await state loading
2. **Write Reliability**: Implement write queuing with retry and error handling
3. **Data Validation**: Sanitize ENUM values before database writes
4. **Historical Queries**: Add sample log files or improve DB query patterns

---

*Generated on: August 19, 2025*  
*Source Analysis: TypeScript symbol analysis and code review*  
*Coverage: Core entities, storage patterns, and data flow architecture*
