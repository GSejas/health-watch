import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LiveMonitorView } from '../../../src/ui/react/monitor/LiveMonitorView';

const defaultProps: any = {
    channels: [{ id: 'c1', name: 'C1' }],
    states: { 'c1': { state: 'online', lastSample: { timestamp: Date.now(), latencyMs: 50 } } },
    recentSamples: [{ timestamp: Date.now(), channelName: 'C1', success: true, latencyMs: 50 }]
};

describe('LiveMonitorView', () => {
    it('renders live monitor header and stats', () => {
        render(<LiveMonitorView {...defaultProps} />);
        expect(screen.getByText(/Live Monitor/i)).toBeInTheDocument();
        expect(screen.getByText(/Channel Status/i)).toBeInTheDocument();
        expect(screen.getByText(/Recent Activity/i)).toBeInTheDocument();
    });
});
