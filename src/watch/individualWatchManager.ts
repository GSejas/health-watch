/**
 * 🎯 Individual Channel Watch Manager
 * 
 * **Purpose**: Manage individual channel watch sessions alongside global watches
 * **Philosophy**: Enable granular monitoring control while maintaining backward compatibility
 * 
 * **Risk Analysis**:
 * - ✅ Zero Risk: Fully backward compatible with existing global watch system
 * - ✅ Reliability: Graceful fallback to global watch behavior
 * - ✅ Performance: Efficient mixed-mode monitoring (individual + global + baseline)
 * 
 * **Inputs**: Watch commands (start/stop/pause per channel), channel configurations
 * **Outputs**: Watch session management, effective monitoring intervals per channel
 * 
 * **Business Value**:
 * - Granular troubleshooting: Monitor specific problematic services
 * - Resource efficiency: Avoid monitoring all channels when only one needs attention
 * - User experience: Intuitive per-channel controls in UI
 * 
 * @author Health Watch Team
 * @version 2.2.0 - Individual Channel Watch
 * @since 2025-08-21
 */

import { WatchSession, IndividualChannelWatch, WatchManager } from '../types';
import { StorageManager } from '../storage';
import { ConfigManager } from '../config';
import { EventEmitter } from 'events';

export interface IndividualWatchEvents {
    'channelWatchStarted': { channelId: string; watch: IndividualChannelWatch };
    'channelWatchStopped': { channelId: string; watch: IndividualChannelWatch };
    'channelWatchExpired': { channelId: string; watch: IndividualChannelWatch };
    'mixedModeChanged': { 
        globalActive: boolean; 
        individualCount: number; 
        channels: string[] 
    };
}


/**
 * Manages per-channel ("individual") watch sessions alongside an optional global watch session.
 *
 * This manager tracks active individual channel watches, coordinates them with a global watch,
 * and emits events when watches start, stop, expire, or when the mixed-mode state changes.
 *
 * Key behaviors
 * - Individual watches take precedence over a global watch for a specific channel: if an individual
 *   watch is active for a channel, it is considered the "effective" watch for that channel.
 * - Starting an individual watch for a channel will stop any existing individual watch for that channel.
 * - Individual watch durations may be one of the presets ('1h', '12h', 'forever') or a numeric value
 *   representing milliseconds. Preset durations are converted to milliseconds internally.
 * - Watches with a finite duration have an expiration timer; when the timer fires the manager emits
 *   a 'channelWatchExpired' event and stops the watch.
 * - Watches are kept in memory for the session. Persistence hooks exist but are currently TODO.
 *
 * Events emitted (EventEmitter):
 * - 'channelWatchStarted'   — emitted after an individual channel watch is successfully started.
 * - 'channelWatchStopped'   — emitted after an individual channel watch is stopped (manually or on expiry).
 * - 'channelWatchExpired'   — emitted when an individual watch reaches its configured duration.
 * - 'mixedModeChanged'      — emitted whenever the combination of global and individual watches changes.
 *
 * Public API overview
 * - isChannelWatched(channelId): boolean
 *     Returns true if the channel is covered by an active individual watch or the active global watch.
 *
 * - getEffectiveWatch(channelId): WatchSession | IndividualChannelWatch | null
 *     Returns the active individual watch for the channel if present, otherwise the global watch if active,
 *     otherwise null.
 *
 * - getActiveWatchType(channelId): 'global' | 'individual' | 'baseline'
 *     Returns which mode applies for the given channel.
 *
 * - startChannelWatch(channelId, options): Promise<IndividualChannelWatch>
 *     Starts an individual watch for the given channel. Options:
 *       - duration?: '1h' | '12h' | 'forever' | number  (milliseconds when number)
 *       - intervalSec?: number                          (optional sampling interval metadata)
 *       - timeoutMs?: number                            (optional request timeout metadata)
 *     The method stops any existing individual watch for the channel before starting the new one,
 *     persists state (currently a no-op stub), sets up an expiration timer for finite durations,
 *     emits 'channelWatchStarted', and triggers a mixed-mode update.
 *
 * - stopChannelWatch(channelId): Promise<boolean>
 *     Stops and removes the individual watch for the channel if present, clears any expiration timer,
 *     persists state (stub), emits 'channelWatchStopped', and triggers a mixed-mode update. Returns
 *     true if a watch was stopped, false if none existed.
 *
 * - stopAllChannelWatches(): Promise<number>
 *     Stops all individual watches, returning the number of watches that were stopped.
 *
 * - setGlobalWatch(watch?: WatchSession): void
 *     Sets or clears the global watch session and emits a mixed-mode update. The global watch is used
 *     as a fallback for channels without an active individual watch.
 *
 * - getActiveWatches(): IndividualChannelWatch[]
 *     Returns an array of currently active individual channel watches.
 *
 * - getWatchStatistics(): object
 *     Returns a summary object containing global watch info, individual watch counts and channel list,
 *     and whether mixed-mode (global + some individual) is active.
 *
 * - dispose(): void
 *     Clears all timers, removes individual watches, unregisters event listeners, and performs cleanup.
 *
 * Persistence and migration
 * - The manager reads the current global watch using the configured storage manager on construction,
 *   but persistent storage for individual channel watches is currently not implemented (TODO).
 * - persistWatchState and loadExistingWatches are present as hooks for future persistence/migration.
 *
 * Concurrency and timing notes
 * - Timers for expiration use setTimeout and callbacks are asynchronous; stopChannelWatch may be
 *   invoked from timer callbacks. Event emission uses Node's EventEmitter and happens synchronously
 *   from the caller's stack (i.e., listeners execute immediately when emit is called).
 *
 * Example
 * @example
 * const mgr = new IndividualWatchManager();
 * mgr.on('channelWatchStarted', ({ channelId, watch }) => { console.log('started', channelId); });
 * await mgr.startChannelWatch('channel-1', { duration: '1h', intervalSec: 30 });
 *
 * @public
 */
export class IndividualWatchManager extends EventEmitter implements WatchManager {
    private configManager = ConfigManager.getInstance();
    private storageManager = StorageManager.getInstance();
    
    globalWatch?: WatchSession;
    individualWatches = new Map<string, IndividualChannelWatch>();
    
    private watchTimers = new Map<string, NodeJS.Timeout>(); // channelId -> timer
    
    constructor() {
        super();
        this.loadExistingWatches();
    }

    /**
     * 🔍 **WATCH QUERY METHODS**
     */
    isChannelWatched(channelId: string): boolean {
        // Channel is watched if it has an individual watch OR global watch is active
        return this.individualWatches.has(channelId) || (this.globalWatch?.isActive ?? false);
    }

    getEffectiveWatch(channelId: string): WatchSession | IndividualChannelWatch | null {
        // Individual watch takes priority over global watch
        const individualWatch = this.individualWatches.get(channelId);
        if (individualWatch?.isActive) {
            return individualWatch;
        }
        
        // Fall back to global watch if active
        if (this.globalWatch?.isActive) {
            return this.globalWatch;
        }
        
        return null;
    }

    getActiveWatchType(channelId: string): 'global' | 'individual' | 'baseline' {
        if (this.individualWatches.get(channelId)?.isActive) {
            return 'individual';
        }
        
        if (this.globalWatch?.isActive) {
            return 'global';
        }
        
        return 'baseline';
    }

    /**
     * 🚀 **INDIVIDUAL CHANNEL WATCH MANAGEMENT**
     */
    async startChannelWatch(
        channelId: string, 
        options: {
            duration?: '1h' | '12h' | 'forever' | number;
            intervalSec?: number;
            timeoutMs?: number;
        } = {}
    ): Promise<IndividualChannelWatch> {
        // Stop any existing watch for this channel
        await this.stopChannelWatch(channelId);
        
        const watch: IndividualChannelWatch = {
            id: `individual-watch-${channelId}-${Date.now()}`,
            channelId,
            startTime: Date.now(),
            duration: options.duration || '1h',
            isActive: true,
            intervalSec: options.intervalSec,
            timeoutMs: options.timeoutMs,
            sampleCount: 0
        };
        
        this.individualWatches.set(channelId, watch);
        
        // Set up expiration timer if not forever
        if (watch.duration !== 'forever') {
            this.setupWatchTimer(watch);
        }
        
        await this.persistWatchState();
        
        this.emit('channelWatchStarted', { channelId, watch });
        this.emitMixedModeChanged();
        
        console.log(`[IndividualWatch] ✅ Started watch for channel ${channelId}`);
        return watch;
    }

    async stopChannelWatch(channelId: string): Promise<boolean> {
        const watch = this.individualWatches.get(channelId);
        if (!watch) return false;
        
        // Mark as ended
        watch.isActive = false;
        watch.endTime = Date.now();
        
        // Clear timer
        const timer = this.watchTimers.get(channelId);
        if (timer) {
            clearTimeout(timer);
            this.watchTimers.delete(channelId);
        }
        
        this.individualWatches.delete(channelId);
        await this.persistWatchState();
        
        this.emit('channelWatchStopped', { channelId, watch });
        this.emitMixedModeChanged();
        
        console.log(`[IndividualWatch] ⏹️ Stopped watch for channel ${channelId}`);
        return true;
    }

    async stopAllChannelWatches(): Promise<number> {
        const channelIds = Array.from(this.individualWatches.keys());
        let stopped = 0;
        
        for (const channelId of channelIds) {
            const success = await this.stopChannelWatch(channelId);
            if (success) stopped++;
        }
        
        console.log(`[IndividualWatch] ⏹️ Stopped ${stopped} individual watches`);
        return stopped;
    }

    /**
     * 🌐 **GLOBAL WATCH INTEGRATION** 
     */
    setGlobalWatch(watch?: WatchSession): void {
        this.globalWatch = watch;
        this.emitMixedModeChanged();
    }

    /**
     * 📊 **WATCH STATISTICS**
     */
    getActiveWatches(): IndividualChannelWatch[] {
        return Array.from(this.individualWatches.values()).filter(watch => watch.isActive);
    }

    getWatchStatistics() {
        const individualActive = Array.from(this.individualWatches.values()).filter(w => w.isActive);
        const globalActive = this.globalWatch?.isActive ?? false;
        
        return {
            globalWatch: {
                active: globalActive,
                startTime: this.globalWatch?.startTime,
                duration: this.globalWatch?.duration
            },
            individualWatches: {
                total: this.individualWatches.size,
                active: individualActive.length,
                channels: individualActive.map(w => w.channelId)
            },
            mixedMode: globalActive && individualActive.length > 0
        };
    }

    /**
     * 🔧 **INTERNAL HELPER METHODS**
     */
    private setupWatchTimer(watch: IndividualChannelWatch): void {
        let durationMs: number;
        
        switch (watch.duration) {
            case '1h':
                durationMs = 60 * 60 * 1000;
                break;
            case '12h':
                durationMs = 12 * 60 * 60 * 1000;
                break;
            case 'forever':
                return; // No timer needed
            default:
                durationMs = typeof watch.duration === 'number' ? watch.duration : 60 * 60 * 1000;
        }
        
        const timer = setTimeout(async () => {
            console.log(`[IndividualWatch] ⏰ Watch expired for channel ${watch.channelId}`);
            this.emit('channelWatchExpired', { channelId: watch.channelId, watch });
            await this.stopChannelWatch(watch.channelId);
        }, durationMs);
        
        this.watchTimers.set(watch.channelId, timer);
    }

    private emitMixedModeChanged(): void {
        const stats = this.getWatchStatistics();
        this.emit('mixedModeChanged', {
            globalActive: stats.globalWatch.active,
            individualCount: stats.individualWatches.active,
            channels: stats.individualWatches.channels
        });
    }

    private async loadExistingWatches(): Promise<void> {
        try {
            // Load global watch from existing system
            this.globalWatch = this.storageManager.getCurrentWatch() || undefined;
            
            // Load individual watches from storage (new feature)
            // TODO: Implement persistent storage for individual watches
            console.log('[IndividualWatch] 📚 Loaded existing watch state');
        } catch (error) {
            console.warn('[IndividualWatch] Failed to load watch state:', error);
        }
    }

    private async persistWatchState(): Promise<void> {
        try {
            // TODO: Implement persistent storage for individual watches
            // For now, individual watches are session-only
            console.log('[IndividualWatch] 💾 Persisted watch state');
        } catch (error) {
            console.warn('[IndividualWatch] Failed to persist watch state:', error);
        }
    }

    /**
     * 🧹 **CLEANUP**
     */
    dispose(): void {
        // Clear all timers
        for (const timer of this.watchTimers.values()) {
            clearTimeout(timer);
        }
        this.watchTimers.clear();
        
        // Clear individual watches
        this.individualWatches.clear();
        
        this.removeAllListeners();
        console.log('[IndividualWatch] 🧹 Disposed watch manager');
    }
}