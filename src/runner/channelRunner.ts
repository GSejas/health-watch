import { EventEmitter } from 'events';
import { Sample, ProbeResult, ChannelState } from '../types';
import { ChannelDefinition, ConfigManager } from '../config';
import { GuardManager } from '../guards';
import { StorageManager } from '../storage';
import { HttpsProbe } from '../probes/https';
import { TcpProbe } from '../probes/tcp';
import { DnsProbe } from '../probes/dns';
import { ScriptProbe } from '../probes/script';
import { TaskProbe } from '../probes/task';
import { AdaptiveBackoffStrategy, BackoffInput } from './adaptiveBackoff';

export interface ChannelEvents {
    'sample': { channelId: string; sample: Sample };
    'stateChange': { channelId: string; oldState: string; newState: string };
    'outageStart': { channelId: string; timestamp: number; reason: string };
    'outageEnd': { channelId: string; timestamp: number; duration: number };
}

export class ChannelRunner extends EventEmitter {
    private configManager = ConfigManager.getInstance();
    private guardManager = GuardManager.getInstance();
    private storageManager = StorageManager.getInstance();
    
    private httpsProbe = new HttpsProbe();
    private tcpProbe = new TcpProbe();
    private dnsProbe = new DnsProbe();
    private scriptProbe = new ScriptProbe();
    
    private pausedChannels = new Set<string>();
    private runningChannels = new Map<string, AbortController>();

    constructor() {
        super();
    }

    async runChannel(channelId: string): Promise<Sample> {
        const channels = this.configManager.getChannels();
        const channel = channels.find(c => c.id === channelId);
        
        if (!channel) {
            throw new Error(`Channel '${channelId}' not found`);
        }

        // If there's a global active watch that is paused, short-circuit and return a paused sample
        const currentWatch = this.storageManager.getCurrentWatch();
        if (currentWatch?.isActive && (currentWatch as any).paused) {
            const sample: Sample = {
                timestamp: Date.now(),
                success: false,
                error: 'Watch is paused'
            };
            return sample;
        }

        if (this.pausedChannels.has(channelId)) {
            const sample: Sample = {
                timestamp: Date.now(),
                success: false,
                error: 'Channel is paused'
            };
            return sample;
        }

        // Check if channel is already running
        if (this.runningChannels.has(channelId)) {
            throw new Error(`Channel '${channelId}' is already running`);
        }

        // Create abort controller for this run
        const abortController = new AbortController();
        this.runningChannels.set(channelId, abortController);

    const state = this.storageManager.getChannelState(channelId);
    // Defensive defaults to maintain arithmetic operations
    state.consecutiveFailures = state.consecutiveFailures ?? 0;
    state.backoffMultiplier = state.backoffMultiplier ?? 1;
    state.lastStateChange = state.lastStateChange ?? Date.now();
        let sample: Sample;

        try {
            // Check guards first
            if (channel.guards && channel.guards.length > 0) {
                const guardResults = await this.guardManager.checkGuards(channel.guards);
                if (!guardResults.passed) {
                    const failedGuards = Array.from(guardResults.results.entries())
                        .filter(([_, result]) => !result.passed)
                        .map(([name, result]) => `${name}: ${result.error}`)
                        .join(', ');
                    
                    sample = {
                        timestamp: Date.now(),
                        success: false,
                        error: `Guard checks failed: ${failedGuards}`
                    };
                    
                    this.updateChannelState(channelId, 'unknown', sample);
                    return sample;
                }
            }

            // Run the actual probe
            const probeResult = await this.executeProbe(channel);
            
            sample = {
                timestamp: Date.now(),
                success: probeResult.success,
                latencyMs: probeResult.latencyMs,
                error: probeResult.error,
                details: probeResult.details
            };

            // Update channel state based on probe result
            if (probeResult.success) {
                this.updateChannelState(channelId, 'online', sample);
            } else {
                this.handleFailure(channelId, sample);
            }

        } catch (error) {
            if (abortController.signal.aborted) {
                sample = {
                    timestamp: Date.now(),
                    success: false,
                    error: 'Channel stopped by user'
                };
            } else {
                sample = {
                    timestamp: Date.now(),
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
                this.handleFailure(channelId, sample);
            }
        } finally {
            // Clean up running channel tracker
            this.runningChannels.delete(channelId);
        }

        this.storageManager.addSample(channelId, sample);
        this.emit('sample', { channelId, sample });
        
        return sample;
    }

    private async executeProbe(channel: ChannelDefinition): Promise<ProbeResult> {
        const defaults = this.configManager.getDefaults();
        const timeoutMs = channel.timeoutMs ?? defaults.timeoutMs;
        
        const channelWithDefaults = {
            ...channel,
            timeoutMs
        };

        switch (channel.type) {
            case 'https':
            case 'http':
                const httpsConfig = this.configManager.getHttpsConfig();
                return await this.httpsProbe.probe(
                    channelWithDefaults, 
                    httpsConfig.userAgent, 
                    httpsConfig.allowProxy
                );
            
            case 'tcp':
                return await this.tcpProbe.probe(channelWithDefaults);
            
            case 'dns':
                return await this.dnsProbe.probe(channelWithDefaults);
            
            case 'script':
                if (!this.configManager.isScriptProbeEnabled()) {
                    throw new Error('Script probes are disabled');
                }
                return await this.scriptProbe.probe(channelWithDefaults);
            
            case 'task':
                return await TaskProbe.executeProbe(channelWithDefaults);
            
            default:
                throw new Error(`Unsupported probe type: ${(channel as any).type}`);
        }
    }

    private updateChannelState(channelId: string, newState: 'online' | 'offline' | 'unknown', sample: Sample) {
        const state = this.storageManager.getChannelState(channelId);
        const oldState = state.state;
        
        if (newState === 'online') {
            if (oldState === 'offline') {
                // Recovery from outage
                this.storageManager.updateOutage(channelId, sample.timestamp, sample.latencyMs);
                this.emit('outageEnd', { 
                    channelId, 
                    timestamp: sample.timestamp, 
                    duration: sample.timestamp - state.lastStateChange 
                });
            }
            
            this.storageManager.updateChannelState(channelId, {
                state: 'online',
                consecutiveFailures: 0,
                backoffMultiplier: 1,
                lastStateChange: oldState !== 'online' ? sample.timestamp : state.lastStateChange,
                firstFailureTime: undefined  // Clear failure streak tracking
            });
        }
        
        if (oldState !== newState) {
            this.emit('stateChange', { channelId, oldState, newState });
        }
    }

    private handleFailure(channelId: string, sample: Sample) {
        const state = this.storageManager.getChannelState(channelId);
        const defaults = this.configManager.getDefaults();
        const channels = this.configManager.getChannels();
        const channel = channels.find(c => c.id === channelId);
        const threshold = channel?.threshold ?? defaults.threshold;
        
    const newFailureCount = (state.consecutiveFailures || 0) + 1;
        
        // Track first failure time in the current streak
        const firstFailureTime = (state.consecutiveFailures || 0) === 0 ? sample.timestamp : 
            (state.firstFailureTime || sample.timestamp);
        
        if (newFailureCount >= threshold && state.state !== 'offline') {
            // Transition to offline - record enhanced outage data
                this.storageManager.updateChannelState(channelId, {
                state: 'offline',
                consecutiveFailures: newFailureCount,
                lastStateChange: sample.timestamp,
                backoffMultiplier: 1, // 🔄 **SURGICAL FIX**: No longer increase backoff when offline
                firstFailureTime: firstFailureTime
            });
            
            this.storageManager.addOutage({
                channelId,
                startTime: sample.timestamp,          // Legacy: threshold crossing time
                confirmedAt: sample.timestamp,        // When threshold was crossed
                firstFailureTime: firstFailureTime,  // When problems actually started  
                reason: sample.error || 'Unknown failure',
                failureCount: newFailureCount
            });
            
            this.emit('outageStart', { 
                channelId, 
                timestamp: sample.timestamp, 
                reason: sample.error || 'Unknown failure',
                firstFailureTime: firstFailureTime,
                failureCount: newFailureCount
            });
        } else {
            // Still accumulating failures - track first failure time
            this.storageManager.updateChannelState(channelId, {
                consecutiveFailures: newFailureCount,
                firstFailureTime: firstFailureTime
            });
        }
    }

    pauseChannel(channelId: string): void {
        this.pausedChannels.add(channelId);
    }

    resumeChannel(channelId: string): void {
        this.pausedChannels.delete(channelId);
    }

    isChannelPaused(channelId: string): boolean {
        return this.pausedChannels.has(channelId);
    }

    isChannelRunning(channelId: string): boolean {
        return this.runningChannels.has(channelId);
    }

    stopChannel(channelId: string): void {
        const abortController = this.runningChannels.get(channelId);
        if (abortController) {
            abortController.abort();
            // The cleanup will happen in the finally block of runChannel
        }
    }

    /** Abort all currently running channels (used when pausing a global watch) */
    abortAllRunning(): void {
        for (const [id, controller] of this.runningChannels.entries()) {
            try { controller.abort(); } catch (e) {}
        }
    }

    /**
     * 🔄 **SURGICAL FIX**: Calculate adaptive probe interval
     * 
     * **Before**: Offline channels got slower (3× backoff multiplier)
     * **After**: Offline channels get faster (adaptive acceleration)
     * 
     * @param channelId - Target channel identifier  
     * @param baseIntervalSec - Configured monitoring interval
     * @returns Optimized interval calculation with strategy info
     */
    getAdaptiveInterval(channelId: string, baseIntervalSec: number): {
        intervalSec: number;
        multiplier: number;
        strategy: string;
        reason: string;
    } {
        const channels = this.configManager.getChannels();
        const channel = channels.find(c => c.id === channelId);
        const state = this.storageManager.getChannelState(channelId);
        const currentWatch = this.storageManager.getCurrentWatch();
        
        const input: BackoffInput = {
            state: state.state,
            consecutiveFailures: state.consecutiveFailures,
            baseIntervalSec,
            isInWatch: !!(currentWatch?.isActive && !(currentWatch as any).paused),
            priority: (channel as any)?.priority || 'medium'
        };
        
        const result = AdaptiveBackoffStrategy.calculateInterval(input);
        
        return {
            intervalSec: result.adjustedIntervalSec,
            multiplier: result.multiplier,
            strategy: result.strategy,
            reason: result.reason
        };
    }

    /**
     * @deprecated Use getAdaptiveInterval() instead
     * 
     * **Legacy Method**: Kept for backward compatibility during transition.
     * This method implements the old "backward backoff" logic that caused missed outages.
     */
    getBackoffMultiplier(channelId: string): number {
        // **Temporary Bridge**: Use new adaptive logic but return old format
        const state = this.storageManager.getChannelState(channelId);
        const defaults = this.configManager.getDefaults();
        const adaptive = this.getAdaptiveInterval(channelId, defaults.intervalSec);
        
        // Convert new logic to old multiplier format for compatibility
        return adaptive.multiplier;
    }

    async runAllChannels(): Promise<Map<string, Sample>> {
        const channels = this.configManager.getChannels();
        const results = new Map<string, Sample>();
        
        const promises = channels.map(async channel => {
            try {
                const sample = await this.runChannel(channel.id);
                results.set(channel.id, sample);
            } catch (error) {
                const sample: Sample = {
                    timestamp: Date.now(),
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
                results.set(channel.id, sample);
            }
        });
        
        await Promise.allSettled(promises);
        return results;
    }

    getChannelStates(): Map<string, ChannelState> {
        const channels = this.configManager.getChannels();
        const states = new Map<string, ChannelState>();
        
        for (const channel of channels) {
            const state = this.storageManager.getChannelState(channel.id);
            states.set(channel.id, state);
        }
        
        return states;
    }
}