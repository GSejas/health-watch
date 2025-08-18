import * as vscode from 'vscode';
import { Sample, ChannelState, WatchSession, Outage } from './types';

/**
 * Manages persistent storage for the Health Watch extension.
 * 
 * This class implements the singleton pattern to provide a centralized storage
 * management solution. It handles the persistence, retrieval, and manipulation of:
 * - Channel health states
 * - Health samples
 * - Watch sessions (real-time monitoring periods)
 * - Outage records
 * 
 * All data is stored in VS Code's extension global state and automatically
 * persisted across sessions.
 * 
 * @example
 * // Initialize in extension activation
 * const storage = StorageManager.initialize(context);
 * 
 * // Access the instance elsewhere
 * const storage = StorageManager.getInstance();
 * 
 * // Get channel state
 * const channelState = storage.getChannelState('my-channel');
 * 
 * // Start a monitoring session
 * storage.startWatch('1h');
 */
export class StorageManager {
    private static instance: StorageManager;
    private context: vscode.ExtensionContext;
    private channelStates = new Map<string, ChannelState>();
    private currentWatch: WatchSession | null = null;
    private watchHistory: WatchSession[] = [];
    private outages: Outage[] = [];

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.loadState();
    }

    static initialize(context: vscode.ExtensionContext): StorageManager {
        if (!StorageManager.instance) {
            StorageManager.instance = new StorageManager(context);
        }
        return StorageManager.instance;
    }

    static getInstance(): StorageManager {
        if (!StorageManager.instance) {
            throw new Error('StorageManager not initialized. Call initialize() first.');
        }
        return StorageManager.instance;
    }

    private async loadState() {
        try {
            const channelStatesData = this.context.globalState.get<Record<string, ChannelState>>('healthWatch.channelStates', {});
            for (const [id, state] of Object.entries(channelStatesData)) {
                this.channelStates.set(id, state);
            }

            this.currentWatch = this.context.globalState.get<WatchSession | null>('healthWatch.currentWatch', null);
            if (this.currentWatch?.samples) {
                this.currentWatch.samples = new Map(Object.entries(this.currentWatch.samples as any));
            }

            this.watchHistory = this.context.globalState.get<WatchSession[]>('healthWatch.watchHistory', []);
            this.outages = this.context.globalState.get<Outage[]>('healthWatch.outages', []);
        } catch (error) {
            console.error('Failed to load storage state:', error);
        }
    }

    /**
     * Persists the health watch state to the extension's global storage.
     * 
     * This method saves the following state data:
     * - Channel states (converted from Map to object)
     * - Current active watch data (if exists), with samples converted from Map to object
     * - Watch history records
     * - Outage records
     * 
     * @private
     * @async
     * @throws {Error} Errors are caught and logged but not propagated
     * @returns {Promise<void>} A promise that resolves when the state has been saved
     */
    private async saveState() {
        try {
            const channelStatesData = Object.fromEntries(this.channelStates.entries());
            await this.context.globalState.update('healthWatch.channelStates', channelStatesData);

            let currentWatchData = null;
            if (this.currentWatch) {
                currentWatchData = {
                    ...this.currentWatch,
                    samples: Object.fromEntries(this.currentWatch.samples.entries())
                };
            }
            await this.context.globalState.update('healthWatch.currentWatch', currentWatchData);

            await this.context.globalState.update('healthWatch.watchHistory', this.watchHistory);
            await this.context.globalState.update('healthWatch.outages', this.outages);
        } catch (error) {
            console.error('Failed to save storage state:', error);
        }
    }

    getChannelState(channelId: string): ChannelState {
        let state = this.channelStates.get(channelId);
        if (!state) {
            state = {
                id: channelId,
                state: 'unknown',
                consecutiveFailures: 0,
                lastStateChange: Date.now(),
                backoffMultiplier: 1,
                samples: []
            };
            this.channelStates.set(channelId, state);
        }
        return state;
    }

    updateChannelState(channelId: string, updates: Partial<ChannelState>): void {
        const state = this.getChannelState(channelId);
        Object.assign(state, updates);
        this.saveState();
    }

    addSample(channelId: string, sample: Sample): void {
        const state = this.getChannelState(channelId);
        state.samples.push(sample);
        state.lastSample = sample;

        const maxSamples = 1000;
        if (state.samples.length > maxSamples) {
            state.samples = state.samples.slice(-maxSamples);
        }

        if (this.currentWatch) {
            let watchSamples = this.currentWatch.samples.get(channelId);
            if (!watchSamples) {
                watchSamples = [];
                this.currentWatch.samples.set(channelId, watchSamples);
            }
            watchSamples.push(sample);
        }

        this.saveState();
    }

    startWatch(duration: '1h' | '12h' | 'forever' | number): WatchSession {
        if (this.currentWatch?.isActive) {
            this.endWatch();
        }

        const session: WatchSession = {
            id: `watch-${Date.now()}`,
            startTime: Date.now(),
            duration,
            samples: new Map(),
            isActive: true
        };

        this.currentWatch = session;
        this.saveState();
        return session;
    }

    endWatch(): WatchSession | null {
        if (!this.currentWatch?.isActive) {
            return null;
        }

        this.currentWatch.endTime = Date.now();
        this.currentWatch.isActive = false;

        this.watchHistory.push({ ...this.currentWatch });
        
        const maxHistory = 50;
        if (this.watchHistory.length > maxHistory) {
            this.watchHistory = this.watchHistory.slice(-maxHistory);
        }

        const endedWatch = this.currentWatch;
        this.currentWatch = null;
        this.saveState();
        
        return endedWatch;
    }

    getCurrentWatch(): WatchSession | null {
        return this.currentWatch;
    }

    getWatchHistory(): WatchSession[] {
        return [...this.watchHistory];
    }

    getLastWatch(): WatchSession | null {
        return this.watchHistory.length > 0 ? this.watchHistory[this.watchHistory.length - 1] : null;
    }

    addOutage(outage: Outage): void {
        this.outages.push(outage);
        
        const maxOutages = 500;
        if (this.outages.length > maxOutages) {
            this.outages = this.outages.slice(-maxOutages);
        }
        
        this.saveState();
    }

    updateOutage(channelId: string, endTime: number, recoveryTime?: number): void {
        const outage = this.outages
            .slice()
            .reverse()
            .find(o => o.channelId === channelId && !o.endTime);
        
        if (outage) {
            outage.endTime = endTime;
            outage.duration = endTime - outage.startTime;
            if (recoveryTime !== undefined) {
                outage.recoveryTime = recoveryTime;
            }
            this.saveState();
        }
    }

    getOutages(channelId?: string, since?: number): Outage[] {
        let filtered = this.outages;
        
        if (channelId) {
            filtered = filtered.filter(o => o.channelId === channelId);
        }
        
        if (since) {
            filtered = filtered.filter(o => o.startTime >= since);
        }
        
        return [...filtered];
    }

    getSamplesInWindow(channelId: string, windowStartMs: number, windowEndMs?: number): Sample[] {
        const state = this.getChannelState(channelId);
        const endTime = windowEndMs || Date.now();
        
        return state.samples.filter(s => 
            s.timestamp >= windowStartMs && s.timestamp <= endTime
        );
    }

    getChannelIds(): string[] {
        return Array.from(this.channelStates.keys());
    }

    removeChannel(channelId: string): void {
        this.channelStates.delete(channelId);
        this.outages = this.outages.filter(o => o.channelId !== channelId);
        
        if (this.currentWatch) {
            this.currentWatch.samples.delete(channelId);
        }
        
        this.watchHistory.forEach(watch => {
            watch.samples?.delete?.(channelId);
        });
        
        this.saveState();
    }

    clearOldData(olderThanMs: number): void {
        const cutoff = Date.now() - olderThanMs;
        
        for (const state of this.channelStates.values()) {
            state.samples = state.samples.filter(s => s.timestamp >= cutoff);
        }
        
        this.outages = this.outages.filter(o => o.startTime >= cutoff);
        this.watchHistory = this.watchHistory.filter(w => w.startTime >= cutoff);
        
        this.saveState();
    }

    exportData(windowMs?: number): any {
        const now = Date.now();
        const since = windowMs ? now - windowMs : 0;
        
        const channelData: Record<string, any> = {};
        for (const [id, state] of this.channelStates.entries()) {
            channelData[id] = {
                state: state.state,
                lastStateChange: state.lastStateChange,
                samples: state.samples.filter(s => s.timestamp >= since)
            };
        }
        
        return {
            exportTime: now,
            windowMs,
            channels: channelData,
            outages: this.getOutages(undefined, since),
            currentWatch: this.currentWatch,
            recentWatches: this.watchHistory.filter(w => w.startTime >= since)
        };
    }
}