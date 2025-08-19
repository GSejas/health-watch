import React from 'react';
import { TimelineData } from '../../dashboardData';

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

    const handleTimeRangeChange = (newRange: string) => {
        // Communicate back to parent through webview messaging
        if (typeof window !== 'undefined' && (window as any).vscode) {
            (window as any).vscode.postMessage({
                command: 'changeTimeRange',
                timeRange: newRange
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

    return (
        <div className="timeline-container">
            <div className="timeline-header">
                <h2>Service Availability Timeline</h2>
                <TimelineControls 
                    timeRange={timeRange} 
                    onTimeRangeChange={handleTimeRangeChange} 
                />
            </div>

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
                {channels.map(channel => {
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
        </div>
    );
};