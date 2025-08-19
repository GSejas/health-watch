import React from 'react';
import { formatRelativeTime, formatWatchDuration } from '../../dashboardUtils';
import '../styles/tailwind.css';

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
        <div className="hw-card" data-channel-id={channel.id}>
            {/* Header with status badge */}
            <div className="flex justify-between items-center mb-3">
                <h3 className="text-base font-medium text-vscode-foreground">{channel.name || channel.id}</h3>
                <span className={`px-2 py-1 rounded text-xs font-bold ${
                    status === 'online' ? 'hw-badge-online' :
                    status === 'offline' ? 'hw-badge-offline' :
                    'hw-badge-unknown'
                }`}>
                    {status.toUpperCase()}
                </span>
            </div>

            {/* Channel details */}
            <div className="space-y-2 mb-3">
                <div className="flex justify-between items-center py-1 text-xs">
                    <span className="text-vscode-secondary">Type</span>
                    <span className="font-medium text-vscode-foreground">{channel.type?.toUpperCase() || 'Unknown'}</span>
                </div>
                
                {channel.url && (
                    <div className="flex justify-between items-center py-1 text-xs">
                        <span className="text-vscode-secondary">URL</span>
                        <span className="font-medium truncate max-w-36 text-vscode-foreground" title={channel.url}>
                            {channel.url}
                        </span>
                    </div>
                )}
                
                {channel.target && (
                    <div className="flex justify-between items-center py-1 text-xs">
                        <span className="text-vscode-secondary">Target</span>
                        <span className="font-medium text-vscode-foreground">{channel.target}</span>
                    </div>
                )}
                
                <div className="flex justify-between items-center py-1 text-xs">
                    <span className="text-vscode-secondary">Latency</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        getLatencyColor(latency) === 'emerald' ? 'bg-vscode-success text-white' :
                        getLatencyColor(latency) === 'yellow' ? 'bg-vscode-warning text-black' :
                        getLatencyColor(latency) === 'red' ? 'bg-vscode-error text-white' :
                        'bg-vscode-secondary text-white'
                    }`}>
                        {latency ? `${latency}ms` : 'N/A'}
                    </span>
                </div>
                
                <div className="flex justify-between items-center py-1 text-xs">
                    <span className="text-vscode-secondary">Last Check</span>
                    <span className="text-xs text-vscode-secondary">
                        {lastCheck ? formatRelativeTime(lastCheck) : 'Never'}
                    </span>
                </div>
            </div>

            {error && (
                <div className="my-3 p-2 bg-red-50 border border-red-200 rounded">
                    <div className="text-xs font-bold text-red-700 mb-1">⚠️ Error</div>
                    <div className="text-xs text-red-700">{error}</div>
                </div>
            )}
            
            {/* Action buttons */}
            <div className="flex gap-2 justify-center mt-3 pt-3 border-t border-vscode-border">
                <button 
                    className="hw-button-primary"
                    onClick={handleRunChannel}
                >
                    ▶️ Run Now
                </button>
                <button 
                    className="hw-button-secondary"
                    onClick={handleViewDetails}
                >
                    📊 Details
                </button>
            </div>
        </div>
    );
};

const MetricCard: React.FC<{
    label: string;
    value: string | number;
    detail: string;
    color?: string;
}> = ({ label, value, detail, color = 'gray' }) => (
    <div className="hw-card text-center">
        <div className="text-xs text-vscode-secondary mb-2">{label}</div>
        <div className={`text-2xl font-bold mb-1 ${
            color === 'emerald' ? 'text-vscode-success' :
            color === 'red' ? 'text-vscode-error' :
            color === 'yellow' ? 'text-vscode-warning' :
            'text-vscode-secondary'
        }`}>{value}</div>
        <div className="text-xs text-vscode-secondary">{detail}</div>
    </div>
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
        <div className="hw-card border-vscode-info bg-opacity-10 mb-6 flex justify-between items-center">
            <div className="flex items-center gap-3">
                <span className="text-xl">🔍</span>
                <div>
                    <h3 className="font-medium text-vscode-info mb-1">Active Watch Session</h3>
                    <p className="text-xs text-vscode-secondary">
                        Duration: {formatWatchDuration(currentWatch)} • 
                        Started: {new Date(currentWatch.startTime).toLocaleString()}
                    </p>
                </div>
            </div>
            <button 
                className="bg-vscode-error text-white px-3 py-1.5 rounded text-sm hover:opacity-80 transition-opacity"
                onClick={handleStopWatch}
            >
                Stop Watch
            </button>
        </div>
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
        <div className="hw-card text-center py-10">
            <div className="text-5xl mb-4">🔧</div>
            <h3 className="text-lg font-medium text-vscode-foreground mb-3">No Channels Configured</h3>
            <p className="text-vscode-secondary max-w-md mx-auto mb-5">
                Add channels to your .healthwatch.json file to start monitoring your services.
            </p>
            <button 
                className="hw-button-primary"
                onClick={handleOpenConfig}
            >
                ⚙️ Open Configuration
            </button>
        </div>
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
        <div className="p-5 max-w-7xl mx-auto font-vscode">
            {/* Quick Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
            </div>

            {/* Watch Status Banner */}
            {currentWatch?.isActive && (
                <WatchStatusBanner currentWatch={currentWatch} />
            )}

            {/* Channel Status Cards */}
            {channels.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {channels.map(channel => (
                        <ChannelCard
                            key={channel.id}
                            channel={channel}
                            state={statesObj[channel.id]}
                        />
                    ))}
                </div>
            ) : (
                <EmptyState />
            )}
        </div>
    );
};