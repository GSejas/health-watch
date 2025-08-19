import React from 'react';
import { 
    Card, 
    Title, 
    Text, 
    Metric, 
    Grid, 
    Flex,
    Badge,
    ProgressCircle,
    List,
    ListItem,
    Divider,
    Button
} from '@tremor/react';
import { formatRelativeTime, formatWatchDuration } from '../../dashboardUtils';

export interface OverviewViewProps {
    channels: any[];
    states: Map<string, any> | Record<string, any>;
    currentWatch?: any;
}

interface ChannelCardProps {
    channel: any;
    state?: any;
}

const getStatusColor = (status: string): string => {
    switch (status) {
        case 'online': return 'emerald';
        case 'offline': return 'red';
        case 'unknown': return 'yellow';
        default: return 'gray';
    }
};

const getLatencyColor = (latency?: number): string => {
    if (!latency) return 'gray';
    if (latency < 100) return 'emerald';
    if (latency < 300) return 'yellow';
    return 'red';
};

const ChannelCard: React.FC<ChannelCardProps> = ({ channel, state }) => {
    const status = state?.state || 'unknown';
    const latency = state?.lastSample?.latencyMs;
    const lastCheck = state?.lastSample?.timestamp;
    const error = state?.lastSample?.error;

    const handleRunChannel = () => {
        if (typeof window !== 'undefined' && (window as any).vscode) {
            (window as any).vscode.postMessage({
                command: 'runChannelNow',
                channelId: channel.id
            });
        }
    };

    const handleViewDetails = () => {
        if (typeof window !== 'undefined' && (window as any).vscode) {
            (window as any).vscode.postMessage({
                command: 'viewChannelDetails',
                channelId: channel.id
            });
        }
    };

    return (
        <Card className="max-w-sm" data-channel-id={channel.id}>
            {/* Header with status badge */}
            <Flex justifyContent="between" alignItems="center" className="mb-4">
                <Title className="text-lg font-medium">{channel.name || channel.id}</Title>
                <Badge color={getStatusColor(status)} size="sm">
                    {status.toUpperCase()}
                </Badge>
            </Flex>

            {/* Channel details */}
            <List className="space-y-2">
                <ListItem>
                    <Flex justifyContent="between">
                        <Text>Type</Text>
                        <Text className="font-medium">{channel.type?.toUpperCase() || 'Unknown'}</Text>
                    </Flex>
                </ListItem>
                
                {channel.url && (
                    <ListItem>
                        <Flex justifyContent="between">
                            <Text>URL</Text>
                            <Text className="font-medium truncate max-w-32" title={channel.url}>
                                {channel.url}
                            </Text>
                        </Flex>
                    </ListItem>
                )}
                
                {channel.target && (
                    <ListItem>
                        <Flex justifyContent="between">
                            <Text>Target</Text>
                            <Text className="font-medium">{channel.target}</Text>
                        </Flex>
                    </ListItem>
                )}
                
                <ListItem>
                    <Flex justifyContent="between">
                        <Text>Latency</Text>
                        <Badge color={getLatencyColor(latency)} size="xs">
                            {latency ? `${latency}ms` : 'N/A'}
                        </Badge>
                    </Flex>
                </ListItem>
                
                <ListItem>
                    <Flex justifyContent="between">
                        <Text>Last Check</Text>
                        <Text className="text-xs">
                            {lastCheck ? formatRelativeTime(lastCheck) : 'Never'}
                        </Text>
                    </Flex>
                </ListItem>
            </List>

            {error && (
                <>
                    <Divider />
                    <Card className="border-red-200 bg-red-50">
                        <Flex alignItems="start" className="space-x-2">
                            <Text className="text-xl">⚠️</Text>
                            <Text className="text-sm text-red-700">{error}</Text>
                        </Flex>
                    </Card>
                </>
            )}

            <Divider />
            
            {/* Action buttons */}
            <Flex className="space-x-2" justifyContent="center">
                <Button 
                    size="xs" 
                    variant="secondary"
                    onClick={handleRunChannel}
                >
                    ▶️ Run Now
                </Button>
                <Button 
                    size="xs" 
                    variant="secondary"
                    onClick={handleViewDetails}
                >
                    📊 Details
                </Button>
            </Flex>
        </Card>
    );
};

const MetricCard: React.FC<{
    label: string;
    value: string | number;
    detail: string;
    color?: string;
}> = ({ label, value, detail, color = 'gray' }) => (
    <Card className="text-center">
        <Text className="text-sm font-medium">{label}</Text>
        <Metric className={`text-${color}-600`}>{value}</Metric>
        <Text className="text-xs text-gray-500 mt-1">{detail}</Text>
    </Card>
);

const WatchStatusBanner: React.FC<{ currentWatch: any }> = ({ currentWatch }) => {
    const handleStopWatch = () => {
        if (typeof window !== 'undefined' && (window as any).vscode) {
            (window as any).vscode.postMessage({
                command: 'stopWatch'
            });
        }
    };

    return (
        <Card className="border-blue-200 bg-blue-50 mb-6">
            <Flex justifyContent="between" alignItems="center">
                <Flex alignItems="center" className="space-x-3">
                    <Text className="text-2xl">🔍</Text>
                    <div>
                        <Title className="text-blue-900">Active Watch Session</Title>
                        <Text className="text-blue-700 text-sm">
                            Duration: {formatWatchDuration(currentWatch)} • 
                            Started: {new Date(currentWatch.startTime).toLocaleString()}
                        </Text>
                    </div>
                </Flex>
                <Button 
                    size="sm" 
                    color="red" 
                    onClick={handleStopWatch}
                >
                    Stop Watch
                </Button>
            </Flex>
        </Card>
    );
};

const EmptyState: React.FC = () => {
    const handleOpenConfig = () => {
        if (typeof window !== 'undefined' && (window as any).vscode) {
            (window as any).vscode.postMessage({
                command: 'openConfig'
            });
        }
    };

    return (
        <Card className="text-center py-12">
            <div className="space-y-4">
                <Text className="text-6xl">🔧</Text>
                <Title className="text-xl">No Channels Configured</Title>
                <Text className="text-gray-600 max-w-md mx-auto">
                    Add channels to your .healthwatch.json file to start monitoring your services.
                </Text>
                <Button 
                    className="mt-4" 
                    onClick={handleOpenConfig}
                >
                    ⚙️ Open Configuration
                </Button>
            </div>
        </Card>
    );
};

export const OverviewView: React.FC<OverviewViewProps> = ({
    channels,
    states,
    currentWatch
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

    // Calculate metrics
    const totalChannels = channels.length;
    let online = 0, offline = 0, unknown = 0;

    for (const channel of channels) {
        const state = statesObj[channel.id]?.state || 'unknown';
        if (state === 'online') online++;
        else if (state === 'offline') offline++;
        else unknown++;
    }

    const availability = totalChannels > 0 ? Math.round((online / totalChannels) * 100) : 0;

    const getAvailabilityColor = (availability: number): string => {
        if (availability >= 95) return 'emerald';
        if (availability >= 85) return 'yellow';
        return 'red';
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Quick Statistics */}
            <Grid numItems={4} className="gap-4 mb-6">
                <MetricCard
                    label="Availability"
                    value={`${availability}%`}
                    detail={`${online}/${totalChannels} services online`}
                    color={getAvailabilityColor(availability)}
                />
                <MetricCard
                    label="Online"
                    value={online}
                    detail="Services running"
                    color="emerald"
                />
                <MetricCard
                    label="Offline"
                    value={offline}
                    detail="Services down"
                    color="red"
                />
                <MetricCard
                    label="Unknown"
                    value={unknown}
                    detail="Status pending"
                    color="yellow"
                />
            </Grid>

            {/* Watch Status Banner */}
            {currentWatch?.isActive && (
                <WatchStatusBanner currentWatch={currentWatch} />
            )}

            {/* Channel Status Cards */}
            {channels.length > 0 ? (
                <Grid numItems={3} className="gap-4">
                    {channels.map(channel => (
                        <ChannelCard
                            key={channel.id}
                            channel={channel}
                            state={statesObj[channel.id]}
                        />
                    ))}
                </Grid>
            ) : (
                <EmptyState />
            )}
        </div>
    );
};