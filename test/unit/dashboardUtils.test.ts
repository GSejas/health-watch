import { describe, it } from 'mocha';
import { strict as assert } from 'assert';
import { calculateAverageLatency, generateQuickStats, formatDuration, calculatePercentage, calculateTrend, formatLatency } from '../../src/ui/dashboardUtils';
import { formatRemaining } from '../../src/ui/dashboardUtils';

describe('dashboardUtils pure helpers', () => {
    it('calculateAverageLatency returns 0 when no samples', () => {
        const channels: any[] = [{ id: 'a' }, { id: 'b' }];
        const states = new Map();
        assert.equal(calculateAverageLatency(channels, states), 0);
    });

    it('calculateAverageLatency averages valid latencies', () => {
        const channels: any[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
        const states = new Map();
        states.set('a', { lastSample: { latencyMs: 100 } });
        states.set('b', { lastSample: { latencyMs: 200 } });
        states.set('c', { lastSample: { latencyMs: 0 } });
        assert.equal(calculateAverageLatency(channels, states), 150);
    });

    it('generateQuickStats computes availability and status correctly', () => {
        const channels: any[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
        const states = new Map();
        states.set('a', { state: 'online', lastSample: { latencyMs: 10 } });
        states.set('b', { state: 'online', lastSample: { latencyMs: 20 } });
        states.set('c', { state: 'offline' });

        const stats = generateQuickStats(channels, states as any);
        assert.equal(stats.totalCount, 4);
        assert.equal(stats.onlineCount, 2);
        assert.equal(stats.availability, 50);
        // Implementation treats exactly 50% as 'critical' (online > total*0.5 required for 'degraded')
        assert.equal(stats.status, 'critical');
    });

    it('formatDuration shows two largest units', () => {
        const ms = ((1 * 24 + 2) * 60 + 30) * 60 * 1000;
        assert.match(formatDuration(ms), /1d 2h/);
    });

    it('calculatePercentage handles zero denominator and decimals', () => {
        assert.equal(calculatePercentage(1, 0), 0);
        assert.ok(Math.abs(calculatePercentage(1, 3, 2) - 33.33) < 0.01);
    });

    it('calculateTrend respects isHigherBetter false', () => {
        assert.equal(calculateTrend(50, 10, 20, false), 'down');
        assert.equal(calculateTrend(10, 10, 20, false), 'up');
        assert.equal(calculateTrend(15, 10, 20, false), 'stable');
    });

    it('formatLatency returns correct classes and units', () => {
        assert.deepEqual(formatLatency(50), { value: '50ms', class: 'latency-good' });
        assert.deepEqual(formatLatency(150), { value: '150ms', class: 'latency-warning' });
        assert.deepEqual(formatLatency(800), { value: '800ms', class: 'latency-poor' });
        assert.deepEqual(formatLatency(1500), { value: '1.5s', class: 'latency-critical' });
    });

    it('formatRemaining handles null, ended, and time strings', () => {
        assert.equal(formatRemaining(null), 'Forever');
        assert.equal(formatRemaining(undefined), 'Forever');
        assert.equal(formatRemaining(0), 'Ended');
        const res = formatRemaining(45 * 1000);
        assert.equal(typeof res, 'string');
    });
});
