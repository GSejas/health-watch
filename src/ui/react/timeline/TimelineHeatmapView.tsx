import React from 'react';
import { HeatmapData } from '../../dashboardData';
import '../styles/tailwind.css';

export interface TimelineHeatmapViewProps {
    channels: any[];
    states: Map<string, any> | Record<string, any>;
    heatmapData: HeatmapData;
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
    <div className="hw-card mb-6">
        <div className="flex items-center space-x-4">
            <span className="text-sm text-vscode-foreground">Availability:</span>
            <div className="flex space-x-2">
                <span className="bg-vscode-error text-white px-2 py-1 rounded text-xs font-bold">0%</span>
                <span className="bg-vscode-warning text-black px-2 py-1 rounded text-xs font-bold">50%</span>
                <span className="bg-vscode-success text-white px-2 py-1 rounded text-xs font-bold">100%</span>
            </div>
        </div>
    </div>
);

const HourLabels: React.FC = () => (
    <div className="flex justify-between mt-4 px-4">
        {[0, 6, 12, 18].map(hour => (
            <span key={hour} className="text-xs text-vscode-secondary">
                {hour.toString().padStart(2, '0')}:00
            </span>
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
            <div className="max-w-4xl mx-auto p-6">
                <div className="hw-card text-center py-12">
                    <div className="text-6xl mb-4">🔥</div>
                    <h3 className="text-lg font-medium text-vscode-foreground mb-2">No Heatmap Data</h3>
                    <p className="text-vscode-secondary">Configure channels to see hourly availability patterns</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto p-6 font-vscode">
            <div className="hw-card mb-6">
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-vscode-foreground mb-2">Hourly Availability Heatmap</h2>
                    <p className="text-vscode-secondary">Last 7 days, hourly resolution</p>
                </div>
                
                <HeatmapLegend />
                
                <div className="space-y-4">
                    {channels.map(channel => {
                        const channelHeatmap = heatmapData[channel.id] || [];
                        return (
                            <div key={channel.id} className="hw-card">
                                <div className="flex justify-between items-center mb-4">
                                    <div>
                                        <h3 className="text-lg font-medium text-vscode-foreground">{channel.name || channel.id}</h3>
                                        <p className="text-sm text-vscode-secondary">{channel.type?.toUpperCase()}</p>
                                    </div>
                                </div>
                                
                                <div className="flex gap-1 mb-2 flex-wrap">
                                    {channelHeatmap.map((hourData, index) => (
                                        <div
                                            key={index}
                                            className="w-4 h-4 rounded-sm cursor-pointer transition-transform hover:scale-110"
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
        </div>
    );
};