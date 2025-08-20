import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { OverviewView } from '../../../src/ui/react/overview/OverviewView';

// Mock window.vscode
const mockVSCode = {
    postMessage: vi.fn()
};
Object.defineProperty(window, 'vscode', {
    value: mockVSCode,
    writable: true
});

describe('OverviewView', () => {
    const mockChannels = [
        {
            id: 'channel-1',
            name: 'Test Service',
            type: 'https',
            url: 'https://example.com'
        },
        {
            id: 'channel-2',
            name: 'Database',
            type: 'tcp',
            target: 'db.example.com:5432'
        }
    ];

    const mockStates = {
        'channel-1': {
            state: 'online',
            lastSample: {
                timestamp: Date.now() - 5000,
                ok: true,
                latencyMs: 150
            },
            consecutiveFailures: 0,
            totalChecks: 100,
            totalFailures: 2
        },
        'channel-2': {
            state: 'offline',
            lastSample: {
                timestamp: Date.now() - 10000,
                ok: false,
                error: 'Connection timeout'
            },
            consecutiveFailures: 5,
            totalChecks: 50,
            totalFailures: 10
        }
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('metrics display', () => {
        it('calculates and displays correct availability metrics', () => {
            render(<OverviewView channels={mockChannels} states={mockStates} />);
            
            // 1 online out of 2 channels = 50% availability
            expect(screen.getByText('50%')).toBeInTheDocument();
            expect(screen.getByText('1/2 services online')).toBeInTheDocument();
        });

        it('displays individual metric cards', () => {
            render(<OverviewView channels={mockChannels} states={mockStates} />);
            
            expect(screen.getByText('Availability')).toBeInTheDocument();
            expect(screen.getByText('Online')).toBeInTheDocument();
            expect(screen.getByText('Offline')).toBeInTheDocument();
            expect(screen.getByText('Unknown')).toBeInTheDocument();

            // Scope counts to their metric cards to avoid ambiguous matches
            const onlineCard = screen.getByText('Online').closest('.metric-card') as HTMLElement;
            expect(within(onlineCard).getByText('1')).toBeInTheDocument();
            const offlineCard = screen.getByText('Offline').closest('.metric-card') as HTMLElement;
            expect(within(offlineCard).getByText('1')).toBeInTheDocument();
            const unknownCard = screen.getByText('Unknown').closest('.metric-card') as HTMLElement;
            expect(within(unknownCard).getByText('0')).toBeInTheDocument();
        });

        it('handles zero channels gracefully', () => {
            render(<OverviewView channels={[]} states={{}} />);
            
            expect(screen.getByText('0%')).toBeInTheDocument();
            expect(screen.getByText('0/0 services online')).toBeInTheDocument();
        });
    });

    describe('channel cards', () => {
        it('renders channel cards with correct information', () => {
            render(<OverviewView channels={mockChannels} states={mockStates} />);
            
            expect(screen.getByText('Test Service')).toBeInTheDocument();
            expect(screen.getByText('Database')).toBeInTheDocument();
            expect(screen.getByText('HTTPS')).toBeInTheDocument();
            expect(screen.getByText('TCP')).toBeInTheDocument();
        });

        it('displays channel status badges correctly', () => {
            render(<OverviewView channels={mockChannels} states={mockStates} />);
            
            expect(screen.getByText('ONLINE')).toBeInTheDocument();
            expect(screen.getByText('OFFLINE')).toBeInTheDocument();
        });

        it('shows latency information', () => {
            render(<OverviewView channels={mockChannels} states={mockStates} />);
            
            expect(screen.getByText('150ms')).toBeInTheDocument();
            expect(screen.getByText('N/A')).toBeInTheDocument(); // For offline channel
        });

        it('displays URLs and targets correctly', () => {
            render(<OverviewView channels={mockChannels} states={mockStates} />);
            
            expect(screen.getByText('https://example.com')).toBeInTheDocument();
            expect(screen.getByText('db.example.com:5432')).toBeInTheDocument();
        });

        it('shows error messages for failed channels', () => {
            render(<OverviewView channels={mockChannels} states={mockStates} />);
            
            expect(screen.getByText('Connection timeout')).toBeInTheDocument();
        });

        it('displays last check timestamps', () => {
            render(<OverviewView channels={mockChannels} states={mockStates} />);
            
            // Should show relative time like "5 seconds ago" scoped per channel card
            const channel1 = screen.getByText('Test Service').closest('.channel-card') as HTMLElement;
            expect(within(channel1).getByText(/ago/)).toBeInTheDocument();
        });
    });

    describe('channel actions', () => {
        it('sends run channel message when Run Now clicked', () => {
            render(<OverviewView channels={mockChannels} states={mockStates} />);
            
            const runButtons = screen.getAllByText(/▶️ Run Now/);
            fireEvent.click(runButtons[0]);
            
            expect(mockVSCode.postMessage).toHaveBeenCalledWith({
                command: 'runChannelNow',
                channelId: 'channel-1'
            });
        });

        it('sends view details message when Details clicked', () => {
            render(<OverviewView channels={mockChannels} states={mockStates} />);
            
            const detailButtons = screen.getAllByText(/📊 Details/);
            fireEvent.click(detailButtons[0]);
            
            expect(mockVSCode.postMessage).toHaveBeenCalledWith({
                command: 'viewChannelDetails',
                channelId: 'channel-1'
            });
        });
    });

    describe('watch session banner', () => {
        it('displays active watch session banner', () => {
            const currentWatch = {
                isActive: true,
                startTime: Date.now() - 60000, // 1 minute ago
                id: 'watch-123'
            };
            
            render(<OverviewView 
                channels={mockChannels} 
                states={mockStates} 
                currentWatch={currentWatch}
            />);
            
            expect(screen.getByText('Active Watch Session')).toBeInTheDocument();
            expect(screen.getByText('Stop Watch')).toBeInTheDocument();
        });

        it('does not display banner when no active watch', () => {
            render(<OverviewView channels={mockChannels} states={mockStates} />);
            
            expect(screen.queryByText('Active Watch Session')).not.toBeInTheDocument();
        });

        it('sends stop watch message when stop button clicked', () => {
            const currentWatch = {
                isActive: true,
                startTime: Date.now() - 60000,
                id: 'watch-123'
            };
            
            render(<OverviewView 
                channels={mockChannels} 
                states={mockStates} 
                currentWatch={currentWatch}
            />);
            
            fireEvent.click(screen.getByText('Stop Watch'));
            
            expect(mockVSCode.postMessage).toHaveBeenCalledWith({
                command: 'stopWatch'
            });
        });
    });

    describe('empty state', () => {
        it('displays empty state when no channels configured', () => {
            render(<OverviewView channels={[]} states={{}} />);
            
            expect(screen.getByText('No Channels Configured')).toBeInTheDocument();
            expect(screen.getByText(/Add channels to your .healthwatch.json/)).toBeInTheDocument();
            expect(screen.getByText('⚙️ Open Configuration')).toBeInTheDocument();
        });

        it('sends open config message when configuration button clicked', () => {
            render(<OverviewView channels={[]} states={{}} />);
            
            fireEvent.click(screen.getByText('⚙️ Open Configuration'));
            
            expect(mockVSCode.postMessage).toHaveBeenCalledWith({
                command: 'openConfig'
            });
        });
    });

    describe('state handling', () => {
        it('handles Map-based states correctly', () => {
            const statesMap = new Map();
            statesMap.set('channel-1', mockStates['channel-1']);
            statesMap.set('channel-2', mockStates['channel-2']);
            
            render(<OverviewView channels={mockChannels} states={statesMap} />);
            
            expect(screen.getByText('Test Service')).toBeInTheDocument();
            expect(screen.getByText('Database')).toBeInTheDocument();
        });

        it('handles missing state gracefully', () => {
            const incompleteStates = {
                'channel-1': mockStates['channel-1']
                // Missing channel-2 state
            };
            
            render(<OverviewView channels={mockChannels} states={incompleteStates} />);
            
            // Should still render both channels
            expect(screen.getByText('Test Service')).toBeInTheDocument();
            expect(screen.getByText('Database')).toBeInTheDocument();
            
            // Channel without state should show as unknown
            expect(screen.getByText('UNKNOWN')).toBeInTheDocument();
        });
    });

    describe('accessibility', () => {
        it('has proper heading structure', () => {
            render(<OverviewView channels={mockChannels} states={mockStates} />);
            
            // Metric cards should have appropriate headings
            expect(screen.getByText('Test Service')).toBeInTheDocument();
            expect(screen.getByText('Database')).toBeInTheDocument();
        });

        it('provides tooltips for truncated text', () => {
            const longUrlChannel = {
                id: 'long-url',
                name: 'Long URL Service',
                type: 'https',
                url: 'https://very-long-domain-name-that-should-be-truncated.example.com/api/v1/health'
            };
            
            render(<OverviewView 
                channels={[longUrlChannel]} 
                states={{}} 
            />);
            
            const urlElement = screen.getByTitle(longUrlChannel.url);
            expect(urlElement).toBeInTheDocument();
        });
    });
});