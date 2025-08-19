/**
 * Utility functions for dashboard calculations and formatting.
 * 
 * All functions in this module are pure (no side effects) and designed for:
 * - Easy unit testing
 * - High reusability across modules
 * - Performance optimization
 */

import { ChannelState, ChannelInfo } from '../types';

/**
 * Formats a timestamp into a human-readable relative time string
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted relative time string (e.g., "5m ago", "2h ago")
 */
export function formatRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) {
        return `${seconds}s ago`;
    } else if (minutes < 60) {
        return `${minutes}m ago`;
    } else if (hours < 24) {
        return `${hours}h ago`;
    } else {
        return new Date(timestamp).toLocaleDateString();
    }
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
 * Formats a duration in milliseconds to a human-readable string
 * @param durationMs - Duration in milliseconds
 * @returns Formatted duration string (e.g., "2h 30m", "45m", "30s")
 */
export function formatDuration(durationMs: number): string {
    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
        return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
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