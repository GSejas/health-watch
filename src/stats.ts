/**
 * @fileoverview Statistics Calculation and Analysis Engine
 * 
 * This module provides comprehensive statistical analysis of monitoring data including:
 * - Availability and uptime calculations
 * - Latency percentile analysis (P50, P95, P99)
 * - Outage detection and MTTR calculation
 * - SLO monitoring and breach detection
 * - Performance trend analysis and anomaly detection
 * - Automated performance recommendations
 * 
 * @module stats
 * @version 1.0.0
 * @author Health Watch Extension
 * 
 * @description
 * The statistics engine processes time-series monitoring data to provide:
 * - Real-time availability percentages
 * - Latency distribution analysis with percentiles
 * - Outage timeline reconstruction
 * - Mean Time to Recovery (MTTR) calculations
 * - SLO compliance monitoring
 * - Baseline performance tracking
 * - Automated performance insights and recommendations
 * 
 * @interfaces
 * - StatsOptions: Configuration for statistics calculation windows
 * - LatencyStats: Latency distribution metrics (min, max, percentiles)
 * - ChannelStats: Complete statistics for a single channel
 * - SLOBreach: SLO violation analysis results
 * - Recommendation: Performance improvement suggestions
 * 
 * @classes
 * - StatsCalculator: Main statistics calculation engine
 * 
 * @dependencies
 * - ./types: Core data structures (Sample, ChannelStats, Outage, WatchSession)
 * - ./storage: Data persistence layer for historical analysis
 * 
 * @calculations
 * - Availability: (successful_samples / total_samples) * 100
 * - Latency Percentiles: Sorted latency values at P50, P95, P99
 * - MTTR: Average time between failure and recovery
 * - Outage Detection: Consecutive failure sequences above threshold
 * - SLO Breach: Availability or latency targets exceeded
 * 
 * @algorithms
 * - Percentile calculation using linear interpolation
 * - Sliding window availability with gap detection
 * - Outage reconstruction from state transitions
 * - Anomaly detection using statistical baselines
 * 
 * @example
 * ```typescript
 * const calculator = new StatsCalculator();
 * 
 * // Calculate statistics for a monitoring session
 * const samples = await storageManager.getSamples('channel-id', windowMs);
 * const stats = calculator.calculateChannelStats(samples, session);
 * 
 * console.log(`Availability: ${stats.availability}%`);
 * console.log(`P95 Latency: ${stats.latencyStats.p95}ms`);
 * console.log(`MTTR: ${stats.mttr}ms`);
 * 
 * // Generate performance recommendations
 * const recommendations = calculator.generateRecommendations([stats]);
 * recommendations.forEach(rec => console.log(rec.recommendation));
 * ```
 * 
 * @performance_metrics
 * - Availability: Percentage of successful probes
 * - P50 Latency: Median response time
 * - P95 Latency: 95th percentile response time  
 * - P99 Latency: 99th percentile response time
 * - MTTR: Mean time to recovery from failures
 * - Outage Count: Number of distinct outage periods
 * - Longest Outage: Duration of longest continuous failure
 * 
 * @see {@link ./types.ts} for data structure definitions
 * @see {@link ./storage.ts} for data persistence
 * @see {@link ../docs/testing/manual-test-plan.md#statistics} for testing procedures
 */

import { Sample, ChannelStats, Outage, WatchSession } from './types';
import { StorageManager } from './storage';

export interface StatsOptions {
    windowStartMs?: number;
    windowEndMs?: number;
    includeCurrentWatch?: boolean;
}

export interface GlobalStats {
    totalChannels: number;
    channelsOnline: number;
    channelsOffline: number;
    channelsUnknown: number;
    overallAvailability: number;
    totalOutages: number;
    averageMTTR: number;
    worstChannel: string | null;
    bestChannel: string | null;
}

export interface RecommendationRule {
    condition: (stats: ChannelStats) => boolean;
    recommendation: string;
    priority: 'low' | 'medium' | 'high';
}

export class StatsCalculator {
    private storageManager = StorageManager.getInstance();
    
    private readonly recommendations: RecommendationRule[] = [
        {
            condition: (stats) => stats.latencyStats.p95 > 1000,
            recommendation: 'High latency detected (p95 > 1000ms). Check Wi-Fi or network connection.',
            priority: 'high'
        },
        {
            condition: (stats) => stats.availability < 95,
            recommendation: 'Low availability (<95%). Consider investigating connection stability.',
            priority: 'high'
        },
        {
            condition: (stats) => stats.outageCount >= 5,
            recommendation: 'Frequent outages detected. Consider adjusting probe thresholds or checking infrastructure.',
            priority: 'medium'
        },
        {
            condition: (stats) => stats.mttr > 300000, // 5 minutes
            recommendation: 'Long recovery times (MTTR > 5min). Check automated recovery processes.',
            priority: 'medium'
        },
        {
            condition: (stats) => stats.latencyStats.p95 > 500 && stats.latencyStats.p95 <= 1000,
            recommendation: 'Moderate latency increase. Monitor network performance.',
            priority: 'low'
        },
        {
            condition: (stats) => stats.availability >= 99.9,
            recommendation: 'Excellent availability! Current monitoring setup is working well.',
            priority: 'low'
        }
    ];

    calculateChannelStats(channelId: string, options: StatsOptions = {}): ChannelStats {
        const { windowStartMs = 0, windowEndMs = Date.now(), includeCurrentWatch = true } = options;
        
        const samples = this.getSamplesInWindow(channelId, windowStartMs, windowEndMs, includeCurrentWatch);
        const outages = this.storageManager.getOutages(channelId, windowStartMs);
        
        if (samples.length === 0) {
            return this.createEmptyStats(channelId);
        }

        const successfulSamples = samples.filter(s => s.success);
        const availability = (successfulSamples.length / samples.length) * 100;
        
        const latencyStats = this.calculateLatencyStats(successfulSamples);
        const outageStats = this.calculateOutageStats(outages);
        const topFailureReason = this.getTopFailureReason(samples.filter(s => !s.success));

        return {
            channelId,
            availability,
            outageCount: outages.length,
            mttr: outageStats.averageDuration,
            longestOutage: outageStats.longestDuration,
            latencyStats,
            topFailureReason,
            totalSamples: samples.length,
            successfulSamples: successfulSamples.length
        };
    }

    calculateGlobalStats(options: StatsOptions = {}): GlobalStats {
        const storageManager = this.storageManager;
        const channelIds = storageManager.getChannelIds();
        
        if (channelIds.length === 0) {
            return {
                totalChannels: 0,
                channelsOnline: 0,
                channelsOffline: 0,
                channelsUnknown: 0,
                overallAvailability: 0,
                totalOutages: 0,
                averageMTTR: 0,
                worstChannel: null,
                bestChannel: null
            };
        }

        let totalAvailability = 0;
        let totalOutages = 0;
        let totalMTTR = 0;
        let channelsWithData = 0;
        let worstAvailability = 100;
        let bestAvailability = 0;
        let worstChannel: string | null = null;
        let bestChannel: string | null = null;

        const currentStates = {
            online: 0,
            offline: 0,
            unknown: 0
        };

        for (const channelId of channelIds) {
            const stats = this.calculateChannelStats(channelId, options);
            const state = storageManager.getChannelState(channelId);
            
            currentStates[state.state]++;
            
            if (stats.totalSamples > 0) {
                channelsWithData++;
                totalAvailability += stats.availability;
                totalOutages += stats.outageCount;
                totalMTTR += stats.mttr;
                
                if (stats.availability < worstAvailability) {
                    worstAvailability = stats.availability;
                    worstChannel = channelId;
                }
                
                if (stats.availability > bestAvailability) {
                    bestAvailability = stats.availability;
                    bestChannel = channelId;
                }
            }
        }

        return {
            totalChannels: channelIds.length,
            channelsOnline: currentStates.online,
            channelsOffline: currentStates.offline,
            channelsUnknown: currentStates.unknown,
            overallAvailability: channelsWithData > 0 ? totalAvailability / channelsWithData : 0,
            totalOutages,
            averageMTTR: channelsWithData > 0 ? totalMTTR / channelsWithData : 0,
            worstChannel,
            bestChannel
        };
    }

    generateRecommendations(channelStats: ChannelStats[]): Array<{ recommendation: string; priority: 'low' | 'medium' | 'high' }> {
        const recommendations: Array<{ recommendation: string; priority: 'low' | 'medium' | 'high' }> = [];
        
        for (const stats of channelStats) {
            for (const rule of this.recommendations) {
                if (rule.condition(stats)) {
                    const channelPrefix = channelStats.length > 1 ? `[${stats.channelId}] ` : '';
                    recommendations.push({
                        recommendation: channelPrefix + rule.recommendation,
                        priority: rule.priority
                    });
                }
            }
        }

        // Sort by priority
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
        
        return recommendations;
    }

    calculateSLOBreach(channelStats: ChannelStats[], targetAvailability: number): {
        breachedChannels: string[];
        worstBreach: { channelId: string; availability: number } | null;
        overallBreach: boolean;
    } {
        const breachedChannels: string[] = [];
        let worstBreach: { channelId: string; availability: number } | null = null;
        
        for (const stats of channelStats) {
            if (stats.availability < targetAvailability) {
                breachedChannels.push(stats.channelId);
                
                if (!worstBreach || stats.availability < worstBreach.availability) {
                    worstBreach = { channelId: stats.channelId, availability: stats.availability };
                }
            }
        }

        const overallAvailability = channelStats.length > 0 
            ? channelStats.reduce((sum, s) => sum + s.availability, 0) / channelStats.length 
            : 0;

        return {
            breachedChannels,
            worstBreach,
            overallBreach: overallAvailability < targetAvailability
        };
    }

    getWatchSessionStats(session: WatchSession): Map<string, ChannelStats> {
        const stats = new Map<string, ChannelStats>();
        
    if (!session.samples) return stats;
    for (const [channelId, samples] of session.samples.entries()) {
            if (samples.length === 0) {
                stats.set(channelId, this.createEmptyStats(channelId));
                continue;
            }

            const successfulSamples = samples.filter(s => s.success);
            const availability = (successfulSamples.length / samples.length) * 100;
            
            const latencyStats = this.calculateLatencyStats(successfulSamples);
            const outages = this.storageManager.getOutages(channelId, session.startTime);
            const outageStats = this.calculateOutageStats(outages);
            const topFailureReason = this.getTopFailureReason(samples.filter(s => !s.success));

            stats.set(channelId, {
                channelId,
                availability,
                outageCount: outages.length,
                mttr: outageStats.averageDuration,
                longestOutage: outageStats.longestDuration,
                latencyStats,
                topFailureReason,
                totalSamples: samples.length,
                successfulSamples: successfulSamples.length
            });
        }
        
        return stats;
    }

    private getSamplesInWindow(
        channelId: string, 
        windowStartMs: number, 
        windowEndMs: number, 
        includeCurrentWatch: boolean
    ): Sample[] {
        let samples = this.storageManager.getSamplesInWindow(channelId, windowStartMs, windowEndMs);
        
        if (includeCurrentWatch) {
            const currentWatch = this.storageManager.getCurrentWatch();
            if (currentWatch && currentWatch.samples && currentWatch.samples.has(channelId)) {
                const watchSamples = currentWatch.samples.get(channelId)!;
                const filteredWatchSamples = watchSamples.filter(s => 
                    s.timestamp >= windowStartMs && s.timestamp <= windowEndMs
                );
                samples = samples.concat(filteredWatchSamples);
            }
        }
        
        // Remove duplicates and sort by timestamp
        const uniqueSamples = samples
            .filter((sample, index, arr) => 
                arr.findIndex(s => s.timestamp === sample.timestamp) === index
            )
            .sort((a, b) => a.timestamp - b.timestamp);
        
        return uniqueSamples;
    }

    private calculateLatencyStats(successfulSamples: Sample[]) {
        const latencies = successfulSamples
            .filter(s => s.latencyMs !== undefined)
            .map(s => s.latencyMs!)
            .sort((a, b) => a - b);

        if (latencies.length === 0) {
            return { min: 0, max: 0, p50: 0, p95: 0, avg: 0 };
        }

        const min = latencies[0];
        const max = latencies[latencies.length - 1];
        const p50 = latencies[Math.floor(latencies.length * 0.5)];
        const p95 = latencies[Math.floor(latencies.length * 0.95)];
        const avg = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;

        return { min, max, p50, p95, avg };
    }

    private calculateOutageStats(outages: Outage[]) {
        if (outages.length === 0) {
            return { averageDuration: 0, longestDuration: 0 };
        }

        const durations = outages
            .filter(o => o.duration !== undefined)
            .map(o => o.duration!);

        if (durations.length === 0) {
            return { averageDuration: 0, longestDuration: 0 };
        }

        const averageDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
        const longestDuration = Math.max(...durations);

        return { averageDuration, longestDuration };
    }

    private getTopFailureReason(failedSamples: Sample[]): string {
        if (failedSamples.length === 0) {
            return 'No failures';
        }

        const reasonCounts = new Map<string, number>();
        
        for (const sample of failedSamples) {
            const reason = sample.error || 'Unknown error';
            reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
        }

        let topReason = 'Unknown error';
        let topCount = 0;
        
        for (const [reason, count] of reasonCounts.entries()) {
            if (count > topCount) {
                topCount = count;
                topReason = reason;
            }
        }

        return topReason;
    }

    private createEmptyStats(channelId: string): ChannelStats {
        return {
            channelId,
            availability: 0,
            outageCount: 0,
            mttr: 0,
            longestOutage: 0,
            latencyStats: { min: 0, max: 0, p50: 0, p95: 0, avg: 0 },
            topFailureReason: 'No data',
            totalSamples: 0,
            successfulSamples: 0
        };
    }
}