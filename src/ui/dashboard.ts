import * as vscode from 'vscode';
import { ConfigManager } from '../config';
import { StorageManager } from '../storage';
import { Scheduler } from '../runner/scheduler';
import { 
    generateDashboardData as generateDashboardDataPure,
    generateTimelineData,
    generateHourlyHeatmapData,
    generateIncidentsData,
    generateMetricsData,
    getRecentSamples
} from './dashboardData';
import { 
    formatRelativeTime,
    calculateAverageLatency,
    generateQuickStats
} from './dashboardUtils';
import { generateOverviewDashboard, OverviewViewData } from './views/overviewView';
import { generateCompactMetricsView, MetricsViewData } from './views/metricsView';
import { 
    generateTimelineSwimlanesView, 
    generateTimelineHeatmapView, 
    generateTimelineIncidentsView,
    TimelineSwimlanesViewData,
    TimelineHeatmapViewData,
    TimelineIncidentsViewData
} from './views/timelineView';
import { generateLiveMonitorView, MonitorViewData } from './views/monitorView';
import { StatsCalculator } from '../stats';

/**
 * Dashboard state management interface for preserving user navigation state
 */
interface DashboardState {
    activeView: string;
    activeSubView?: string;
    selectedChannel?: string;
    timeRange?: string;
    liveMonitorEnabled: boolean;
    lastUpdate: number;
}

export class DashboardManager {
    private panel: vscode.WebviewPanel | undefined;
    private configManager = ConfigManager.getInstance();
    private storageManager = StorageManager.getInstance();
    private statsCalculator = new StatsCalculator();
    private refreshTimer: NodeJS.Timeout | undefined;
    private context: vscode.ExtensionContext | undefined;
    
    // State preservation for seamless UX
    private currentState: DashboardState = {
        activeView: 'overview',
        liveMonitorEnabled: true,
        lastUpdate: Date.now()
    };

    constructor(private scheduler: Scheduler) {}

    /**
     * Generate a nonce for CSP compliance
     */
    private generateNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    async openDashboard(context: vscode.ExtensionContext) {
        this.context = context; // Store context for URI generation
        
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
                    vscode.Uri.joinPath(context.extensionUri, 'resources'),
                    vscode.Uri.joinPath(context.extensionUri, 'dist')
                ]
            }
        );

        this.panel.webview.html = this.generateDashboardHTML();

        // Handle messages from webview
        this.panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'refreshData':
                    await this.updateDashboard({ preserveState: true });
                    break;
                case 'runAllProbes':
                    await this.scheduler.runAllChannelsNow();
                    await this.updateDashboard({ preserveState: true });
                    break;
                case 'runChannelProbe':
                    await this.scheduler.runChannelNow(message.channelId);
                    await this.updateDashboard({ preserveState: true });
                    break;
                case 'startWatch':
                    this.scheduler.emit('startWatch', { duration: message.duration });
                    break;
                case 'changeView':
                    this.currentState.activeView = message.viewType;
                    this.currentState.activeSubView = message.subViewType;
                    await this.updateDashboard({ preserveState: false });
                    break;
                case 'changeTimeRange':
                    this.currentState.timeRange = message.range;
                    await this.updateDashboard({ preserveState: true });
                    break;
                case 'filterIncidents':
                    await this.updateDashboard({ 
                        preserveState: true, 
                        additionalOptions: { filter: message.filter }
                    });
                    break;
                case 'toggleLiveMonitor':
                    this.currentState.liveMonitorEnabled = message.enabled;
                    if (message.enabled) {
                        this.startAutoRefresh();
                    } else {
                        this.stopAutoRefresh();
                    }
                    await this.updateDashboard({ preserveState: true });
                    break;
                case 'generateLiveReport':
                    // Handle live report generation requests
                    try {
                        const reportData = await this.generateLiveReportData(message.filter || {});
                        this.panel?.webview.postMessage({
                            command: 'liveReportGenerated',
                            data: reportData
                        });
                    } catch (error) {
                        console.error('Failed to generate live report:', error instanceof Error ? error.message : String(error));
                        this.panel?.webview.postMessage({
                            command: 'liveReportError',
                            error: (error as Error)?.message ?? String(error)
                        });
                    }
                    break;
                case 'exportLiveReport':
                    // Handle live report export requests
                    try {
                        const markdown = message.markdown;
                        const filename = `health-watch-report-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.md`;
                        const uri = await this.exportReportToFile(markdown, filename);
                        this.panel?.webview.postMessage({
                            command: 'reportExported',
                            uri: uri.toString()
                        });
                    } catch (error) {
                        console.error('Failed to export live report:', error instanceof Error ? error.message : String(error));
                        this.panel?.webview.postMessage({
                            command: 'exportError',
                            error: (error as Error)?.message ?? String(error)
                        });
                    }
                    break;
                case 'stateUpdate':
                    // Webview reports its current state for synchronization
                    this.currentState = { ...this.currentState, ...message.state };
                    break;
            }
        });

        // Clean up when panel is disposed
        this.panel.onDidDispose(() => {
            this.stopAutoRefresh();
            this.panel = undefined;
        });

        // Start intelligent auto-refresh
        this.startAutoRefresh();
    }

    /**
     * Intelligent dashboard update system that preserves user state
     */
    private async updateDashboard(options: { 
        preserveState: boolean; 
        additionalOptions?: any;
        forceRefresh?: boolean;
    }) {
        if (!this.panel) return;

        const updateOptions = {
            ...options.additionalOptions,
            state: this.currentState,
            preserveNavigation: options.preserveState
        };

        if (options.preserveState) {
            // Send incremental update via postMessage instead of full HTML replacement
            this.panel.webview.postMessage({
                command: 'updateContent',
                data: this.generateDashboardData(),
                options: updateOptions
            });
        } else {
            // Full refresh for view changes
            this.panel.webview.html = this.generateDashboardHTML(
                this.currentState.activeView, 
                updateOptions
            );
        }
    }

    /**
     * Adaptive auto-refresh that respects user preferences
     */
    private startAutoRefresh() {
        this.stopAutoRefresh(); // Ensure no duplicate timers
        
        if (!this.currentState.liveMonitorEnabled) return;

        this.refreshTimer = setInterval(async () => {
            if (this.panel && this.panel.visible && this.currentState.liveMonitorEnabled) {
                // Only update if sufficient time has passed to avoid overwhelming the UI
                const timeSinceLastUpdate = Date.now() - this.currentState.lastUpdate;
                if (timeSinceLastUpdate >= 5000) { // Minimum 5 second interval
                    this.currentState.lastUpdate = Date.now();
                    await this.updateDashboard({ preserveState: true });
                }
            }
        }, 10000); // Check every 10 seconds, but respect minimum update interval
    }

    private stopAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = undefined;
        }
    }

    /**
     * Generate data payload for incremental updates
     */
    private generateDashboardData(): any {
        const channels = this.configManager.getChannels();
        const states = this.scheduler.getChannelRunner().getChannelStates();
        const currentWatch = this.storageManager.getCurrentWatch();

        // Use the pure data generation function
        const dashboardData = generateDashboardDataPure(channels, states, currentWatch || undefined, this.storageManager);

        // Add UI-specific transformations for backward compatibility
        return {
            channels: channels.map(ch => ({
                id: ch.id,
                name: ch.name,
                state: states.get(ch.id)?.state || 'unknown',
                lastLatency: states.get(ch.id)?.lastSample?.latencyMs,
                lastProbe: states.get(ch.id)?.lastSample?.timestamp,
                isRunning: this.scheduler.getChannelRunner().isChannelRunning(ch.id)
            })),
            currentWatch,
            timestamp: Date.now(),
            stats: generateQuickStats(channels, states),
            // Add the new structured data (excluding duplicate channels)
            metrics: dashboardData.metrics,
            recentSamples: dashboardData.recentSamples,
            timelineData: dashboardData.timelineData,
            heatmapData: dashboardData.heatmapData,
            incidents: dashboardData.incidents
        };
    }

    /**
     * Generate lightweight stats for incremental updates - now delegated to pure functions
     */

    /**
     * Generate state-aware navigation that preserves user's current position
     */
    private generateNavigationHTML(currentView: string, currentSubView?: string): string {
        const isTimelineView = currentView.startsWith('timeline-');
        const mainView = isTimelineView ? 'timeline' : currentView;

        const primaryNavButtons = [
            { id: 'overview', label: 'Overview', active: mainView === 'overview' },
            { id: 'metrics', label: 'Metrics', active: mainView === 'metrics' },
            { id: 'monitor', label: 'Live Monitor', active: mainView === 'monitor' },
            { id: 'timeline', label: 'Timeline', active: mainView === 'timeline' },
            { id: 'reports', label: 'Reports', active: mainView === 'reports' }
        ];

        const primaryNav = primaryNavButtons.map(btn => 
            `<button class="nav-item ${btn.active ? 'active' : ''}" 
                     data-command="changeView" data-param="${btn.id}">${btn.label}</button>`
        ).join('');

        let subNav = '';
        if (mainView === 'timeline') {
            const subViewButtons = [
                { id: 'swimlane', label: 'Swimlanes', active: currentView === 'timeline-swimlane' || !currentSubView },
                { id: 'heatmap', label: 'Heatmap', active: currentView === 'timeline-heatmap' },
                { id: 'incidents', label: 'Incidents', active: currentView === 'timeline-incidents' }
            ];

            subNav = `
                <nav class="sub-navigation">
                    ${subViewButtons.map(btn => 
                        `<button class="sub-nav-item ${btn.active ? 'active' : ''}" 
                                 data-command="changeView" data-param="timeline-${btn.id}">${btn.label}</button>`
                    ).join('')}
                </nav>
            `;
        }

        return `
            <header class="dashboard-header">
                <div class="header-top">
                    <h1 class="dashboard-title">Health Watch Dashboard</h1>
                    <div class="dashboard-controls">
                        <label class="live-monitor-toggle">
                            <input type="checkbox" 
                                   ${this.currentState.liveMonitorEnabled ? 'checked' : ''} 
                                   data-live-toggle>
                            <span class="toggle-label">Live Updates</span>
                        </label>
                        <button class="refresh-btn" data-command="refreshData" title="Refresh Now">
                            <span class="icon">🔄</span>
                        </button>
                    </div>
                </div>
                <nav class="primary-navigation">
                    ${primaryNav}
                </nav>
                ${subNav}
            </header>
        `;
    }

    private generateDashboardHTML(viewType: string = 'overview', options: any = {}): string {
        const channels = this.configManager.getChannels();
        const states = this.scheduler.getChannelRunner().getChannelStates();
        const currentWatch = this.storageManager.getCurrentWatch();
        
        // Update current state
        this.currentState.activeView = viewType;
        this.currentState.lastUpdate = Date.now();

    // Generate nonce and URIs for React components
    const nonce = this.generateNonce();
    const cspSource = this.panel?.webview.cspSource || '';
        let reactBundleUri: string | undefined;
        let overviewBundleUri: string | undefined;
        let timelineBundleUri: string | undefined;
        let monitorBundleUri: string | undefined;
        
        const navigation = this.generateNavigationHTML(viewType);
        const baseCSS = this.getBaseCSS();
        const baseScripts = this.getBaseScripts(nonce);
        
        if (this.context && this.panel) {
            const metricsBundleUri = vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'metrics-view.js');
            reactBundleUri = this.panel.webview.asWebviewUri(metricsBundleUri).toString();
            
            const overviewBundleUriPath = vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'overview-view.js');
            overviewBundleUri = this.panel.webview.asWebviewUri(overviewBundleUriPath).toString();
            
            const timelineBundleUriPath = vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'timeline-view.js');
            timelineBundleUri = this.panel.webview.asWebviewUri(timelineBundleUriPath).toString();
            
            const monitorBundleUriPath = vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'monitor-view.js');
            monitorBundleUri = this.panel.webview.asWebviewUri(monitorBundleUriPath).toString();
        }

        switch (viewType) {
            case 'timeline':
            case 'timeline-swimlane':
                const timeRange = options.timeRange || this.currentState.timeRange || '7D';
                const days = this.getTimeRangeDays(timeRange);
                const timelineData = generateTimelineData(channels, days, this.storageManager);
                return generateTimelineSwimlanesView({
                    channels,
                    states,
                    timelineData,
                    timeRange,
                    navigation,
                    baseCSS,
                    baseScripts,
                    nonce,
                    cspSource,
                    timelineBundleUri
                });
                
            case 'timeline-heatmap':
                const heatmapData = generateHourlyHeatmapData(channels, 7, this.storageManager);
                return generateTimelineHeatmapView({
                    channels,
                    states,
                    heatmapData,
                    navigation,
                    baseCSS,
                    baseScripts,
                    nonce,
                    cspSource,
                    timelineBundleUri
                });
                
            case 'timeline-incidents':
                const incidents = generateIncidentsData(channels, 7, this.storageManager);
                return generateTimelineIncidentsView({
                    channels,
                    states,
                    incidents,
                    navigation,
                    baseCSS,
                    baseScripts,
                    nonce,
                    cspSource,
                    timelineBundleUri
                });
                
            case 'metrics':
                const metricsData = generateMetricsData(channels, states, this.storageManager);
                return generateCompactMetricsView({
                    channels,
                    states,
                    currentWatch: currentWatch || undefined,
                    metricsData,
                    navigation,
                    baseCSS,
                    baseScripts,
                    reactBundleUri,
                    nonce,
                    cspSource
                });
                
            case 'monitor':
                const recentSamples = getRecentSamples(channels, 50, this.storageManager);
                return generateLiveMonitorView({
                    channels,
                    states,
                    currentWatch: currentWatch || undefined,
                    recentSamples,
                    navigation,
                    baseCSS,
                    baseScripts,
                    nonce,
                    cspSource
                });

            case 'reports':
                const reportsBundleUri = this.panel!.webview.asWebviewUri(this.getReportsBundleUri());
                return this.generateLiveReportsView({
                    channels,
                    states,
                    currentWatch: currentWatch || undefined,
                    navigation,
                    baseCSS,
                    baseScripts,
                    reactBundleUri: reportsBundleUri.toString(),
                    nonce,
                    cspSource
                });
                
            case 'overview':
            default:
                return generateOverviewDashboard({
                    channels,
                    states,
                    currentWatch: currentWatch || undefined,
                    navigation,
                    baseCSS,
                    baseScripts,
                    reactBundleUri: overviewBundleUri,
                    nonce,
                    cspSource
                });
        }
    }







    private getBaseCSS(): string {
        return `
        <style>
        /* Base Styling */
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
            margin: 0;
            padding: 20px;
            line-height: 1.4;
        }

        /* Dashboard Header & Navigation */
        .dashboard-header {
            margin-bottom: 30px;
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 15px;
        }
        .header-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }
        .dashboard-title {
            font-size: 24px;
            font-weight: bold;
            margin: 0;
            color: var(--vscode-foreground);
        }
        .dashboard-controls {
            display: flex;
            align-items: center;
            gap: 15px;
        }
        .live-monitor-toggle {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
        }
        .live-monitor-toggle input[type="checkbox"] {
            margin: 0;
        }
        .refresh-btn {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            padding: 8px;
            border-radius: 4px;
            cursor: pointer;
            display: flex;
            align-items: center;
        }
        .refresh-btn:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        
        .primary-navigation {
            display: flex;
            gap: 8px;
            margin-bottom: 10px;
        }
        .nav-item {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            text-decoration: none;
        }
        .nav-item:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        .nav-item.active {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }

        .sub-navigation {
            display: flex;
            gap: 4px;
            margin-top: 8px;
        }
        .sub-nav-item {
            background: transparent;
            color: var(--vscode-descriptionForeground);
            border: 1px solid var(--vscode-panel-border);
            padding: 6px 12px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 11px;
            text-decoration: none;
        }
        .sub-nav-item:hover {
            background: var(--vscode-list-hoverBackground);
        }
        .sub-nav-item.active {
            background: var(--vscode-list-activeSelectionBackground);
            color: var(--vscode-list-activeSelectionForeground);
        }

        /* Overview Dashboard Styles */
        .dashboard-content {
            max-width: 1200px;
            margin: 0 auto;
        }
        .metrics-summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .metric-card {
            background: var(--vscode-textBlockQuote-background);
            border-radius: 8px;
            padding: 20px;
            border: 1px solid var(--vscode-panel-border);
            text-align: center;
        }
        .metric-card.metric-good {
            border-color: var(--vscode-charts-green);
        }
        .metric-card.metric-warning {
            border-color: var(--vscode-charts-orange);
        }
        .metric-card.metric-critical {
            border-color: var(--vscode-charts-red);
        }
        .metric-label {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 8px;
            text-transform: uppercase;
            font-weight: bold;
        }
        .metric-value {
            font-size: 28px;
            font-weight: bold;
            margin: 8px 0;
        }
        .metric-detail {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
        }
        .metric-online { color: var(--vscode-charts-green); }
        .metric-offline { color: var(--vscode-charts-red); }
        .metric-unknown { color: var(--vscode-charts-orange); }

        /* Channel Cards */
        .channels-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .channel-card {
            background: var(--vscode-textBlockQuote-background);
            border-radius: 8px;
            padding: 20px;
            border: 1px solid var(--vscode-panel-border);
        }
        .channel-card.channel-online {
            border-left: 4px solid var(--vscode-charts-green);
        }
        .channel-card.channel-offline {
            border-left: 4px solid var(--vscode-charts-red);
        }
        .channel-card.channel-unknown {
            border-left: 4px solid var(--vscode-charts-orange);
        }
        .channel-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }
        .channel-name {
            font-weight: bold;
            font-size: 14px;
        }
        .channel-status {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 11px;
            font-weight: bold;
        }
        .status-indicator {
            width: 8px;
            height: 8px;
            border-radius: 50%;
        }
        .status-online .status-indicator { background: var(--vscode-charts-green); }
        .status-offline .status-indicator { background: var(--vscode-charts-red); }
        .status-unknown .status-indicator { background: var(--vscode-charts-orange); }
        .channel-details {
            margin: 15px 0;
        }
        .detail-row {
            display: flex;
            justify-content: space-between;
            margin: 8px 0;
            font-size: 12px;
        }
        .detail-label {
            color: var(--vscode-descriptionForeground);
            font-weight: 500;
        }
        .detail-value {
            color: var(--vscode-foreground);
        }
        .channel-url {
            font-family: var(--vscode-editor-font-family);
            font-size: 11px;
            max-width: 200px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .latency-good { color: var(--vscode-charts-green); }
        .latency-warning { color: var(--vscode-charts-orange); }
        .latency-poor { color: var(--vscode-charts-red); }

        .channel-error {
            background: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            border-radius: 4px;
            padding: 10px;
            margin: 10px 0;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .error-message {
            font-size: 11px;
            color: var(--vscode-inputValidation-errorForeground);
        }

        .channel-actions {
            display: flex;
            gap: 8px;
            margin-top: 15px;
        }
        .action-btn {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
            display: flex;
            align-items: center;
            gap: 4px;
            text-decoration: none;
        }
        .action-btn:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .action-btn.primary {
            background: var(--vscode-button-background);
        }
        .btn-icon {
            font-size: 10px;
        }

        /* Watch Status Banner */
        .watch-status-banner {
            background: var(--vscode-notifications-background);
            border: 1px solid var(--vscode-notifications-border);
            border-radius: 8px;
            padding: 15px 20px;
            margin-bottom: 25px;
            display: flex;
            align-items: center;
            gap: 15px;
        }
        .watch-icon {
            font-size: 20px;
        }
        .watch-info {
            flex: 1;
        }
        .watch-title {
            font-weight: bold;
            margin-bottom: 4px;
        }
        .watch-details {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
        }
        .watch-stop-btn {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        }
        .watch-stop-btn:hover {
            background: var(--vscode-button-hoverBackground);
        }

        /* Empty States */
        .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: var(--vscode-descriptionForeground);
        }
        .empty-icon {
            font-size: 48px;
            margin-bottom: 15px;
        }
        .empty-title {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 10px;
            color: var(--vscode-foreground);
        }
        .empty-description {
            font-size: 14px;
            margin-bottom: 20px;
            max-width: 400px;
            margin-left: auto;
            margin-right: auto;
        }

        /* Timeline Styles */
        .timeline-container {
            margin-top: 20px;
        }
        .timeline-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }
        .timeline-controls select {
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            padding: 6px 10px;
            font-size: 12px;
        }
        .timeline-legend {
            display: flex;
            gap: 20px;
            margin-bottom: 20px;
            flex-wrap: wrap;
        }
        .legend-item {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
        }
        .legend-color {
            width: 16px;
            height: 16px;
            border-radius: 3px;
        }
        .bar-online { background: var(--vscode-charts-green); }
        .bar-degraded { background: var(--vscode-charts-orange); }
        .bar-offline { background: var(--vscode-charts-red); }
        .bar-no-data { background: var(--vscode-descriptionForeground); opacity: 0.3; }

        .timeline-grid {
            display: grid;
            gap: 2px;
            font-size: 11px;
        }
        .timeline-labels {
            display: grid;
            grid-template-columns: 150px repeat(auto-fit, minmax(60px, 1fr));
            gap: 2px;
            margin-bottom: 5px;
        }
        .channel-label-header {
            font-weight: bold;
            padding: 8px;
            background: var(--vscode-textBlockQuote-background);
        }
        .date-label {
            text-align: center;
            padding: 8px 4px;
            background: var(--vscode-textBlockQuote-background);
            font-weight: bold;
        }
        .timeline-row {
            display: grid;
            grid-template-columns: 150px repeat(auto-fit, minmax(60px, 1fr));
            gap: 2px;
            margin-bottom: 2px;
        }
        .channel-label {
            padding: 8px;
            background: var(--vscode-textBlockQuote-background);
            display: flex;
            flex-direction: column;
            justify-content: center;
        }
        .channel-name {
            font-weight: bold;
            font-size: 11px;
        }
        .channel-type {
            font-size: 9px;
            color: var(--vscode-descriptionForeground);
            margin-top: 2px;
        }
        .timeline-bar {
            position: relative;
            padding: 8px 4px;
            text-align: center;
            min-height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .bar-fill {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            background: inherit;
            opacity: 0.3;
        }
        .sample-count {
            position: relative;
            font-size: 9px;
            color: var(--vscode-foreground);
            font-weight: bold;
        }

        /* Monitor View Styles */
        .monitor-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
        }
        .monitor-title {
            display: flex;
            align-items: center;
            gap: 15px;
        }
        .live-indicator {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            color: var(--vscode-charts-green);
            font-weight: bold;
        }
        .pulse-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--vscode-charts-green);
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.3; }
            100% { opacity: 1; }
        }
        .watch-indicator {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            color: var(--vscode-charts-blue);
        }

        .live-channels h3 {
            margin-bottom: 15px;
            color: var(--vscode-foreground);
        }
        .live-channels-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 30px;
        }
        .live-channel-card {
            background: var(--vscode-textBlockQuote-background);
            border-radius: 6px;
            padding: 15px;
            border: 1px solid var(--vscode-panel-border);
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .channel-status-indicator {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            flex-shrink: 0;
        }
        .channel-status-indicator.online { background: var(--vscode-charts-green); }
        .channel-status-indicator.offline { background: var(--vscode-charts-red); }
        .channel-status-indicator.unknown { background: var(--vscode-charts-orange); }
        .channel-info {
            flex: 1;
        }
        .channel-name {
            font-weight: bold;
            font-size: 12px;
            margin-bottom: 4px;
        }
        .channel-latency {
            font-size: 10px;
            color: var(--vscode-descriptionForeground);
        }

        .activity-feed h3 {
            margin-bottom: 15px;
            color: var(--vscode-foreground);
        }
        .activity-list {
            max-height: 400px;
            overflow-y: auto;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            background: var(--vscode-textBlockQuote-background);
        }
        .activity-item {
            display: grid;
            grid-template-columns: 80px auto 1fr;
            gap: 12px;
            padding: 10px 15px;
            border-bottom: 1px solid var(--vscode-panel-border);
            align-items: center;
        }
        .activity-item:last-child {
            border-bottom: none;
        }
        .activity-time {
            font-size: 10px;
            color: var(--vscode-descriptionForeground);
        }
        .status-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
        }
        .status-dot.success { background: var(--vscode-charts-green); }
        .status-dot.failure { background: var(--vscode-charts-red); }
        .activity-details {
            font-size: 11px;
        }
        .activity-channel {
            font-weight: bold;
            margin-bottom: 2px;
        }
        .activity-info {
            color: var(--vscode-descriptionForeground);
        }

        .no-activity {
            text-align: center;
            padding: 40px;
            color: var(--vscode-descriptionForeground);
        }
        .no-activity-icon {
            font-size: 24px;
            margin-bottom: 10px;
        }

        /* General Utility Classes */
        h1, h2, h3 {
            margin-top: 0;
            color: var(--vscode-foreground);
        }
        .value-good { color: var(--vscode-charts-green); }
        .value-warning { color: var(--vscode-charts-orange); }
        .value-bad { color: var(--vscode-charts-red); }
        
        /* Timeline Swimlanes View Styles */
        .timeline-container {
            background: var(--vscode-textBlockQuote-background);
            border-radius: 8px;
            padding: 20px;
            border: 1px solid var(--vscode-panel-border);
        }
        .timeline-header {
            margin-bottom: 20px;
        }
        .timeline-header h2 {
            margin: 0 0 8px 0;
            font-size: 20px;
            color: var(--vscode-foreground);
        }
        .timeline-subtitle {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        .timeline-swimlanes {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }
        .timeline-lane {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 15px;
        }
        .lane-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        }
        .lane-title {
            font-weight: bold;
            font-size: 14px;
        }
        .lane-status {
            font-size: 11px;
            padding: 4px 8px;
            border-radius: 4px;
            background: var(--vscode-button-secondaryBackground);
        }
        .timeline-bars {
            display: flex;
            gap: 2px;
            height: 20px;
            margin-bottom: 8px;
        }
        .timeline-bar {
            flex: 1;
            border-radius: 2px;
            cursor: pointer;
        }
        .bar-online { background: var(--vscode-charts-green); }
        .bar-offline { background: var(--vscode-charts-red); }
        .bar-mixed { background: var(--vscode-charts-orange); }
        .bar-unknown { background: var(--vscode-descriptionForeground); }
        .bar-no-data { background: var(--vscode-panel-border); }
        .timeline-labels {
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            color: var(--vscode-descriptionForeground);
        }
        
        /* Heatmap View Styles */
        .heatmap-container {
            background: var(--vscode-textBlockQuote-background);
            border-radius: 8px;
            padding: 20px;
            border: 1px solid var(--vscode-panel-border);
        }
        .heatmap-header {
            margin-bottom: 20px;
        }
        .heatmap-header h2 {
            margin: 0 0 8px 0;
            font-size: 20px;
            color: var(--vscode-foreground);
        }
        .heatmap-subtitle {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        .heatmap-legend {
            display: flex;
            align-items: center;
            gap: 15px;
            margin-bottom: 20px;
        }
        .legend-label {
            font-size: 12px;
            color: var(--vscode-foreground);
        }
        .legend-gradient {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        .gradient-bar {
            width: 200px;
            height: 12px;
            background: linear-gradient(to right, #ff0000, #ffff00, #00ff00);
            border-radius: 6px;
        }
        .gradient-labels {
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            color: var(--vscode-descriptionForeground);
        }
        .heatmap-grid {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .heatmap-channel {
            display: flex;
            align-items: center;
            gap: 15px;
        }
        .heatmap-channel-label {
            min-width: 150px;
            text-align: right;
        }
        .channel-name {
            font-weight: bold;
            font-size: 12px;
        }
        .channel-type {
            font-size: 10px;
            color: var(--vscode-descriptionForeground);
        }
        .heatmap-cells {
            display: flex;
            gap: 2px;
        }
        .heatmap-cell {
            width: 16px;
            height: 16px;
            border-radius: 2px;
            cursor: pointer;
        }
        .heatmap-time-labels {
            display: flex;
            gap: 2px;
            margin-top: 15px;
            margin-left: 165px;
        }
        .time-label {
            width: 16px;
            font-size: 9px;
            color: var(--vscode-descriptionForeground);
            text-align: center;
        }
        
        /* Incidents View Styles */
        .incidents-container {
            background: var(--vscode-textBlockQuote-background);
            border-radius: 8px;
            padding: 20px;
            border: 1px solid var(--vscode-panel-border);
        }
        .incidents-header {
            margin-bottom: 20px;
        }
        .incidents-header h2 {
            margin: 0 0 8px 0;
            font-size: 20px;
            color: var(--vscode-foreground);
        }
        .incidents-subtitle {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        .incidents-list {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }
        .incident-item {
            display: flex;
            align-items: center;
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 15px;
            gap: 15px;
        }
        .incident-item.severity-high {
            border-left: 4px solid var(--vscode-charts-red);
        }
        .incident-item.severity-medium {
            border-left: 4px solid var(--vscode-charts-orange);
        }
        .incident-item.severity-low {
            border-left: 4px solid var(--vscode-charts-yellow);
        }
        .incident-timeline-marker {
            display: flex;
            flex-direction: column;
            align-items: center;
            min-width: 120px;
        }
        .incident-time {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 6px;
        }
        .incident-marker {
            width: 12px;
            height: 12px;
            border-radius: 50%;
        }
        .incident-marker.outage {
            background: var(--vscode-charts-red);
        }
        .incident-marker.recovery {
            background: var(--vscode-charts-green);
        }
        .incident-marker.maintenance {
            background: var(--vscode-charts-blue);
        }
        .incident-details {
            flex: 1;
        }
        .incident-title {
            font-weight: bold;
            font-size: 14px;
            margin-bottom: 6px;
        }
        .incident-description {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 8px;
        }
        .incident-meta {
            display: flex;
            gap: 15px;
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
        }
        .incident-channel {
            font-weight: bold;
        }
        .incident-duration {
            color: var(--vscode-charts-orange);
        }
        .incident-impact {
            color: var(--vscode-charts-red);
        }
        .incident-severity {
            min-width: 80px;
            display: flex;
            align-items: center;
        }
        .severity-badge {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: bold;
            text-transform: uppercase;
        }
        .severity-badge.high {
            background: var(--vscode-charts-red);
            color: white;
        }
        .severity-badge.medium {
            background: var(--vscode-charts-orange);
            color: white;
        }
        .severity-badge.low {
            background: var(--vscode-charts-yellow);
            color: black;
        }
        .empty-incidents {
            text-align: center;
            padding: 40px;
            color: var(--vscode-descriptionForeground);
        }
        .empty-icon {
            font-size: 48px;
            margin-bottom: 15px;
        }
        .empty-title {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 8px;
            color: var(--vscode-foreground);
        }
        .empty-description {
            font-size: 12px;
        }
        
        /* Loading Spinner */
        .loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 60px 20px;
            color: var(--vscode-descriptionForeground);
        }
        .loading-spinner {
            width: 40px;
            height: 40px;
            border: 4px solid var(--vscode-panel-border);
            border-top: 4px solid var(--vscode-charts-blue);
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-bottom: 15px;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        /* React Overview Component Fallback Styles */
        .overview-root {
            max-width: 1200px;
            margin: 0 auto;
        }
        .overview-loading {
            text-align: center;
            padding: 40px;
            color: var(--vscode-descriptionForeground);
        }
        
        /* Enhanced Tremor Integration Styles */
        .tremor-base {
            font-family: var(--vscode-font-family) !important;
            color: var(--vscode-foreground) !important;
        }
        .tremor-Card-root {
            background: var(--vscode-textBlockQuote-background) !important;
            border: 1px solid var(--vscode-panel-border) !important;
            color: var(--vscode-foreground) !important;
        }
        .tremor-Title-root {
            color: var(--vscode-foreground) !important;
        }
        .tremor-Text-root {
            color: var(--vscode-descriptionForeground) !important;
        }
        .tremor-Metric-root {
            color: var(--vscode-foreground) !important;
        }
        .tremor-Badge-root {
            background: var(--vscode-button-background) !important;
            color: var(--vscode-button-foreground) !important;
        }
        .tremor-Button-root {
            background: var(--vscode-button-background) !important;
            color: var(--vscode-button-foreground) !important;
            border: 1px solid var(--vscode-button-background) !important;
        }
        .tremor-Button-root:hover {
            background: var(--vscode-button-hoverBackground) !important;
        }
        
        /* Timeline React Bundle Fallback */
        #timeline-swimlanes-root .loading {
            min-height: 300px;
        }
        
        /* Overview View Styles (No Tremor) */
        .overview-container {
            padding: 20px;
            max-width: 1200px;
            margin: 0 auto;
        }
        
        /* Stats Grid */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
        }
        
        .metric-card {
            background: var(--vscode-textBlockQuote-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 16px;
            text-align: center;
        }
        
        .metric-label {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 8px;
        }
        
        .metric-value {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 4px;
        }
        
        .metric-emerald { color: var(--vscode-charts-green); }
        .metric-red { color: var(--vscode-charts-red); }
        .metric-yellow { color: var(--vscode-charts-yellow); }
        .metric-gray { color: var(--vscode-descriptionForeground); }
        
        .metric-detail {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
        }
        
        /* Watch Banner */
        .watch-banner {
            background: var(--vscode-textBlockQuote-background);
            border: 1px solid var(--vscode-charts-blue);
            border-radius: 6px;
            padding: 16px;
            margin-bottom: 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .watch-info {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        
        .watch-icon {
            font-size: 20px;
        }
        
        .watch-title {
            margin: 0 0 4px 0;
            font-size: 16px;
            color: var(--vscode-charts-blue);
        }
        
        .watch-details {
            margin: 0;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        
        /* Channels Grid */
        .channels-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 16px;
        }
        
        /* Channel Card */
        .channel-card {
            background: var(--vscode-textBlockQuote-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 16px;
        }
        
        .channel-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        }
        
        .channel-title {
            margin: 0;
            font-size: 16px;
            color: var(--vscode-foreground);
        }
        
        .status-badge {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: bold;
        }
        
        .status-online {
            background: var(--vscode-charts-green);
            color: white;
        }
        
        .status-offline {
            background: var(--vscode-charts-red);
            color: white;
        }
        
        .status-unknown {
            background: var(--vscode-charts-yellow);
            color: black;
        }
        
        /* Channel Details */
        .channel-details {
            margin-bottom: 12px;
        }
        
        .detail-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 4px 0;
            font-size: 12px;
        }
        
        .detail-value {
            font-weight: 500;
            color: var(--vscode-foreground);
        }
        
        .detail-value-small {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
        }
        
        .truncate {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            max-width: 150px;
        }
        
        /* Latency Badge */
        .latency-badge {
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 10px;
            font-weight: bold;
        }
        
        .latency-emerald {
            background: var(--vscode-charts-green);
            color: white;
        }
        
        .latency-yellow {
            background: var(--vscode-charts-yellow);
            color: black;
        }
        
        .latency-red {
            background: var(--vscode-charts-red);
            color: white;
        }
        
        .latency-gray {
            background: var(--vscode-descriptionForeground);
            color: white;
        }
        
        /* Error Section */
        .error-section {
            margin: 12px 0;
            padding: 8px;
            background: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            border-radius: 4px;
        }
        
        .error-header {
            font-size: 12px;
            font-weight: bold;
            color: var(--vscode-inputValidation-errorForeground);
            margin-bottom: 4px;
        }
        
        .error-message {
            font-size: 11px;
            color: var(--vscode-inputValidation-errorForeground);
        }
        
        /* Action Buttons */
        .channel-actions {
            display: flex;
            gap: 8px;
            justify-content: center;
            margin-top: 12px;
            border-top: 1px solid var(--vscode-panel-border);
            padding-top: 12px;
        }
        
        .action-btn {
            padding: 6px 12px;
            border-radius: 4px;
            border: none;
            font-size: 11px;
            cursor: pointer;
            font-family: var(--vscode-font-family);
        }
        
        .action-btn.primary {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        
        .action-btn.primary:hover {
            background: var(--vscode-button-hoverBackground);
        }
        
        .action-btn.secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        
        .action-btn.secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        
        .action-btn.danger {
            background: var(--vscode-charts-red);
            color: white;
        }
        
        .action-btn.danger:hover {
            background: var(--vscode-errorForeground);
        }
        
        /* Empty State */
        .empty-state {
            text-align: center;
            padding: 40px;
            background: var(--vscode-textBlockQuote-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
        }
        
        .empty-icon {
            font-size: 48px;
            margin-bottom: 16px;
        }
        
        .empty-title {
            margin: 0 0 12px 0;
            font-size: 18px;
            color: var(--vscode-foreground);
        }
        
        .empty-description {
            margin: 0 0 20px 0;
            color: var(--vscode-descriptionForeground);
            max-width: 400px;
            margin-left: auto;
            margin-right: auto;
        }
        </style>
        `;
    }

    private getBaseScripts(nonce: string): string {
        return `
        <script nonce="${nonce}">
            const vscode = acquireVsCodeApi();
            
            // Dashboard state management
            let dashboardState = {
                activeView: '${this.currentState.activeView}',
                liveMonitorEnabled: ${this.currentState.liveMonitorEnabled}
            };
            
            // Enhanced view change with state preservation
            function changeView(viewType, subViewType = null) {
                dashboardState.activeView = viewType;
                dashboardState.activeSubView = subViewType;
                
                // Report state change to backend
                vscode.postMessage({ 
                    command: 'stateUpdate', 
                    state: dashboardState 
                });
                
                vscode.postMessage({ 
                    command: 'changeView', 
                    viewType: viewType, 
                    subViewType: subViewType 
                });
            }
            
            // Live monitoring toggle
            function toggleLiveMonitor(enabled) {
                dashboardState.liveMonitorEnabled = enabled;
                vscode.postMessage({ 
                    command: 'toggleLiveMonitor', 
                    enabled: enabled 
                });
                
                // Update UI feedback
                const toggle = document.querySelector('.live-monitor-toggle input');
                if (toggle) toggle.checked = enabled;
                
                // Visual feedback
                showToast(enabled ? 'Live updates enabled' : 'Live updates disabled');
            }
            
            // Enhanced refresh that doesn't lose focus
            function refreshData() {
                vscode.postMessage({ command: 'refreshData' });
            }
            
            function runAllProbes() {
                vscode.postMessage({ command: 'runAllProbes' });
                showToast('Running all probes...');
            }
            
            function startWatch(duration) {
                vscode.postMessage({ command: 'startWatch', duration: duration });
                showToast(\`Starting \${duration} watch...\`);
            }
            
            // Handle incremental updates from backend
            window.addEventListener('message', event => {
                const message = event.data;
                if (message.command === 'updateContent') {
                    updateDashboardContent(message.data, message.options);
                }
            });
            
            // Replace inline event handlers with proper event listeners
            document.addEventListener('DOMContentLoaded', () => {
                // Attach event listeners to replace onclick handlers
                document.querySelectorAll('[data-command]').forEach(element => {
                    const command = element.getAttribute('data-command');
                    const param = element.getAttribute('data-param');
                    element.addEventListener('click', (e) => {
                        e.preventDefault();
                        switch(command) {
                            case 'changeView':
                                changeView(param);
                                break;
                            case 'refreshData':
                                refreshData();
                                break;
                            case 'runAllProbes':
                                runAllProbes();
                                break;
                            case 'startWatch':
                                startWatch(param);
                                break;
                            case 'stopWatch':
                                stopWatch();
                                break;
                            case 'runChannelNow':
                                runChannelNow(param);
                                break;
                            case 'viewChannelDetails':
                                viewChannelDetails(param);
                                break;
                            case 'openConfig':
                                openConfig();
                                break;
                            case 'changeTimeRange':
                                changeTimeRange(element.value);
                                break;
                        }
                    });
                });
                
                // Handle live monitor toggle
                const liveToggle = document.querySelector('[data-live-toggle]');
                if (liveToggle) {
                    liveToggle.addEventListener('change', (e) => {
                        toggleLiveMonitor(e.target.checked);
                    });
                }
                
                // Handle time range selector
                const timeSelector = document.querySelector('[data-time-range]');
                if (timeSelector) {
                    timeSelector.addEventListener('change', (e) => {
                        changeTimeRange(e.target.value);
                    });
                }
            });
            
            // Incremental content update without losing navigation state
            function updateDashboardContent(data, options) {
                if (options.preserveNavigation) {
                    // Update only data elements, preserve navigation
                    updateChannelStatus(data.channels);
                    updateStats(data.stats);
                    updateTimestamp(data.timestamp);
                } else {
                    // This shouldn't happen with the new system, but fallback
                    location.reload();
                }
            }
            
            // Update individual UI components
            function updateChannelStatus(channels) {
                channels.forEach(channel => {
                    const elements = document.querySelectorAll(\`[data-channel-id="\${channel.id}"]\`);
                    elements.forEach(element => {
                        // Update status indicators
                        const statusDot = element.querySelector('.status-dot');
                        if (statusDot) {
                            statusDot.className = \`status-dot \${channel.state}\`;
                        }
                        
                        // Update latency displays
                        const latencyElement = element.querySelector('.latency');
                        if (latencyElement && channel.lastLatency) {
                            latencyElement.textContent = \`\${channel.lastLatency}ms\`;
                        }
                        
                        // Update running indicators
                        const runningIndicator = element.querySelector('.running-indicator');
                        if (runningIndicator) {
                            runningIndicator.style.display = channel.isRunning ? 'inline' : 'none';
                        }
                    });
                });
            }
            
            function updateStats(stats) {
                // Update overall health percentage
                const healthIndicators = document.querySelectorAll('.health-indicator');
                healthIndicators.forEach(indicator => {
                    indicator.textContent = \`\${stats.availability}%\`;
                });
                
                // Update service counts
                const serviceCounts = document.querySelectorAll('.service-count');
                serviceCounts.forEach(count => {
                    count.textContent = \`\${stats.onlineCount}/\${stats.totalCount} services online\`;
                });
                
                // Update status classes for color coding
                const statusElements = document.querySelectorAll('[data-status]');
                statusElements.forEach(element => {
                    element.setAttribute('data-status', stats.status);
                    element.className = element.className.replace(/status-(healthy|degraded|critical)/, \`status-\${stats.status}\`);
                });
            }
            
            function updateTimestamp(timestamp) {
                const timestampElements = document.querySelectorAll('.last-updated');
                const timeStr = new Date(timestamp).toLocaleTimeString();
                timestampElements.forEach(element => {
                    element.textContent = \`Updated: \${timeStr}\`;
                });
            }
            
            // User feedback system
            function showToast(message, duration = 3000) {
                const toast = document.createElement('div');
                toast.className = 'toast-notification';
                toast.textContent = message;
                toast.style.cssText = \`
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: var(--vscode-notifications-background);
                    color: var(--vscode-notifications-foreground);
                    padding: 12px 16px;
                    border-radius: 4px;
                    border: 1px solid var(--vscode-notifications-border);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    z-index: 1000;
                    animation: slideIn 0.3s ease-out;
                \`;
                
                document.body.appendChild(toast);
                
                setTimeout(() => {
                    toast.style.animation = 'slideOut 0.3s ease-in forwards';
                    setTimeout(() => toast.remove(), 300);
                }, duration);
            }
            
            // Add animations
            const style = document.createElement('style');
            style.textContent = \`
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
                .status-healthy { color: var(--vscode-charts-green); }
                .status-degraded { color: var(--vscode-charts-orange); }
                .status-critical { color: var(--vscode-charts-red); }
            \`;
            document.head.appendChild(style);
            
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

    // Helper methods for dashboard views - now delegated to pure functions




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

    /**
     * Generate Live Reports View with React component
     */
    private generateLiveReportsView(data: {
        channels: any[];
        states: Map<string, any>;
        currentWatch?: any;
        navigation: string;
        baseCSS: string;
        baseScripts: string;
        reactBundleUri?: string;
        nonce?: string;
        cspSource?: string;
    }): string {
        const { channels, states, currentWatch, navigation, baseCSS, baseScripts } = data;
        
        // Convert Map to plain object for JSON serialization
        const statesObj: Record<string, any> = {};
        states.forEach((value, key) => {
            statesObj[key] = value;
        });

        // Samples are provided by the async data endpoint; keep empty placeholders here
        const samples: Record<string, any[]> = {};
        for (const channel of channels) {
            samples[channel.id] = [];
        }
        
        // Prepare props for React component
        const reactProps = {
            channels,
            states: statesObj,
            samples
        };

        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${data.cspSource || ''} https:; script-src ${data.cspSource || ''} 'nonce-${data.nonce || ''}'; style-src ${data.cspSource || ''} https: 'unsafe-inline';">
            <title>Health Watch - Live Reports</title>
            ${baseCSS}
        </head>
        <body>
            ${navigation}
            <div id="live-reports-root"></div>
            ${baseScripts}
            <script nonce="${data.nonce || ''}" src="${typeof data.reactBundleUri === 'string' ? data.reactBundleUri : (data.reactBundleUri as any)?.toString?.()}"></script>
            <script nonce="${data.nonce || ''}">
                window.healthWatchProps = ${JSON.stringify(reactProps)};
                window.healthWatchComponent = 'LiveReportView';
            </script>
        </body>
        </html>
        `;
    }

    /**
     * Get the bundled React app URI for reports
     */
    private getReportsBundleUri(): vscode.Uri {
        return vscode.Uri.joinPath(this.context!.extensionUri, 'dist', 'reports-view.js');
    }

    /**
     * Generate live report data for real-time dashboard reports
     */
    private async generateLiveReportData(filter: any) {
        const channels = this.configManager.getChannels();
        const states = this.scheduler.getChannelRunner().getChannelStates();
        const samples = new Map<string, any[]>();

        // Collect samples for each channel based on filter (last 1 hour)
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        for (const channel of channels) {
            const channelSamples = this.storageManager.getSamplesInWindow(channel.id, oneHourAgo, Date.now());
            samples.set(channel.id, channelSamples || []);
        }

        return {
            channels,
            states,
            samples: Array.from(samples.entries()).reduce((obj, [key, value]) => {
                obj[key] = value;
                return obj;
            }, {} as any),
            filter
        };
    }

    /**
     * Export report markdown to file in workspace
     */
    private async exportReportToFile(markdown: string, filename: string): Promise<vscode.Uri> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new Error('No workspace folder available for export');
        }

        const uri = vscode.Uri.joinPath(workspaceFolder.uri, filename);
        const encoder = new TextEncoder();
        await vscode.workspace.fs.writeFile(uri, encoder.encode(markdown));
        
        // Optionally open the file
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc);
        
        return uri;
    }

    dispose() {
        if (this.panel) {
            this.panel.dispose();
        }
    }
}