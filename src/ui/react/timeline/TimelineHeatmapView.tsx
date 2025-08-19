import React from 'react';
import { 
    Card, 
    Title, 
    Text, 
    Grid, 
    Flex,
    Badge,
    List,
    ListItem
} from '@tremor/react';
import { HeatmapData } from '../../dashboardData';

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
    <Card className="mb-6">
        <Flex justifyContent="start" alignItems="center" className="space-x-4">
            <Text>Availability:</Text>
            <div className="flex space-x-2">
                <Badge color="red" size="sm">0%</Badge>
                <Badge color="yellow" size="sm">50%</Badge>
                <Badge color="emerald" size="sm">100%</Badge>
            </div>
        </Flex>
    </Card>
);

const HourLabels: React.FC = () => (
    <div className="flex justify-between mt-4 px-4">
        {[0, 6, 12, 18].map(hour => (
            <Text key={hour} className="text-xs">
                {hour.toString().padStart(2, '0')}:00
            </Text>
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
                <Card>
                    <div className="text-center py-12">
                        <div className="text-6xl mb-4">🔥</div>
                        <Title className="mb-2">No Heatmap Data</Title>
                        <Text>Configure channels to see hourly availability patterns</Text>
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto p-6">
            <Card className="mb-6">
                <div className="text-center mb-6">
                    <Title className="text-2xl mb-2">Hourly Availability Heatmap</Title>
                    <Text>Last 7 days, hourly resolution</Text>
                </div>
                
                <HeatmapLegend />
                
                <Grid numItems={1} className="gap-4">
                    {channels.map(channel => {
                        const channelHeatmap = heatmapData[channel.id] || [];
                        return (
                            <Card key={channel.id}>
                                <Flex justifyContent="between" alignItems="center" className="mb-4">
                                    <div>
                                        <Title className="text-lg">{channel.name || channel.id}</Title>
                                        <Text className="text-sm">{channel.type?.toUpperCase()}</Text>
                                    </div>
                                </Flex>
                                
                                <div className="flex gap-1 mb-2">
                                    {channelHeatmap.map((hourData, index) => (
                                        <div
                                            key={index}
                                            className="w-4 h-4 rounded-sm cursor-pointer"
                                            style={{ backgroundColor: getHeatmapColor(hourData.availability) }}
                                            title={getHeatmapTooltip(channel.name || channel.id, hourData, index)}
                                        />
                                    ))}
                                </div>
                            </Card>
                        );
                    })}
                </Grid>

                <HourLabels />
            </Card>
        </div>
    );
};