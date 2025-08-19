/*
╔════════════════════════════════════════════════════════╗
║               HEALTH WATCH DASHBOARD DATA             ║
║   Pure data generation helpers for dashboard views    ║
╚════════════════════════════════════════════════════════╝
*/
// Module: src/ui/dashboardData.ts
// Purpose: Pure data generation helpers for the Health Watch dashboard views.
// Responsibilities:
//  - Transform storage-backed entities into view-friendly data models
//  - Provide pure, testable functions for metrics, timeline, heatmap, incidents
//  - Avoid side-effects; accept `StorageManager` to query persisted data
// Exports:
//  - generateTimelineData, generateHourlyHeatmapData, generateIncidentsData
//  - generateMetricsData, getRecentSamples, generateDashboardData
// Notes:
//  - Keep functions small and side-effect free to enable unit tests and reuse.

import { Sample, ChannelState, WatchSession, Outage, ChannelInfo } from '../types';
import { StorageManager } from '../storage';
import { ChannelDefinition } from '../config';

/**
 * Pure data generation functions for dashboard views.
 * 
 * All functions in this module are pure (no side effects) and designed for:
 * - Easy unit testing
 * - Performance optimization through memoization
 * - Clear data contracts with typed inputs/outputs
 */

// Type definitions for dashboard data structures
export interface TimelineDataPoint {
    availability: number;
    sampleCount: number;
}

export interface TimelineData {
    [channelId: string]: TimelineDataPoint[];
}

export interface HeatmapDataPoint {
    availability: number;
    sampleCount: number;
}

export interface HeatmapData {
    [channelId: string]: HeatmapDataPoint[];
}

export interface DashboardIncident {
    timestamp: number;
    title: string;
    description: string;
    severity: 'critical' | 'warning' | 'info';
    type: 'outage' | 'recovery' | 'maintenance';
    channel: string;
    duration?: number;
    impact: string;
}

export interface ChannelMetrics {
    availability: number;
    averageLatency: number;
    p95Latency: number;
    outageCount: number;
}

export interface DashboardMetrics {
    totalChannels: number;
    onlineChannels: number;
    overallAvailability: number;
    averageLatency: number;
    p95Latency: number;
    totalOutages: number;
    channelMetrics: Record<string, ChannelMetrics>;
    // Legacy UI compatibility structure
    availability: {
        value: number;
        trend: 'up' | 'stable' | 'down';
        trendText: string;
        subtitle: string;
        uptime: string;
        slo: number;
        sloClass: string;
    };
    latency: {
        p95: number;
        avg: number;
        max: number;
        trend: 'up' | 'stable' | 'down';
        trendText: string;
    };
    incidents: {
        total: number;
        critical: number;
        warnings: number;
        trend: 'up' | 'stable' | 'down';
        trendText: string;
    };
    mttr: {
        average: number;
        fastest: number;
        longest: number;
        trend: 'up' | 'stable' | 'down';
        trendText: string;
    };
    channels: Record<string, any>;
}

export interface RecentSample {
    channelId: string;
    channelName: string;
    timestamp: number;
    success: boolean;
    latencyMs?: number;
    error?: string;
}

export interface DashboardData {
    channels: ChannelDefinition[];
    states: Map<string, ChannelState>;
    currentWatch?: WatchSession;
    metrics: DashboardMetrics;
    recentSamples: RecentSample[];
    timelineData: TimelineData;
    heatmapData: HeatmapData;
    incidents: DashboardIncident[];
}

/**
 * Generates timeline data showing availability over multiple days
 */
export function generateTimelineData(
    channels: ChannelDefinition[],
    days: number,
    storageManager: StorageManager
): TimelineData {
    const data: TimelineData = {};
    const now = Date.now();
    const msPerDay = 24 * 60 * 60 * 1000;
    
    for (const channel of channels) {
        data[channel.id] = [];
        for (let day = 0; day < days; day++) {
            const startTime = now - ((days - day) * msPerDay);
            const endTime = now - ((days - day - 1) * msPerDay);
            
            // Get real samples from storage for this day
            const samples = storageManager.getSamplesInWindow(channel.id, startTime, endTime);
            
            let availability = 100;
            if (samples.length > 0) {
                const successfulSamples = samples.filter(s => s.success);
                availability = (successfulSamples.length / samples.length) * 100;
            } else {
                // No data available for this day
                availability = 0;
            }
            
            data[channel.id].push({ availability, sampleCount: samples.length });
        }
    }
    
    return data;
}

/**
 * Generates hourly heatmap data showing availability patterns
 */
export function generateHourlyHeatmapData(
    channels: ChannelDefinition[],
    days: number,
    storageManager: StorageManager
): HeatmapData {
    const data: HeatmapData = {};
    const now = Date.now();
    const msPerHour = 60 * 60 * 1000;
    
    for (const channel of channels) {
        data[channel.id] = [];
        for (let hour = 0; hour < days * 24; hour++) {
            const startTime = now - ((days * 24 - hour) * msPerHour);
            const endTime = now - ((days * 24 - hour - 1) * msPerHour);
            
            // Get real samples from storage for this hour
            const samples = storageManager.getSamplesInWindow(channel.id, startTime, endTime);
            
            let availability = 100;
            if (samples.length > 0) {
                const successfulSamples = samples.filter(s => s.success);
                availability = (successfulSamples.length / samples.length) * 100;
            } else {
                // No data available for this hour
                availability = 0;
            }
            
            data[channel.id].push({ availability, sampleCount: samples.length });
        }
    }
    
    return data;
}

/**
 * Generates incidents data from outages and other events
 */
export function generateIncidentsData(
    channels: ChannelDefinition[],
    days: number,
    storageManager: StorageManager
): DashboardIncident[] {
    const now = Date.now();
    const windowStart = now - (days * 24 * 60 * 60 * 1000);
    
    // Get real outages from storage
    const outages = storageManager.getOutages(undefined, windowStart);
    const incidents: DashboardIncident[] = [];
    
    for (const outage of outages) {
        const channel = channels.find(c => c.id === outage.channelId);
        
        // Add outage start incident
        const impactDuration = outage.actualDuration || outage.duration;
        const impactMinutes = impactDuration ? Math.round(impactDuration / (60 * 1000)) : undefined;
        
        // Create enhanced description showing actual vs detected impact  
        let description = `Service became unavailable. Reason: ${outage.reason || 'Unknown'}`;
        if (outage.actualDuration && outage.duration && outage.actualDuration !== outage.duration) {
            const detectedMinutes = Math.round(outage.duration / (60 * 1000));
            description += ` (Impact: ${impactMinutes}m, detected after ${Math.round((outage.confirmedAt || outage.startTime) - (outage.firstFailureTime || outage.startTime)) / (60 * 1000)}m)`;
        }
        
        incidents.push({
            timestamp: outage.firstFailureTime || outage.startTime,  // Show actual start time
            title: `${channel?.name || outage.channelId} Outage Started`,
            description: description,
            severity: 'critical',
            type: 'outage',
            channel: channel?.name || outage.channelId,
            duration: impactMinutes,
            impact: '100% of requests affected'
        });
        
        // Add recovery incident if outage ended
        if (outage.endTime) {
            incidents.push({
                timestamp: outage.endTime,
                title: `${channel?.name || outage.channelId} Service Recovered`,
                description: `Service restored after ${impactMinutes || 'unknown'} minutes of impact`,
                severity: 'info',
                type: 'recovery',
                channel: channel?.name || outage.channelId,
                duration: impactMinutes,
                impact: 'Service fully restored'
            });
        }
    }
    
    // If no real incidents, add some demo data to show the UI
    if (incidents.length === 0) {
        incidents.push({
            timestamp: now - 2 * 60 * 60 * 1000, // 2 hours ago
            title: 'No Recent Incidents',
            description: 'All services are running smoothly. This is a placeholder incident to demonstrate the interface.',
            severity: 'info',
            type: 'recovery',
            channel: 'System',
            impact: 'Demo data'
        });
    }
    
    return incidents.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Calculates percentile from sorted array of numbers
 */
function calculatePercentile(sortedNumbers: number[], percentile: number): number {
    if (sortedNumbers.length === 0) return 0;
    
    const index = Math.ceil((percentile / 100) * sortedNumbers.length) - 1;
    return sortedNumbers[Math.max(0, index)];
}

/**
 * Generates comprehensive metrics data for dashboard
 */
export function generateMetricsData(
    channels: ChannelDefinition[],
    states: Map<string, ChannelState>,
    storageManager: StorageManager
): DashboardMetrics {
    const totalChannels = channels.length;
    let online = 0;
    const now = Date.now();
    const last7Days = 7 * 24 * 60 * 60 * 1000;
    
    // Calculate real availability and latency metrics
    let totalAvailability = 0;
    let totalLatencies: number[] = [];
    const channelMetrics: Record<string, ChannelMetrics> = {};
    
    for (const channel of channels) {
        const state = states.get(channel.id);
        if (state?.state === 'online') { online++; }
        
        // Get samples from the last 7 days
        const samples = storageManager.getSamplesInWindow(channel.id, now - last7Days, now);
        
        let channelAvailability = 100;
        const channelLatencies: number[] = [];
        
        if (samples.length > 0) {
            const successfulSamples = samples.filter(s => s.success);
            channelAvailability = (successfulSamples.length / samples.length) * 100;
            
            // Collect latency data from successful samples
            successfulSamples.forEach(s => {
                if (s.latencyMs) {
                    totalLatencies.push(s.latencyMs);
                    channelLatencies.push(s.latencyMs);
                }
            });
        }
        
        // Get outages for this channel in the last 7 days
        const outages = storageManager.getOutages(channel.id, now - last7Days);
        
        // Calculate channel-specific metrics
        channelLatencies.sort((a, b) => a - b);
        channelMetrics[channel.id] = {
            availability: channelAvailability,
            averageLatency: channelLatencies.length > 0 
                ? channelLatencies.reduce((sum, lat) => sum + lat, 0) / channelLatencies.length 
                : 0,
            p95Latency: calculatePercentile(channelLatencies, 95),
            outageCount: outages.length
        };
        
        totalAvailability += channelAvailability;
    }
    
    // Calculate overall metrics
    const overallAvailability = totalChannels > 0 ? totalAvailability / totalChannels : 100;
    totalLatencies.sort((a, b) => a - b);
    const averageLatency = totalLatencies.length > 0 
        ? totalLatencies.reduce((sum, lat) => sum + lat, 0) / totalLatencies.length 
        : 0;
    const p95Latency = calculatePercentile(totalLatencies, 95);
    
    // Get total outages across all channels
    const allOutages = storageManager.getOutages(undefined, now - last7Days);
    const totalIncidents = allOutages.length;
    const criticalIncidents = allOutages.filter(o => !o.endTime).length; // Ongoing outages
    
    // Calculate MTTR from resolved outages
    const resolvedOutages = allOutages.filter(o => o.endTime && o.duration);
    const mttrValues = resolvedOutages.map(o => o.duration! / (60 * 1000)); // Convert to minutes
    const avgMTTR = mttrValues.length > 0 ? mttrValues.reduce((sum, val) => sum + val, 0) / mttrValues.length : 0;
    const fastestMTTR = mttrValues.length > 0 ? Math.min(...mttrValues) : 0;
    const longestMTTR = mttrValues.length > 0 ? Math.max(...mttrValues) : 0;
    
    // Calculate max latency for legacy structure
    const maxLatency = totalLatencies.length > 0 ? Math.max(...totalLatencies) : 0;

    return {
        totalChannels,
        onlineChannels: online,
        overallAvailability,
        averageLatency,
        p95Latency,
        totalOutages: totalIncidents,
        channelMetrics,
        // Legacy UI compatibility structure
        availability: {
            value: overallAvailability,
            trend: overallAvailability >= 95 ? 'up' : overallAvailability >= 85 ? 'stable' : 'down',
            trendText: overallAvailability >= 95 ? 'Good' : overallAvailability >= 85 ? 'Fair' : 'Poor',
            subtitle: `${online}/${totalChannels} services online`,
            uptime: `${overallAvailability.toFixed(1)}%`,
            slo: 99.5,
            sloClass: overallAvailability >= 99 ? '' : overallAvailability >= 95 ? 'slo-warning' : 'slo-critical'
        },
        latency: {
            p95: Math.round(p95Latency),
            avg: Math.round(averageLatency),
            max: Math.round(maxLatency),
            trend: p95Latency <= 200 ? 'up' : p95Latency <= 500 ? 'stable' : 'down',
            trendText: p95Latency <= 200 ? 'Fast' : p95Latency <= 500 ? 'OK' : 'Slow'
        },
        incidents: {
            total: totalIncidents,
            critical: criticalIncidents,
            warnings: totalIncidents - criticalIncidents,
            trend: totalIncidents <= 2 ? 'up' : totalIncidents <= 5 ? 'stable' : 'down',
            trendText: totalIncidents <= 2 ? 'Low' : totalIncidents <= 5 ? 'Moderate' : 'High'
        },
        mttr: {
            average: Math.round(avgMTTR),
            fastest: Math.round(fastestMTTR),
            longest: Math.round(longestMTTR),
            trend: avgMTTR <= 15 ? 'up' : avgMTTR <= 30 ? 'stable' : 'down',
            trendText: avgMTTR <= 15 ? 'Fast Recovery' : avgMTTR <= 30 ? 'Average' : 'Slow Recovery'
        },
        channels: channelMetrics
    };
}

/**
 * Gets recent samples across all channels for activity display
 */
export function getRecentSamples(
    channels: ChannelDefinition[],
    limit: number,
    storageManager: StorageManager
): RecentSample[] {
    const allSamples: RecentSample[] = [];
    
    for (const channel of channels) {
        try {
            // Try to get recent samples from storage
            const channelState = storageManager.getChannelState(channel.id);
            if (channelState && channelState.samples) {
                // Get the most recent samples (up to 5 per channel to avoid overwhelming the display)
                const recentChannelSamples = channelState.samples
                    .slice(-5)
                    .map(sample => ({
                        channelId: channel.id,
                        channelName: channel.name || channel.id,
                        timestamp: sample.timestamp,
                        success: sample.success,
                        latencyMs: sample.latencyMs,
                        error: sample.error
                    }));
                
                allSamples.push(...recentChannelSamples);
            }
        } catch (error) {
            console.warn(`Failed to get samples for channel ${channel.id}:`, error);
        }
    }
    
    // Sort by timestamp (newest first) and limit results
    return allSamples
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);
}

/**
 * Orchestrates the collection of all dashboard data
 */
export function generateDashboardData(
    channels: ChannelDefinition[],
    states: Map<string, ChannelState>,
    currentWatch: WatchSession | undefined,
    storageManager: StorageManager
): DashboardData {
    const metrics = generateMetricsData(channels, states, storageManager);
    const recentSamples = getRecentSamples(channels, 20, storageManager);
    const timelineData = generateTimelineData(channels, 7, storageManager);
    const heatmapData = generateHourlyHeatmapData(channels, 3, storageManager);
    const incidents = generateIncidentsData(channels, 7, storageManager);
    
    return {
        channels,
        states,
        currentWatch,
        metrics,
        recentSamples,
        timelineData,
        heatmapData,
        incidents
    };
}