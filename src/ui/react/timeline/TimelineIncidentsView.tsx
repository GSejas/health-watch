import React from 'react';
import { DashboardIncident } from '../../dashboardData';
import { baseStyles } from '../shared/baseStyles';

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
            
            <style>{incidentsStyles}</style>
        </div>
    );
};

const incidentsStyles = `
    ${baseStyles}
    
    /* Incidents-specific styles */
    .incidents-header {
        margin-bottom: 24px;
        text-align: center;
    }

    .incidents-subtitle {
        color: var(--vscode-descriptionForeground);
        font-size: 14px;
    }

    /* Incidents Summary Styles */
    .incidents-summary {
        background: var(--vscode-editor-inactiveSelectionBackground);
        border: 1px solid var(--vscode-widget-border);
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 20px;
    }

    .summary-stats {
        display: flex;
        gap: 24px;
        justify-content: center;
        margin-bottom: 16px;
    }

    .stat-item {
        text-align: center;
    }

    .stat-value {
        font-size: 24px;
        font-weight: 700;
        color: var(--vscode-foreground);
    }

    .stat-label {
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
        margin-top: 4px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .severity-breakdown {
        display: flex;
        gap: 16px;
        justify-content: center;
        flex-wrap: wrap;
    }

    .severity-count {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
    }

    .severity-count.severity-critical {
        background: rgba(244, 67, 54, 0.2);
        color: #f44336;
    }

    .severity-count.severity-high {
        background: rgba(255, 152, 0, 0.2);
        color: #ff9800;
    }

    .severity-count.severity-medium {
        background: rgba(255, 235, 59, 0.2);
        color: #ffeb3b;
    }

    .severity-count.severity-low {
        background: rgba(76, 175, 80, 0.2);
        color: #4caf50;
    }

    /* Filters Styles */
    .incident-filters {
        display: flex;
        gap: 16px;
        margin-bottom: 20px;
        padding: 16px;
        background: var(--vscode-input-background);
        border: 1px solid var(--vscode-widget-border);
        border-radius: 6px;
    }

    .filter-group {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .filter-group label {
        font-size: 13px;
        font-weight: 500;
        color: var(--vscode-foreground);
    }

    .filter-group select {
        background: var(--vscode-dropdown-background);
        color: var(--vscode-dropdown-foreground);
        border: 1px solid var(--vscode-dropdown-border);
        border-radius: 4px;
        padding: 4px 8px;
        font-size: 12px;
        min-width: 120px;
    }

    .filter-group select:focus {
        outline: 1px solid var(--vscode-focusBorder);
    }

    /* Incidents List Styles */
    .incidents-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .incident-item {
        display: flex;
        align-items: flex-start;
        gap: 16px;
        padding: 16px;
        background: var(--vscode-editor-inactiveSelectionBackground);
        border: 1px solid var(--vscode-widget-border);
        border-radius: 8px;
        border-left-width: 4px;
        transition: all 0.2s ease;
    }

    .incident-item:hover {
        background: var(--vscode-list-hoverBackground);
        border-color: var(--vscode-list-hoverBackground);
    }

    .incident-item.severity-critical {
        border-left-color: #f44336;
    }

    .incident-item.severity-high {
        border-left-color: #ff9800;
    }

    .incident-item.severity-medium {
        border-left-color: #ffeb3b;
    }

    .incident-item.severity-low {
        border-left-color: #4caf50;
    }

    .incident-timeline-marker {
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        width: 100px;
    }

    .incident-time {
        font-size: 11px;
        color: var(--vscode-descriptionForeground);
        text-align: center;
        line-height: 1.2;
    }

    .incident-marker {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        background: var(--vscode-editor-background);
        border: 2px solid var(--vscode-widget-border);
    }

    .incident-marker.outage {
        background: rgba(244, 67, 54, 0.1);
        border-color: #f44336;
    }

    .incident-marker.degradation {
        background: rgba(255, 152, 0, 0.1);
        border-color: #ff9800;
    }

    .incident-marker.recovery {
        background: rgba(76, 175, 80, 0.1);
        border-color: #4caf50;
    }

    .incident-marker.maintenance {
        background: rgba(33, 150, 243, 0.1);
        border-color: #2196f3;
    }

    .incident-details {
        flex: 1;
        min-width: 0;
    }

    .incident-title {
        font-size: 15px;
        font-weight: 600;
        color: var(--vscode-foreground);
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .incident-description {
        font-size: 13px;
        color: var(--vscode-descriptionForeground);
        line-height: 1.4;
        margin-bottom: 10px;
    }

    .incident-meta {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        font-size: 11px;
        color: var(--vscode-descriptionForeground);
    }

    .incident-channel, .incident-duration, .incident-impact {
        background: var(--vscode-badge-background);
        color: var(--vscode-badge-foreground);
        padding: 2px 6px;
        border-radius: 3px;
        font-weight: 500;
    }

    .incident-severity {
        flex-shrink: 0;
    }

    .severity-badge {
        padding: 6px 10px;
        border-radius: 12px;
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .severity-badge.critical {
        background: #f44336;
        color: white;
    }

    .severity-badge.high {
        background: #ff9800;
        color: white;
    }

    .severity-badge.medium {
        background: #ffeb3b;
        color: #333;
    }

    .severity-badge.low {
        background: #4caf50;
        color: white;
    }

    /* Empty State - using base empty-state classes from baseStyles */
    .empty-incidents {
        /* Inherits from .empty-state in baseStyles */
        text-align: center;
        padding: 80px 20px;
        color: var(--vscode-descriptionForeground);
    }
`;