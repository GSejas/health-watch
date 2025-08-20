import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TimelineHeatmapView } from '../../../src/ui/react/timeline/TimelineHeatmapView';

describe('TimelineHeatmapView', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders empty state when no channels provided', () => {
    render(React.createElement(TimelineHeatmapView, { channels: [], states: {}, heatmapData: {} }));
        expect(screen.getByText(/No Heatmap Data/i)).toBeInTheDocument();
    });

    it('renders heatmap cells for channels and uses color helper', () => {
        const channel = { id: 'c1', name: 'Channel 1', type: 'https' };
        const heatmapData: any = {
            c1: [
                { availability: 100 },
                { availability: 50 },
                { availability: 0 }
            ]
        };

        render(React.createElement(TimelineHeatmapView, { channels: [channel], states: {}, heatmapData }));
        const allCells = document.querySelectorAll('.heatmap-cell');
        expect(allCells.length).toBe(3);
        const firstColor = (allCells[0] as HTMLElement).style.backgroundColor;
        expect(firstColor).toMatch(/rgb\(/);
    });
});
