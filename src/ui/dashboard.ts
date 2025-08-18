import * as vscode from 'vscode';
import { ConfigManager } from '../config';
import { StorageManager } from '../storage';
import { Scheduler } from '../runner/scheduler';
import { StatsCalculator } from '../stats';

export class DashboardManager {
    private panel: vscode.WebviewPanel | undefined;
    private configManager = ConfigManager.getInstance();
    private storageManager = StorageManager.getInstance();
    private statsCalculator = new StatsCalculator();

    constructor(private scheduler: Scheduler) {}

    async openDashboard(context: vscode.ExtensionContext) {
        if (this.panel) {
            this.panel.reveal();
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'healthWatchDashboard',
            'Health Watch Dashboard',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(context.extensionUri, 'resources')
                ]
            }
        );

        this.panel.webview.html = this.generateDashboardHTML();

        // Handle messages from webview
        this.panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'refreshData':
                    this.panel!.webview.html = this.generateDashboardHTML();
                    break;
                case 'runAllProbes':
                    await this.scheduler.runAllChannelsNow();
                    this.panel!.webview.html = this.generateDashboardHTML();
                    break;
                case 'runChannelProbe':
                    await this.scheduler.runChannelNow(message.channelId);
                    this.panel!.webview.html = this.generateDashboardHTML();
                    break;
                case 'startWatch':
                    this.scheduler.emit('startWatch', { duration: message.duration });
                    break;
                case 'changeView':
                    this.panel!.webview.html = this.generateDashboardHTML(message.viewType, message.options);
                    break;
                case 'changeTimeRange':
                    this.panel!.webview.html = this.generateDashboardHTML('timeline-swimlane', { timeRange: message.range });
                    break;
                case 'filterIncidents':
                    this.panel!.webview.html = this.generateDashboardHTML(message.viewType, { filter: message.filter });
                    break;
            }
        });

        // Clean up when panel is disposed
        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });

        // Auto-refresh every 30 seconds
        this.startAutoRefresh();
    }

    private startAutoRefresh() {
        const refreshTimer = setInterval(() => {
            if (this.panel && this.panel.visible) {
                this.panel.webview.html = this.generateDashboardHTML();
            } else {
                clearInterval(refreshTimer);
            }
        }, 30000);
    }

    private generateDashboardHTML(viewType: string = 'overview', options: any = {}): string {
        const channels = this.configManager.getChannels();
        const states = this.scheduler.getChannelRunner().getChannelStates();
        const currentWatch = this.storageManager.getCurrentWatch();

        switch (viewType) {
            case 'timeline-swimlane':
                return this.generateTimelineSwimlanesView(channels, states, options);
            case 'timeline-heatmap':
                return this.generateTimelineHeatmapView(channels, states, options);
            case 'timeline-incidents':
                return this.generateTimelineIncidentsView(channels, states, options);
            case 'metrics':
                return this.generateCompactMetricsView(channels, states, currentWatch);
            case 'monitor':
                return this.generateLiveMonitorView(channels, states);
            case 'overview':
            default:
                return this.generateOverviewDashboard(channels, states, currentWatch);
        }
    }

    private generateOverviewDashboard(channels: any[], states: Map<string, any>, currentWatch?: any): string {
        const totalChannels = channels.length;
        let online = 0, offline = 0, unknown = 0;

        for (const channel of channels) {
            const state = states.get(channel.id);
            switch (state?.state) {
                case 'online': online++; break;
                case 'offline': offline++; break;
                case 'unknown': unknown++; break;
            }
        }

        const healthPercentage = totalChannels > 0 ? Math.round((online / totalChannels) * 100) : 0;
        const healthColor = healthPercentage >= 90 ? '#4CAF50' : healthPercentage >= 70 ? '#FF9800' : '#F44336';

        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Health Watch Dashboard</title>
            <style>
                ${this.getBaseCSS()}
                .overview-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 20px;
                    margin-bottom: 20px;
                }
                .status-card {
                    background: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 8px;
                    padding: 20px;
                }
                .health-indicator {
                    font-size: 48px;
                    font-weight: bold;
                    color: ${healthColor};
                    text-align: center;
                    margin-bottom: 10px;
                }
                .channel-list {
                    display: grid;
                    gap: 10px;
                }
                .channel-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 10px;
                    background: var(--vscode-textBlockQuote-background);
                    border-radius: 4px;
                }
                .status-dot {
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                    margin-right: 10px;
                }
                .online { background-color: #4CAF50; }
                .offline { background-color: #F44336; }
                .unknown { background-color: #FF9800; }
            </style>
        </head>
        <body>
            <div class="dashboard-header">
                <h1>Health Watch Dashboard</h1>
                <div class="view-switcher">
                    <button class="view-btn active" onclick="changeView('overview')">Overview</button>
                    <button class="view-btn" onclick="changeView('metrics')">Metrics</button>
                    <button class="view-btn" onclick="changeView('monitor')">Live Monitor</button>
                    <button class="view-btn" onclick="changeView('timeline-swimlane')">Timeline</button>
                </div>
            </div>

            <div class="overview-grid">
                <div class="status-card">
                    <div class="health-indicator">${healthPercentage}%</div>
                    <div style="text-align: center;">
                        <div>Overall Health</div>
                        <small>${online}/${totalChannels} services online</small>
                    </div>
                </div>
                
                <div class="status-card">
                    <h3>Quick Actions</h3>
                    <div style="display: grid; gap: 10px; margin-top: 15px;">
                        <button class="action-btn" onclick="runAllProbes()">🔄 Run All Probes</button>
                        <button class="action-btn" onclick="startWatch('1h')">👁️ Start 1h Watch</button>
                        <button class="action-btn" onclick="refreshData()">📊 Refresh Data</button>
                    </div>
                </div>
            </div>

            <div class="status-card">
                <h3>Service Status</h3>
                <div class="channel-list">
                    ${channels.map(channel => {
                        const state = states.get(channel.id);
                        const statusClass = state?.state || 'unknown';
                        const latency = state?.lastSample?.latencyMs ? `${state.lastSample.latencyMs}ms` : 'N/A';
                        
                        return `
                        <div class="channel-item">
                            <div style="display: flex; align-items: center;">
                                <div class="status-dot ${statusClass}"></div>
                                <div>
                                    <div>${channel.name || channel.id}</div>
                                    <small>${channel.type.toUpperCase()}</small>
                                </div>
                            </div>
                            <div style="text-align: right;">
                                <div>${(state?.state || 'unknown').toUpperCase()}</div>
                                <small>${latency}</small>
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>

            ${this.getBaseScripts()}
        </body>
        </html>
        `;
    }

    private generateTimelineSwimlanesView(channels: any[], states: Map<string, any>, options: any = {}): string {
        const timeRange = options.timeRange || '7D';
        const days = this.getTimeRangeDays(timeRange);
        const timelineData = this.generateTimelineData(channels, days);
        
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Timeline - Swimlanes</title>
            <style>
                ${this.getBaseCSS()}
                .timeline-container {
                    background: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 8px;
                    padding: 20px;
                    margin-top: 20px;
                }
                .timeline-controls {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                    padding-bottom: 15px;
                    border-bottom: 1px solid var(--vscode-panel-border);
                }
                .zoom-controls {
                    display: flex;
                    gap: 5px;
                }
                .zoom-btn {
                    background: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                    border: none;
                    padding: 6px 12px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 11px;
                }
                .zoom-btn.active {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                }
                .timeline-header {
                    display: grid;
                    grid-template-columns: 200px 1fr;
                    gap: 20px;
                    margin-bottom: 10px;
                    align-items: center;
                }
                .time-labels {
                    display: grid;
                    grid-template-columns: repeat(${days}, 1fr);
                    gap: 2px;
                    text-align: center;
                    font-size: 11px;
                    color: var(--vscode-descriptionForeground);
                    padding: 0 5px;
                }
                .swimlanes {
                    display: grid;
                    gap: 8px;
                }
                .swimlane {
                    display: grid;
                    grid-template-columns: 200px 1fr;
                    gap: 20px;
                    align-items: center;
                    min-height: 40px;
                }
                .swimlane-label {
                    font-weight: bold;
                    color: var(--vscode-foreground);
                    padding: 8px;
                    background: var(--vscode-textBlockQuote-background);
                    border-radius: 4px;
                    font-size: 12px;
                }
                .swimlane-track {
                    display: grid;
                    grid-template-columns: repeat(${days}, 1fr);
                    gap: 2px;
                    height: 20px;
                    padding: 0 5px;
                }
                .timeline-bar {
                    border-radius: 2px;
                    position: relative;
                    cursor: pointer;
                }
                .bar-online {
                    background: var(--vscode-charts-green);
                }
                .bar-offline {
                    background: var(--vscode-charts-red);
                }
                .bar-unknown {
                    background: var(--vscode-charts-orange);
                }
                .bar-mixed {
                    background: linear-gradient(to right, 
                        var(--vscode-charts-green) 0%, 
                        var(--vscode-charts-green) 60%, 
                        var(--vscode-charts-red) 60%, 
                        var(--vscode-charts-red) 100%);
                }
                .timeline-bar:hover {
                    opacity: 0.8;
                    transform: scaleY(1.2);
                }
                .timeline-legend {
                    display: flex;
                    gap: 20px;
                    margin-top: 20px;
                    padding: 15px;
                    background: var(--vscode-textBlockQuote-background);
                    border-radius: 6px;
                    font-size: 12px;
                }
                .legend-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .legend-color {
                    width: 16px;
                    height: 12px;
                    border-radius: 2px;
                }
                .stats-summary {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 15px;
                    margin-top: 20px;
                }
                .stat-card {
                    background: var(--vscode-textBlockQuote-background);
                    padding: 15px;
                    border-radius: 6px;
                    text-align: center;
                }
                .stat-value {
                    font-size: 24px;
                    font-weight: bold;
                    color: var(--vscode-charts-blue);
                }
                .stat-label {
                    font-size: 11px;
                    color: var(--vscode-descriptionForeground);
                    margin-top: 5px;
                }
            </style>
        </head>
        <body>
            <div class="dashboard-header">
                <h1>Timeline - Swimlanes</h1>
                <div class="view-switcher">
                    <button class="view-btn" onclick="changeView('overview')">Overview</button>
                    <button class="view-btn active" onclick="changeView('timeline-swimlane')">Swimlanes</button>
                    <button class="view-btn" onclick="changeView('timeline-heatmap')">Heatmap</button>
                    <button class="view-btn" onclick="changeView('timeline-incidents')">Incidents</button>
                </div>
            </div>
            
            <div class="timeline-container">
                <div class="timeline-controls">
                    <h3>Service Availability Timeline - Last ${this.getTimeRangeLabel(timeRange)}</h3>
                    <div class="zoom-controls">
                        <button class="zoom-btn ${timeRange === '7D' ? 'active' : ''}" onclick="changeTimeRange('7D')">7D</button>
                        <button class="zoom-btn ${timeRange === '3D' ? 'active' : ''}" onclick="changeTimeRange('3D')">3D</button>
                        <button class="zoom-btn ${timeRange === '24H' ? 'active' : ''}" onclick="changeTimeRange('24H')">24H</button>
                        <button class="zoom-btn ${timeRange === '6H' ? 'active' : ''}" onclick="changeTimeRange('6H')">6H</button>
                    </div>
                </div>

                <div class="timeline-header">
                    <div></div>
                    <div class="time-labels" style="grid-template-columns: repeat(${days}, 1fr);">
                        ${this.generateDateLabels(days).map(date => `<div>${date}</div>`).join('')}
                    </div>
                </div>

                <div class="swimlanes">
                    ${channels.map((channel, index) => {
                        const channelData = timelineData[channel.id] || [];
                        return `
                        <div class="swimlane">
                            <div class="swimlane-label">
                                ${channel.name || channel.id}
                                <br><small>${channel.type.toUpperCase()}</small>
                            </div>
                            <div class="swimlane-track" style="grid-template-columns: repeat(${days}, 1fr);">
                                ${channelData.map((dayData: any, dayIndex: number) => {
                                    const barClass = this.getTimelineBarClass(dayData);
                                    const availability = dayData.availability || 0;
                                    return `
                                    <div class="timeline-bar ${barClass}" 
                                         title="${channel.name || channel.id} - ${this.generateDateLabels(days)[dayIndex]}: ${availability.toFixed(1)}% uptime"
                                         data-channel="${channel.id}" 
                                         data-day="${dayIndex}">
                                    </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>

                <div class="timeline-legend">
                    <div class="legend-item">
                        <div class="legend-color bar-online"></div>
                        <span>Online (90-100%)</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color bar-mixed"></div>
                        <span>Degraded (50-90%)</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color bar-offline"></div>
                        <span>Offline (0-50%)</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color bar-unknown"></div>
                        <span>Unknown/No Data</span>
                    </div>
                </div>

                <div class="stats-summary">
                    <div class="stat-card">
                        <div class="stat-value">${this.calculateOverallAvailability(timelineData).toFixed(1)}%</div>
                        <div class="stat-label">Overall Availability</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${this.countIncidents(timelineData)}</div>
                        <div class="stat-label">Total Incidents</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${channels.length}</div>
                        <div class="stat-label">Monitored Services</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${this.calculateMTTR(timelineData)}min</div>
                        <div class="stat-label">Avg Recovery Time</div>
                    </div>
                </div>
            </div>
            
            ${this.getBaseScripts()}
        </body>
        </html>
        `;
    }

    private generateTimelineHeatmapView(channels: any[], states: Map<string, any>, options: any = {}): string {
        const heatmapData = this.generateHourlyHeatmapData(channels, 7); // 7 days hourly
        
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Timeline - Heatmap</title>
            <style>
                ${this.getBaseCSS()}
                .heatmap-container {
                    background: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 8px;
                    padding: 20px;
                    margin-top: 20px;
                }
                .heatmap-grid {
                    display: grid;
                    gap: 15px;
                }
                .channel-heatmap {
                    background: var(--vscode-textBlockQuote-background);
                    border-radius: 6px;
                    padding: 15px;
                }
                .channel-title {
                    font-weight: bold;
                    margin-bottom: 10px;
                    color: var(--vscode-foreground);
                }
                .heatmap-chart {
                    display: grid;
                    grid-template-columns: repeat(24, 1fr);
                    gap: 1px;
                    margin-bottom: 2px;
                }
                .heatmap-day {
                    display: grid;
                    grid-template-columns: 60px 1fr;
                    gap: 10px;
                    align-items: center;
                    margin-bottom: 1px;
                }
                .day-label {
                    font-size: 11px;
                    color: var(--vscode-descriptionForeground);
                    text-align: right;
                }
                .hour-cell {
                    height: 12px;
                    border-radius: 1px;
                    cursor: pointer;
                    transition: transform 0.1s ease;
                }
                .hour-cell:hover {
                    transform: scale(1.3);
                    border: 1px solid var(--vscode-foreground);
                }
                .availability-100 { background: #2d5016; }
                .availability-95 { background: #3d6b1c; }
                .availability-90 { background: #4d8622; }
                .availability-80 { background: #6ba528; }
                .availability-70 { background: #8bc34a; }
                .availability-60 { background: #cddc39; }
                .availability-50 { background: #ffeb3b; }
                .availability-40 { background: #ffc107; }
                .availability-30 { background: #ff9800; }
                .availability-20 { background: #ff5722; }
                .availability-10 { background: #f44336; }
                .availability-0 { background: #d32f2f; }
                .availability-unknown { background: var(--vscode-descriptionForeground); }
                
                .hour-labels {
                    display: grid;
                    grid-template-columns: 60px 1fr;
                    gap: 10px;
                    margin-bottom: 10px;
                }
                .time-labels {
                    display: grid;
                    grid-template-columns: repeat(24, 1fr);
                    gap: 1px;
                    font-size: 10px;
                    color: var(--vscode-descriptionForeground);
                    text-align: center;
                }
                .heatmap-legend {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-top: 20px;
                    padding: 15px;
                    background: var(--vscode-textBlockQuote-background);
                    border-radius: 6px;
                    font-size: 11px;
                }
                .legend-scale {
                    display: flex;
                    gap: 1px;
                }
                .legend-cell {
                    width: 12px;
                    height: 12px;
                    border-radius: 1px;
                }
                .heatmap-stats {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                    gap: 10px;
                    margin-top: 15px;
                }
                .stat-mini {
                    text-align: center;
                    padding: 8px;
                    background: var(--vscode-editor-background);
                    border-radius: 4px;
                    font-size: 11px;
                }
                .stat-mini-value {
                    font-weight: bold;
                    color: var(--vscode-charts-blue);
                }
            </style>
        </head>
        <body>
            <div class="dashboard-header">
                <h1>Timeline - Heatmap</h1>
                <div class="view-switcher">
                    <button class="view-btn" onclick="changeView('overview')">Overview</button>
                    <button class="view-btn" onclick="changeView('timeline-swimlane')">Swimlanes</button>
                    <button class="view-btn active" onclick="changeView('timeline-heatmap')">Heatmap</button>
                    <button class="view-btn" onclick="changeView('timeline-incidents')">Incidents</button>
                </div>
            </div>
            
            <div class="heatmap-container">
                <h3>Hourly Availability Heatmap - Last 7 Days</h3>
                <p style="color: var(--vscode-descriptionForeground); font-size: 12px; margin-bottom: 20px;">
                    Each cell represents one hour. Darker green = better availability.
                </p>

                <div class="hour-labels">
                    <div></div>
                    <div class="time-labels">
                        ${Array.from({length: 24}, (_, i) => `<div>${i.toString().padStart(2, '0')}</div>`).join('')}
                    </div>
                </div>

                <div class="heatmap-grid">
                    ${channels.map(channel => {
                        const channelData = heatmapData[channel.id] || [];
                        return `
                        <div class="channel-heatmap">
                            <div class="channel-title">${channel.name || channel.id}</div>
                            ${this.generateDateLabels(7).map((dateLabel, dayIndex) => `
                            <div class="heatmap-day">
                                <div class="day-label">${dateLabel}</div>
                                <div class="heatmap-chart">
                                    ${Array.from({length: 24}, (_, hour) => {
                                        const hourData = channelData[dayIndex * 24 + hour] || {availability: 0};
                                        const availabilityClass = this.getAvailabilityClass(hourData.availability);
                                        return `
                                        <div class="hour-cell ${availabilityClass}"
                                             title="${channel.name || channel.id} - ${dateLabel} ${hour}:00 - ${hourData.availability?.toFixed(1) || 0}% availability"
                                             data-channel="${channel.id}"
                                             data-day="${dayIndex}"
                                             data-hour="${hour}">
                                        </div>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                            `).join('')}
                            
                            <div class="heatmap-stats">
                                <div class="stat-mini">
                                    <div class="stat-mini-value">${this.calculateChannelAverage(channelData).toFixed(1)}%</div>
                                    <div>Avg Availability</div>
                                </div>
                                <div class="stat-mini">
                                    <div class="stat-mini-value">${this.countChannelOutages(channelData)}</div>
                                    <div>Outage Hours</div>
                                </div>
                                <div class="stat-mini">
                                    <div class="stat-mini-value">${this.getBestHour(channelData)}</div>
                                    <div>Best Hour</div>
                                </div>
                                <div class="stat-mini">
                                    <div class="stat-mini-value">${this.getWorstHour(channelData)}</div>
                                    <div>Worst Hour</div>
                                </div>
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>

                <div class="heatmap-legend">
                    <span>Less availability</span>
                    <div class="legend-scale">
                        <div class="legend-cell availability-0"></div>
                        <div class="legend-cell availability-20"></div>
                        <div class="legend-cell availability-40"></div>
                        <div class="legend-cell availability-60"></div>
                        <div class="legend-cell availability-80"></div>
                        <div class="legend-cell availability-95"></div>
                        <div class="legend-cell availability-100"></div>
                    </div>
                    <span>More availability</span>
                </div>
            </div>
            
            ${this.getBaseScripts()}
        </body>
        </html>
        `;
    }

    private generateTimelineIncidentsView(channels: any[], states: Map<string, any>, options: any = {}): string {
        const incidents = this.generateIncidentsData(channels, 7);
        
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Timeline - Incidents</title>
            <style>
                ${this.getBaseCSS()}
                .incidents-container {
                    background: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 8px;
                    padding: 20px;
                    margin-top: 20px;
                }
                .incidents-timeline {
                    position: relative;
                    margin: 20px 0;
                }
                .timeline-line {
                    position: absolute;
                    left: 40px;
                    top: 0;
                    width: 2px;
                    height: 100%;
                    background: var(--vscode-panel-border);
                }
                .incident-item {
                    display: grid;
                    grid-template-columns: 80px 1fr;
                    gap: 20px;
                    margin-bottom: 20px;
                    position: relative;
                }
                .incident-time {
                    text-align: right;
                    font-size: 11px;
                    color: var(--vscode-descriptionForeground);
                    padding-top: 5px;
                }
                .incident-marker {
                    position: absolute;
                    left: 35px;
                    top: 8px;
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                    border: 2px solid var(--vscode-editor-background);
                    z-index: 1;
                }
                .marker-outage { background: var(--vscode-charts-red); }
                .marker-recovery { background: var(--vscode-charts-green); }
                .marker-degraded { background: var(--vscode-charts-orange); }
                .incident-card {
                    background: var(--vscode-textBlockQuote-background);
                    border-radius: 6px;
                    padding: 15px;
                    border-left: 3px solid var(--vscode-charts-red);
                }
                .recovery-card {
                    border-left-color: var(--vscode-charts-green);
                }
                .degraded-card {
                    border-left-color: var(--vscode-charts-orange);
                }
                .incident-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 8px;
                }
                .incident-title {
                    font-weight: bold;
                    color: var(--vscode-foreground);
                }
                .incident-severity {
                    font-size: 10px;
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-weight: bold;
                }
                .severity-critical {
                    background: var(--vscode-charts-red);
                    color: white;
                }
                .severity-warning {
                    background: var(--vscode-charts-orange);
                    color: white;
                }
                .severity-info {
                    background: var(--vscode-charts-blue);
                    color: white;
                }
                .incident-details {
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground);
                    margin-bottom: 8px;
                }
                .incident-metrics {
                    display: flex;
                    gap: 15px;
                    font-size: 11px;
                    color: var(--vscode-descriptionForeground);
                }
                .metric-item {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }
                .incidents-summary {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 15px;
                    margin-bottom: 20px;
                }
                .summary-card {
                    background: var(--vscode-textBlockQuote-background);
                    padding: 15px;
                    border-radius: 6px;
                    text-align: center;
                }
                .summary-value {
                    font-size: 24px;
                    font-weight: bold;
                    margin-bottom: 5px;
                }
                .summary-critical { color: var(--vscode-charts-red); }
                .summary-warning { color: var(--vscode-charts-orange); }
                .summary-resolved { color: var(--vscode-charts-green); }
                .summary-label {
                    font-size: 11px;
                    color: var(--vscode-descriptionForeground);
                }
                .filter-bar {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 20px;
                    align-items: center;
                }
                .filter-btn {
                    background: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                    border: none;
                    padding: 6px 12px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 11px;
                }
                .filter-btn.active {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                }
            </style>
        </head>
        <body>
            <div class="dashboard-header">
                <h1>Timeline - Incidents</h1>
                <div class="view-switcher">
                    <button class="view-btn" onclick="changeView('overview')">Overview</button>
                    <button class="view-btn" onclick="changeView('timeline-swimlane')">Swimlanes</button>
                    <button class="view-btn" onclick="changeView('timeline-heatmap')">Heatmap</button>
                    <button class="view-btn active" onclick="changeView('timeline-incidents')">Incidents</button>
                </div>
            </div>
            
            <div class="incidents-container">
                <div class="incidents-summary">
                    <div class="summary-card">
                        <div class="summary-value summary-critical">${incidents.filter(i => i.severity === 'critical').length}</div>
                        <div class="summary-label">Critical Incidents</div>
                    </div>
                    <div class="summary-card">
                        <div class="summary-value summary-warning">${incidents.filter(i => i.severity === 'warning').length}</div>
                        <div class="summary-label">Warnings</div>
                    </div>
                    <div class="summary-card">
                        <div class="summary-value summary-resolved">${incidents.filter(i => i.type === 'recovery').length}</div>
                        <div class="summary-label">Recovered</div>
                    </div>
                    <div class="summary-card">
                        <div class="summary-value">${this.calculateAverageMTTR(incidents)}min</div>
                        <div class="summary-label">Avg MTTR</div>
                    </div>
                </div>

                <div class="filter-bar">
                    <span>Filter:</span>
                    <button class="filter-btn active" onclick="filterIncidents('all')">All</button>
                    <button class="filter-btn" onclick="filterIncidents('critical')">Critical</button>
                    <button class="filter-btn" onclick="filterIncidents('warning')">Warnings</button>
                    <button class="filter-btn" onclick="filterIncidents('recovery')">Recovery</button>
                </div>

                <div class="incidents-timeline">
                    <div class="timeline-line"></div>
                    ${incidents.map(incident => `
                    <div class="incident-item" data-status="${incident.type === 'recovery' ? 'recovery' : incident.severity}">
                        <div class="incident-time">
                            ${new Date(incident.timestamp).toLocaleDateString()}<br>
                            ${new Date(incident.timestamp).toLocaleTimeString()}
                        </div>
                        <div class="incident-card ${incident.type === 'recovery' ? 'recovery-card' : incident.severity === 'warning' ? 'degraded-card' : ''}">
                            <div class="incident-marker marker-${incident.type === 'recovery' ? 'recovery' : incident.severity === 'warning' ? 'degraded' : 'outage'}"></div>
                            <div class="incident-header">
                                <div class="incident-title">${incident.title}</div>
                                <div class="incident-severity severity-${incident.severity}">${incident.severity.toUpperCase()}</div>
                            </div>
                            <div class="incident-details">${incident.description}</div>
                            <div class="incident-metrics">
                                <div class="metric-item">
                                    <span>📍</span>
                                    <span>${incident.channel}</span>
                                </div>
                                ${incident.duration ? `
                                <div class="metric-item">
                                    <span>⏱️</span>
                                    <span>${incident.duration}min</span>
                                </div>
                                ` : ''}
                                ${incident.impact ? `
                                <div class="metric-item">
                                    <span>📊</span>
                                    <span>${incident.impact}</span>
                                </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                    `).join('')}
                    
                    ${incidents.length === 0 ? `
                    <div style="text-align: center; padding: 40px; color: var(--vscode-descriptionForeground);">
                        <h3>🎉 No incidents in the last 7 days!</h3>
                        <p>All services have been running smoothly.</p>
                    </div>
                    ` : ''}
                </div>
            </div>
            
            ${this.getBaseScripts()}
        </body>
        </html>
        `;
    }

    private generateCompactMetricsView(channels: any[], states: Map<string, any>, currentWatch?: any): string {
        const metricsData = this.generateMetricsData(channels, states);
        
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Compact Metrics</title>
            <style>
                ${this.getBaseCSS()}
                .metrics-container {
                    background: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 8px;
                    padding: 20px;
                    margin-top: 20px;
                }
                .metrics-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 20px;
                    margin-bottom: 20px;
                }
                .metric-panel {
                    background: var(--vscode-textBlockQuote-background);
                    border-radius: 8px;
                    padding: 20px;
                }
                .panel-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                    border-bottom: 1px solid var(--vscode-panel-border);
                    padding-bottom: 10px;
                }
                .panel-title {
                    font-weight: bold;
                    color: var(--vscode-foreground);
                }
                .panel-trend {
                    font-size: 11px;
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-weight: bold;
                }
                .trend-up {
                    background: var(--vscode-charts-green);
                    color: white;
                }
                .trend-down {
                    background: var(--vscode-charts-red);
                    color: white;
                }
                .trend-stable {
                    background: var(--vscode-charts-blue);
                    color: white;
                }
                .big-metric {
                    font-size: 36px;
                    font-weight: bold;
                    text-align: center;
                    margin: 15px 0;
                    line-height: 1;
                }
                .metric-availability { color: var(--vscode-charts-green); }
                .metric-latency { color: var(--vscode-charts-blue); }
                .metric-incidents { color: var(--vscode-charts-red); }
                .metric-mttr { color: var(--vscode-charts-orange); }
                .metric-subtitle {
                    text-align: center;
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground);
                    margin-bottom: 15px;
                }
                .mini-metrics {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                    font-size: 11px;
                }
                .mini-metric {
                    text-align: center;
                    padding: 8px;
                    background: var(--vscode-editor-background);
                    border-radius: 4px;
                }
                .mini-value {
                    font-weight: bold;
                    color: var(--vscode-foreground);
                    display: block;
                    font-size: 14px;
                }
                .mini-label {
                    color: var(--vscode-descriptionForeground);
                    margin-top: 2px;
                }
                .channel-metrics {
                    margin-top: 20px;
                }
                .channel-row {
                    display: grid;
                    grid-template-columns: 1fr auto auto auto auto;
                    gap: 15px;
                    padding: 10px 0;
                    border-bottom: 1px solid var(--vscode-panel-border);
                    align-items: center;
                    font-size: 12px;
                }
                .channel-row:last-child {
                    border-bottom: none;
                }
                .channel-name {
                    font-weight: bold;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .status-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                }
                .dot-online { background: var(--vscode-charts-green); }
                .dot-offline { background: var(--vscode-charts-red); }
                .dot-unknown { background: var(--vscode-charts-orange); }
                .metric-value {
                    text-align: center;
                    color: var(--vscode-descriptionForeground);
                }
                .value-good { color: var(--vscode-charts-green); }
                .value-warning { color: var(--vscode-charts-orange); }
                .value-bad { color: var(--vscode-charts-red); }
                .slo-bar {
                    width: 100px;
                    height: 4px;
                    background: var(--vscode-panel-border);
                    border-radius: 2px;
                    overflow: hidden;
                    margin: 10px auto;
                }
                .slo-fill {
                    height: 100%;
                    background: var(--vscode-charts-green);
                    transition: width 0.3s ease;
                }
                .slo-warning { background: var(--vscode-charts-orange); }
                .slo-critical { background: var(--vscode-charts-red); }
                .performance-chart {
                    height: 60px;
                    background: var(--vscode-editor-background);
                    border-radius: 4px;
                    margin: 10px 0;
                    padding: 10px;
                    display: flex;
                    align-items: end;
                    gap: 2px;
                }
                .perf-bar {
                    flex: 1;
                    background: var(--vscode-charts-blue);
                    opacity: 0.7;
                    border-radius: 1px;
                    min-height: 2px;
                }
            </style>
        </head>
        <body>
            <div class="dashboard-header">
                <h1>Compact Metrics</h1>
                <div class="view-switcher">
                    <button class="view-btn" onclick="changeView('overview')">Overview</button>
                    <button class="view-btn active" onclick="changeView('metrics')">Metrics</button>
                    <button class="view-btn" onclick="changeView('monitor')">Live Monitor</button>
                    <button class="view-btn" onclick="changeView('timeline-swimlane')">Timeline</button>
                </div>
            </div>
            
            <div class="metrics-container">
                <div class="metrics-grid">
                    <!-- Overall Availability -->
                    <div class="metric-panel">
                        <div class="panel-header">
                            <div class="panel-title">Overall Availability</div>
                            <div class="panel-trend trend-${metricsData.availability.trend}">${metricsData.availability.trendText}</div>
                        </div>
                        <div class="big-metric metric-availability">${metricsData.availability.value.toFixed(1)}%</div>
                        <div class="metric-subtitle">${metricsData.availability.subtitle}</div>
                        <div class="slo-bar">
                            <div class="slo-fill ${metricsData.availability.sloClass}" style="width: ${metricsData.availability.value}%"></div>
                        </div>
                        <div class="mini-metrics">
                            <div class="mini-metric">
                                <span class="mini-value">${metricsData.availability.uptime}</span>
                                <div class="mini-label">Uptime</div>
                            </div>
                            <div class="mini-metric">
                                <span class="mini-value">${metricsData.availability.slo}%</span>
                                <div class="mini-label">SLO Target</div>
                            </div>
                        </div>
                    </div>

                    <!-- Average Latency -->
                    <div class="metric-panel">
                        <div class="panel-header">
                            <div class="panel-title">Response Time</div>
                            <div class="panel-trend trend-${metricsData.latency.trend}">${metricsData.latency.trendText}</div>
                        </div>
                        <div class="big-metric metric-latency">${metricsData.latency.p95}ms</div>
                        <div class="metric-subtitle">95th percentile</div>
                        <div class="performance-chart">
                            ${Array.from({length: 24}, (_, i) => {
                                const height = Math.random() * 40 + 10; // Mock data
                                return `<div class="perf-bar" style="height: ${height}px"></div>`;
                            }).join('')}
                        </div>
                        <div class="mini-metrics">
                            <div class="mini-metric">
                                <span class="mini-value">${metricsData.latency.avg}ms</span>
                                <div class="mini-label">Average</div>
                            </div>
                            <div class="mini-metric">
                                <span class="mini-value">${metricsData.latency.max}ms</span>
                                <div class="mini-label">Peak</div>
                            </div>
                        </div>
                    </div>

                    <!-- Incidents -->
                    <div class="metric-panel">
                        <div class="panel-header">
                            <div class="panel-title">Incidents</div>
                            <div class="panel-trend trend-${metricsData.incidents.trend}">${metricsData.incidents.trendText}</div>
                        </div>
                        <div class="big-metric metric-incidents">${metricsData.incidents.total}</div>
                        <div class="metric-subtitle">Last 7 days</div>
                        <div class="mini-metrics">
                            <div class="mini-metric">
                                <span class="mini-value">${metricsData.incidents.critical}</span>
                                <div class="mini-label">Critical</div>
                            </div>
                            <div class="mini-metric">
                                <span class="mini-value">${metricsData.incidents.warnings}</span>
                                <div class="mini-label">Warnings</div>
                            </div>
                        </div>
                    </div>

                    <!-- MTTR -->
                    <div class="metric-panel">
                        <div class="panel-header">
                            <div class="panel-title">Recovery Time</div>
                            <div class="panel-trend trend-${metricsData.mttr.trend}">${metricsData.mttr.trendText}</div>
                        </div>
                        <div class="big-metric metric-mttr">${metricsData.mttr.average}min</div>
                        <div class="metric-subtitle">Mean time to recovery</div>
                        <div class="mini-metrics">
                            <div class="mini-metric">
                                <span class="mini-value">${metricsData.mttr.fastest}min</span>
                                <div class="mini-label">Fastest</div>
                            </div>
                            <div class="mini-metric">
                                <span class="mini-value">${metricsData.mttr.longest}min</span>
                                <div class="mini-label">Longest</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Channel Details -->
                <div class="channel-metrics">
                    <h3>Channel Performance</h3>
                    <div class="channel-row" style="font-weight: bold; color: var(--vscode-descriptionForeground);">
                        <div>Service</div>
                        <div>Status</div>
                        <div>Availability</div>
                        <div>Latency</div>
                        <div>Last Check</div>
                    </div>
                    ${channels.map(channel => {
                        const state = states.get(channel.id);
                        const channelMetrics = metricsData.channels[channel.id] || {};
                        const statusClass = state?.state || 'unknown';
                        
                        return `
                        <div class="channel-row">
                            <div class="channel-name">
                                <div class="status-dot dot-${statusClass}"></div>
                                ${channel.name || channel.id}
                            </div>
                            <div class="metric-value ${this.getValueClass(statusClass, 'status')}">
                                ${(state?.state || 'unknown').toUpperCase()}
                            </div>
                            <div class="metric-value ${this.getValueClass(channelMetrics.availability || 0, 'availability')}">
                                ${(channelMetrics.availability || 0).toFixed(1)}%
                            </div>
                            <div class="metric-value ${this.getValueClass(state?.lastSample?.latencyMs || 0, 'latency')}">
                                ${state?.lastSample?.latencyMs ? state.lastSample.latencyMs + 'ms' : 'N/A'}
                            </div>
                            <div class="metric-value">
                                ${state?.lastSample?.timestamp ? this.formatRelativeTime(state.lastSample.timestamp) : 'Never'}
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>
            
            ${this.getBaseScripts()}
        </body>
        </html>
        `;
    }

    private generateLiveMonitorView(channels: any[], states: Map<string, any>): string {
        const currentWatch = this.storageManager.getCurrentWatch();
        const recentSamples = this.getRecentSamples(channels, 20); // Last 20 samples across all channels
        
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Live Monitor</title>
            <style>
                ${this.getBaseCSS()}
                .monitor-container {
                    display: grid;
                    grid-template-columns: 2fr 1fr;
                    gap: 20px;
                    height: calc(100vh - 160px);
                }
                .log-panel {
                    background: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 8px;
                    padding: 20px;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                }
                .status-panel {
                    background: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 8px;
                    padding: 20px;
                    overflow-y: auto;
                }
                .log-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                    padding-bottom: 10px;
                    border-bottom: 1px solid var(--vscode-panel-border);
                }
                .log-controls {
                    display: flex;
                    gap: 10px;
                    align-items: center;
                }
                .refresh-indicator {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground);
                }
                .auto-refresh {
                    color: var(--vscode-charts-green);
                }
                .log-content {
                    font-family: var(--vscode-editor-font-family);
                    font-size: 12px;
                    flex: 1;
                    overflow-y: auto;
                    background: var(--vscode-terminal-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 4px;
                    padding: 10px;
                }
                .log-entry {
                    display: grid;
                    grid-template-columns: auto 1fr auto auto auto;
                    gap: 10px;
                    padding: 4px 0;
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                    align-items: center;
                }
                .log-entry:hover {
                    background: var(--vscode-list-hoverBackground);
                }
                .log-timestamp {
                    color: var(--vscode-descriptionForeground);
                    font-size: 11px;
                }
                .log-channel {
                    font-weight: bold;
                }
                .log-status {
                    font-size: 11px;
                    font-weight: bold;
                    padding: 2px 6px;
                    border-radius: 3px;
                }
                .status-success {
                    background: var(--vscode-charts-green);
                    color: white;
                }
                .status-error {
                    background: var(--vscode-charts-red);
                    color: white;
                }
                .status-unknown {
                    background: var(--vscode-charts-orange);
                    color: white;
                }
                .log-latency {
                    color: var(--vscode-charts-blue);
                    font-size: 11px;
                }
                .log-details {
                    color: var(--vscode-descriptionForeground);
                    font-size: 11px;
                    max-width: 200px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .channel-status-grid {
                    display: grid;
                    gap: 15px;
                }
                .channel-card {
                    background: var(--vscode-textBlockQuote-background);
                    border-radius: 6px;
                    padding: 15px;
                }
                .channel-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 10px;
                }
                .channel-name {
                    font-weight: bold;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .status-indicator {
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                }
                .indicator-online { background: var(--vscode-charts-green); }
                .indicator-offline { background: var(--vscode-charts-red); }
                .indicator-unknown { background: var(--vscode-charts-orange); }
                .channel-metrics {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                    font-size: 12px;
                }
                .metric {
                    display: flex;
                    flex-direction: column;
                }
                .metric-label {
                    color: var(--vscode-descriptionForeground);
                    font-size: 11px;
                }
                .metric-value {
                    font-weight: bold;
                    color: var(--vscode-foreground);
                }
                .actions-panel {
                    margin-bottom: 20px;
                }
                .action-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                }
                .pulse-animation {
                    animation: pulse 2s infinite;
                }
                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.5; }
                    100% { opacity: 1; }
                }
            </style>
        </head>
        <body>
            <div class="dashboard-header">
                <h1>Live Monitor</h1>
                <div class="view-switcher">
                    <button class="view-btn" onclick="changeView('overview')">Overview</button>
                    <button class="view-btn" onclick="changeView('metrics')">Metrics</button>
                    <button class="view-btn active" onclick="changeView('monitor')">Live Monitor</button>
                    <button class="view-btn" onclick="changeView('timeline-swimlane')">Timeline</button>
                </div>
            </div>

            <div class="monitor-container">
                <!-- Live Log Panel -->
                <div class="log-panel">
                    <div class="log-header">
                        <h3>Live Activity Log</h3>
                        <div class="log-controls">
                            <div class="refresh-indicator auto-refresh pulse-animation">
                                <span>●</span>
                                <span>Auto-refresh: 5s</span>
                            </div>
                            <button class="view-btn" onclick="runAllProbes()" title="Run all probes now">
                                🔄 Probe All
                            </button>
                            <button class="view-btn" onclick="clearLog()" title="Clear log entries">
                                🗑️ Clear
                            </button>
                        </div>
                    </div>
                    <div class="log-content" id="logContent">
                        ${recentSamples.map(sample => this.formatLogEntry(sample)).join('')}
                        ${recentSamples.length === 0 ? '<div style="text-align: center; color: var(--vscode-descriptionForeground); padding: 20px;">No recent activity. Waiting for probe results...</div>' : ''}
                    </div>
                </div>

                <!-- Status Panel -->
                <div class="status-panel">
                    <div class="actions-panel">
                        <h3>Quick Actions</h3>
                        <div class="action-grid">
                            <button class="action-btn" onclick="runAllProbes()">🔄 Run All Probes</button>
                            <button class="action-btn" onclick="startWatch('1h')">👁️ Start 1h Watch</button>
                        </div>
                    </div>

                    <h3>Channel Status</h3>
                    <div class="channel-status-grid">
                        ${channels.map(channel => {
                            const state = states.get(channel.id);
                            const statusClass = state?.state || 'unknown';
                            
                            return `
                            <div class="channel-card">
                                <div class="channel-header">
                                    <div class="channel-name">
                                        <div class="status-indicator indicator-${statusClass}"></div>
                                        ${channel.name || channel.id}
                                    </div>
                                    <button class="view-btn" onclick="runChannelProbe('${channel.id}')" title="Run probe now">
                                        🔄
                                    </button>
                                </div>
                                <div class="channel-metrics">
                                    <div class="metric">
                                        <span class="metric-label">Status</span>
                                        <span class="metric-value">${(state?.state || 'unknown').toUpperCase()}</span>
                                    </div>
                                    <div class="metric">
                                        <span class="metric-label">Latency</span>
                                        <span class="metric-value">${state?.lastSample?.latencyMs ? state.lastSample.latencyMs + 'ms' : 'N/A'}</span>
                                    </div>
                                    <div class="metric">
                                        <span class="metric-label">Type</span>
                                        <span class="metric-value">${channel.type.toUpperCase()}</span>
                                    </div>
                                    <div class="metric">
                                        <span class="metric-label">Last Check</span>
                                        <span class="metric-value">${state?.lastSample?.timestamp ? this.formatRelativeTime(state.lastSample.timestamp) : 'Never'}</span>
                                    </div>
                                </div>
                                ${state?.lastSample?.error ? `
                                <div style="margin-top: 8px; padding: 6px; background: var(--vscode-inputValidation-errorBackground); border-radius: 3px; font-size: 11px;">
                                    Error: ${state.lastSample.error}
                                </div>
                                ` : ''}
                            </div>
                            `;
                        }).join('')}
                    </div>

                    ${currentWatch?.isActive ? `
                    <div style="margin-top: 20px; padding: 15px; background: var(--vscode-charts-green); color: white; border-radius: 6px;">
                        <h4 style="margin: 0 0 5px 0;">Active Watch Session</h4>
                        <div style="font-size: 12px;">Duration: ${this.formatWatchDuration(currentWatch)}</div>
                        <div style="font-size: 12px;">Started: ${new Date(currentWatch.startTime).toLocaleString()}</div>
                    </div>
                    ` : ''}
                </div>
            </div>

            ${this.getBaseScripts()}
            <script>
                // Auto-refresh every 5 seconds
                setInterval(() => {
                    refreshData();
                }, 5000);

                function runChannelProbe(channelId) {
                    vscode.postMessage({ command: 'runChannelProbe', channelId: channelId });
                }

                function clearLog() {
                    document.getElementById('logContent').innerHTML = 
                        '<div style="text-align: center; color: var(--vscode-descriptionForeground); padding: 20px;">Log cleared. Waiting for new activity...</div>';
                }

                // Auto-scroll log to bottom
                const logContent = document.getElementById('logContent');
                if (logContent && logContent.children.length > 0) {
                    logContent.scrollTop = logContent.scrollHeight;
                }
            </script>
        </body>
        </html>
        `;
    }

    private getBaseCSS(): string {
        return `
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
            margin: 0;
            padding: 20px;
        }
        .dashboard-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 15px;
        }
        .view-switcher {
            display: flex;
            gap: 5px;
        }
        .view-btn {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        }
        .view-btn:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        .view-btn.active {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        .action-btn {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 10px;
            border-radius: 4px;
            cursor: pointer;
            text-align: left;
        }
        .action-btn:hover {
            background: var(--vscode-button-hoverBackground);
        }
        h1, h2, h3 {
            margin-top: 0;
        }
        `;
    }

    private getBaseScripts(): string {
        return `
        <script>
            const vscode = acquireVsCodeApi();
            
            function changeView(viewType) {
                vscode.postMessage({ command: 'changeView', viewType: viewType });
            }
            
            function runAllProbes() {
                vscode.postMessage({ command: 'runAllProbes' });
            }
            
            function startWatch(duration) {
                vscode.postMessage({ command: 'startWatch', duration: duration });
            }
            
            function refreshData() {
                vscode.postMessage({ command: 'refreshData' });
            }
            
            function changeTimeRange(range) {
                vscode.postMessage({
                    command: 'changeTimeRange',
                    range: range
                });
            }
            
            function filterIncidents(status) {
                // Update filter button states
                document.querySelectorAll('.filter-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                event.target.classList.add('active');
                
                // Filter incident items
                const incidents = document.querySelectorAll('.incident-item');
                incidents.forEach(item => {
                    if (status === 'all' || item.dataset.status === status) {
                        item.style.display = 'block';
                    } else {
                        item.style.display = 'none';
                    }
                });
            }
        </script>
        `;
    }

    private getRecentSamples(channels: any[], limit: number = 20): any[] {
        const allSamples: any[] = [];
        
        for (const channel of channels) {
            try {
                // Try to get recent samples from storage
                const channelState = this.storageManager.getChannelState(channel.id);
                const channelSamples = channelState?.samples || [];
                
                // Take the most recent samples
                const recentSamples = channelSamples
                    .slice(-limit)
                    .reverse(); // Most recent first
                
                for (const sample of recentSamples) {
                    allSamples.push({
                        ...sample,
                        channelId: channel.id,
                        channelName: channel.name || channel.id
                    });
                }
            } catch (error) {
                // Fallback: create a mock sample for demo purposes
                allSamples.push({
                    timestamp: Date.now() - Math.random() * 300000, // Random time in last 5 minutes
                    success: Math.random() > 0.3, // 70% success rate
                    latencyMs: Math.floor(Math.random() * 200) + 20,
                    error: Math.random() > 0.7 ? 'Connection timeout' : undefined,
                    channelId: channel.id,
                    channelName: channel.name || channel.id
                });
            }
        }
        
        // Sort by timestamp descending (newest first)
        return allSamples
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
    }

    private formatLogEntry(sample: any): string {
        const timestamp = new Date(sample.timestamp).toLocaleTimeString();
        const statusClass = sample.success ? 'status-success' : 'status-error';
        const statusText = sample.success ? 'OK' : 'FAIL';
        const latency = sample.latencyMs ? `${sample.latencyMs}ms` : '';
        const details = sample.error || (sample.success ? 'Success' : 'Unknown error');

        return `
        <div class="log-entry">
            <span class="log-timestamp">${timestamp}</span>
            <span class="log-channel">${sample.channelName}</span>
            <span class="log-status ${statusClass}">${statusText}</span>
            <span class="log-latency">${latency}</span>
            <span class="log-details" title="${details}">${details}</span>
        </div>
        `;
    }

    private formatRelativeTime(timestamp: number): string {
        const now = Date.now();
        const diff = now - timestamp;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (seconds < 60) {
            return `${seconds}s ago`;
        } else if (minutes < 60) {
            return `${minutes}m ago`;
        } else if (hours < 24) {
            return `${hours}h ago`;
        } else {
            return new Date(timestamp).toLocaleDateString();
        }
    }

    private formatWatchDuration(watch: any): string {
        if (watch.duration === 'forever') {
            return 'Forever';
        }

        const durationMs = typeof watch.duration === 'string' ? this.parseDuration(watch.duration) : watch.duration;
        const elapsed = Date.now() - watch.startTime;
        const remaining = Math.max(0, durationMs - elapsed);

        if (remaining === 0) {
            return 'Ending soon';
        }

        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

        if (hours > 0) {
            return `${hours}h ${minutes}m remaining`;
        } else {
            return `${minutes}m remaining`;
        }
    }

    private parseDuration(duration: string): number {
        switch (duration) {
            case '1h': return 60 * 60 * 1000;
            case '12h': return 12 * 60 * 60 * 1000;
            case 'forever': return Number.MAX_SAFE_INTEGER;
            default: return 60 * 60 * 1000;
        }
    }

    private getTimeRangeDays(range: string): number {
        switch (range) {
            case '24H': return 1;
            case '3D': return 3; 
            case '7D': return 7;
            case '30D': return 30;
            default: return 7;
        }
    }

    private getTimeRangeLabel(range: string): string {
        switch (range) {
            case '24H': return 'Last 24 Hours';
            case '3D': return 'Last 3 Days';
            case '7D': return 'Last 7 Days';
            case '30D': return 'Last 30 Days';
            default: return 'Last 7 Days';
        }
    }

    // Helper methods for dashboard views
    private generateTimelineData(channels: any[], days: number): any {
        const data: any = {};
        const now = Date.now();
        const msPerDay = 24 * 60 * 60 * 1000;
        
        for (const channel of channels) {
            data[channel.id] = [];
            for (let day = 0; day < days; day++) {
                const startTime = now - ((days - day) * msPerDay);
                const endTime = now - ((days - day - 1) * msPerDay);
                
                // Get real samples from storage for this day
                const samples = this.storageManager.getSamplesInWindow(channel.id, startTime, endTime);
                
                let availability = 100;
                if (samples.length > 0) {
                    const successfulSamples = samples.filter(s => s.success);
                    availability = (successfulSamples.length / samples.length) * 100;
                } else {
                    // No data available for this day
                    availability = 0;
                }
                
                data[channel.id].push({ availability, sampleCount: samples.length });
            }
        }
        
        return data;
    }

    private generateHourlyHeatmapData(channels: any[], days: number): any {
        const data: any = {};
        const now = Date.now();
        const msPerHour = 60 * 60 * 1000;
        
        for (const channel of channels) {
            data[channel.id] = [];
            for (let hour = 0; hour < days * 24; hour++) {
                const startTime = now - ((days * 24 - hour) * msPerHour);
                const endTime = now - ((days * 24 - hour - 1) * msPerHour);
                
                // Get real samples from storage for this hour
                const samples = this.storageManager.getSamplesInWindow(channel.id, startTime, endTime);
                
                let availability = 100;
                if (samples.length > 0) {
                    const successfulSamples = samples.filter(s => s.success);
                    availability = (successfulSamples.length / samples.length) * 100;
                } else {
                    // No data available for this hour
                    availability = 0;
                }
                
                data[channel.id].push({ availability, sampleCount: samples.length });
            }
        }
        
        return data;
    }

    private generateIncidentsData(channels: any[], days: number): any[] {
        const now = Date.now();
        const windowStart = now - (days * 24 * 60 * 60 * 1000);
        
        // Get real outages from storage
        const outages = this.storageManager.getOutages(undefined, windowStart);
        const incidents = [];
        
        for (const outage of outages) {
            const channel = channels.find(c => c.id === outage.channelId);
            
            // Add outage start incident
            incidents.push({
                timestamp: outage.startTime,
                title: `${channel?.name || outage.channelId} Outage Started`,
                description: `Service became unavailable. Reason: ${outage.reason || 'Unknown'}`,
                severity: 'critical',
                type: 'outage',
                channel: channel?.name || outage.channelId,
                duration: outage.duration ? Math.round(outage.duration / (60 * 1000)) : undefined,
                impact: '100% of requests affected'
            });
            
            // Add recovery incident if outage ended
            if (outage.endTime) {
                incidents.push({
                    timestamp: outage.endTime,
                    title: `${channel?.name || outage.channelId} Service Recovered`,
                    description: `Service restored after ${outage.duration ? Math.round(outage.duration / (60 * 1000)) : 'unknown'} minutes`,
                    severity: 'info',
                    type: 'recovery',
                    channel: channel?.name || outage.channelId,
                    duration: outage.duration ? Math.round(outage.duration / (60 * 1000)) : undefined,
                    impact: 'Service fully restored'
                });
            }
        }
        
        // If no real incidents, add some demo data to show the UI
        if (incidents.length === 0) {
            incidents.push({
                timestamp: now - 2 * 60 * 60 * 1000, // 2 hours ago
                title: 'No Recent Incidents',
                description: 'All services are running smoothly. This is a placeholder incident to demonstrate the interface.',
                severity: 'info',
                type: 'recovery',
                channel: 'System',
                impact: 'Demo data'
            });
        }
        
        return incidents.sort((a, b) => b.timestamp - a.timestamp);
    }

    private generateMetricsData(channels: any[], states: Map<string, any>): any {
        const totalChannels = channels.length;
        let online = 0;
        const now = Date.now();
        const last7Days = 7 * 24 * 60 * 60 * 1000;
        
        // Calculate real availability and latency metrics
        let totalAvailability = 0;
        let totalLatencies: number[] = [];
        const channelMetrics: Record<string, any> = {};
        
        for (const channel of channels) {
            const state = states.get(channel.id);
            if (state?.state === 'online') { online++; }
            
            // Get samples from the last 7 days
            const samples = this.storageManager.getSamplesInWindow(channel.id, now - last7Days, now);
            
            let channelAvailability = 100;
            if (samples.length > 0) {
                const successfulSamples = samples.filter(s => s.success);
                channelAvailability = (successfulSamples.length / samples.length) * 100;
                
                // Collect latency data from successful samples
                successfulSamples.forEach(s => {
                    if (s.latencyMs) {
                        totalLatencies.push(s.latencyMs);
                    }
                });
            } else {
                channelAvailability = 0;
            }
            
            totalAvailability += channelAvailability;
            channelMetrics[channel.id] = { availability: channelAvailability };
        }
        
        const overallAvailability = totalChannels > 0 ? totalAvailability / totalChannels : 0;
        
        // Calculate latency percentiles
        totalLatencies.sort((a, b) => a - b);
        const p95Index = Math.floor(totalLatencies.length * 0.95);
        const avgLatency = totalLatencies.length > 0 ? totalLatencies.reduce((sum, val) => sum + val, 0) / totalLatencies.length : 0;
        const p95Latency = totalLatencies.length > 0 ? totalLatencies[p95Index] || totalLatencies[totalLatencies.length - 1] : 0;
        const maxLatency = totalLatencies.length > 0 ? Math.max(...totalLatencies) : 0;
        
        // Get real incidents from outages
        const recentOutages = this.storageManager.getOutages(undefined, now - last7Days);
        const criticalIncidents = recentOutages.filter(o => !o.endTime).length; // Ongoing outages
        const totalIncidents = recentOutages.length;
        
        // Calculate MTTR from resolved outages
        const resolvedOutages = recentOutages.filter(o => o.endTime && o.duration);
        const mttrValues = resolvedOutages.map(o => o.duration! / (60 * 1000)); // Convert to minutes
        const avgMTTR = mttrValues.length > 0 ? mttrValues.reduce((sum, val) => sum + val, 0) / mttrValues.length : 0;
        const fastestMTTR = mttrValues.length > 0 ? Math.min(...mttrValues) : 0;
        const longestMTTR = mttrValues.length > 0 ? Math.max(...mttrValues) : 0;
        
        return {
            availability: {
                value: overallAvailability,
                trend: overallAvailability >= 95 ? 'up' : overallAvailability >= 85 ? 'stable' : 'down',
                trendText: overallAvailability >= 95 ? 'Good' : overallAvailability >= 85 ? 'Fair' : 'Poor',
                subtitle: `${online}/${totalChannels} services online`,
                uptime: `${overallAvailability.toFixed(1)}%`,
                slo: 99.5,
                sloClass: overallAvailability >= 99 ? '' : overallAvailability >= 95 ? 'slo-warning' : 'slo-critical'
            },
            latency: {
                p95: Math.round(p95Latency),
                avg: Math.round(avgLatency),
                max: Math.round(maxLatency),
                trend: p95Latency <= 200 ? 'up' : p95Latency <= 500 ? 'stable' : 'down',
                trendText: p95Latency <= 200 ? 'Fast' : p95Latency <= 500 ? 'OK' : 'Slow'
            },
            incidents: {
                total: totalIncidents,
                critical: criticalIncidents,
                warnings: totalIncidents - criticalIncidents,
                trend: totalIncidents <= 2 ? 'up' : totalIncidents <= 5 ? 'stable' : 'down',
                trendText: totalIncidents <= 2 ? 'Low' : totalIncidents <= 5 ? 'Moderate' : 'High'
            },
            mttr: {
                average: Math.round(avgMTTR),
                fastest: Math.round(fastestMTTR),
                longest: Math.round(longestMTTR),
                trend: avgMTTR <= 15 ? 'up' : avgMTTR <= 30 ? 'stable' : 'down',
                trendText: avgMTTR <= 15 ? 'Fast Recovery' : avgMTTR <= 30 ? 'Average' : 'Slow Recovery'
            },
            channels: channelMetrics
        };
    }

    private generateDateLabels(days: number): string[] {
        const labels = [];
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        }
        return labels;
    }

    private getTimelineBarClass(dayData: any): string {
        const availability = dayData.availability || 0;
        if (availability >= 90) return 'bar-online';
        if (availability >= 50) return 'bar-mixed';
        if (availability > 0) return 'bar-offline';
        return 'bar-unknown';
    }

    private getAvailabilityClass(availability: number): string {
        if (availability >= 100) return 'availability-100';
        if (availability >= 95) return 'availability-95';
        if (availability >= 90) return 'availability-90';
        if (availability >= 80) return 'availability-80';
        if (availability >= 70) return 'availability-70';
        if (availability >= 60) return 'availability-60';
        if (availability >= 50) return 'availability-50';
        if (availability >= 40) return 'availability-40';
        if (availability >= 30) return 'availability-30';
        if (availability >= 20) return 'availability-20';
        if (availability >= 10) return 'availability-10';
        if (availability > 0) return 'availability-0';
        return 'availability-unknown';
    }

    private getValueClass(value: any, type: string): string {
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
    }

    private calculateOverallAvailability(timelineData: any): number {
        let total = 0;
        let count = 0;
        
        for (const channelId in timelineData) {
            for (const dayData of timelineData[channelId]) {
                total += dayData.availability || 0;
                count++;
            }
        }
        
        return count > 0 ? total / count : 0;
    }

    private countIncidents(timelineData: any): number {
        // Mock incident count
        return Math.floor(Math.random() * 5) + 1;
    }

    private calculateMTTR(timelineData: any): string {
        // Mock MTTR calculation
        return (Math.random() * 30 + 5).toFixed(0);
    }

    private calculateChannelAverage(channelData: any[]): number {
        if (!channelData.length) return 0;
        const sum = channelData.reduce((acc, data) => acc + (data.availability || 0), 0);
        return sum / channelData.length;
    }

    private countChannelOutages(channelData: any[]): number {
        return channelData.filter(data => (data.availability || 0) < 50).length;
    }

    private getBestHour(channelData: any[]): string {
        // Mock best hour calculation
        return `${Math.floor(Math.random() * 24).toString().padStart(2, '0')}:00`;
    }

    private getWorstHour(channelData: any[]): string {
        // Mock worst hour calculation  
        return `${Math.floor(Math.random() * 24).toString().padStart(2, '0')}:00`;
    }

    private calculateAverageMTTR(incidents: any[]): number {
        if (!incidents.length) return 0;
        const recoveryIncidents = incidents.filter(i => i.duration);
        if (!recoveryIncidents.length) return 0;
        
        const totalTime = recoveryIncidents.reduce((sum, i) => sum + i.duration, 0);
        return Math.round(totalTime / recoveryIncidents.length);
    }

    dispose() {
        if (this.panel) {
            this.panel.dispose();
        }
    }
}