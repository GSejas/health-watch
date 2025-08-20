import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';

import MetricsView from '../../../src/ui/react/metrics/MetricsView';
import * as dashboardUtils from '../../../src/ui/dashboardUtils';

describe('MetricsView focused behavior', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('applies correct value classes for status, availability and latency', () => {
        const channels = [
            { id: 'ch1', name: 'Service A' },
            { id: 'ch2', name: 'Service B' },
            { id: 'ch3', name: 'Service C' },
        ];

        const states = {
            ch1: { state: 'online', lastSample: { latencyMs: 50, timestamp: 1000 } },
            ch2: { state: 'offline', lastSample: { latencyMs: 400, timestamp: 2000 } },
            ch3: { state: 'degraded', lastSample: { latencyMs: 200, timestamp: 3000 } },
        } as any;

        const metricsData: any = {
            availability: { value: 96.5, trend: 'up', trendText: '+', subtitle: 'OK', sloClass: 'slo-ok', uptime: '99.9', slo: 99 },
            latency: { p95: 120, trend: 'down', trendText: '-', avg: 110, max: 250 },
            incidents: { total: 2, trend: 'stable', trendText: '', critical: 1, warnings: 1 },
            mttr: { average: 5, trend: 'stable', trendText: '', fastest: 1, longest: 10 },
            channelMetrics: {
                ch1: { availability: 99.2 },
                ch2: { availability: 80.4 },
                ch3: { availability: 90.0 },
            }
        };

        // make formatRelativeTime deterministic
        vi.spyOn(dashboardUtils, 'formatRelativeTime').mockReturnValue('5 minutes ago');

        render(<MetricsView channels={channels} states={states} metricsData={metricsData} />);

        // For each channel row, check the metric-value class ordering:
        channels.forEach(ch => {
            const nameEl = screen.getByText(new RegExp(ch.name));
            const row = nameEl.closest('.channel-row') as HTMLElement;
            expect(row).toBeTruthy();

            const metricValues = Array.from(row.querySelectorAll('.metric-value')) as HTMLElement[];
            // metricValues[0] -> status (ONLINE/OFFLINE/DEGRADED), [1] -> availability, [2] -> latency
            const statusEl = metricValues[0];
            const availabilityEl = metricValues[1];
            const latencyEl = metricValues[2];

            if (ch.id === 'ch1') {
                expect(statusEl.classList.contains('value-good')).toBe(true);
                expect(availabilityEl.classList.contains('value-good')).toBe(true);
                expect(latencyEl.classList.contains('value-good')).toBe(true);
            }

            if (ch.id === 'ch2') {
                expect(statusEl.classList.contains('value-bad')).toBe(true);
                expect(availabilityEl.classList.contains('value-bad')).toBe(true);
                expect(latencyEl.classList.contains('value-bad')).toBe(true);
            }

            if (ch.id === 'ch3') {
                // degraded -> should map to 'value-warning' for status
                expect(statusEl.classList.contains('value-warning')).toBe(true);
                // availability 90 -> warning
                expect(availabilityEl.classList.contains('value-warning')).toBe(true);
                // latency 200 -> warning
                expect(latencyEl.classList.contains('value-warning')).toBe(true);
            }
        });

        // Ensure formatRelativeTime was used for the last column
        expect(screen.getAllByText('5 minutes ago').length).toBeGreaterThan(0);
        expect((dashboardUtils.formatRelativeTime as any).mock.calls.length).toBeGreaterThan(0);
    });

    it('renders 24 deterministic performance bars when Math.random is mocked', () => {
        // Make Math.random return 0.5 so computed height = 0.5*40 + 10 = 30px
        const rnd = vi.spyOn(Math, 'random').mockReturnValue(0.5);

        const channels: any[] = [];
        const states = {} as any;
        const metricsData: any = {
            availability: { value: 99, trend: 'up', trendText: '', subtitle: '', sloClass: '', uptime: '', slo: 99 },
            latency: { p95: 120, trend: 'stable', trendText: '', avg: 110, max: 250 },
            incidents: { total: 0, trend: 'stable', trendText: '', critical: 0, warnings: 0 },
            mttr: { average: 0, trend: 'stable', trendText: '', fastest: 0, longest: 0 },
            channelMetrics: {}
        };

        render(<MetricsView channels={channels} states={states} metricsData={metricsData} />);

        const bars = document.querySelectorAll('.perf-bar');
        expect(bars.length).toBe(24);
        bars.forEach((b) => {
            const el = b as HTMLElement;
            expect(el.style.height).toBe('30px');
        });

        rnd.mockRestore();
    });

    it('calls formatRelativeTime with the channel last sample timestamp', () => {
        const channels = [{ id: 'cX', name: 'X' }];
        const states = { cX: { state: 'online', lastSample: { latencyMs: 10, timestamp: 987654 } } } as any;
        const metricsData: any = {
            availability: { value: 99, trend: 'up', trendText: '', subtitle: '', sloClass: '', uptime: '', slo: 99 },
            latency: { p95: 10, trend: 'stable', trendText: '', avg: 5, max: 11 },
            incidents: { total: 0, trend: 'stable', trendText: '', critical: 0, warnings: 0 },
            mttr: { average: 0, trend: 'stable', trendText: '', fastest: 0, longest: 0 },
            channelMetrics: { cX: { availability: 99 } }
        };

        const spy = vi.spyOn(dashboardUtils, 'formatRelativeTime').mockReturnValue('a moment ago');

        render(<MetricsView channels={channels} states={states} metricsData={metricsData} />);

        expect(spy).toHaveBeenCalledWith(987654);
        expect(screen.getByText('a moment ago')).toBeInTheDocument();
    });
});
// ...removed duplicate block; file contains only the focused MetricsView tests above...
