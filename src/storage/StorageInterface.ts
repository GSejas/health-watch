/**
 * Extensible, modular storage interface for Health Watch
 * 
 * This interface defines the contract for different storage backends:
 * - File-based storage (current implementation)
 * - MySQL storage (for robust logging)
 * - SQLite storage (lightweight alternative)
 * - Remote storage (future: cloud sync)
 */

import { Sample, ChannelState, WatchSession, Outage } from '../types';

export interface StorageBackend {
    /**
     * Initialize the storage backend
     */
    initialize(): Promise<void>;

    /**
     * Close/cleanup the storage backend
     */
    close(): Promise<void>;

    /**
     * Test if the storage backend is available and working
     */
    healthCheck(): Promise<boolean>;

    /**
     * Get configuration/status info about this storage backend
     */
    getInfo(): StorageBackendInfo;
}

export interface StorageBackendInfo {
    name: string;
    type: 'file' | 'mysql' | 'sqlite' | 'remote';
    version: string;
    isSecure: boolean;
    supportsTransactions: boolean;
    maxRetentionDays?: number;
    connectionString?: string; // For logging/debug only - no credentials
}

export interface SampleStorage extends StorageBackend {
    /**
     * Store a health sample
     */
    storeSample(channelId: string, sample: Sample): Promise<void>;

    /**
     * Store multiple samples in batch (more efficient)
     */
    storeSamples(samples: Array<{ channelId: string; sample: Sample }>): Promise<void>;

    /**
     * Get samples for a channel in time range
     */
    getSamples(channelId: string, startTime: number, endTime: number): Promise<Sample[]>;

    /**
     * Get recent samples (last N samples)
     */
    getRecentSamples(channelId: string, count: number): Promise<Sample[]>;

    /**
     * Clean up old samples (retention management)
     */
    cleanupSamples(olderThanMs: number): Promise<number>; // Returns count of deleted samples
}

export interface StateStorage extends StorageBackend {
    /**
     * Get current state for a channel
     */
    getChannelState(channelId: string): Promise<ChannelState | undefined>;

    /**
     * Set channel state
     */
    setChannelState(channelId: string, state: ChannelState): Promise<void>;

    /**
     * Get all channel states
     */
    getAllChannelStates(): Promise<Map<string, ChannelState>>;

    /**
     * Remove a channel's state
     */
    removeChannelState(channelId: string): Promise<void>;
}

export interface SessionStorage extends StorageBackend {
    /**
     * Start a new watch session
     */
    startWatchSession(session: WatchSession): Promise<void>;

    /**
     * Update current watch session
     */
    updateWatchSession(session: WatchSession): Promise<void>;

    /**
     * End the current watch session
     */
    endWatchSession(): Promise<void>;

    /**
     * Get current watch session
     */
    getCurrentWatchSession(): Promise<WatchSession | undefined>;

    /**
     * Get watch session history
     */
    getWatchHistory(limit?: number): Promise<WatchSession[]>;
}

export interface OutageStorage extends StorageBackend {
    /**
     * Record an outage
     */
    recordOutage(outage: Outage): Promise<void>;

    /**
     * Get outages for a channel in time range
     */
    getOutages(channelId?: string, startTime?: number, endTime?: number): Promise<Outage[]>;

    /**
     * Update an outage (e.g., when it ends)
     */
    updateOutage(outageId: string, updates: Partial<Outage>): Promise<void>;
}

/**
 * Security/access control interface for storage backends
 */
export interface StorageSecurity {
    /**
     * Encrypt sensitive data before storage
     */
    encrypt(data: string): Promise<string>;

    /**
     * Decrypt data after retrieval
     */
    decrypt(encryptedData: string): Promise<string>;

    /**
     * Generate secure credentials for storage access
     */
    generateCredentials(): Promise<StorageCredentials>;

    /**
     * Validate storage access permissions
     */
    validateAccess(credentials: StorageCredentials): Promise<boolean>;
}

export interface StorageCredentials {
    username?: string;
    password?: string;
    connectionString?: string;
    keyFile?: string;
    expiresAt?: number;
}

/**
 * Main storage manager that coordinates multiple backends
 */
export interface StorageManager extends SampleStorage, StateStorage, SessionStorage, OutageStorage {
    /**
     * Register a storage backend
     */
    registerBackend(name: string, backend: StorageBackend): void;

    /**
     * Set which backend to use for which data type
     */
    setBackendForType(dataType: 'samples' | 'states' | 'sessions' | 'outages', backendName: string): void;

    /**
     * Get list of available backends
     */
    getAvailableBackends(): Array<{ name: string; info: StorageBackendInfo }>;

    /**
     * Enable/disable a specific backend
     */
    setBackendEnabled(backendName: string, enabled: boolean): void;

    /**
     * Get storage statistics
     */
    getStorageStats(): Promise<StorageStats>;
}

export interface StorageStats {
    totalSamples: number;
    totalChannels: number;
    totalOutages: number;
    totalSessions: number;
    oldestSample?: number;
    newestSample?: number;
    storageSize: number; // bytes
    backends: Array<{
        name: string;
        isHealthy: boolean;
        lastError?: string;
        recordCount: number;
    }>;
}

/**
 * Configuration for storage backends
 */
export interface StorageConfig {
    // Default retention period in days
    retentionDays: number;
    
    // Which backend to use for each data type
    backends: {
        samples: string;
        states: string;
        sessions: string;
        outages: string;
    };

    // MySQL specific config
    mysql?: {
        host: string;
        port: number;
        database: string;
        username: string;
        password?: string; // Should be stored securely
        ssl?: boolean;
        maxConnections?: number;
        retryAttempts?: number;
    };

    // File storage config
    file?: {
        directory: string;
        maxFileSize: number; // bytes
        compressionEnabled: boolean;
    };

    // Security settings
    security?: {
        encryptionEnabled: boolean;
        credentialStore: 'vscode' | 'keychain' | 'file';
    };
}