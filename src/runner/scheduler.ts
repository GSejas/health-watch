import { EventEmitter } from 'events';
import { ChannelRunner, ChannelEvents } from './channelRunner';
import { ConfigManager } from '../config';
import { StorageManager } from '../storage';
import { WatchSession, Sample, IndividualChannelWatch } from '../types';
import { IndividualWatchManager } from '../watch/individualWatchManager';

interface ScheduledChannel {
    id: string;
    nextRun: number;
    timer?: NodeJS.Timeout;
    isRunning: boolean;
}


export class Scheduler extends EventEmitter {
    private configManager = ConfigManager.getInstance();
    private storageManager = StorageManager.getInstance();
    private channelRunner = new ChannelRunner();
    private scheduledChannels = new Map<string, ScheduledChannel>();
    private isEnabled = false;
    protected individualWatchManager?: IndividualWatchManager;

    private isWatchPaused = false;

    constructor(individualWatchManager?: IndividualWatchManager) {
        super();
        this.individualWatchManager = individualWatchManager;
        this.setupChannelRunnerEvents();
    }

    private setupChannelRunnerEvents() {
        this.channelRunner.on('sample', (event) => {
            this.emit('sample', event);
        });

        this.channelRunner.on('stateChange', (event) => {
            this.emit('stateChange', event);
            this.adjustScheduleForStateChange(event.channelId, event.newState);
        });

        this.channelRunner.on('outageStart', (event) => {
            this.emit('outageStart', event);
        });

        this.channelRunner.on('outageEnd', (event) => {
            this.emit('outageEnd', event);
        });
    }

    start(): void {
        if (this.isEnabled) {
            return;
        }

        this.isEnabled = true;
        this.refreshChannels();
        this.emit('started');
    }

    stop(): void {
        if (!this.isEnabled) {
            return;
        }

        this.isEnabled = false;
        this.clearAllTimers();
        this.emit('stopped');
    }

    refreshChannels(): void {
        if (!this.isEnabled) {
            return;
        }

        this.clearAllTimers();
        
        const channels = this.configManager.getChannels();
        const newScheduled = new Map<string, ScheduledChannel>();

        for (const channel of channels) {
            const existing = this.scheduledChannels.get(channel.id);
            const scheduled: ScheduledChannel = {
                id: channel.id,
                nextRun: existing?.nextRun || this.calculateNextRun(channel.id),
                isRunning: false
            };

            newScheduled.set(channel.id, scheduled);
            this.scheduleNext(scheduled);
        }

        this.scheduledChannels = newScheduled;
    }

    private calculateNextRun(channelId: string): number {
        const intervalResult = this.getEffectiveInterval(channelId);
        
        // Add jitter to final interval
        const jitter = (Math.random() - 0.5) * 2 * (intervalResult.jitterPct / 100);
        const jitteredInterval = intervalResult.finalIntervalSec * (1 + jitter);

        // Log the decision for transparency
        console.log(`[Scheduler] ${intervalResult.explanation}`);
        
        return Date.now() + (jitteredInterval * 1000);
    }

    /**
     * SIMPLIFIED PRECEDENCE HIERARCHY
     * Get effective interval with clear, predictable precedence and full transparency
     * 
     * NEW CLEAR ORDER (only 4 levels):
     * 1. 🎯 Individual Watch - Explicit per-channel watch  
     * 2. ⚙️ Channel Config - .healthwatch.json channel settings
     * 3. 🌐 Global Watch - When active watch is running
     * 4. 📋 Defaults - System defaults with adaptive adjustments
     */
    getEffectiveInterval(channelId: string): {
        finalIntervalSec: number;
        baseIntervalSec: number;
        source: '🎯 Individual Watch' | '⚙️ Channel Config' | '🌐 Global Watch' | '📋 Defaults';
        adaptiveMultiplier: number;
        adaptiveReason: string;
        jitterPct: number;
        explanation: string;
    } {
        const channels = this.configManager.getChannels();
        const channel = channels.find(c => c.id === channelId);
        if (!channel) {
            return {
                finalIntervalSec: 60,
                baseIntervalSec: 60,
                source: '📋 Defaults',
                adaptiveMultiplier: 1,
                adaptiveReason: 'Channel not found',
                jitterPct: 10,
                explanation: `Channel '${channelId}': ❌ NOT FOUND → 60s default`
            };
        }

        const defaults = this.configManager.getDefaults();
        const currentWatch = this.storageManager.getCurrentWatch();
        
        let baseIntervalSec: number;
        let source: '🎯 Individual Watch' | '⚙️ Channel Config' | '🌐 Global Watch' | '📋 Defaults';
        let sourceDetail: string;

        // LEVEL 1: 🎯 Individual Watch (highest priority)
        const individualWatch = this.individualWatchManager?.getEffectiveWatch(channelId);
        const watchType = this.individualWatchManager?.getActiveWatchType(channelId) || 'baseline';
        
        if (individualWatch && watchType === 'individual') {
            baseIntervalSec = (individualWatch as IndividualChannelWatch).intervalSec ?? 
                             this.configManager.getWatchConfig().highCadenceIntervalSec;
            source = '🎯 Individual Watch';
            sourceDetail = `individual watch (${baseIntervalSec}s)`;
        }
        // LEVEL 2: ⚙️ Channel Config (.healthwatch.json)
        else if (channel.intervalSec) {
            baseIntervalSec = channel.intervalSec;
            source = '⚙️ Channel Config';
            sourceDetail = `channel config (${baseIntervalSec}s)`;
        }
        // LEVEL 3: 🌐 Global Watch (when active)
        else if (currentWatch?.isActive && !(currentWatch as any).paused) {
            baseIntervalSec = this.configManager.getWatchConfig().highCadenceIntervalSec;
            source = '🌐 Global Watch';
            sourceDetail = `global watch active (${baseIntervalSec}s)`;
        }
        // LEVEL 4: 📋 Defaults (fallback)
        else {
            baseIntervalSec = defaults.intervalSec;
            source = '📋 Defaults';
            sourceDetail = `system defaults (${baseIntervalSec}s)`;
        }

        // Apply adaptive backoff (accelerates during outages, slows when stable)
        const adaptiveResult = this.channelRunner.getAdaptiveInterval(channelId, baseIntervalSec);
        
        const jitterPct = channel.jitterPct ?? defaults.jitterPct;
        
        // Build clear explanation
        const adaptiveExplanation = adaptiveResult.strategy !== 'stable' 
            ? ` → ${adaptiveResult.strategy.toUpperCase()} ${adaptiveResult.intervalSec}s (${adaptiveResult.multiplier.toFixed(2)}×: ${adaptiveResult.reason})`
            : '';
            
        const explanation = `Channel '${channelId}': ${source} ${sourceDetail}${adaptiveExplanation}`;

        return {
            finalIntervalSec: adaptiveResult.intervalSec,
            baseIntervalSec,
            source,
            adaptiveMultiplier: adaptiveResult.multiplier,
            adaptiveReason: adaptiveResult.reason,
            jitterPct,
            explanation
        };
    }

    private scheduleNext(scheduled: ScheduledChannel): void {
        if (!this.isEnabled) {
            return;
        }

        // If a global watch is paused, do not schedule probe runs
        const currentWatch = this.storageManager.getCurrentWatch();
        if (currentWatch?.isActive && (currentWatch as any).paused) {
            // leave timers cleared while paused
            return;
        }

        const delay = Math.max(0, scheduled.nextRun - Date.now());
        
        scheduled.timer = setTimeout(async () => {
            if (!this.isEnabled || this.channelRunner.isChannelPaused(scheduled.id)) {
                return;
            }

            scheduled.isRunning = true;
            
            try {
                await this.channelRunner.runChannel(scheduled.id);
            } catch (error) {
                console.error(`Failed to run channel ${scheduled.id}:`, error);
            } finally {
                scheduled.isRunning = false;
                
                if (this.isEnabled) {
                    scheduled.nextRun = this.calculateNextRun(scheduled.id);
                    this.scheduleNext(scheduled);
                }
            }
        }, delay);
    }

    /**
     * Pause scheduling for an active watch. Clears timers so probes stop running.
     */
    pauseForWatch(): void {
        this.isWatchPaused = true;
    this.clearAllTimers();
    // Abort any in-flight probes immediately
    try { this.channelRunner.abortAllRunning(); } catch (e) {}
    }

    /**
     * Resume scheduling after a paused watch. Reschedules channels.
     */
    resumeForWatch(): void {
        this.isWatchPaused = false;
        if (this.isEnabled) this.refreshChannels();
    }

    private adjustScheduleForStateChange(channelId: string, newState: string): void {
        const scheduled = this.scheduledChannels.get(channelId);
        if (!scheduled || scheduled.isRunning) {
            return;
        }

        // Reschedule with updated backoff
        if (scheduled.timer) {
            clearTimeout(scheduled.timer);
        }
        
        scheduled.nextRun = this.calculateNextRun(channelId);
        this.scheduleNext(scheduled);
    }

    private clearAllTimers(): void {
        for (const scheduled of this.scheduledChannels.values()) {
            if (scheduled.timer) {
                clearTimeout(scheduled.timer);
                scheduled.timer = undefined;
            }
        }
    }

    async runChannelNow(channelId: string): Promise<Sample> {
        const scheduled = this.scheduledChannels.get(channelId);
        if (scheduled?.isRunning) {
            throw new Error(`Channel ${channelId} is already running`);
        }

        const sample = await this.channelRunner.runChannel(channelId);
        
        // Reschedule the next run
        if (scheduled && this.isEnabled) {
            if (scheduled.timer) {
                clearTimeout(scheduled.timer);
            }
            scheduled.nextRun = this.calculateNextRun(channelId);
            this.scheduleNext(scheduled);
        }
        
        return sample;
    }

    async runAllChannelsNow(): Promise<Map<string, Sample>> {
        return await this.channelRunner.runAllChannels();
    }

    pauseChannel(channelId: string): void {
        this.channelRunner.pauseChannel(channelId);
        const scheduled = this.scheduledChannels.get(channelId);
        if (scheduled?.timer) {
            clearTimeout(scheduled.timer);
            scheduled.timer = undefined;
        }
    }

    resumeChannel(channelId: string): void {
        this.channelRunner.resumeChannel(channelId);
        const scheduled = this.scheduledChannels.get(channelId);
        if (scheduled && this.isEnabled) {
            scheduled.nextRun = this.calculateNextRun(channelId);
            this.scheduleNext(scheduled);
        }
    }

    stopChannel(channelId: string): void {
        const scheduled = this.scheduledChannels.get(channelId);
        if (!scheduled) {
            return;
        }

        // Clear the timer to prevent next scheduled run
        if (scheduled.timer) {
            clearTimeout(scheduled.timer);
            scheduled.timer = undefined;
        }

        // Stop the channel runner for this specific channel
        this.channelRunner.stopChannel(channelId);
        
        // Mark as not running
        scheduled.isRunning = false;
        
        // Reschedule the next run
        if (this.isEnabled) {
            scheduled.nextRun = this.calculateNextRun(channelId);
            this.scheduleNext(scheduled);
        }
    }


    getScheduleInfo(): Map<string, { nextRun: number; isRunning: boolean; isPaused: boolean }> {
        const info = new Map<string, { nextRun: number; isRunning: boolean; isPaused: boolean }>();
        
        for (const [id, scheduled] of this.scheduledChannels.entries()) {
            info.set(id, {
                nextRun: scheduled.nextRun,
                isRunning: scheduled.isRunning,
                isPaused: this.channelRunner.isChannelPaused(id)
            });
        }
        
        return info;
    }

    getChannelRunner(): ChannelRunner {
        return this.channelRunner;
    }

    isRunning(): boolean {
        return this.isEnabled;
    }

    /**
     * PUBLIC API: Get interval configuration explanation for debugging and UI
     * This enables the "Channel Details" UI and debug features
     */
    explainChannelInterval(channelId: string): {
        finalIntervalSec: number;
        baseIntervalSec: number;
        source: '🎯 Individual Watch' | '⚙️ Channel Config' | '🌐 Global Watch' | '📋 Defaults';
        adaptiveMultiplier: number;
        adaptiveReason: string;
        jitterPct: number;
        explanation: string;
        humanReadableExplanation: string;
    } {
        const result = this.getEffectiveInterval(channelId);
        
        // Create user-friendly explanation for UI
        let humanReadableExplanation = '';
        switch (result.source) {
            case '🎯 Individual Watch':
                humanReadableExplanation = `This channel has an individual watch active, which overrides all other settings. Monitoring every ${result.baseIntervalSec} seconds.`;
                break;
            case '⚙️ Channel Config':
                humanReadableExplanation = `Using interval from .healthwatch.json channel configuration: ${result.baseIntervalSec} seconds.`;
                break;
            case '🌐 Global Watch':
                humanReadableExplanation = `A global watch is active, using high-frequency monitoring: ${result.baseIntervalSec} seconds.`;
                break;
            case '📋 Defaults':
                humanReadableExplanation = `Using system default interval: ${result.baseIntervalSec} seconds.`;
                break;
        }

        if (result.adaptiveMultiplier !== 1) {
            humanReadableExplanation += ` Adaptive backoff is ${result.adaptiveMultiplier > 1 ? 'slowing down' : 'speeding up'} monitoring (${result.adaptiveMultiplier.toFixed(2)}x) because: ${result.adaptiveReason}`;
        }

        return {
            ...result,
            humanReadableExplanation
        };
    }
}