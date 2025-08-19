import { describe, it } from 'mocha';
import * as assert from 'assert';
import { 
    formatRelativeTime, 
    calculateAverageLatency, 
    generateQuickStats,
    formatDuration,
    calculatePercentage,
    calculateTrend,
    formatLatency
} from '../../src/ui/dashboardUtils';
import { ChannelState } from '../../src/types';

describe('Dashboard Utilities', () => {
    describe('formatRelativeTime', () => {
        const now = Date.now();

        it('should format seconds correctly', () => {
            const result = formatRelativeTime(now - 30 * 1000); // 30 seconds ago
            assert.strictEqual(result, '30s ago');
        });

        it('should format minutes correctly', () => {
            const result = formatRelativeTime(now - 5 * 60 * 1000); // 5 minutes ago
            assert.strictEqual(result, '5m ago');
        });

        it('should format hours correctly', () => {
            const result = formatRelativeTime(now - 2 * 60 * 60 * 1000); // 2 hours ago
            assert.strictEqual(result, '2h ago');
        });

        it('should format days as date string', () => {
            const twoDaysAgo = now - 2 * 24 * 60 * 60 * 1000;
            const result = formatRelativeTime(twoDaysAgo);
            assert.strictEqual(result, new Date(twoDaysAgo).toLocaleDateString());
        });
    });

    describe('calculateAverageLatency', () => {
        const createState = (latency?: number): ChannelState => ({
            id: 'test',
            state: 'online' as const,
            consecutiveFailures: 0,
            lastStateChange: Date.now(),
            backoffMultiplier: 1,
            samples: [],
            lastSample: latency ? { timestamp: Date.now(), success: true, latencyMs: latency } : undefined
        });

        it('should calculate average from valid latencies', () => {
            const channels = [
                { id: 'ch1' },
                { id: 'ch2' },
                { id: 'ch3' }
            ];
            const states = new Map([
                ['ch1', createState(100)],
                ['ch2', createState(200)],
                ['ch3', createState(300)]
            ]);

            const result = calculateAverageLatency(channels, states);
            assert.strictEqual(result, 200); // (100 + 200 + 300) / 3
        });

        it('should ignore channels without latency data', () => {
            const channels = [
                { id: 'ch1' },
                { id: 'ch2' },
                { id: 'ch3' }
            ];
            const states = new Map([
                ['ch1', createState(100)],
                ['ch2', createState()], // No latency
                ['ch3', createState(300)]
            ]);

            const result = calculateAverageLatency(channels, states);
            assert.strictEqual(result, 200); // (100 + 300) / 2
        });

        it('should return 0 when no channels have latency data', () => {
            const channels = [{ id: 'ch1' }];
            const states = new Map([['ch1', createState()]]);

            const result = calculateAverageLatency(channels, states);
            assert.strictEqual(result, 0);
        });
    });

    describe('generateQuickStats', () => {
        const createState = (state: 'online' | 'offline' | 'unknown', latency?: number): ChannelState => ({
            id: 'test',
            state,
            consecutiveFailures: 0,
            lastStateChange: Date.now(),
            backoffMultiplier: 1,
            samples: [],
            lastSample: latency ? { timestamp: Date.now(), success: true, latencyMs: latency } : undefined
        });

        it('should calculate healthy status when all channels online', () => {
            const channels = [{ id: 'ch1' }, { id: 'ch2' }];
            const states = new Map([
                ['ch1', createState('online', 100)],
                ['ch2', createState('online', 200)]
            ]);

            const result = generateQuickStats(channels, states);
            assert.strictEqual(result.availability, 100);
            assert.strictEqual(result.onlineCount, 2);
            assert.strictEqual(result.totalCount, 2);
            assert.strictEqual(result.avgLatency, 150);
            assert.strictEqual(result.status, 'healthy');
        });

        it('should calculate degraded status when some channels offline', () => {
            const channels = [{ id: 'ch1' }, { id: 'ch2' }];
            const states = new Map([
                ['ch1', createState('online', 100)],
                ['ch2', createState('offline')]
            ]);

            const result = generateQuickStats(channels, states);
            assert.strictEqual(result.availability, 50);
            assert.strictEqual(result.onlineCount, 1);
            assert.strictEqual(result.totalCount, 2);
            assert.strictEqual(result.status, 'degraded');
        });

        it('should calculate critical status when most channels offline', () => {
            const channels = [{ id: 'ch1' }, { id: 'ch2' }, { id: 'ch3' }];
            const states = new Map([
                ['ch1', createState('online', 100)],
                ['ch2', createState('offline')],
                ['ch3', createState('offline')]
            ]);

            const result = generateQuickStats(channels, states);
            assert.strictEqual(result.availability, 33); // 1/3 * 100 rounded
            assert.strictEqual(result.onlineCount, 1);
            assert.strictEqual(result.totalCount, 3);
            assert.strictEqual(result.status, 'critical');
        });
    });

    describe('formatDuration', () => {
        it('should format seconds', () => {
            assert.strictEqual(formatDuration(30 * 1000), '30s');
        });

        it('should format minutes and seconds', () => {
            assert.strictEqual(formatDuration(90 * 1000), '1m 30s');
        });

        it('should format hours and minutes', () => {
            assert.strictEqual(formatDuration(3900 * 1000), '1h 5m'); // 1 hour 5 minutes
        });

        it('should format days and hours', () => {
            assert.strictEqual(formatDuration(25 * 60 * 60 * 1000), '1d 1h'); // 25 hours
        });
    });

    describe('calculatePercentage', () => {
        it('should calculate percentage correctly', () => {
            assert.strictEqual(calculatePercentage(25, 100), 25.0);
            assert.strictEqual(calculatePercentage(1, 3, 2), 33.33);
        });

        it('should handle division by zero', () => {
            assert.strictEqual(calculatePercentage(10, 0), 0);
        });
    });

    describe('calculateTrend', () => {
        it('should calculate trend for higher-is-better metrics', () => {
            assert.strictEqual(calculateTrend(95, 90, 75, true), 'up');
            assert.strictEqual(calculateTrend(80, 90, 75, true), 'stable');
            assert.strictEqual(calculateTrend(60, 90, 75, true), 'down');
        });

        it('should calculate trend for lower-is-better metrics', () => {
            assert.strictEqual(calculateTrend(50, 100, 200, false), 'up');
            assert.strictEqual(calculateTrend(150, 100, 200, false), 'stable');
            assert.strictEqual(calculateTrend(250, 100, 200, false), 'down');
        });
    });

    describe('formatLatency', () => {
        it('should format good latency', () => {
            const result = formatLatency(50);
            assert.strictEqual(result.value, '50ms');
            assert.strictEqual(result.class, 'latency-good');
        });

        it('should format warning latency', () => {
            const result = formatLatency(200);
            assert.strictEqual(result.value, '200ms');
            assert.strictEqual(result.class, 'latency-warning');
        });

        it('should format poor latency', () => {
            const result = formatLatency(500);
            assert.strictEqual(result.value, '500ms');
            assert.strictEqual(result.class, 'latency-poor');
        });

        it('should format critical latency in seconds', () => {
            const result = formatLatency(2500);
            assert.strictEqual(result.value, '2.5s');
            assert.strictEqual(result.class, 'latency-critical');
        });
    });
});