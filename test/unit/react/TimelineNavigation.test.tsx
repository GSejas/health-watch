import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TimelineNavigation } from '../../../src/ui/react/shared/TimelineNavigation';

describe('TimelineNavigation', () => {
    const defaultProps = {
        activeView: 'swimlanes' as const,
        timeRange: '7d',
        refreshInterval: 'off'
    };

    it('renders timeline navigation with correct title', () => {
        render(<TimelineNavigation {...defaultProps} />);
        
        expect(screen.getByText('Health Watch Timeline')).toBeInTheDocument();
    });

    it('renders all view tabs', () => {
        render(<TimelineNavigation {...defaultProps} />);
        
        expect(screen.getByText('Swimlanes')).toBeInTheDocument();
        expect(screen.getByText('Heatmap')).toBeInTheDocument();
        expect(screen.getByText('Incidents')).toBeInTheDocument();
    });

    it('highlights the active view tab', () => {
        render(<TimelineNavigation {...defaultProps} activeView="heatmap" />);
        
        const heatmapTab = screen.getByText('Heatmap').closest('button');
        expect(heatmapTab).toHaveClass('active');
    });

    it('calls onViewChange when tab is clicked', () => {
        const onViewChange = vi.fn();
        render(<TimelineNavigation {...defaultProps} onViewChange={onViewChange} />);
        
        fireEvent.click(screen.getByText('Heatmap'));
        
        expect(onViewChange).toHaveBeenCalledWith('heatmap');
    });

    describe('time range dropdown', () => {
        it('renders time range dropdown when callback provided', () => {
            const onTimeRangeChange = vi.fn();
            render(<TimelineNavigation {...defaultProps} onTimeRangeChange={onTimeRangeChange} />);
            
            expect(screen.getByText('Time range:')).toBeInTheDocument();
            expect(screen.getByText('Last 7 days')).toBeInTheDocument();
        });

        it('does not render time range dropdown when callback not provided', () => {
            render(<TimelineNavigation {...defaultProps} />);
            
            expect(screen.queryByText('Time range:')).not.toBeInTheDocument();
        });

        it('opens dropdown when clicked', () => {
            const onTimeRangeChange = vi.fn();
            render(<TimelineNavigation {...defaultProps} onTimeRangeChange={onTimeRangeChange} />);
            
            const dropdown = screen.getByText('Last 7 days').closest('button');
            fireEvent.click(dropdown!);
            
            expect(screen.getByText('Last hour')).toBeInTheDocument();
            expect(screen.getByText('Last 30 days')).toBeInTheDocument();
        });

        it('calls onTimeRangeChange when option is selected', () => {
            const onTimeRangeChange = vi.fn();
            render(<TimelineNavigation {...defaultProps} onTimeRangeChange={onTimeRangeChange} />);
            
            const dropdown = screen.getByText('Last 7 days').closest('button');
            fireEvent.click(dropdown!);
            
            fireEvent.click(screen.getByText('Last hour'));
            
            expect(onTimeRangeChange).toHaveBeenCalledWith('1h');
        });

        it('closes dropdown after selection', () => {
            const onTimeRangeChange = vi.fn();
            render(<TimelineNavigation {...defaultProps} onTimeRangeChange={onTimeRangeChange} />);
            
            const dropdown = screen.getByText('Last 7 days').closest('button');
            fireEvent.click(dropdown!);
            fireEvent.click(screen.getByText('Last hour'));
            
            expect(screen.queryByText('Last 30 days')).not.toBeInTheDocument();
        });
    });

    describe('refresh interval dropdown', () => {
        it('renders refresh dropdown when callback provided', () => {
            const onRefreshIntervalChange = vi.fn();
            render(<TimelineNavigation {...defaultProps} onRefreshIntervalChange={onRefreshIntervalChange} />);
            
            expect(screen.getByText('Refresh:')).toBeInTheDocument();
            expect(screen.getByText('Off')).toBeInTheDocument();
        });

        it('shows correct refresh interval options', () => {
            const onRefreshIntervalChange = vi.fn();
            render(<TimelineNavigation {...defaultProps} onRefreshIntervalChange={onRefreshIntervalChange} />);
            
            const dropdown = screen.getByText('Off').closest('button');
            fireEvent.click(dropdown!);
            
            expect(screen.getByText('5s')).toBeInTheDocument();
            expect(screen.getByText('30s')).toBeInTheDocument();
            expect(screen.getByText('1m')).toBeInTheDocument();
            expect(screen.getByText('15m')).toBeInTheDocument();
        });

        it('calls onRefreshIntervalChange when option is selected', () => {
            const onRefreshIntervalChange = vi.fn();
            render(<TimelineNavigation {...defaultProps} onRefreshIntervalChange={onRefreshIntervalChange} />);
            
            const dropdown = screen.getByText('Off').closest('button');
            fireEvent.click(dropdown!);
            
            fireEvent.click(screen.getByText('30s'));
            
            expect(onRefreshIntervalChange).toHaveBeenCalledWith('30s');
        });
    });

    describe('refresh button', () => {
        it('renders refresh button when callback provided', () => {
            const onRefresh = vi.fn();
            render(<TimelineNavigation {...defaultProps} onRefresh={onRefresh} />);
            
            const refreshButton = screen.getByTitle('Refresh now');
            expect(refreshButton).toBeInTheDocument();
            expect(refreshButton).toHaveTextContent('🔄');
        });

        it('calls onRefresh when clicked', () => {
            const onRefresh = vi.fn();
            render(<TimelineNavigation {...defaultProps} onRefresh={onRefresh} />);
            
            fireEvent.click(screen.getByTitle('Refresh now'));
            
            expect(onRefresh).toHaveBeenCalled();
        });

        it('does not render refresh button when callback not provided', () => {
            render(<TimelineNavigation {...defaultProps} />);
            
            expect(screen.queryByTitle('Refresh now')).not.toBeInTheDocument();
        });
    });

    describe('dropdown accessibility', () => {
        it('closes dropdown when clicking outside', () => {
            const onTimeRangeChange = vi.fn();
            render(<TimelineNavigation {...defaultProps} onTimeRangeChange={onTimeRangeChange} />);
            
            const dropdown = screen.getByText('Last 7 days').closest('button');
            fireEvent.click(dropdown!);
            
            expect(screen.getByText('Last hour')).toBeInTheDocument();
            
            // Click outside
            fireEvent.mouseDown(document.body);
            
            expect(screen.queryByText('Last hour')).not.toBeInTheDocument();
        });

        it('shows correct arrow direction when dropdown is open/closed', () => {
            const onTimeRangeChange = vi.fn();
            render(<TimelineNavigation {...defaultProps} onTimeRangeChange={onTimeRangeChange} />);
            
            const dropdown = screen.getByText('Last 7 days').closest('button');
            
            // Initially closed - should show down arrow
            expect(dropdown).toHaveTextContent('▼');
            
            // Open dropdown - should show up arrow
            fireEvent.click(dropdown!);
            expect(dropdown).toHaveTextContent('▲');
        });
    });

    describe('responsive behavior', () => {
        it('applies responsive CSS classes', () => {
            render(<TimelineNavigation {...defaultProps} />);
            
            const navigation = screen.getByText('Health Watch Timeline').closest('.timeline-navigation');
            expect(navigation).toBeInTheDocument();
        });
    });

    describe('props handling', () => {
        it('displays correct time range label', () => {
            render(<TimelineNavigation {...defaultProps} timeRange="1h" onTimeRangeChange={() => {}} />);
            
            expect(screen.getByText('Last hour')).toBeInTheDocument();
        });

        it('displays correct refresh interval label', () => {
            render(<TimelineNavigation {...defaultProps} refreshInterval="5s" onRefreshIntervalChange={() => {}} />);
            
            expect(screen.getByText('5s')).toBeInTheDocument();
        });

        it('handles custom time ranges gracefully', () => {
            render(<TimelineNavigation {...defaultProps} timeRange="custom" onTimeRangeChange={() => {}} />);
            
            // Should display the raw value if no matching option found
            expect(screen.getByText('custom')).toBeInTheDocument();
        });
    });
});