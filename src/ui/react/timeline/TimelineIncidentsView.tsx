import React from 'react';
import { DashboardIncident } from '../../dashboardData';

export interface TimelineIncidentsViewProps {
    channels: any[];
    states: Map<string, any> | Record<string, any>;
    incidents: DashboardIncident[];
}

interface IncidentItemProps {
    incident: DashboardIncident;
}

const IncidentItem: React.FC<IncidentItemProps> = ({ incident }) => {
    const getSeverityIcon = (severity: string): string => {
        switch (severity) {
            case 'critical': return '🔴';
            case 'high': return '🟠';
            case 'medium': return '🟡';
            case 'low': return '🟢';
            default: return '⚪';
        }
    };

    const getIncidentTypeIcon = (type: string): string => {
        switch (type) {
            case 'outage': return '📉';
            case 'degradation': return '⚠️';
            case 'recovery': return '✅';
            case 'maintenance': return '🔧';
            default: return '📊';
        }
    };

    const formatDuration = (duration?: number): string => {
        if (!duration) return 'Ongoing';
        const hours = Math.floor(duration / 60);
        const minutes = duration % 60;
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    };

    return (
        <div className={`incident-item severity-${incident.severity}`}>
            <div className="incident-timeline-marker">
                <div className="incident-time">
                    {new Date(incident.timestamp).toLocaleString()}
                </div>
                <div className={`incident-marker ${incident.type}`}>
                    {getIncidentTypeIcon(incident.type)}
                </div>
            </div>
            <div className="incident-details">
                <div className="incident-title">
                    {getSeverityIcon(incident.severity)} {incident.title}
                </div>
                <div className="incident-description">{incident.description}</div>
                <div className="incident-meta">
                    <span className="incident-channel">{incident.channel}</span>
                    {incident.duration && (
                        <span className="incident-duration">
                            {formatDuration(incident.duration)} duration
                        </span>
                    )}
                    <span className="incident-impact">{incident.impact}</span>
                </div>
            </div>
            <div className="incident-severity">
                <div className={`severity-badge ${incident.severity}`}>
                    {incident.severity.toUpperCase()}
                </div>
            </div>
        </div>
    );
};

const EmptyIncidents: React.FC = () => (
    <div className="empty-incidents">
        <div className="empty-icon">✅</div>
        <div className="empty-title">No Recent Incidents</div>
        <div className="empty-description">All services are running smoothly</div>
    </div>
);

const IncidentsSummary: React.FC<{ incidents: DashboardIncident[] }> = ({ incidents }) => {
    const summary = React.useMemo(() => {
        const now = Date.now();
        const last24h = incidents.filter(i => now - i.timestamp < 24 * 60 * 60 * 1000);
        const last7d = incidents.filter(i => now - i.timestamp < 7 * 24 * 60 * 60 * 1000);
        
        const severityCounts = incidents.reduce((acc, incident) => {
            acc[incident.severity] = (acc[incident.severity] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        return {
            total: incidents.length,
            last24h: last24h.length,
            last7d: last7d.length,
            severityCounts
        };
    }, [incidents]);

    if (summary.total === 0) return null;

    return (
        <div className="incidents-summary">
            <div className="summary-stats">
                <div className="stat-item">
                    <div className="stat-value">{summary.total}</div>
                    <div className="stat-label">Total Incidents</div>
                </div>
                <div className="stat-item">
                    <div className="stat-value">{summary.last24h}</div>
                    <div className="stat-label">Last 24h</div>
                </div>
                <div className="stat-item">
                    <div className="stat-value">{summary.last7d}</div>
                    <div className="stat-label">Last 7 days</div>
                </div>
            </div>
            <div className="severity-breakdown">
                {Object.entries(summary.severityCounts).map(([severity, count]) => (
                    <div key={severity} className={`severity-count severity-${severity}`}>
                        <span className="severity-label">{severity}:</span>
                        <span className="severity-number">{count}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const IncidentFilters: React.FC<{
    selectedSeverity: string;
    selectedChannel: string;
    channels: any[];
    onSeverityChange: (severity: string) => void;
    onChannelChange: (channel: string) => void;
}> = ({ selectedSeverity, selectedChannel, channels, onSeverityChange, onChannelChange }) => {
    return (
        <div className="incident-filters">
            <div className="filter-group">
                <label>Severity:</label>
                <select value={selectedSeverity} onChange={(e) => onSeverityChange(e.target.value)}>
                    <option value="">All Severities</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                </select>
            </div>
            <div className="filter-group">
                <label>Channel:</label>
                <select value={selectedChannel} onChange={(e) => onChannelChange(e.target.value)}>
                    <option value="">All Channels</option>
                    {channels.map(channel => (
                        <option key={channel.id} value={channel.id}>
                            {channel.name || channel.id}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
};

export const TimelineIncidentsView: React.FC<TimelineIncidentsViewProps> = ({
    channels,
    states,
    incidents
}) => {
    const [selectedSeverity, setSelectedSeverity] = React.useState('');
    const [selectedChannel, setSelectedChannel] = React.useState('');

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

    const filteredIncidents = React.useMemo(() => {
        return incidents.filter(incident => {
            if (selectedSeverity && incident.severity !== selectedSeverity) {
                return false;
            }
            if (selectedChannel && incident.channel !== selectedChannel) {
                return false;
            }
            return true;
        });
    }, [incidents, selectedSeverity, selectedChannel]);

    return (
        <div className="incidents-container">
            <div className="incidents-header">
                <h2>Incident Timeline</h2>
                <div className="incidents-subtitle">Last 7 days of incidents and recoveries</div>
            </div>

            <IncidentsSummary incidents={incidents} />

            <IncidentFilters
                selectedSeverity={selectedSeverity}
                selectedChannel={selectedChannel}
                channels={channels}
                onSeverityChange={setSelectedSeverity}
                onChannelChange={setSelectedChannel}
            />

            <div className="incidents-list">
                {filteredIncidents.length > 0 ? (
                    filteredIncidents.map(incident => (
                        <IncidentItem key={incident.id} incident={incident} />
                    ))
                ) : (
                    <EmptyIncidents />
                )}
            </div>
        </div>
    );
};