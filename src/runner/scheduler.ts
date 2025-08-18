import { EventEmitter } from 'events';
import { ChannelRunner, ChannelEvents } from './channelRunner';
import { ConfigManager } from '../config';
import { StorageManager } from '../storage';
import { WatchSession, Sample } from '../types';

interface ScheduledChannel {
    id: string;
    nextRun: number;
    timer?: NodeJS.Timeout;
    isRunning: boolean;
}

export interface FishyCondition {
    type: 'consecutive_failures' | 'high_latency' | 'dns_errors';
    threshold: number;
    windowMs: number;
    description: string;
}

export class Scheduler extends EventEmitter {
    private configManager = ConfigManager.getInstance();
    private storageManager = StorageManager.getInstance();
    private channelRunner = new ChannelRunner();
    private scheduledChannels = new Map<string, ScheduledChannel>();
    private isEnabled = false;
    private fishyConditions: FishyCondition[] = [
        {
            type: 'consecutive_failures',
            threshold: 3,
            windowMs: 0,
            description: '≥3 consecutive failures'
        },
        {
            type: 'high_latency',
            threshold: 1200,
            windowMs: 3 * 60 * 1000, // 3 minutes
            description: 'p95 latency > 1200ms for 3m'
        },
        {
            type: 'dns_errors',
            threshold: 2,
            windowMs: 2 * 60 * 1000, // 2 minutes
            description: '≥2 DNS errors in 2m'
        }
    ];

    constructor() {
        super();
        this.setupChannelRunnerEvents();
    }

    private setupChannelRunnerEvents() {
        this.channelRunner.on('sample', (event) => {
            this.emit('sample', event);
            this.evaluateFishyConditions(event.channelId, event.sample);
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
        const channels = this.configManager.getChannels();
        const channel = channels.find(c => c.id === channelId);
        if (!channel) {
            return Date.now() + 60000; // Default 1 minute
        }

        const defaults = this.configManager.getDefaults();
        const currentWatch = this.storageManager.getCurrentWatch();
        
        let intervalSec: number;
        if (currentWatch?.isActive) {
            // High cadence during watch
            const watchConfig = this.configManager.getWatchConfig();
            intervalSec = watchConfig.highCadenceIntervalSec;
        } else if (this.configManager.getOnlyWhenFishyConfig().enabled) {
            // Baseline interval in fishy mode
            const fishyConfig = this.configManager.getOnlyWhenFishyConfig();
            intervalSec = fishyConfig.baselineIntervalSec;
        } else {
            // Normal interval
            intervalSec = channel.intervalSec ?? defaults.intervalSec;
        }

        // Apply backoff for offline channels
        const backoffMultiplier = this.channelRunner.getBackoffMultiplier(channelId);
        intervalSec *= backoffMultiplier;

        // Add jitter
        const jitterPct = channel.jitterPct ?? defaults.jitterPct;
        const jitter = (Math.random() - 0.5) * 2 * (jitterPct / 100);
        const jitteredInterval = intervalSec * (1 + jitter);

        return Date.now() + (jitteredInterval * 1000);
    }

    private scheduleNext(scheduled: ScheduledChannel): void {
        if (!this.isEnabled) {
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

    private evaluateFishyConditions(channelId: string, sample: Sample): void {
        if (!this.configManager.getOnlyWhenFishyConfig().enabled) {
            return;
        }

        const currentWatch = this.storageManager.getCurrentWatch();
        if (currentWatch?.isActive) {
            return; // Already in a watch
        }

        const now = Date.now();
        
        for (const condition of this.fishyConditions) {
            if (this.checkFishyCondition(channelId, condition, now)) {
                this.emit('fishyConditionDetected', {
                    channelId,
                    condition,
                    timestamp: now
                });
                return; // Only trigger once
            }
        }
    }

    private checkFishyCondition(channelId: string, condition: FishyCondition, timestamp: number): boolean {
        const state = this.storageManager.getChannelState(channelId);
        
        switch (condition.type) {
            case 'consecutive_failures':
                return state.consecutiveFailures >= condition.threshold;
            
            case 'high_latency':
                const latencySamples = this.storageManager.getSamplesInWindow(
                    channelId, 
                    timestamp - condition.windowMs, 
                    timestamp
                ).filter(s => s.success && s.latencyMs !== undefined);
                
                if (latencySamples.length < 5) {
                    return false; // Need sufficient samples
                }
                
                const latencies = latencySamples.map(s => s.latencyMs!).sort((a, b) => a - b);
                const p95Index = Math.ceil(latencies.length * 0.95) - 1;
                const p95Latency = latencies[p95Index];
                
                return p95Latency > condition.threshold;
            
            case 'dns_errors':
                const dnsErrorSamples = this.storageManager.getSamplesInWindow(
                    channelId, 
                    timestamp - condition.windowMs, 
                    timestamp
                ).filter(s => !s.success && s.error?.toLowerCase().includes('dns'));
                
                return dnsErrorSamples.length >= condition.threshold;
            
            default:
                return false;
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
}