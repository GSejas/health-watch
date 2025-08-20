import React from 'react';
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
        <div className="channel-card" data-channel-id={channel.id}>
            {/* Header with status badge */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '500', margin: '0' }}>{channel.name || channel.id}</h3>
                <span className={`status-badge status-${status}`}>
                    {status.toUpperCase()}
                </span>
            </div>

            {/* Channel details */}
            <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: '12px' }}>
                    <span style={{ opacity: '0.7' }}>Type</span>
                    <span style={{ fontWeight: '500' }}>{channel.type?.toUpperCase() || 'Unknown'}</span>
                </div>
                
                {channel.url && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: '12px' }}>
                        <span style={{ opacity: '0.7' }}>URL</span>
                        <span style={{ fontWeight: '500', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '144px' }} title={channel.url}>
                            {channel.url}
                        </span>
                    </div>
                )}
                
                {channel.target && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: '12px' }}>
                        <span style={{ opacity: '0.7' }}>Target</span>
                        <span style={{ fontWeight: '500' }}>{channel.target}</span>
                    </div>
                )}
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: '12px' }}>
                    <span style={{ opacity: '0.7' }}>Latency</span>
                    <span className={`latency-badge latency-${getLatencyColor(latency)}`}>
                        {latency ? `${latency}ms` : 'N/A'}
                    </span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: '12px' }}>
                    <span style={{ opacity: '0.7' }}>Last Check</span>
                    <span style={{ fontSize: '12px', opacity: '0.7' }}>
                        {lastCheck ? formatRelativeTime(lastCheck) : 'Never'}
                    </span>
                </div>
            </div>

            {error && (
                <div className="error-box">
                    <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>⚠️ Error</div>
                    <div style={{ fontSize: '12px' }}>{error}</div>
                </div>
            )}
            
            {/* Action buttons */}
            <div className="channel-actions">
                <button 
                    className="btn btn-primary"
                    onClick={handleRunChannel}
                >
                    ▶️ Run Now
                </button>
                <button 
                    className="btn btn-secondary"
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
    <div className="metric-card">
        <div style={{ fontSize: '12px', opacity: '0.7', marginBottom: '8px' }}>{label}</div>
        <div className={`metric-value metric-${color}`}>{value}</div>
        <div style={{ fontSize: '12px', opacity: '0.7' }}>{detail}</div>
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
        <div className="watch-banner">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '20px' }}>🔍</span>
                <div>
                    <h3 className="watch-title">Active Watch Session</h3>
                    <p style={{ fontSize: '12px', opacity: '0.7' }}>
                        Duration: {formatWatchDuration(currentWatch)} • 
                        Started: {new Date(currentWatch.startTime).toLocaleString()}
                    </p>
                </div>
            </div>
            <button 
                className="btn btn-danger"
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
        <div className="empty-state">
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔧</div>
            <h3 style={{ fontSize: '18px', fontWeight: '500', marginBottom: '12px' }}>No Channels Configured</h3>
            <p style={{ opacity: '0.7', maxWidth: '400px', margin: '0 auto 20px' }}>
                Add channels to your .healthwatch.json file to start monitoring your services.
            </p>
            <button 
                className="btn btn-primary"
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
        <div className="overview-container">
            {/* Quick Statistics */}
            <div className="metrics-grid">
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
                <div className="channels-grid">
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