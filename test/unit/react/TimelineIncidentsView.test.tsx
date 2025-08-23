import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { TimelineIncidentsView } from '../../../src/ui/react/timeline/TimelineIncidentsView';

describe('TimelineIncidentsView', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders empty incidents when none provided', () => {
    render(React.createElement(TimelineIncidentsView, { channels: [], states: {}, incidents: [] }));
        expect(screen.getByText(/No Recent Incidents/i)).toBeInTheDocument();
    });

    it('filters incidents by severity and channel', () => {
        const c1 = { id: 'c1', name: 'Channel 1' };
        const c2 = { id: 'c2', name: 'Channel 2' };
    const incident: any = { id: 'i1', channel: 'c1', severity: 'critical', timestamp: Date.now(), title: 'Down', description: 'Service is down', impact: 'High', duration: 30, type: 'outage' };
    render(React.createElement(TimelineIncidentsView, { channels: [c1, c2], states: {}, incidents: [incident] } as any));
        // Should show the incident initially (match the title element specifically)
        expect(screen.getByText(/Down/i, { selector: '.incident-title' })).toBeInTheDocument();
    // Filter by severity -> choose a severity that hides the incident (scope to the filter-group)
    const severityLabel = screen.getByText(/Severity:/i);
    const severityGroup = severityLabel.closest('.filter-group') as HTMLElement;
    const severitySelect = within(severityGroup).getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(severitySelect, { target: { value: 'low' } });
        expect(screen.getByText(/No Recent Incidents/i)).toBeInTheDocument();
        // Reset severity to all
    fireEvent.change(severitySelect, { target: { value: '' } });
        expect(screen.getByText(/Down/i, { selector: '.incident-title' })).toBeInTheDocument();
        // Filter by channel -> select a different channel (c2) which should hide the c1 incident
    const channelLabel = screen.getByText(/Channel:/i);
    const channelGroup = channelLabel.closest('.filter-group') as HTMLElement;
    const channelSelect = within(channelGroup).getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(channelSelect, { target: { value: 'c2' } });
        expect(screen.getByText(/No Recent Incidents/i)).toBeInTheDocument();
    });
});
