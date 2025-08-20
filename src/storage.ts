import * as vscode from 'vscode';
import { Sample, ChannelState, WatchSession, Outage } from './types';
import { DiskStorageManager } from './diskStorage';

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
    private diskStorage: DiskStorageManager;
    private readyPromise: Promise<void>;
    private channelStates = new Map<string, ChannelState>();
    private currentWatch: WatchSession | null = null;
    private watchHistory: WatchSession[] = [];
    private outages: Outage[] = [];

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.diskStorage = DiskStorageManager.initialize(context);
        // Kick off async load and expose a readiness promise to avoid races
        this.readyPromise = this.loadState();
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

    /**
     * Returns a promise that resolves when the initial state load has completed.
     * Callers that require loaded state can await this without changing initialize signature.
     */
    whenReady(): Promise<void> {
        return this.readyPromise;
    }

    private async loadState(): Promise<void> {
        const maxRetries = 3;
        let lastError: Error | undefined;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Migrate from global state if needed (first time using disk storage)
                await this.diskStorage.migrateFromGlobalState();

                // Load from disk storage
                this.channelStates = await this.diskStorage.getChannelStates();
                this.currentWatch = await this.diskStorage.getCurrentWatch();
                this.watchHistory = await this.diskStorage.getWatchHistory();
                this.outages = await this.diskStorage.getOutages();

                // Convert samples back to Map for current watch
                if (this.currentWatch && this.currentWatch.samples) {
                    if (!(this.currentWatch.samples instanceof Map)) {
                        this.currentWatch.samples = new Map(Object.entries(this.currentWatch.samples as any));
                    }
                }
                
                console.log(`Storage state loaded successfully: ${this.channelStates.size} channels, ${this.outages.length} outages, ${this.watchHistory.length} watch sessions`);
                return; // Success
                
            } catch (error) {
                lastError = error as Error;
                console.error(`Failed to load state from disk storage (attempt ${attempt}/${maxRetries}):`, error);
                
                if (attempt < maxRetries) {
                    // Wait before retry with exponential backoff
                    const delayMs = 200 * Math.pow(2, attempt - 1);
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                }
            }
        }
        
        // All retries failed - initialize with empty state and log error
        console.error(`CRITICAL: Failed to load storage state after ${maxRetries} attempts, initializing with empty state:`, lastError);
        
        // Initialize with safe defaults
        this.channelStates = new Map();
        this.currentWatch = null;
        this.watchHistory = [];
        this.outages = [];
        
        // Show user notification for critical loading failures
        vscode.window.showWarningMessage(
            'Health Watch: Failed to load monitoring history. Starting with fresh state.',
            'Show Logs'
        ).then(selection => {
            if (selection === 'Show Logs') {
                vscode.commands.executeCommand('workbench.action.openLogs');
            }
        });
    }

    /**
     * Persists the health watch state to disk storage with comprehensive error handling.
     * This method saves the following state data:
     * - Channel states
     * - Current active watch data (if exists), with samples converted from Map to object
     * - Watch history records
     * - Outage records
     * 
     * @private
     * @async
     * @returns {Promise<void>} A promise that resolves when the state has been saved
     */
    private async saveState(): Promise<void> {
        const maxRetries = 2;
        let lastError: Error | undefined;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Save channel states to disk storage
                await this.diskStorage.saveChannelStates(this.channelStates);

                // Convert Map to object for current watch before saving
                if (this.currentWatch) {
                    const currentWatchData = {
                        ...this.currentWatch,
                        samples: Object.fromEntries(this.currentWatch.samples.entries())
                    } as any; // Type assertion for compatibility with storage
                    await this.diskStorage.setCurrentWatch(currentWatchData);
                } else {
                    await this.diskStorage.setCurrentWatch(null);
                }

                // Success - exit retry loop
                return;
                
            } catch (error) {
                lastError = error as Error;
                console.error(`Failed to save storage state (attempt ${attempt}/${maxRetries}):`, error);
                
                if (attempt < maxRetries) {
                    // Wait before retry
                    await new Promise(resolve => setTimeout(resolve, 250 * attempt));
                }
            }
        }
        
        // All retries failed - log critical error and show user notification
        console.error(`CRITICAL: Failed to save storage state after ${maxRetries} attempts:`, lastError);
        
        // Show user notification for critical storage failures (rate limited)
        const now = Date.now();
        const lastNotification = (this as any)._lastStorageErrorNotification || 0;
        if (now - lastNotification > 300000) { // Show at most once every 5 minutes
            (this as any)._lastStorageErrorNotification = now;
            vscode.window.showErrorMessage(
                'Health Watch: Failed to save monitoring data. Some data may be lost.',
                'Show Logs'
            ).then(selection => {
                if (selection === 'Show Logs') {
                    vscode.commands.executeCommand('workbench.action.openLogs');
                }
            });
        }
    }    getChannelState(channelId: string): ChannelState {
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
        // Fire-and-forget with internal error handling
        void this.saveState();
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

    void this.saveState();
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
    void this.saveState();
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

    // Save to disk storage (fire-and-forget with safety)
    void this.diskStorage.addToWatchHistory({ ...this.currentWatch }).catch(() => {});

        const endedWatch = this.currentWatch;
    this.currentWatch = null;
    void this.saveState();
        
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
        
    // Save directly to disk storage (fire-and-forget with safety)
    void this.diskStorage.addOutage(outage).catch(() => {});
    }

    updateOutage(channelId: string, endTime: number, recoveryTime?: number): void {
        const outage = this.outages
            .slice()
            .reverse()
            .find(o => o.channelId === channelId && !o.endTime);
        
        if (outage) {
            outage.endTime = endTime;
            outage.duration = endTime - outage.startTime;  // Legacy: detected duration
            
            // Calculate actual impact duration if we have firstFailureTime
            if (outage.firstFailureTime) {
                outage.actualDuration = endTime - outage.firstFailureTime;
            }
            
            if (recoveryTime !== undefined) {
                outage.recoveryTime = recoveryTime;
            }
            void this.saveState();
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
        
        void this.saveState();
    }

    clearOldData(olderThanMs: number): void {
        const cutoff = Date.now() - olderThanMs;
        
        for (const state of this.channelStates.values()) {
            state.samples = state.samples.filter(s => s.timestamp >= cutoff);
        }
        
        this.outages = this.outages.filter(o => o.startTime >= cutoff);
        this.watchHistory = this.watchHistory.filter(w => w.startTime >= cutoff);
        
    // Also cleanup disk storage (fire-and-forget with safety)
    const daysToKeep = Math.ceil(olderThanMs / (24 * 60 * 60 * 1000));
    void this.diskStorage.cleanupOldData(daysToKeep).catch(() => {});
        
    void this.saveState();
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

    // Custom data storage for extensions like incidents
    getCustomData(key: string): any {
        return this.context.globalState.get(`healthWatch.custom.${key}`);
    }

    setCustomData(key: string, data: any): Thenable<void> {
        return this.context.globalState.update(`healthWatch.custom.${key}`, data);
    }

    removeCustomData(key: string): Thenable<void> {
        return this.context.globalState.update(`healthWatch.custom.${key}`, undefined);
    }
}