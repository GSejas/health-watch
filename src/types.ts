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
}

export interface Outage {
    channelId: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    reason: string;
    recoveryTime?: number;
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