import React from 'react';
import { formatRelativeTime } from '../../dashboardUtils';

export interface OverviewViewProps {
    channels: any[];
    states: Map<string, any> | Record<string, any>;
    currentWatch?: any;
}

interface ChannelCardProps {
    channel: any;
    state?: any;
}

const StatusIndicator: React.FC<{ status: string }> = ({ status }) => (
    <div className={`channel-status status-${status}`}>
        <div className="status-indicator"></div>
        <span className="status-text">{status.toUpperCase()}</span>
    </div>
);

const ChannelCard: React.FC<ChannelCardProps> = ({ channel, state }) => {
    const status = state?.state || 'unknown';
    const latency = state?.lastSample?.latencyMs;
    const lastCheck = state?.lastSample?.timestamp;
    const error = state?.lastSample?.error;
    
    const getLatencyClass = (latency?: number): string => {
        if (!latency) return '';
        if (latency < 100) return 'latency-good';
        if (latency < 300) return 'latency-warning';
        return 'latency-poor';
    };

    const handleRunChannel = () => {
        // Post message to parent window (webview communication)
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
        <div className={`channel-card channel-${status}`} data-channel-id={channel.id}>
            <div className="channel-header">
                <div className="channel-name">{channel.name || channel.id}</div>
                <StatusIndicator status={status} />
            </div>
            
            <div className="channel-details">
                <div className="detail-row">
                    <span className="detail-label">Type:</span>
                    <span className="detail-value">{channel.type?.toUpperCase() || 'Unknown'}</span>
                </div>
                {channel.url && (
                    <div className="detail-row">
                        <span className="detail-label">URL:</span>
                        <span className="detail-value channel-url" title={channel.url}>{channel.url}</span>
                    </div>
                )}
                {channel.target && (
                    <div className="detail-row">
                        <span className="detail-label">Target:</span>
                        <span className="detail-value">{channel.target}</span>
                    </div>
                )}
                <div className="detail-row">
                    <span className="detail-label">Latency:</span>
                    <span className={`detail-value ${getLatencyClass(latency)}`}>
                        {latency ? latency + 'ms' : 'N/A'}
                    </span>
                </div>
                <div className="detail-row">
                    <span className="detail-label">Last Check:</span>
                    <span className="detail-value">
                        {lastCheck ? formatRelativeTime(lastCheck) : 'Never'}
                    </span>
                </div>
            </div>

            {error && (
                <div className="channel-error">
                    <div className="error-icon">⚠️</div>
                    <div className="error-message">{error}</div>
                </div>
            )}

            <div className="channel-actions">
                <button className="action-btn" onClick={handleRunChannel}>
                    <span className="btn-icon">▶️</span>
                    Run Now
                </button>
                <button className="action-btn" onClick={handleViewDetails}>
                    <span className="btn-icon">📊</span>
                    Details
                </button>
            </div>
        </div>
    );
};

const MetricCard: React.FC<{
    label: string;
    value: string | number;
    detail: string;
    className?: string;
}> = ({ label, value, detail, className = '' }) => (
    <div className={`metric-card ${className}`}>
        <div className="metric-label">{label}</div>
        <div className="metric-value">{value}</div>
        <div className="metric-detail">{detail}</div>
    </div>
);

const WatchStatusBanner: React.FC<{ currentWatch: any }> = ({ currentWatch }) => {
    const formatWatchDuration = (watch: any): string => {
        if (watch.duration === 'forever') {
            return 'Forever';
        }
        
        if (typeof watch.duration === 'string') {
            return watch.duration;
        }
        
        const ms = typeof watch.duration === 'number' ? watch.duration : 60 * 60 * 1000;
        const hours = Math.floor(ms / (60 * 60 * 1000));
        const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
        
        if (hours > 0) {
            return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
        }
        return `${minutes}m`;
    };

    const handleStopWatch = () => {
        if (typeof window !== 'undefined' && (window as any).vscode) {
            (window as any).vscode.postMessage({
                command: 'stopWatch'
            });
        }
    };

    return (
        <div className="watch-status-banner">
            <div className="watch-icon">🔍</div>
            <div className="watch-info">
                <div className="watch-title">Active Watch Session</div>
                <div className="watch-details">
                    Duration: {formatWatchDuration(currentWatch)} • 
                    Started: {new Date(currentWatch.startTime).toLocaleString()}
                </div>
            </div>
            <button className="watch-stop-btn" onClick={handleStopWatch}>
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
            <div className="empty-icon">🔧</div>
            <div className="empty-title">No Channels Configured</div>
            <div className="empty-description">
                Add channels to your .healthwatch.json file to start monitoring your services.
            </div>
            <button className="action-btn primary" onClick={handleOpenConfig}>
                <span className="btn-icon">⚙️</span>
                Open Configuration
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

    return (
        <div className="dashboard-content">
            {/* Quick Statistics */}
            <div className="metrics-summary">
                <MetricCard
                    label="Availability"
                    value={`${availability}%`}
                    detail={`${online}/${totalChannels} services online`}
                    className={availability >= 95 ? 'metric-good' : availability >= 85 ? 'metric-warning' : 'metric-critical'}
                />
                <MetricCard
                    label="Online"
                    value={online}
                    detail="Services running"
                    className="metric-online"
                />
                <MetricCard
                    label="Offline"
                    value={offline}
                    detail="Services down"
                    className="metric-offline"
                />
                <MetricCard
                    label="Unknown"
                    value={unknown}
                    detail="Status pending"
                    className="metric-unknown"
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