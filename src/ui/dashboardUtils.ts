/**
 * Utility functions for dashboard calculations and formatting.
 * 
 * All functions in this module are pure (no side effects) and designed for:
 * - Easy unit testing
 * - High reusability across modules
 * - Performance optimization
 */

import { ChannelState, ChannelInfo } from '../types';
import { formatDistanceToNow, intervalToDuration, formatDuration as dateFnsFormatDuration, format } from 'date-fns';

/**
 * Formats a timestamp into a human-readable relative time string using date-fns
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted relative time string (e.g., "5 minutes ago", "2 hours ago")
 */
export function formatRelativeTime(timestamp: number): string {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
}

/**
 * Calculates the average latency across all channels with valid samples
 * @param channels - Array of channel definitions
 * @param states - Map of channel states containing sample data
 * @returns Average latency in milliseconds, rounded to nearest integer
 */
export function calculateAverageLatency(channels: Array<{ id: string }>, states: Map<string, ChannelState>): number {
    const latencies = channels
        .map(ch => states.get(ch.id)?.lastSample?.latencyMs)
        .filter((lat): lat is number => typeof lat === 'number' && lat > 0);
    
    return latencies.length > 0 
        ? Math.round(latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length)
        : 0;
}

/**
 * Interface for quick stats summary
 */
export interface QuickStats {
    availability: number;
    onlineCount: number;
    totalCount: number;
    avgLatency: number;
    status: 'healthy' | 'degraded' | 'critical';
}

/**
 * Generates quick statistics summary for dashboard header/status displays
 * @param channels - Array of channel definitions
 * @param states - Map of channel states
 * @returns Quick stats object with availability, counts, latency, and overall status
 */
export function generateQuickStats(channels: Array<{ id: string }>, states: Map<string, ChannelState>): QuickStats {
    const online = channels.filter(ch => states.get(ch.id)?.state === 'online').length;
    const total = channels.length;
    const avgLatency = calculateAverageLatency(channels, states);
    
    return {
        availability: total > 0 ? Math.round((online / total) * 100) : 0,
        onlineCount: online,
        totalCount: total,
        avgLatency: avgLatency,
        status: online === total ? 'healthy' : online > total * 0.5 ? 'degraded' : 'critical'
    };
}

/**
 * Formats a duration in milliseconds into a human-readable string using date-fns
 * @param durationMs - Duration in milliseconds
 * @returns Formatted duration string (e.g., "2h 30m", "45m", "30s")
 */
export function formatDuration(durationMs: number): string {
    const duration = intervalToDuration({ start: 0, end: durationMs });
    
    // Custom formatter to match our existing format
    const parts = [];
    if (duration.days) parts.push(`${duration.days}d`);
    if (duration.hours) parts.push(`${duration.hours}h`);
    if (duration.minutes) parts.push(`${duration.minutes}m`);
    if (duration.seconds && parts.length < 2) parts.push(`${duration.seconds}s`); // Only show seconds if not too verbose
    
    return parts.slice(0, 2).join(' ') || '0s'; // Show max 2 units, fallback to "0s"
}

/**
 * Formats a timestamp into a compact string format for filenames using date-fns
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted timestamp string (e.g., "20241219-1430")
 */
export function formatTimestamp(timestamp: number): string {
    return format(new Date(timestamp), 'yyyyMMdd-HHmm');
}

/**
 * Formats watch duration handling different input formats using date-fns
 * @param watch - Watch object with duration property
 * @returns Formatted duration string (e.g., "2h 30m", "Forever")
 */
export function formatWatchDuration(watch: any): string {
    if (watch.duration === 'forever') {
        return 'Forever';
    }
    
    if (typeof watch.duration === 'string') {
        return watch.duration;
    }
    
    const ms = typeof watch.duration === 'number' ? watch.duration : 60 * 60 * 1000;
    return formatDuration(ms);
}

/**
 * Calculates percentage with safe division by zero handling
 * @param numerator - The numerator value
 * @param denominator - The denominator value
 * @param decimals - Number of decimal places (default: 1)
 * @returns Percentage as number, 0 if denominator is 0
 */
export function calculatePercentage(numerator: number, denominator: number, decimals: number = 1): number {
    if (denominator === 0) return 0;
    return Number(((numerator / denominator) * 100).toFixed(decimals));
}

/**
 * Determines trend direction based on current value and thresholds
 * @param value - Current value to evaluate
 * @param goodThreshold - Threshold for "good" status
 * @param warningThreshold - Threshold for "warning" status
 * @param isHigherBetter - Whether higher values are better (default: true)
 * @returns Trend direction
 */
export function calculateTrend(
    value: number, 
    goodThreshold: number, 
    warningThreshold: number, 
    isHigherBetter: boolean = true
): 'up' | 'stable' | 'down' {
    if (isHigherBetter) {
        if (value >= goodThreshold) return 'up';
        if (value >= warningThreshold) return 'stable';
        return 'down';
    } else {
        if (value <= goodThreshold) return 'up';
        if (value <= warningThreshold) return 'stable';
        return 'down';
    }
}

/**
 * Formats latency value with appropriate units and color indicators
 * @param latencyMs - Latency in milliseconds
 * @returns Object with formatted value and severity class
 */
export function formatLatency(latencyMs: number): { value: string; class: string } {
    if (latencyMs < 100) {
        return { value: `${latencyMs}ms`, class: 'latency-good' };
    } else if (latencyMs < 300) {
        return { value: `${latencyMs}ms`, class: 'latency-warning' };
    } else if (latencyMs < 1000) {
        return { value: `${latencyMs}ms`, class: 'latency-poor' };
    } else {
        return { value: `${(latencyMs / 1000).toFixed(1)}s`, class: 'latency-critical' };
    }
}