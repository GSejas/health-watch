export interface Sample {
    timestamp: number;
    success: boolean;
    latencyMs?: number;
    error?: string;
    details?: any;
}

export interface ProbeResult {
    success: boolean;
    latencyMs: number;
    error?: string;
    details?: any;
}

export interface ChannelState {
    id: string;
    state: 'online' | 'offline' | 'unknown';
    lastSample?: Sample;
    consecutiveFailures: number;
    lastStateChange: number;
    backoffMultiplier: number;
    samples: Sample[];
    firstFailureTime?: number;  // Track when current failure streak started
    // Optional legacy/aux fields used by some storage backends
    lastSuccessTime?: number;
    lastFailureTime?: number;
    totalChecks?: number;
    totalFailures?: number;
}

export interface ChannelInfo {
    id: string;
    name?: string;
    description?: string;
    type: string;
    state: 'online' | 'offline' | 'unknown';
    lastLatency?: number;
    nextProbe?: number;
    isPaused: boolean;
    isRunning?: boolean;
}

export interface WatchSession {
    id: string;
    startTime: number;
    endTime?: number;
    duration: '1h' | '12h' | 'forever' | number;
    samples: Map<string, Sample[]>;
    isActive: boolean;
    // Optional compatibility fields
    durationSetting?: string | number | null;
    sampleCount?: number;
}

export interface Outage {
    id?: string;
    channelId: string;
    startTime: number;          // Legacy: when threshold crossed (for compatibility)
    endTime?: number;
    duration?: number;          // Legacy: detected duration (for compatibility)
    reason: string;
    recoveryTime?: number;
    
    // Enhanced tracking (new fields)
    firstFailureTime?: number;  // When problems actually started
    confirmedAt?: number;       // When threshold crossed (same as startTime for new outages)
    actualDuration?: number;    // Real impact: endTime - firstFailureTime
    failureCount?: number;      // Failures before confirmation
    // Optional legacy/aux fields
    durationMs?: number;
    impact?: string;
    isResolved?: boolean;
}

export interface ChannelStats {
    channelId: string;
    availability: number;
    outageCount: number;
    mttr: number;
    longestOutage: number;
    latencyStats: {
        min: number;
        max: number;
        p50: number;
        p95: number;
        avg: number;
    };
    topFailureReason: string;
    totalSamples: number;
    successfulSamples: number;
}