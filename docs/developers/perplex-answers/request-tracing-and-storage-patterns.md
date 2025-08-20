# Request Tracing & Storage Patterns Analysis

## Executive Summary
Analysis of how industry-leading observability tools handle individual request tracing, storage optimization, and historical analysis. Includes specific recommendations for HealthWatch's request-level observability implementation.

## Request Tracing Fundamentals

### Industry Standard Trace Model
Modern observability platforms use **distributed tracing** concepts even for single-service monitoring:

```typescript
interface TraceContext {
  traceId: string;          // 128-bit unique identifier (16 bytes)
  spanId: string;           // 64-bit span identifier (8 bytes)  
  parentSpanId?: string;    // Parent span reference
  flags: number;            // Sampling flags, debug mode
  baggage?: Record<string, string>; // Cross-cutting context
}

interface Span {
  context: TraceContext;
  operationName: string;    // "HTTP GET /api/health"
  startTime: number;        // High-precision timestamp (nanoseconds)
  duration: number;         // Execution time (nanoseconds)
  
  // Status classification
  status: {
    code: 'OK' | 'ERROR' | 'TIMEOUT' | 'CANCELLED';
    message?: string;
  };
  
  // Request details
  attributes: {
    // HTTP-specific
    'http.method'?: string;
    'http.url'?: string; 
    'http.status_code'?: number;
    'http.user_agent'?: string;
    
    // Network-specific  
    'net.peer.ip'?: string;
    'net.peer.port'?: number;
    'net.transport'?: 'tcp' | 'udp';
    
    // DNS-specific
    'dns.question.name'?: string;
    'dns.question.type'?: string;
    'dns.response.code'?: number;
    
    // Custom attributes
    [key: string]: string | number | boolean;
  };
  
  // Events within span (for errors, retries, etc.)
  events: Array<{
    timestamp: number;
    name: string;           // "exception", "retry_attempt"  
    attributes: Record<string, any>;
  }>;
  
  // Resource information
  resource: {
    'service.name': string;
    'service.version'?: string;
    'deployment.environment'?: string;
    'host.name'?: string;
  };
}
```

### Request Storage Optimization Patterns

#### 1. Tiered Storage Strategy (Datadog/New Relic Pattern)
```typescript
interface StorageTier {
  name: string;
  retentionPeriod: string;  // "1h", "24h", "7d", "30d", "1y"
  samplingRate: number;     // 1.0 = 100%, 0.1 = 10%
  
  // What data to store at this tier
  includeSuccessfulRequests: boolean;
  includeErrorRequests: boolean;
  includeSlowRequests: boolean; // Above threshold
  
  // Compression/aggregation  
  aggregationLevel: 'raw' | 'minute' | 'hour' | 'day';
  compressionEnabled: boolean;
  
  // Storage backend
  storageType: 'memory' | 'sqlite' | 'file' | 'external';
}

// Example tiered configuration
const STORAGE_TIERS: StorageTier[] = [
  {
    name: 'recent_detailed',
    retentionPeriod: '1h',
    samplingRate: 1.0,       // Keep everything recent
    includeSuccessfulRequests: true,
    includeErrorRequests: true, 
    includeSlowRequests: true,
    aggregationLevel: 'raw',
    compressionEnabled: false,
    storageType: 'memory'
  },
  {
    name: 'daily_sampled',
    retentionPeriod: '24h', 
    samplingRate: 0.1,       // Sample 10% of successful requests
    includeSuccessfulRequests: true,
    includeErrorRequests: true,   // Always keep errors
    includeSlowRequests: true,    // Always keep slow requests  
    aggregationLevel: 'raw',
    compressionEnabled: true,
    storageType: 'sqlite'
  },
  {
    name: 'weekly_aggregated',
    retentionPeriod: '7d',
    samplingRate: 0.01,      // 1% sample for long-term trends
    includeSuccessfulRequests: false, // Only errors and aggregates
    includeErrorRequests: true,
    includeSlowRequests: true,
    aggregationLevel: 'minute',
    compressionEnabled: true, 
    storageType: 'sqlite'
  }
];
```

#### 2. Adaptive Sampling (Jaeger/Datadog Pattern)
```typescript
interface SamplingStrategy {
  // Default sampling for all services
  defaultSamplingRate: number;  // 0.1 = 10%
  
  // Per-service overrides
  serviceOverrides: Record<string, number>;
  
  // Dynamic sampling based on request characteristics
  rules: Array<{
    condition: {
      attributeKey: string;
      operator: 'equals' | 'contains' | 'greater_than';
      value: string | number;
    };
    samplingRate: number;
  }>;
  
  // Error and slow request handling
  alwaysSampleErrors: boolean;
  alwaysSampleSlowRequests: boolean;
  slowRequestThreshold: number; // milliseconds
  
  // Rate limiting to prevent storage overflow
  maxTracesPerSecond: number;
}

// Example: Always sample errors, 1% of successful requests
const SAMPLING_CONFIG: SamplingStrategy = {
  defaultSamplingRate: 0.01,
  serviceOverrides: {
    'critical-api': 0.1,      // Sample 10% of critical service
    'health-checks': 0.001    // Very low sampling for noisy health checks
  },
  rules: [
    {
      condition: { attributeKey: 'http.status_code', operator: 'greater_than', value: 399 },
      samplingRate: 1.0       // Always sample errors (4xx, 5xx)
    },
    {
      condition: { attributeKey: 'duration_ms', operator: 'greater_than', value: 1000 },
      samplingRate: 1.0       // Always sample slow requests (>1s)
    }
  ],
  alwaysSampleErrors: true,
  alwaysSampleSlowRequests: true,
  slowRequestThreshold: 1000,
  maxTracesPerSecond: 100
};
```

### Request Context & Correlation

#### 1. Cross-Request Correlation
```typescript
interface RequestCorrelation {
  // Primary identifiers
  traceId: string;              // Groups related operations
  userId?: string;              // User session tracking
  sessionId?: string;           // Browser/app session
  
  // Business context
  tenantId?: string;            // Multi-tenant isolation
  featureFlag?: string;         // A/B testing context
  deploymentVersion?: string;   // Code version tracking
  
  // Request chain tracking  
  upstreamTraceId?: string;     // Request that triggered this
  downstreamTraceIds: string[]; // Requests triggered by this
  
  // Temporal correlation
  requestBatch?: string;        // Grouped requests (e.g., health check sweep)
  maintenanceWindow?: string;   // Active maintenance period
}
```

#### 2. Request Timeline Reconstruction
```typescript
interface RequestTimeline {
  traceId: string;
  
  // Request phases with precise timing
  phases: Array<{
    name: string;               // "dns_lookup", "tcp_connect", "tls_handshake", "request_sent", "response_received"
    startOffset: number;        // Nanoseconds from request start
    duration: number;           // Nanoseconds
    attributes?: Record<string, any>;
  }>;
  
  // Network-level details
  networkInfo: {
    localIP?: string;
    remoteIP?: string;
    protocol: string;           // "HTTP/1.1", "HTTP/2", "TCP", "UDP"
    tlsVersion?: string;        // "TLSv1.3"
    cipherSuite?: string;
  };
  
  // Retry/circuit breaker information
  attempts: Array<{
    attemptNumber: number;
    outcome: 'success' | 'failure' | 'timeout' | 'circuit_open';
    duration: number;
    errorDetails?: string;
  }>;
}
```

## Storage Schema Design

### SQLite Schema for Request Storage
```sql
-- Main requests table (optimized for time-series queries)
CREATE TABLE requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trace_id TEXT NOT NULL,
    span_id TEXT NOT NULL,
    parent_span_id TEXT,
    
    -- Timing (stored as integer nanoseconds for precision)
    start_time_ns INTEGER NOT NULL,
    duration_ns INTEGER NOT NULL,
    
    -- Request classification
    service_name TEXT NOT NULL,
    operation_name TEXT NOT NULL,
    status_code TEXT NOT NULL, -- 'OK', 'ERROR', 'TIMEOUT'
    
    -- Quick filtering columns  
    is_error BOOLEAN NOT NULL DEFAULT FALSE,
    is_slow BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- JSON storage for flexible attributes
    attributes TEXT, -- JSON blob
    events TEXT,     -- JSON array of events
    resource TEXT,   -- JSON blob
    
    -- Indexing aids
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    retention_tier TEXT DEFAULT 'raw'
);

-- Indexes for fast time-series queries
CREATE INDEX idx_requests_start_time ON requests(start_time_ns);
CREATE INDEX idx_requests_service_time ON requests(service_name, start_time_ns);
CREATE INDEX idx_requests_trace_id ON requests(trace_id);
CREATE INDEX idx_requests_errors ON requests(is_error, start_time_ns) WHERE is_error = TRUE;
CREATE INDEX idx_requests_slow ON requests(is_slow, start_time_ns) WHERE is_slow = TRUE;

-- Pre-aggregated metrics table for fast dashboard queries
CREATE TABLE metric_rollups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_name TEXT NOT NULL,
    time_bucket INTEGER NOT NULL,  -- Unix timestamp rounded to bucket size
    bucket_size_seconds INTEGER NOT NULL, -- 60, 300, 3600, etc.
    
    -- Aggregated metrics
    request_count INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    slow_count INTEGER NOT NULL DEFAULT 0,
    
    -- Latency percentiles (stored as integer microseconds)
    latency_p50_us INTEGER,
    latency_p90_us INTEGER, 
    latency_p95_us INTEGER,
    latency_p99_us INTEGER,
    latency_max_us INTEGER,
    
    -- Additional metrics
    bytes_sent INTEGER DEFAULT 0,
    bytes_received INTEGER DEFAULT 0,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(service_name, time_bucket, bucket_size_seconds)
);

CREATE INDEX idx_metric_rollups_service_time ON metric_rollups(service_name, time_bucket);
CREATE INDEX idx_metric_rollups_bucket ON metric_rollups(bucket_size_seconds, time_bucket);
```

### Retention and Cleanup Patterns
```typescript
interface RetentionPolicy {
  // Age-based retention
  retentionRules: Array<{
    maxAge: string;           // "1h", "24h", "7d", "30d"
    conditions?: {
      statusCodes?: string[]; // Only apply to specific status codes
      services?: string[];    // Only apply to specific services
      samplingRate?: number;  // Aggressively sample before deletion
    };
  }>;
  
  // Size-based retention  
  maxStorageSize: string;     // "100MB", "1GB"
  
  // Cleanup schedule
  cleanupInterval: string;    // "1h", "6h", "24h"
  
  // Archive options
  archiveBeforeDelete: boolean;
  archiveLocation?: string;   // File path for export before deletion
}

// Example retention configuration
const RETENTION_POLICY: RetentionPolicy = {
  retentionRules: [
    {
      maxAge: '1h',           // Keep all data for 1 hour
    },
    {
      maxAge: '24h',          // Keep sampled data for 24 hours
      conditions: {
        samplingRate: 0.1     // Keep only 10% of successful requests
      }
    },
    {
      maxAge: '7d',           // Keep errors and slow requests for 7 days
      conditions: {
        statusCodes: ['ERROR', 'TIMEOUT'],
        samplingRate: 1.0     // Keep all errors/timeouts
      }
    }
  ],
  maxStorageSize: '500MB',
  cleanupInterval: '1h',
  archiveBeforeDelete: true,
  archiveLocation: './logs/archived'
};
```

## Request Analysis Patterns

### 1. Request Flow Analysis
```typescript
interface RequestFlowAnalysis {
  // Identify request patterns
  identifyRequestChains(traceIds: string[]): Array<{
    rootTraceId: string;
    chainLength: number;
    totalDuration: number;
    bottleneckService: string;
    errorCascades: boolean;
  }>;
  
  // Find slow request root causes
  analyzeSlowRequests(threshold: number): Array<{
    traceId: string;
    slowestPhase: string;
    contributingFactors: string[];
    similarIncidents: number;
  }>;
  
  // Detect anomalous patterns
  detectAnomalies(): Array<{
    pattern: string;          // "unusual_error_rate", "latency_spike", "cascade_failure"
    affectedServices: string[];
    timeRange: { start: number; end: number };
    severity: 'low' | 'medium' | 'high';
  }>;
}
```

### 2. Cross-Service Impact Analysis  
```typescript
interface ImpactAnalysis {
  // Calculate blast radius of incidents
  calculateBlastRadius(incidentTraceId: string): {
    primaryService: string;
    affectedServices: string[];
    affectedRequestCount: number;
    errorPropagation: Array<{
      fromService: string;
      toService: string;
      errorRate: number;
    }>;
  };
  
  // Find correlated failures
  findCorrelatedFailures(timeWindow: number): Array<{
    services: string[];
    correlationStrength: number;
    commonFailurePatterns: string[];
  }>;
}
```

## Recommendations for HealthWatch Implementation

### Phase 1: Basic Request Tracing
1. **Implement TraceContext** - Add trace/span IDs to all requests
2. **Structured Storage** - Replace JSON files with SQLite schema  
3. **Request Timeline** - Capture detailed timing information
4. **Basic Correlation** - Link related requests with trace IDs

### Phase 2: Advanced Storage Optimization
1. **Tiered Storage** - Implement retention tiers with different sampling
2. **Pre-aggregated Metrics** - Store rollups for fast dashboard queries
3. **Adaptive Sampling** - Smart sampling based on request characteristics
4. **Efficient Cleanup** - Automated retention policy enforcement

### Phase 3: Request Analysis Features
1. **Flow Visualization** - Show request chains and dependencies
2. **Anomaly Detection** - Identify unusual patterns automatically  
3. **Impact Analysis** - Calculate blast radius of incidents
4. **Request Search** - Full-text search across request attributes

### Implementation Priority for Current HealthWatch Concerns

**Immediate (addresses your deployment monitoring concerns):**
- Add maintenance window support with alert suppression
- Implement "how long has it been offline" tracking
- Create adaptive monitoring cadence (reduce frequency during stable periods)

**Short-term (improves observability):**
- Replace JSON storage with SQLite for better querying
- Add request correlation to see failure patterns
- Implement configurable retention policies

**Medium-term (enterprise features):**
- Add request flow visualization
- Implement anomaly detection for "fishy" patterns
- Create business impact correlation

This request tracing foundation will transform HealthWatch from basic uptime monitoring into comprehensive request-level observability.