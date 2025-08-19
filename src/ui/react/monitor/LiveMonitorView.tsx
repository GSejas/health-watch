import React from 'react';
import { formatRelativeTime } from '../../dashboardUtils';
import { RecentSample } from '../../dashboardData';

export interface LiveMonitorViewProps {
    channels: any[];
    states: Map<string, any> | Record<string, any>;
    currentWatch?: any;
    recentSamples: RecentSample[];
}

interface LiveChannelCardProps {
    channel: any;
    state?: any;
}

const LiveChannelCard: React.FC<LiveChannelCardProps> = ({ channel, state }) => {
    const status = state?.state || 'unknown';
    const latency = state?.lastSample?.latencyMs;

    return (
        <div className={`live-channel-card status-${status}`}>
            <div className={`channel-status-indicator ${status}`}></div>
            <div className="channel-info">
                <div className="channel-name">{channel.name || channel.id}</div>
                <div className="channel-latency">
                    {latency ? `${latency}ms` : 'N/A'}
                </div>
            </div>
        </div>
    );
};

const ActivityItem: React.FC<{ sample: RecentSample }> = ({ sample }) => {
    return (
        <div className={`activity-item ${sample.success ? 'success' : 'failure'}`}>
            <div className="activity-time">
                {formatRelativeTime(sample.timestamp)}
            </div>
            <div className="activity-status">
                <div className={`status-dot ${sample.success ? 'success' : 'failure'}`}></div>
            </div>
            <div className="activity-details">
                <div className="activity-channel">{sample.channelName}</div>
                <div className="activity-info">
                    {sample.success 
                        ? `✓ ${sample.latencyMs ? sample.latencyMs + 'ms' : 'OK'}`
                        : `✗ ${sample.error || 'Failed'}`
                    }
                </div>
            </div>
        </div>
    );
};

const MonitorHeader: React.FC<{ currentWatch?: any }> = ({ currentWatch }) => (
    <div className="monitor-header">
        <div className="monitor-title">
            <h2>Live Monitor</h2>
            <div className="live-indicator">
                <div className="pulse-dot"></div>
                <span>Live</span>
            </div>
        </div>
        
        {currentWatch?.isActive && (
            <div className="watch-indicator">
                <span className="watch-icon">🔍</span>
                <span>Watch Active</span>
            </div>
        )}
    </div>
);

const ActivityFeed: React.FC<{ 
    recentSamples: RecentSample[];
    limit?: number;
}> = ({ recentSamples, limit = 50 }) => {
    const displaySamples = recentSamples.slice(0, limit);

    if (displaySamples.length === 0) {
        return (
            <div className="activity-feed">
                <h3>Recent Activity</h3>
                <div className="no-activity">
                    <div className="no-activity-icon">📊</div>
                    <div className="no-activity-text">No recent activity</div>
                </div>
            </div>
        );
    }

    return (
        <div className="activity-feed">
            <h3>Recent Activity</h3>
            <div className="activity-list">
                {displaySamples.map((sample, index) => (
                    <ActivityItem key={`${sample.timestamp}-${index}`} sample={sample} />
                ))}
            </div>
        </div>
    );
};

const LiveChannelsGrid: React.FC<{
    channels: any[];
    statesObj: Record<string, any>;
}> = ({ channels, statesObj }) => (
    <div className="live-channels">
        <h3>Channel Status</h3>
        <div className="live-channels-grid">
            {channels.map(channel => (
                <LiveChannelCard
                    key={channel.id}
                    channel={channel}
                    state={statesObj[channel.id]}
                />
            ))}
        </div>
    </div>
);

const LiveStats: React.FC<{
    channels: any[];
    statesObj: Record<string, any>;
    recentSamples: RecentSample[];
}> = ({ channels, statesObj, recentSamples }) => {
    const stats = React.useMemo(() => {
        const totalChannels = channels.length;
        let online = 0, offline = 0, unknown = 0;

        for (const channel of channels) {
            const state = statesObj[channel.id]?.state || 'unknown';
            if (state === 'online') online++;
            else if (state === 'offline') offline++;
            else unknown++;
        }

        const last5Minutes = Date.now() - 5 * 60 * 1000;
        const recentActivity = recentSamples.filter(s => s.timestamp > last5Minutes);
        const recentSuccessRate = recentActivity.length > 0 
            ? (recentActivity.filter(s => s.success).length / recentActivity.length) * 100
            : 0;

        return {
            totalChannels,
            online,
            offline,
            unknown,
            recentActivity: recentActivity.length,
            recentSuccessRate
        };
    }, [channels, statesObj, recentSamples]);

    return (
        <div className="live-stats">
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-value">{stats.online}</div>
                    <div className="stat-label">Online</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats.offline}</div>
                    <div className="stat-label">Offline</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats.recentActivity}</div>
                    <div className="stat-label">Recent Probes</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats.recentSuccessRate.toFixed(1)}%</div>
                    <div className="stat-label">Success Rate</div>
                </div>
            </div>
        </div>
    );
};

export const LiveMonitorView: React.FC<LiveMonitorViewProps> = ({
    channels,
    states,
    currentWatch,
    recentSamples
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

    // Auto-refresh effect (optional - could be controlled by parent)
    React.useEffect(() => {
        const interval = setInterval(() => {
            // Request fresh data from parent
            if (typeof window !== 'undefined' && (window as any).vscode) {
                (window as any).vscode.postMessage({
                    command: 'refreshLiveData'
                });
            }
        }, 5000); // Refresh every 5 seconds

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="dashboard-content">
            <MonitorHeader currentWatch={currentWatch} />

            <LiveStats 
                channels={channels}
                statesObj={statesObj}
                recentSamples={recentSamples}
            />

            <LiveChannelsGrid 
                channels={channels}
                statesObj={statesObj}
            />

            <ActivityFeed 
                recentSamples={recentSamples}
                limit={50}
            />
        </div>
    );
};