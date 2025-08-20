import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { TimelineSwimlanesView } from '../../../src/ui/react/timeline/TimelineSwimlanesView';

describe('TimelineSwimlanesView', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders empty state when no channels provided', () => {
    render(React.createElement(TimelineSwimlanesView, { channels: [], states: {}, timelineData: {}, timeRange: '7D' }));
        expect(screen.getByText(/No Timeline Data/i)).toBeInTheDocument();
    });

    it('sends timeRange change message when selector changes', () => {
        const channel = { id: 'c1', name: 'Channel 1', type: 'https' };
        const timelineData: any = { c1: [{ availability: 100, sampleCount: 1 }] };
    render(React.createElement(TimelineSwimlanesView, { channels: [channel], states: {}, timelineData, timeRange: '7D' }));
    // Find the time range selector within the timeline controls container
    const controls = document.querySelector('.timeline-controls') as HTMLElement | null;
    const select = controls ? within(controls).getByRole('combobox') as HTMLSelectElement : screen.getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: '30D' } });
        expect((window as any).vscode.postMessage).toHaveBeenCalledWith({ command: 'changeTimeRange', timeRange: '30D' });
    });
});
