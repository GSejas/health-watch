import React, { useEffect, useState } from 'react';
import { formatRelativeTime, formatWatchDuration, formatRemaining } from '../../dashboardUtils';

export interface OverviewViewProps {
    channels: any[];
    states: Map<string, any> | Record<string, any>;
    currentWatch?: any;
}

/**
 * Props for the Channel Card component.
 *
 * @remarks
 * This interface describes the properties used to render a Channel Card in the overview section.
 *
 * @property channel - The channel data. Replace `any` with a more specific type if available.
 * @property state - Optional state for the channel. Its type can be refined as needed.
 */

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
    const [now, setNow] = useState<number>(Date.now());
    const [stats, setStats] = useState<{ probesRun?: number; successRatePct?: number; lastSampleAgeMs?: number }>({});

    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        const handler = (event: MessageEvent) => {
            const msg = event.data || {};
            if (!msg || !msg.command) return;
            if (msg.command === 'watchStats' && msg.payload) {
                setStats(msg.payload);
            }
        };
        window.addEventListener('message', handler as any);
        return () => window.removeEventListener('message', handler as any);
    }, []);

    const start = currentWatch?.startTime || now;
    // Determine end time: explicit endTime, or start + duration (if numeric), else null (forever)
    const end = currentWatch?.endTime ?? (typeof currentWatch?.duration === 'number' ? start + currentWatch.duration : null);
    const elapsed = now - start;
    const remaining = end !== null && end !== undefined ? end - now : null;
    const total = end !== null && end !== undefined ? end - start : (typeof currentWatch?.duration === 'number' ? currentWatch.duration : null);
    const fraction = total && total > 0 ? Math.max(0, Math.min(1, elapsed / total)) : null;

    const post = (message: any) => {
        if (typeof window !== 'undefined' && (window as any).vscode) {
            (window as any).vscode.postMessage(message);
        }
    };

    const handleStopWatch = () => post({ command: 'stopWatch' });
    const handlePause = () => post({ command: 'pauseWatch' });
    const handleResume = () => post({ command: 'resumeWatch' });
    const handleExtend = (ms: number | 'forever') => {
        post({ command: 'extendWatch', payload: { extendMs: ms } });
    };

    return (
        <div className="watch-banner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '20px' }}>
                    🔍
                </span>
                <div>
                    <h3 className="watch-title">Active Watch Session</h3>
                    <p style={{ fontSize: '12px', opacity: '0.7', margin: 0 }}>
                        {formatRemaining(remaining)} remaining • Started: {new Date(start).toLocaleString()}
                    </p>
                    <div style={{ marginTop: 8 }}>
                        <div style={{ height: 8, background: '#eee', borderRadius: 6, overflow: 'hidden', width: 320 }} aria-hidden>
                            {fraction !== null ? (
                                <div style={{ height: '100%', width: `${Math.round(fraction * 100)}%`, background: 'linear-gradient(90deg,#34d399,#06b6d4)', transition: 'width 1s linear' }} />
                            ) : (
                                <div style={{ height: '100%', width: '100%', background: 'repeating-linear-gradient(45deg,#e2e8f0 0 10px,#cbd5e1 10px 20px)' }} />
                            )}
                        </div>
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12, color: '#6b7280' }}>
                        {stats.probesRun !== undefined ? `${stats.probesRun} probes • ${stats.successRatePct ?? 0}% success • Last: ${stats.lastSampleAgeMs ? Math.round(stats.lastSampleAgeMs / 1000) + 's' : 'N/A'} ago` : ''}
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {currentWatch?.paused ? (
                    <button className="btn btn-primary" onClick={handleResume}>Resume</button>
                ) : (
                    <button className="btn" onClick={handlePause}>Pause</button>
                )}
                <button className="btn btn-secondary" onClick={() => handleExtend(30 * 60 * 1000)}>+30m</button>
                <button className="btn btn-secondary" onClick={() => handleExtend(60 * 60 * 1000)}>+1h</button>
                <button className="btn btn-secondary" onClick={() => handleExtend('forever')}>∞</button>
                <button className="btn btn-danger" onClick={handleStopWatch}>Stop</button>
            </div>
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
            <div className="metrics-summary">
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