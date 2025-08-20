import React, { useState, useMemo } from 'react';
import { TimelineData } from '../../dashboardData';
import { baseStyles } from '../shared/baseStyles';
import { FilterPanel, FilterOptions } from '../shared/FilterPanel';

export interface TimelineSwimlanesViewProps {
    channels: any[];
    states: Map<string, any> | Record<string, any>;
    timelineData: TimelineData;
    timeRange: string;
}

interface TimelineBarProps {
    dayData: any;
    dateLabel: string;
    channelName: string;
}

const TimelineBar: React.FC<TimelineBarProps> = ({ dayData, dateLabel, channelName }) => {
    const getTimelineBarClass = (dayData: any): string => {
        const availability = dayData.availability || 0;
        if (availability >= 90) return 'bar-online';
        if (availability >= 70) return 'bar-degraded';
        if (availability > 0) return 'bar-offline';
        return 'bar-no-data';
    };

    const getTimelineTooltip = (channelName: string, dayData: any, dateLabel: string): string => {
        return `${channelName} - ${dateLabel}: ${dayData.availability.toFixed(1)}% (${dayData.sampleCount} samples)`;
    };

    return (
        <div 
            className={`timeline-bar ${getTimelineBarClass(dayData)}`}
            title={getTimelineTooltip(channelName, dayData, dateLabel)}
        >
            <div className="bar-fill" style={{ height: `${dayData.availability}%` }}></div>
            {dayData.sampleCount > 0 && (
                <div className="sample-count">{dayData.sampleCount}</div>
            )}
        </div>
    );
};

const TimelineControls: React.FC<{
    timeRange: string;
    onTimeRangeChange: (range: string) => void;
}> = ({ timeRange, onTimeRangeChange }) => {
    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        onTimeRangeChange(e.target.value);
    };

    return (
        <div className="timeline-controls">
            <select 
                className="time-range-selector" 
                value={timeRange}
                onChange={handleChange}
            >
                <option value="7D">Last 7 Days</option>
                <option value="30D">Last 30 Days</option>
            </select>
        </div>
    );
};

const TimelineLegend: React.FC = () => (
    <div className="timeline-legend">
        <div className="legend-item">
            <div className="legend-color bar-online"></div>
            <span>Online (≥90%)</span>
        </div>
        <div className="legend-item">
            <div className="legend-color bar-degraded"></div>
            <span>Degraded (70-89%)</span>
        </div>
        <div className="legend-item">
            <div className="legend-color bar-offline"></div>
            <span>Offline (&lt;70%)</span>
        </div>
        <div className="legend-item">
            <div className="legend-color bar-no-data"></div>
            <span>No Data</span>
        </div>
    </div>
);

export const TimelineSwimlanesView: React.FC<TimelineSwimlanesViewProps> = ({
    channels,
    states,
    timelineData,
    timeRange
}) => {
    // Filter state
    const [filters, setFilters] = useState<FilterOptions>({
        timeRange: (timeRange.replace('D', 'd').toLowerCase() as any) || '7d',
        selectedChannels: [],
        showOnlyProblems: false
    });
    const getTimeRangeDays = (timeRange: string): number => {
        switch (timeRange) {
            case '30D': return 30;
            case '7D':
            default: return 7;
        }
    };

    const generateDateLabels = (days: number): string[] => {
        const labels = [];
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        }
        return labels;
    };

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

    const days = getTimeRangeDays(timeRange);
    const dateLabels = generateDateLabels(days);

    if (channels.length === 0) {
        return (
            <div className="timeline-container">
                <div className="empty-timeline">
                    <div className="empty-icon">📈</div>
                    <div className="empty-title">No Timeline Data</div>
                    <div className="empty-description">Configure channels to see availability timeline</div>
                </div>
            </div>
        );
    }

    if (filteredChannels.length === 0) {
        return (
            <div className="timeline-container">
                <div className="timeline-header">
                    <h2>Service Availability Timeline</h2>
                </div>

                <FilterPanel
                    channels={channels}
                    filters={filters}
                    onFiltersChange={handleFiltersChange}
                    showProblemFilter={true}
                />

                <div className="empty-timeline">
                    <div className="empty-icon">🔍</div>
                    <div className="empty-title">No Matching Channels</div>
                    <div className="empty-description">
                        {filters.showOnlyProblems ? 
                            "No channels are currently offline" : 
                            "Try adjusting your filter settings"
                        }
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="timeline-container">
            <div className="timeline-header">
                <h2>Service Availability Timeline</h2>
            </div>

            <FilterPanel
                channels={channels}
                filters={filters}
                onFiltersChange={handleFiltersChange}
                showProblemFilter={true}
            />

            <TimelineLegend />

            <div className="timeline-grid">
                {/* Date headers */}
                <div className="timeline-labels">
                    <div className="channel-label-header">Channel</div>
                    {dateLabels.map((label, index) => (
                        <div key={index} className="date-label">{label}</div>
                    ))}
                </div>

                {/* Channel rows */}
                {filteredChannels.map(channel => {
                    const channelData = timelineData[channel.id] || [];
                    return (
                        <div key={channel.id} className="timeline-row">
                            <div className="channel-label">
                                <div className="channel-name">{channel.name || channel.id}</div>
                                <div className="channel-type">{channel.type?.toUpperCase()}</div>
                            </div>
                            {channelData.map((dayData, index) => (
                                <TimelineBar
                                    key={index}
                                    dayData={dayData}
                                    dateLabel={dateLabels[index]}
                                    channelName={channel.name || channel.id}
                                />
                            ))}
                        </div>
                    );
                })}
            </div>
            
            <style>{swimlanesStyles}</style>
        </div>
    );
};

const swimlanesStyles = `
    ${baseStyles}
    
    /* Timeline Swimlanes Specific Styles */
    .timeline-container {
        /* Base styles inherited from baseStyles */
    }

    .timeline-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 24px;
        padding-bottom: 16px;
        border-bottom: 1px solid var(--vscode-widget-border);
    }

    .timeline-controls {
        display: flex;
        gap: 12px;
        align-items: center;
    }

    .time-range-selector {
        background: var(--vscode-dropdown-background);
        color: var(--vscode-dropdown-foreground);
        border: 1px solid var(--vscode-dropdown-border);
        border-radius: 4px;
        padding: 6px 8px;
        font-size: 12px;
        min-width: 120px;
    }

    .time-range-selector:focus {
        outline: 1px solid var(--vscode-focusBorder);
    }

    .timeline-legend {
        display: flex;
        justify-content: center;
        gap: 24px;
        margin-bottom: 20px;
        padding: 12px;
        background: var(--vscode-editor-inactiveSelectionBackground);
        border-radius: 6px;
        border: 1px solid var(--vscode-widget-border);
    }

    .legend-item {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: var(--vscode-foreground);
    }

    .legend-color {
        width: 16px;
        height: 12px;
        border-radius: 2px;
        border: 1px solid var(--vscode-widget-border);
    }

    .legend-color.bar-online {
        background: #4caf50;
    }

    .legend-color.bar-degraded {
        background: #ff9800;
    }

    .legend-color.bar-offline {
        background: #f44336;
    }

    .legend-color.bar-no-data {
        background: var(--vscode-input-background);
    }

    .timeline-grid {
        display: flex;
        flex-direction: column;
        gap: 1px;
        border: 1px solid var(--vscode-widget-border);
        border-radius: 6px;
        overflow: hidden;
    }

    .timeline-labels {
        display: flex;
        background: var(--vscode-editor-inactiveSelectionBackground);
        border-bottom: 2px solid var(--vscode-widget-border);
    }

    .channel-label-header {
        width: 180px;
        flex-shrink: 0;
        padding: 12px 16px;
        font-weight: 600;
        font-size: 12px;
        color: var(--vscode-foreground);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        border-right: 1px solid var(--vscode-widget-border);
    }

    .date-label {
        flex: 1;
        padding: 12px 8px;
        text-align: center;
        font-size: 11px;
        font-weight: 500;
        color: var(--vscode-foreground);
        border-right: 1px solid var(--vscode-widget-border);
        min-width: 60px;
    }

    .date-label:last-child {
        border-right: none;
    }

    .timeline-row {
        display: flex;
        background: var(--vscode-editor-background);
        border-bottom: 1px solid var(--vscode-widget-border);
        transition: background-color 0.2s ease;
    }

    .timeline-row:hover {
        background: var(--vscode-list-hoverBackground);
    }

    .timeline-row:last-child {
        border-bottom: none;
    }

    .channel-label {
        width: 180px;
        flex-shrink: 0;
        padding: 12px 16px;
        border-right: 1px solid var(--vscode-widget-border);
        display: flex;
        flex-direction: column;
        justify-content: center;
    }

    .channel-name {
        font-weight: 500;
        font-size: 13px;
        color: var(--vscode-foreground);
        margin-bottom: 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .channel-type {
        font-size: 9px;
        color: var(--vscode-descriptionForeground);
        text-transform: uppercase;
        font-weight: 600;
        letter-spacing: 0.5px;
    }

    .timeline-bar {
        flex: 1;
        height: 60px;
        border-right: 1px solid var(--vscode-widget-border);
        position: relative;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: end;
        justify-content: center;
        min-width: 60px;
    }

    .timeline-bar:last-child {
        border-right: none;
    }

    .timeline-bar:hover {
        transform: scale(1.02);
        z-index: 10;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .bar-fill {
        width: 100%;
        border-radius: 2px 2px 0 0;
        transition: all 0.2s ease;
        min-height: 2px;
    }

    .timeline-bar.bar-online .bar-fill {
        background: linear-gradient(to top, #4caf50, #66bb6a);
    }

    .timeline-bar.bar-degraded .bar-fill {
        background: linear-gradient(to top, #ff9800, #ffb74d);
    }

    .timeline-bar.bar-offline .bar-fill {
        background: linear-gradient(to top, #f44336, #e57373);
    }

    .timeline-bar.bar-no-data .bar-fill {
        background: var(--vscode-input-background);
        border: 1px dashed var(--vscode-widget-border);
    }

    .sample-count {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 9px;
        color: white;
        font-weight: 600;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
        pointer-events: none;
    }

    .timeline-bar.bar-no-data .sample-count {
        color: var(--vscode-descriptionForeground);
        text-shadow: none;
    }

    /* Empty state */
    .empty-timeline {
        /* Inherits from .empty-state in baseStyles */
        text-align: center;
        padding: 80px 20px;
        color: var(--vscode-descriptionForeground);
    }
`;