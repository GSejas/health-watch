import React, { useState, useMemo } from 'react';
import { HeatmapData } from '../../dashboardData';
import { baseStyles } from '../shared/baseStyles';
import { FilterPanel, FilterOptions } from '../shared/FilterPanel';

export interface TimelineHeatmapViewProps {
    channels: any[];
    states: Map<string, any> | Record<string, any>;
    heatmapData: HeatmapData;
    timeRange: string;
}

// Helper functions
const getHeatmapColor = (availability: number): string => {
    const intensity = availability / 100;
    const red = Math.round(255 * (1 - intensity));
    const green = Math.round(255 * intensity);
    return `rgb(${red}, ${green}, 0)`;
};

const getHeatmapTooltip = (channelName: string, hourData: any, hourIndex: number): string => {
    const hour = hourIndex % 24;
    const day = Math.floor(hourIndex / 24);
    return `${channelName} - Day ${day + 1}, ${hour}:00: ${hourData.availability.toFixed(1)}%`;
};

const HeatmapLegend: React.FC = () => (
    <div className="heatmap-legend">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '14px' }}>Availability:</span>
            <div style={{ display: 'flex', gap: '8px' }}>
                <span className="availability-badge availability-low">0%</span>
                <span className="availability-badge availability-medium">50%</span>
                <span className="availability-badge availability-high">100%</span>
            </div>
        </div>
    </div>
);

const HourLabels: React.FC = () => (
    <div className="hour-labels">
        {[0, 6, 12, 18].map(hour => (
            <span key={hour} className="hour-label">
                {hour.toString().padStart(2, '0')}:00
            </span>
        ))}
    </div>
);

export const TimelineHeatmapView: React.FC<TimelineHeatmapViewProps> = ({
    channels,
    states,
    heatmapData,
    timeRange
}) => {
    // Filter state
    const [filters, setFilters] = useState<FilterOptions>({
        timeRange: (timeRange.replace('D', 'd').toLowerCase() as any) || '7d',
        selectedChannels: [],
        showOnlyProblems: false
    });

    const handleFiltersChange = (newFilters: FilterOptions) => {
        setFilters(newFilters);
        
        // Convert our time format back to backend format
        const backendTimeRange = newFilters.timeRange.replace('d', 'D').toUpperCase();
        
        // Communicate back to parent through webview messaging
        if (typeof window !== 'undefined' && (window as any).vscode) {
            (window as any).vscode.postMessage({
                command: 'changeTimeRange',
                timeRange: backendTimeRange
            });
        }
    };

    // Convert Map to object if needed
    const statesObj = React.useMemo(() => {
        if (states instanceof Map) {
            const obj: Record<string, any> = {};
            states.forEach((value, key) => {
                obj[key] = value;
            });
            return obj;
        }
        return states as Record<string, any>;
    }, [states]);

    // Filter channels based on selection and problems filter
    const filteredChannels = useMemo(() => {
        let result = channels;
        
        // Apply channel selection filter
        if (filters.selectedChannels.length > 0) {
            result = result.filter(channel => filters.selectedChannels.includes(channel.id));
        }
        
        // Apply problems filter
        if (filters.showOnlyProblems) {
            result = result.filter(channel => {
                const channelState = statesObj[channel.id];
                return channelState && channelState.state === 'offline';
            });
        }
        
        return result;
    }, [channels, filters, statesObj]);

    if (channels.length === 0) {
        return (
            <div className="heatmap-container">
                <div className="empty-heatmap">
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔥</div>
                    <h3 style={{ fontSize: '18px', fontWeight: '500', marginBottom: '8px' }}>No Heatmap Data</h3>
                    <p style={{ opacity: '0.7' }}>Configure channels to see hourly availability patterns</p>
                </div>
            </div>
        );
    }

    if (filteredChannels.length === 0) {
        return (
            <div className="heatmap-container">
                <div className="heatmap-card">
                    <div className="heatmap-header">
                        <h2 className="heatmap-title">Hourly Availability Heatmap</h2>
                        <p className="heatmap-subtitle">Last 7 days, hourly resolution</p>
                    </div>

                    <FilterPanel
                        channels={channels}
                        filters={filters}
                        onFiltersChange={handleFiltersChange}
                        showProblemFilter={true}
                    />

                    <div className="empty-heatmap">
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
                        <h3 style={{ fontSize: '18px', fontWeight: '500', marginBottom: '8px' }}>No Matching Channels</h3>
                        <p style={{ opacity: '0.7' }}>
                            {filters.showOnlyProblems ? 
                                "No channels are currently offline" : 
                                "Try adjusting your filter settings"
                            }
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="heatmap-container">
            <div className="heatmap-card">
                <div className="heatmap-header">
                    <h2 className="heatmap-title">Hourly Availability Heatmap</h2>
                    <p className="heatmap-subtitle">Last 7 days, hourly resolution</p>
                </div>

                <FilterPanel
                    channels={channels}
                    filters={filters}
                    onFiltersChange={handleFiltersChange}
                    showProblemFilter={true}
                />
                
                <HeatmapLegend />
                
                <div className="channels-heatmap-grid">
                    {filteredChannels.map(channel => {
                        const channelHeatmap = heatmapData[channel.id] || [];
                        return (
                            <div key={channel.id} className="channel-heatmap-card">
                                <div className="channel-heatmap-header">
                                    <div>
                                        <h3 className="channel-heatmap-name">{channel.name || channel.id}</h3>
                                        <p className="channel-heatmap-type">{channel.type?.toUpperCase()}</p>
                                    </div>
                                </div>
                                
                                <div className="heatmap-cells">
                                    {channelHeatmap.map((hourData, index) => (
                                        <div
                                            key={index}
                                            className="heatmap-cell"
                                            style={{ backgroundColor: getHeatmapColor(hourData.availability) }}
                                            title={getHeatmapTooltip(channel.name || channel.id, hourData, index)}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <HourLabels />
            </div>
            
            <style>{heatmapStyles}</style>
        </div>
    );
};

const heatmapStyles = `
    ${baseStyles}
    
    /* Heatmap Specific Styles */
    .heatmap-container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 24px;
        font-family: var(--vscode-font-family);
    }

    .heatmap-card {
        background: var(--vscode-editor-background);
        border: 1px solid var(--vscode-widget-border);
        border-radius: 8px;
        padding: 24px;
        margin-bottom: 24px;
    }

    .heatmap-header {
        text-align: center;
        margin-bottom: 24px;
    }

    .heatmap-title {
        font-size: 24px;
        font-weight: 700;
        color: var(--vscode-foreground);
        margin: 0 0 8px 0;
    }

    .heatmap-subtitle {
        color: var(--vscode-descriptionForeground);
        margin: 0;
    }

    .heatmap-legend {
        background: var(--vscode-editor-inactiveSelectionBackground);
        border: 1px solid var(--vscode-widget-border);
        border-radius: 6px;
        padding: 16px;
        margin-bottom: 24px;
    }

    .availability-badge {
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 700;
    }

    .availability-badge.availability-low {
        background: var(--vscode-errorBackground);
        color: var(--vscode-errorForeground);
    }

    .availability-badge.availability-medium {
        background: var(--vscode-warningBackground);
        color: var(--vscode-warningForeground);
    }

    .availability-badge.availability-high {
        background: var(--vscode-notificationsInfoIcon-foreground);
        color: white;
    }

    .channels-heatmap-grid {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .channel-heatmap-card {
        background: var(--vscode-editor-inactiveSelectionBackground);
        border: 1px solid var(--vscode-widget-border);
        border-radius: 6px;
        padding: 16px;
    }

    .channel-heatmap-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
    }

    .channel-heatmap-name {
        font-size: 18px;
        font-weight: 500;
        color: var(--vscode-foreground);
        margin: 0 0 4px 0;
    }

    .channel-heatmap-type {
        font-size: 14px;
        color: var(--vscode-descriptionForeground);
        margin: 0;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .heatmap-cells {
        display: flex;
        gap: 2px;
        flex-wrap: wrap;
        margin-bottom: 8px;
    }

    .heatmap-cell {
        width: 16px;
        height: 16px;
        border-radius: 2px;
        cursor: pointer;
        transition: transform 0.2s ease;
        border: 1px solid var(--vscode-widget-border);
    }

    .heatmap-cell:hover {
        transform: scale(1.1);
        z-index: 10;
    }

    .hour-labels {
        display: flex;
        justify-content: space-between;
        margin-top: 16px;
        padding: 0 16px;
    }

    .hour-label {
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
    }

    /* Empty State */
    .empty-heatmap {
        text-align: center;
        padding: 80px 20px;
        color: var(--vscode-descriptionForeground);
        background: var(--vscode-editor-background);
        border: 1px solid var(--vscode-widget-border);
        border-radius: 8px;
    }
`;