/**
 * React Metrics Dashboard Component
 * 
 * Migrated from metricsView.ts to use React for better state management and component lifecycle.
 * Displays availability, latency, incidents, and MTTR metrics with interactive elements.
 */

import React from 'react';
import { DashboardMetrics } from '../../dashboardData';
import { formatRelativeTime } from '../../dashboardUtils';

export interface MetricsViewProps {
    channels: any[];
    states: Map<string, any> | Record<string, any>;
    currentWatch?: any;
    metricsData: DashboardMetrics;
}

export const MetricsView: React.FC<MetricsViewProps> = ({
    channels,
    states,
    currentWatch,
    metricsData
}) => {
    // Convert states to object for easier access in React
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

    const getValueClass = (value: any, type: string): string => {
        switch (type) {
            case 'status':
                return value === 'online' ? 'value-good' : value === 'offline' ? 'value-bad' : 'value-warning';
            case 'availability':
                return value >= 95 ? 'value-good' : value >= 85 ? 'value-warning' : 'value-bad';
            case 'latency':
                return value <= 100 ? 'value-good' : value <= 300 ? 'value-warning' : 'value-bad';
            default:
                return '';
        }
    };

    const generatePerformanceBars = () => {
        // Generate 24 mock performance bars (representing hourly data)
        return Array.from({ length: 24 }, (_, i) => {
            const height = Math.random() * 40 + 10;
            return (
                <div 
                    key={i}
                    className="perf-bar" 
                    style={{ height: `${height}px` }}
                />
            );
        });
    };

    return (
        <div className="dashboard-content">
            <div className="metrics-container">
                {/* KPI Overview Grid */}
                <div className="kpi-grid">
                    {/* Overall Availability Panel */}
                    <div className="metric-panel">
                        <div className="panel-header">
                            <div className="panel-title">Overall Availability</div>
                            <div className={`panel-trend trend-${metricsData.availability.trend}`}>
                                {metricsData.availability.trendText}
                            </div>
                        </div>
                        <div className="big-metric metric-availability">
                            {metricsData.availability.value.toFixed(1)}%
                        </div>
                        <div className="metric-subtitle">{metricsData.availability.subtitle}</div>
                        <div className="slo-bar">
                            <div 
                                className={`slo-fill ${metricsData.availability.sloClass}`}
                                style={{ width: `${metricsData.availability.value}%` }}
                            />
                        </div>
                        <div className="mini-metrics">
                            <div className="mini-metric">
                                <span className="mini-value">{metricsData.availability.uptime}</span>
                                <div className="mini-label">Uptime</div>
                            </div>
                            <div className="mini-metric">
                                <span className="mini-value">{metricsData.availability.slo}%</span>
                                <div className="mini-label">SLO Target</div>
                            </div>
                        </div>
                    </div>

                    {/* Response Time Panel */}
                    <div className="metric-panel">
                        <div className="panel-header">
                            <div className="panel-title">Response Time</div>
                            <div className={`panel-trend trend-${metricsData.latency.trend}`}>
                                {metricsData.latency.trendText}
                            </div>
                        </div>
                        <div className="big-metric metric-latency">
                            {metricsData.latency.p95}ms
                        </div>
                        <div className="metric-subtitle">95th percentile</div>
                        <div className="performance-chart">
                            {generatePerformanceBars()}
                        </div>
                        <div className="mini-metrics">
                            <div className="mini-metric">
                                <span className="mini-value">{metricsData.latency.avg}ms</span>
                                <div className="mini-label">Average</div>
                            </div>
                            <div className="mini-metric">
                                <span className="mini-value">{metricsData.latency.max}ms</span>
                                <div className="mini-label">Peak</div>
                            </div>
                        </div>
                    </div>

                    {/* Incidents Panel */}
                    <div className="metric-panel">
                        <div className="panel-header">
                            <div className="panel-title">Incidents</div>
                            <div className={`panel-trend trend-${metricsData.incidents.trend}`}>
                                {metricsData.incidents.trendText}
                            </div>
                        </div>
                        <div className="big-metric metric-incidents">
                            {metricsData.incidents.total}
                        </div>
                        <div className="metric-subtitle">Last 7 days</div>
                        <div className="mini-metrics">
                            <div className="mini-metric">
                                <span className="mini-value">{metricsData.incidents.critical}</span>
                                <div className="mini-label">Critical</div>
                            </div>
                            <div className="mini-metric">
                                <span className="mini-value">{metricsData.incidents.warnings}</span>
                                <div className="mini-label">Warnings</div>
                            </div>
                        </div>
                    </div>

                    {/* MTTR Panel */}
                    <div className="metric-panel">
                        <div className="panel-header">
                            <div className="panel-title">Recovery Time</div>
                            <div className={`panel-trend trend-${metricsData.mttr.trend}`}>
                                {metricsData.mttr.trendText}
                            </div>
                        </div>
                        <div className="big-metric metric-mttr">
                            {metricsData.mttr.average}min
                        </div>
                        <div className="metric-subtitle">Mean time to recovery</div>
                        <div className="mini-metrics">
                            <div className="mini-metric">
                                <span className="mini-value">{metricsData.mttr.fastest}min</span>
                                <div className="mini-label">Fastest</div>
                            </div>
                            <div className="mini-metric">
                                <span className="mini-value">{metricsData.mttr.longest}min</span>
                                <div className="mini-label">Longest</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Channel Performance Table */}
                <div className="channel-metrics">
                    <h3>Channel Performance</h3>
                    <div className="channel-table">
                        <div className="table-header">
                            <div>Service</div>
                            <div>Status</div>
                            <div>Availability</div>
                            <div>Latency</div>
                            <div>Last Check</div>
                        </div>
                        {channels.map(channel => {
                            const state = statesObj[channel.id];
                            const channelMetrics = metricsData.channelMetrics?.[channel.id] || {};
                            const statusClass = state?.state || 'unknown';
                            
                            return (
                                <div key={channel.id} className="channel-row">
                                    <div className="channel-name">
                                        <div className={`status-dot dot-${statusClass}`} />
                                        {channel.name || channel.id}
                                    </div>
                                    <div className={`metric-value ${getValueClass(statusClass, 'status')}`}>
                                        {(state?.state || 'unknown').toUpperCase()}
                                    </div>
                                    <div className={`metric-value ${getValueClass(channelMetrics.availability || 0, 'availability')}`}>
                                        {(channelMetrics.availability || 0).toFixed(1)}%
                                    </div>
                                    <div className={`metric-value ${getValueClass(state?.lastSample?.latencyMs || 0, 'latency')}`}>
                                        {state?.lastSample?.latencyMs ? `${state.lastSample.latencyMs}ms` : 'N/A'}
                                    </div>
                                    <div className="metric-value">
                                        {state?.lastSample?.timestamp ? formatRelativeTime(state.lastSample.timestamp) : 'Never'}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MetricsView;