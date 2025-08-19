import React from 'react';
import { HeatmapData } from '../../dashboardData';

export interface TimelineHeatmapViewProps {
    channels: any[];
    states: Map<string, any> | Record<string, any>;
    heatmapData: HeatmapData;
}

interface HeatmapCellProps {
    hourData: any;
    channelName: string;
    hourIndex: number;
}

const HeatmapCell: React.FC<HeatmapCellProps> = ({ hourData, channelName, hourIndex }) => {
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

    return (
        <div 
            className="heatmap-cell"
            style={{ backgroundColor: getHeatmapColor(hourData.availability) }}
            title={getHeatmapTooltip(channelName, hourData, hourIndex)}
        >
        </div>
    );
};

const HeatmapLegend: React.FC = () => (
    <div className="heatmap-legend">
        <span className="legend-label">Availability:</span>
        <div className="legend-gradient">
            <div className="gradient-bar"></div>
            <div className="gradient-labels">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
            </div>
        </div>
    </div>
);

const HourLabels: React.FC = () => (
    <div className="heatmap-time-labels">
        {Array.from({ length: 24 }, (_, hour) => (
            <div key={hour} className="time-label">
                {hour.toString().padStart(2, '0')}
            </div>
        ))}
    </div>
);

export const TimelineHeatmapView: React.FC<TimelineHeatmapViewProps> = ({
    channels,
    states,
    heatmapData
}) => {
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

    if (channels.length === 0) {
        return (
            <div className="heatmap-container">
                <div className="empty-timeline">
                    <div className="empty-icon">🔥</div>
                    <div className="empty-title">No Heatmap Data</div>
                    <div className="empty-description">Configure channels to see hourly availability patterns</div>
                </div>
            </div>
        );
    }

    return (
        <div className="heatmap-container">
            <div className="heatmap-header">
                <h2>Hourly Availability Heatmap</h2>
                <div className="heatmap-subtitle">Last 7 days, hourly resolution</div>
            </div>

            <HeatmapLegend />

            <div className="heatmap-grid">
                {channels.map(channel => {
                    const channelHeatmap = heatmapData[channel.id] || [];
                    return (
                        <div key={channel.id} className="heatmap-channel">
                            <div className="heatmap-channel-label">
                                <div className="channel-name">{channel.name || channel.id}</div>
                                <div className="channel-type">{channel.type?.toUpperCase()}</div>
                            </div>
                            <div className="heatmap-cells">
                                {channelHeatmap.map((hourData, index) => (
                                    <HeatmapCell
                                        key={index}
                                        hourData={hourData}
                                        channelName={channel.name || channel.id}
                                        hourIndex={index}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            <HourLabels />
        </div>
    );
};