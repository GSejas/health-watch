/**
 * Modular Storage Manager for Health Watch
 * 
 * Coordinates multiple storage backends and provides a unified interface.
 * Supports fallback strategies, backend health monitoring, and data migration.
 */

import * as vscode from 'vscode';
import { Sample, ChannelState, WatchSession, Outage, RawSample } from '../types';
import {
    StorageManager,
    StorageBackend,
    SampleStorage,
    StateStorage,
    SessionStorage,
    OutageStorage,
    StorageBackendInfo,
    StorageStats,
    StorageConfig
} from './StorageInterface';
import { MySQLStorage } from './MySQLStorage';
import { DiskStorageAdapter } from './DiskStorageAdapter';

export class ModularStorageManager implements StorageManager {
    private backends = new Map<string, StorageBackend>();
    private backendHealth = new Map<string, boolean>();
    private backendAssignments: {
        samples: string;
        states: string;
        sessions: string;
        outages: string;
    };
    private config: StorageConfig;
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext, config: StorageConfig) {
        this.context = context;
        this.config = config;
        this.backendAssignments = config.backends;
    }

    async initialize(): Promise<void> {
        // Register built-in backends
        await this.registerBuiltinBackends();

        // Initialize all backends
        for (const [name, backend] of this.backends) {
            try {
                await backend.initialize();
                this.backendHealth.set(name, true);
                console.log(`Storage backend '${name}' initialized successfully`);
            } catch (error) {
                console.error(`Failed to initialize storage backend '${name}':`, error);
                this.backendHealth.set(name, false);
            }
        }

        // Verify required backends are healthy
        await this.verifyBackendHealth();
    }

    private async registerBuiltinBackends(): Promise<void> {
        // File-based storage (always available as fallback)
        const diskStorage = new DiskStorageAdapter(this.context);
        this.registerBackend('disk', diskStorage);

        // MySQL storage (if configured)
        if (this.config.mysql) {
            const mysqlStorage = new MySQLStorage(this.config.mysql);
            this.registerBackend('mysql', mysqlStorage);
        }
    }

    private async verifyBackendHealth(): Promise<void> {
        const requiredBackends = Object.values(this.backendAssignments);
        const unhealthyBackends: string[] = [];

        for (const backendName of requiredBackends) {
            const isHealthy = this.backendHealth.get(backendName);
            if (!isHealthy) {
                unhealthyBackends.push(backendName);
            }
        }

        if (unhealthyBackends.length > 0) {
            // Try to fallback to disk storage for critical operations
            if (unhealthyBackends.includes(this.backendAssignments.states)) {
                console.warn('State storage backend unhealthy, falling back to disk storage');
                this.backendAssignments.states = 'disk';
            }

            if (unhealthyBackends.includes(this.backendAssignments.sessions)) {
                console.warn('Session storage backend unhealthy, falling back to disk storage');
                this.backendAssignments.sessions = 'disk';
            }

            // For samples and outages, we can continue with reduced functionality
            if (unhealthyBackends.includes(this.backendAssignments.samples)) {
                console.warn('Sample storage backend unhealthy - sample logging may be limited');
            }

            if (unhealthyBackends.includes(this.backendAssignments.outages)) {
                console.warn('Outage storage backend unhealthy - outage tracking may be limited');
            }
        }
    }

    registerBackend(name: string, backend: StorageBackend): void {
        this.backends.set(name, backend);
        this.backendHealth.set(name, false); // Will be set to true after successful initialization
    }

    setBackendForType(dataType: 'samples' | 'states' | 'sessions' | 'outages', backendName: string): void {
        if (!this.backends.has(backendName)) {
            throw new Error(`Backend '${backendName}' not registered`);
        }
        this.backendAssignments[dataType] = backendName;
    }

    getAvailableBackends(): Array<{ name: string; info: StorageBackendInfo }> {
        return Array.from(this.backends.entries()).map(([name, backend]) => ({
            name,
            info: backend.getInfo()
        }));
    }

    setBackendEnabled(backendName: string, enabled: boolean): void {
        if (!enabled) {
            // If disabling a backend, ensure we're not using it for critical operations
            Object.entries(this.backendAssignments).forEach(([dataType, assignedBackend]) => {
                if (assignedBackend === backendName) {
                    console.warn(`Backend '${backendName}' disabled but was assigned to '${dataType}', falling back to disk`);
                    this.backendAssignments[dataType as keyof typeof this.backendAssignments] = 'disk';
                }
            });
        }
        this.backendHealth.set(backendName, enabled);
    }

    private getBackendForType(dataType: 'samples' | 'states' | 'sessions' | 'outages'): StorageBackend {
        const backendName = this.backendAssignments[dataType];
        const backend = this.backends.get(backendName);
        
        if (!backend) {
            throw new Error(`Backend '${backendName}' for '${dataType}' not found`);
        }

        const isHealthy = this.backendHealth.get(backendName);
        if (!isHealthy) {
            // Try to fallback to disk storage
            const diskBackend = this.backends.get('disk');
            if (diskBackend && this.backendHealth.get('disk')) {
                console.warn(`Backend '${backendName}' unhealthy, falling back to disk for '${dataType}'`);
                return diskBackend;
            }
            throw new Error(`Backend '${backendName}' for '${dataType}' is unhealthy and no fallback available`);
        }

        return backend;
    }

    // === Sample Storage Implementation ===

    async storeSample(channelId: string, sample: RawSample): Promise<void> {
        const backend = this.getBackendForType('samples') as SampleStorage;
        return backend.storeSample(channelId, sample as any);
    }

    async storeSamples(samples: Array<{ channelId: string; sample: RawSample }>): Promise<void> {
        const backend = this.getBackendForType('samples') as SampleStorage;
        return backend.storeSamples(samples as any);
    }

    async getSamples(channelId: string, startTime: number, endTime: number): Promise<Sample[]> {
        const backend = this.getBackendForType('samples') as SampleStorage;
        return backend.getSamples(channelId, startTime, endTime);
    }

    async getRecentSamples(channelId: string, count: number): Promise<Sample[]> {
        const backend = this.getBackendForType('samples') as SampleStorage;
        return backend.getRecentSamples(channelId, count);
    }

    async cleanupSamples(olderThanMs: number): Promise<number> {
        const backend = this.getBackendForType('samples') as SampleStorage;
        return backend.cleanupSamples(olderThanMs);
    }

    // === State Storage Implementation ===

    async getChannelState(channelId: string): Promise<ChannelState | undefined> {
        const backend = this.getBackendForType('states') as StateStorage;
        return backend.getChannelState(channelId);
    }

    async setChannelState(channelId: string, state: Partial<ChannelState>): Promise<void> {
        const backend = this.getBackendForType('states') as StateStorage;
        return backend.setChannelState(channelId, state as any);
    }

    async getAllChannelStates(): Promise<Map<string, ChannelState>> {
        const backend = this.getBackendForType('states') as StateStorage;
        return backend.getAllChannelStates();
    }

    async removeChannelState(channelId: string): Promise<void> {
        const backend = this.getBackendForType('states') as StateStorage;
        return backend.removeChannelState(channelId);
    }

    // === Session Storage Implementation ===

    async startWatchSession(session: WatchSession): Promise<void> {
        const backend = this.getBackendForType('sessions') as SessionStorage;
        return backend.startWatchSession(session);
    }

    async updateWatchSession(session: WatchSession): Promise<void> {
        const backend = this.getBackendForType('sessions') as SessionStorage;
        return backend.updateWatchSession(session);
    }

    async endWatchSession(): Promise<void> {
        const backend = this.getBackendForType('sessions') as SessionStorage;
        return backend.endWatchSession();
    }

    async getCurrentWatchSession(): Promise<WatchSession | undefined> {
        const backend = this.getBackendForType('sessions') as SessionStorage;
        return backend.getCurrentWatchSession();
    }

    async getWatchHistory(limit?: number): Promise<WatchSession[]> {
        const backend = this.getBackendForType('sessions') as SessionStorage;
        return backend.getWatchHistory(limit);
    }

    // === Outage Storage Implementation ===

    async recordOutage(outage: Outage): Promise<void> {
        const backend = this.getBackendForType('outages') as OutageStorage;
        return backend.recordOutage(outage);
    }

    async getOutages(channelId?: string, startTime?: number, endTime?: number): Promise<Outage[]> {
        const backend = this.getBackendForType('outages') as OutageStorage;
        return backend.getOutages(channelId, startTime, endTime);
    }

    async updateOutage(outageId: string, updates: Partial<Outage>): Promise<void> {
        const backend = this.getBackendForType('outages') as OutageStorage;
        return backend.updateOutage(outageId, updates);
    }

    // === Storage Management ===

    async getStorageStats(): Promise<StorageStats> {
        const stats: StorageStats = {
            totalSamples: 0,
            totalChannels: 0,
            totalOutages: 0,
            totalSessions: 0,
            storageSize: 0,
            backends: []
        };

        // Collect stats from all backends
        for (const [name, backend] of this.backends) {
            const isHealthy = this.backendHealth.get(name) || false;
            
            let recordCount = 0;
            let lastError: string | undefined;

            try {
                if (isHealthy) {
                    // Try to get some basic stats
                    if (name === this.backendAssignments.states) {
                        const states = await (backend as StateStorage).getAllChannelStates();
                        stats.totalChannels = states.size;
                        recordCount += states.size;
                    }

                    if (name === this.backendAssignments.sessions) {
                        const sessions = await (backend as SessionStorage).getWatchHistory(1000);
                        stats.totalSessions = sessions.length;
                        recordCount += sessions.length;
                    }

                    if (name === this.backendAssignments.outages) {
                        const outages = await (backend as OutageStorage).getOutages();
                        stats.totalOutages = outages.length;
                        recordCount += outages.length;
                    }
                }
            } catch (error) {
                lastError = error instanceof Error ? error.message : String(error);
                this.backendHealth.set(name, false);
            }

            stats.backends.push({
                name,
                isHealthy: this.backendHealth.get(name) || false,
                lastError,
                recordCount
            });
        }

        return stats;
    }

    async healthCheck(): Promise<boolean> {
        let allHealthy = true;

        for (const [name, backend] of this.backends) {
            try {
                const isHealthy = await backend.healthCheck();
                this.backendHealth.set(name, isHealthy);
                if (!isHealthy) {
                    allHealthy = false;
                }
            } catch (error) {
                console.error(`Health check failed for backend '${name}':`, error);
                this.backendHealth.set(name, false);
                allHealthy = false;
            }
        }

        return allHealthy;
    }

    async close(): Promise<void> {
        for (const [name, backend] of this.backends) {
            try {
                await backend.close();
            } catch (error) {
                console.error(`Error closing backend '${name}':`, error);
            }
        }
    }

    getInfo(): StorageBackendInfo {
        return {
            name: 'Modular Storage Manager',
            type: 'remote', // Manager coordinates multiple types
            version: '1.0.0',
            isSecure: true,
            supportsTransactions: true,
            maxRetentionDays: this.config.retentionDays
        };
    }

    // initialize implemented above
}