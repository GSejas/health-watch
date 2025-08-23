/**
 * @fileoverview Shared React components tests
 * @module test/unit/react
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TimelineHeatmapView } from '../../../src/ui/react/timeline/TimelineHeatmapView';

// Ensure the global test setup has provided a mock vscode
describe('Shared React Components', () => {
    beforeEach(() => vi.clearAllMocks());

    it('provides a mocked vscode.postMessage', () => {
        expect(typeof (window as any).vscode).toBe('object');
        (window as any).vscode.postMessage({ test: 'ping' });
        expect((window as any).vscode.postMessage).toHaveBeenCalledWith({ test: 'ping' });
    });

    it('renders loading / empty states for heatmap', () => {
        render(React.createElement(TimelineHeatmapView, { channels: [], states: {}, heatmapData: {}, timeRange: '24h' }));
        expect(screen.getByText(/No Heatmap Data/i)).toBeInTheDocument();
    });

    it('captures console.error when a component throws', () => {
        const Bomb: React.FC = () => {
            throw new Error('boom');
        };

        try {
            render(React.createElement(Bomb));
        } catch (e) {
            // React will throw during render; ensure console.error was called
            expect((console.error as any)).toHaveBeenCalled();
            return;
        }

        // If no throw occurred, that is unexpected
        expect(true).toBe(false);
    });
});