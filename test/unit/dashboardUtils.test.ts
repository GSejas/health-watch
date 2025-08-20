import { describe, it, expect } from 'vitest';
import { calculateAverageLatency, generateQuickStats, formatDuration, calculatePercentage, calculateTrend, formatLatency } from '../../src/ui/dashboardUtils';

describe('dashboardUtils pure helpers', () => {
    it('calculateAverageLatency returns 0 when no samples', () => {
        const channels: any[] = [{ id: 'a' }, { id: 'b' }];
        const states = new Map();
        expect(calculateAverageLatency(channels, states)).toBe(0);
    });

    it('calculateAverageLatency averages valid latencies', () => {
        const channels: any[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
        const states = new Map();
        states.set('a', { lastSample: { latencyMs: 100 } });
        states.set('b', { lastSample: { latencyMs: 200 } });
        states.set('c', { lastSample: { latencyMs: 0 } });
        expect(calculateAverageLatency(channels, states)).toBe(150);
    });

    it('generateQuickStats computes availability and status correctly', () => {
        const channels: any[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
        const states = new Map();
        states.set('a', { state: 'online', lastSample: { latencyMs: 10 } });
        states.set('b', { state: 'online', lastSample: { latencyMs: 20 } });
        states.set('c', { state: 'offline' });

        const stats = generateQuickStats(channels, states as any);
        expect(stats.totalCount).toBe(4);
        expect(stats.onlineCount).toBe(2);
        expect(stats.availability).toBe(50);
        // Implementation treats exactly 50% as 'critical' (online > total*0.5 required for 'degraded')
        expect(stats.status).toBe('critical');
    });

    it('formatDuration shows two largest units', () => {
        const ms = ((1 * 24 + 2) * 60 + 30) * 60 * 1000;
        expect(formatDuration(ms)).toMatch(/1d 2h/);
    });

    it('calculatePercentage handles zero denominator and decimals', () => {
        expect(calculatePercentage(1, 0)).toBe(0);
        expect(calculatePercentage(1, 3, 2)).toBeCloseTo(33.33, 2);
    });

    it('calculateTrend respects isHigherBetter false', () => {
        expect(calculateTrend(50, 10, 20, false)).toBe('down');
        expect(calculateTrend(10, 10, 20, false)).toBe('up');
        expect(calculateTrend(15, 10, 20, false)).toBe('stable');
    });

    it('formatLatency returns correct classes and units', () => {
        expect(formatLatency(50)).toEqual({ value: '50ms', class: 'latency-good' });
        expect(formatLatency(150)).toEqual({ value: '150ms', class: 'latency-warning' });
        expect(formatLatency(800)).toEqual({ value: '800ms', class: 'latency-poor' });
        expect(formatLatency(1500)).toEqual({ value: '1.5s', class: 'latency-critical' });
    });
});
