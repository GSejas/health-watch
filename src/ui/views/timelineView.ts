/**
 * Timeline dashboard view components.
 * 
 * Focused, single-responsibility modules for timeline-related views:
 * - Swimlanes view
 * - Heatmap view  
 * - Incidents view
 */

import { TimelineData, HeatmapData, DashboardIncident } from '../dashboardData';

export interface TimelineSwimlanesViewData {
    channels: any[];
    states: Map<string, any>;
    timelineData: TimelineData;
    timeRange: string;
    navigation: string;
    baseCSS: string;
        baseScripts: string;
        nonce?: string;
        cspSource?: string;
}

export interface TimelineHeatmapViewData {
    channels: any[];
    states: Map<string, any>;
    heatmapData: HeatmapData;
    navigation: string;
    baseCSS: string;
        baseScripts: string;
        nonce?: string;
        cspSource?: string;
}

export interface TimelineIncidentsViewData {
    channels: any[];
    states: Map<string, any>;
    incidents: DashboardIncident[];
    navigation: string;
    baseCSS: string;
        baseScripts: string;
        nonce?: string;
        cspSource?: string;
}

/**
 * Generates timeline swimlanes view - shows availability over time per channel
 */
export function generateTimelineSwimlanesView(data: TimelineSwimlanesViewData): string {
    const { channels, timelineData, timeRange, navigation, baseCSS, baseScripts } = data;
    const days = getTimeRangeDays(timeRange);
    const dateLabels = generateDateLabels(days);

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${data.cspSource || ''} https:; script-src ${data.cspSource || ''} 'nonce-${data.nonce || ''}'; style-src ${data.cspSource || ''} 'unsafe-inline';">
        <title>Health Watch - Timeline Swimlanes</title>
        ${baseCSS}
    </head>
    <body>
        ${navigation}
        
        <div class="dashboard-content">
            <div class="timeline-container">
                <div class="timeline-header">
                    <h2>Service Availability Timeline</h2>
                    <div class="timeline-controls">
                        <select class="time-range-selector" data-command="changeTimeRange">
                            <option value="7D" ${timeRange === '7D' ? 'selected' : ''}>Last 7 Days</option>
                            <option value="30D" ${timeRange === '30D' ? 'selected' : ''}>Last 30 Days</option>
                        </select>
                    </div>
                </div>

                <div class="timeline-legend">
                    <div class="legend-item">
                        <div class="legend-color bar-online"></div>
                        <span>Online (≥90%)</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color bar-degraded"></div>
                        <span>Degraded (70-89%)</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color bar-offline"></div>
                        <span>Offline (<70%)</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color bar-no-data"></div>
                        <span>No Data</span>
                    </div>
                </div>

                <div class="timeline-grid">
                    <!-- Date headers -->
                    <div class="timeline-labels">
                        <div class="channel-label-header">Channel</div>
                        ${dateLabels.map(label => `
                            <div class="date-label">${label}</div>
                        `).join('')}
                    </div>

                    <!-- Channel rows -->
                    ${channels.map(channel => {
                        const channelData = timelineData[channel.id] || [];
                        return `
                        <div class="timeline-row">
                            <div class="channel-label">
                                <div class="channel-name">${channel.name || channel.id}</div>
                                <div class="channel-type">${channel.type?.toUpperCase()}</div>
                            </div>
                            ${channelData.map((dayData, index) => `
                                <div class="timeline-bar ${getTimelineBarClass(dayData)}" 
                                     title="${getTimelineTooltip(channel, dayData, dateLabels[index])}">
                                    <div class="bar-fill" style="height: ${dayData.availability}%"></div>
                                    ${dayData.sampleCount > 0 ? `
                                        <div class="sample-count">${dayData.sampleCount}</div>
                                    ` : ''}
                                </div>
                            `).join('')}
                        </div>
                        `;
                    }).join('')}
                </div>

                ${channels.length === 0 ? `
                <div class="empty-timeline">
                    <div class="empty-icon">📈</div>
                    <div class="empty-title">No Timeline Data</div>
                    <div class="empty-description">Configure channels to see availability timeline</div>
                </div>
                ` : ''}
            </div>
        </div>
        
        ${baseScripts}
    </body>
    </html>
    `;
}

/**
 * Generates timeline heatmap view - shows hourly availability patterns
 */
export function generateTimelineHeatmapView(data: TimelineHeatmapViewData): string {
    const { channels, heatmapData, navigation, baseCSS, baseScripts } = data;
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${data.cspSource || ''} https:; script-src ${data.cspSource || ''} 'nonce-${data.nonce || ''}'; style-src ${data.cspSource || ''} 'unsafe-inline';">
        <title>Health Watch - Timeline Heatmap</title>
        ${baseCSS}
    </head>
    <body>
        ${navigation}
        
        <div class="dashboard-content">
            <div class="heatmap-container">
                <div class="heatmap-header">
                    <h2>Hourly Availability Heatmap</h2>
                    <div class="heatmap-subtitle">Last 7 days, hourly resolution</div>
                </div>

                <div class="heatmap-legend">
                    <span class="legend-label">Availability:</span>
                    <div class="legend-gradient">
                        <div class="gradient-bar"></div>
                        <div class="gradient-labels">
                            <span>0%</span>
                            <span>50%</span>
                            <span>100%</span>
                        </div>
                    </div>
                </div>

                <div class="heatmap-grid">
                    ${channels.map(channel => {
                        const channelHeatmap = heatmapData[channel.id] || [];
                        return `
                        <div class="heatmap-channel">
                            <div class="heatmap-channel-label">
                                <div class="channel-name">${channel.name || channel.id}</div>
                                <div class="channel-type">${channel.type?.toUpperCase()}</div>
                            </div>
                            <div class="heatmap-cells">
                                ${channelHeatmap.map((hourData, index) => `
                                    <div class="heatmap-cell" 
                                         style="background-color: ${getHeatmapColor(hourData.availability)}"
                                         title="${getHeatmapTooltip(channel, hourData, index)}">
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>

                <!-- Hour labels -->
                <div class="heatmap-time-labels">
                    ${Array.from({length: 24}, (_, hour) => `
                        <div class="time-label">${hour.toString().padStart(2, '0')}</div>
                    `).join('')}
                </div>
            </div>
        </div>
        
        ${baseScripts}
    </body>
    </html>
    `;
}

/**
 * Generates timeline incidents view - shows incident history
 */
export function generateTimelineIncidentsView(data: TimelineIncidentsViewData): string {
    const { incidents, navigation, baseCSS, baseScripts } = data;

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${data.cspSource || ''} https:; script-src ${data.cspSource || ''} 'nonce-${data.nonce || ''}'; style-src ${data.cspSource || ''} 'unsafe-inline';">
        <title>Health Watch - Incidents Timeline</title>
        ${baseCSS}
    </head>
    <body>
        ${navigation}
        
        <div class="dashboard-content">
            <div class="incidents-container">
                <div class="incidents-header">
                    <h2>Incident Timeline</h2>
                    <div class="incidents-subtitle">Last 7 days of incidents and recoveries</div>
                </div>

                <div class="incidents-list">
                    ${incidents.map(incident => `
                        <div class="incident-item severity-${incident.severity}">
                            <div class="incident-timeline-marker">
                                <div class="incident-time">
                                    ${new Date(incident.timestamp).toLocaleString()}
                                </div>
                                <div class="incident-marker ${incident.type}"></div>
                            </div>
                            <div class="incident-details">
                                <div class="incident-title">${incident.title}</div>
                                <div class="incident-description">${incident.description}</div>
                                <div class="incident-meta">
                                    <span class="incident-channel">${incident.channel}</span>
                                    ${incident.duration ? `
                                        <span class="incident-duration">${incident.duration}m duration</span>
                                    ` : ''}
                                    <span class="incident-impact">${incident.impact}</span>
                                </div>
                            </div>
                            <div class="incident-severity">
                                <div class="severity-badge ${incident.severity}">
                                    ${incident.severity.toUpperCase()}
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>

                ${incidents.length === 0 ? `
                <div class="empty-incidents">
                    <div class="empty-icon">✅</div>
                    <div class="empty-title">No Recent Incidents</div>
                    <div class="empty-description">All services are running smoothly</div>
                </div>
                ` : ''}
            </div>
        </div>
        
        ${baseScripts}
    </body>
    </html>
    `;
}

// Utility functions for timeline views

function getTimeRangeDays(timeRange: string): number {
    switch (timeRange) {
        case '30D': return 30;
        case '7D':
        default: return 7;
    }
}

function generateDateLabels(days: number): string[] {
    const labels = [];
    for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    }
    return labels;
}

function getTimelineBarClass(dayData: any): string {
    const availability = dayData.availability || 0;
    if (availability >= 90) return 'bar-online';
    if (availability >= 70) return 'bar-degraded';
    if (availability > 0) return 'bar-offline';
    return 'bar-no-data';
}

function getTimelineTooltip(channel: any, dayData: any, dateLabel: string): string {
    return `${channel.name || channel.id} - ${dateLabel}: ${dayData.availability.toFixed(1)}% (${dayData.sampleCount} samples)`;
}

function getHeatmapColor(availability: number): string {
    const intensity = availability / 100;
    const red = Math.round(255 * (1 - intensity));
    const green = Math.round(255 * intensity);
    return `rgb(${red}, ${green}, 0)`;
}

function getHeatmapTooltip(channel: any, hourData: any, hourIndex: number): string {
    const hour = hourIndex % 24;
    const day = Math.floor(hourIndex / 24);
    return `${channel.name || channel.id} - Day ${day + 1}, ${hour}:00: ${hourData.availability.toFixed(1)}%`;
}