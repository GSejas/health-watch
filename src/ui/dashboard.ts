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
import { DASHBOARD_CSS } from './styles/index';

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
    // Track pending pings to measure round-trip times
    private pendingPings: Map<string, number> = new Map();
    private context: vscode.ExtensionContext | undefined;
    
    // State preservation for seamless UX
    private currentState: DashboardState = {
        activeView: 'overview',
    liveMonitorEnabled: true,
    timeRange: '7d',
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
                case 'pauseWatch':
                    this.storageManager.pauseWatch();
                    // Ask scheduler to pause scheduling while watch is paused
                    try { this.scheduler.pauseForWatch(); } catch {}
                    // send updated watch state to webview
                    this.panel?.webview.postMessage({ command: 'watchUpdated', payload: this.storageManager.getCurrentWatch() });
                    break;
                case 'resumeWatch':
                    this.storageManager.resumeWatch();
                    try { this.scheduler.resumeForWatch(); } catch {}
                    this.panel?.webview.postMessage({ command: 'watchUpdated', payload: this.storageManager.getCurrentWatch() });
                    break;
                case 'extendWatch':
                    // payload: { extendMs }
                    if (message.payload && message.payload.extendMs !== undefined) {
                        this.storageManager.extendWatch(message.payload.extendMs);
                        this.panel?.webview.postMessage({ command: 'watchUpdated', payload: this.storageManager.getCurrentWatch() });
                    }
                    break;
                case 'changeView':
                    this.currentState.activeView = message.viewType;
                    this.currentState.activeSubView = message.subViewType;
                    await this.updateDashboard({ preserveState: false });
                    break;
                case 'changeTimeRange':
                    // Accept both `range` and legacy `timeRange` keys from the webview
                    {
                        // Log the raw incoming message for diagnostics so we can see exactly what the webview posted
                        console.debug('[Dashboard] changeTimeRange received (raw message)', message);

                        const incoming = message.range ?? message.timeRange;
                        let effective = typeof incoming === 'string' ? String(incoming).trim() : undefined;
                        if (!effective) {
                            console.warn('[Dashboard] changeTimeRange received without range, defaulting to 7d');
                            effective = '7d';
                        }
                        // Normalize to canonical form
                        effective = effective.replace('D', 'd').toLowerCase();
                        console.debug('[Dashboard] changeTimeRange normalized ->', { incoming, effective, requestId: message.requestId });
                        // Trace assignment with caller context to help find unexpected overwrites
                        const previous = this.currentState.timeRange;
                        this.currentState.timeRange = effective;
                        const assignTrace = (new Error().stack || '').split('\n').slice(2,5).join('\n');
                        console.debug('[Dashboard] changeTimeRange -> applied', { previous, effective, requestId: message.requestId, assignTrace });

                        // Inform the webview of the applied range so the UI can sync; echo requestId if present
                        this.panel?.webview.postMessage({ command: 'changeTimeRangeAck', appliedRange: effective, requestId: message.requestId });

                        await this.updateDashboard({ preserveState: true });
                    }
                    break;
                case 'zoomToTimeRange':
                    // Handle heatmap cell zoom - switch to detailed view for specific time range
                    this.currentState.timeRange = '1h'; // Zoom to 1-hour view
                    this.currentState.activeView = 'timeline-incidents'; // Switch to detailed incidents view
                    this.currentState.selectedChannel = message.channelId; // Focus on clicked channel
                    
                    // Store zoom context for the view
                    const zoomContext = {
                        startTime: message.startTime,
                        endTime: message.endTime,
                        originalContext: message.context
                    };
                    
                    await this.updateDashboard({ 
                        preserveState: false, // Force full refresh for view change
                        additionalOptions: { zoomContext }
                    });
                    
                    // Send confirmation back to UI
                    this.panel?.webview.postMessage({
                        command: 'zoomCompleted',
                        channelId: message.channelId,
                        timeRange: this.currentState.timeRange
                    });
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
                case 'stateUpdate':
                    // Webview reports its current state for synchronization
                    this.currentState = { ...this.currentState, ...message.state };
                    break;
                case 'pong':
                    try {
                        const id = message.id as string | undefined;
                        const sentAt = id ? this.pendingPings.get(id) : undefined;
                        if (id && sentAt) {
                            const rtt = Date.now() - sentAt;
                            console.debug('[Dashboard] received pong', { id, rtt });
                            this.pendingPings.delete(id);
                        } else {
                            console.debug('[Dashboard] received pong (no matching ping)', { id });
                        }
                    } catch (err) {
                        console.warn('[Dashboard] error handling pong', err);
                    }
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
            // Include timeline & heatmap payload so React components can update without full reload
            const dashboardData = this.generateDashboardData();
            // Debug logging
            console.debug('[Dashboard] sending incremental update', { timeRange: this.currentState.timeRange });
            this.panel.webview.postMessage({
                command: 'updateContent',
                data: dashboardData,
                options: updateOptions
            });

            // Also send a targeted update for timeline/heatmap components
            try {
                this.panel.webview.postMessage({
                    command: 'updateTimelineHeatmap',
                    payload: {
                        heatmapData: dashboardData.heatmapData,
                        timelineData: dashboardData.timelineData,
                        timeRange: this.currentState.timeRange || '7d'
                    }
                });
            } catch (err) {
                console.warn('[Dashboard] failed to post updateTimelineHeatmap', err);
            }
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

        let running = false;
        this.refreshTimer = setInterval(async () => {
            if (running) return; // Skip if previous run still in progress
            if (this.panel && this.panel.visible && this.currentState.liveMonitorEnabled) {
                // Only update if sufficient time has passed to avoid overwhelming the UI
                const timeSinceLastUpdate = Date.now() - this.currentState.lastUpdate;
                if (timeSinceLastUpdate >= 5000) { // Minimum 5 second interval
                    running = true;
                    try {
                        this.currentState.lastUpdate = Date.now();
                        await this.updateDashboard({ preserveState: true });
                        // Send a lightweight ping to the webview after each successful incremental update
                        try { this.sendPing(); } catch (err) { console.warn('[Dashboard] sendPing failed', err); }

                        // Push lightweight watch stats to webview for UI banner
                        const currentWatch = this.storageManager.getCurrentWatch();
                        if (this.panel && currentWatch) {
                            // Use StatsCalculator to compute per-channel stats for the current watch
                            try {
                                const sessionStats = this.statsCalculator.getWatchSessionStats(currentWatch as any);
                                // Build summary metrics
                                let probesRun = 0;
                                const perChannel: Record<string, any> = {};
                                for (const [chId, stats] of sessionStats.entries()) {
                                    perChannel[chId] = {
                                        availability: Math.round(stats.availability),
                                        totalSamples: stats.totalSamples,
                                        successfulSamples: stats.successfulSamples,
                                        p95: Math.round(stats.latencyStats.p95)
                                    };
                                    probesRun += stats.totalSamples;
                                }

                                // Overall successRatePct derived from per-channel totals
                                const totalSamples = Object.values(perChannel).reduce((s: number, c: any) => s + (c.totalSamples || 0), 0);
                                const successfulSamples = Object.values(perChannel).reduce((s: number, c: any) => s + (c.successfulSamples || 0), 0);
                                const successRatePct = totalSamples > 0 ? Math.round((successfulSamples / totalSamples) * 100) : 0;
                                this.panel.webview.postMessage({ command: 'watchStats', payload: { probesRun, successRatePct, perChannel } });
                            } catch (err) {
                                // Fallback to lightweight stats if StatsCalculator fails
                                const channels = this.configManager.getChannels();
                                const states = this.scheduler.getChannelRunner().getChannelStates();
                                const probesRun = channels.reduce((acc, ch) => acc + (states.get(ch.id)?.totalChecks || 0), 0);
                                let success = 0, total = 0;
                                for (const ch of channels) {
                                    const s = states.get(ch.id)?.lastSample;
                                    if (s) {
                                        total++;
                                        if (s.success) success++;
                                    }
                                }
                                const successRatePct = total > 0 ? Math.round((success / total) * 100) : 0;
                                this.panel.webview.postMessage({ command: 'watchStats', payload: { probesRun, successRatePct } });
                            }
                        }
                    } finally {
                        running = false;
                    }
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

    // Lightweight ping/pong to verify webview responsiveness and measure RTT
    private generatePingId(): string {
        return Math.random().toString(36).slice(2, 10);
    }

    private sendPing() {
        if (!this.panel) return;
        try {
            const id = this.generatePingId();
            this.pendingPings.set(id, Date.now());
            this.panel.webview.postMessage({ command: 'ping', id });
            console.debug('[Dashboard] sent ping', { id });
        } catch (err) {
            console.warn('[Dashboard] failed to post ping', err);
        }
    }

    /**
     * Generate data payload for incremental updates
     */
    private generateDashboardData(): any {
        const channels = this.configManager.getChannels();
        const states = this.scheduler.getChannelRunner().getChannelStates();
        const currentWatch = this.storageManager.getCurrentWatch();

    // Use the pure data generation function and respect current timeRange
    const effectiveRange = this.currentState.timeRange || '7d';
    console.debug('[Dashboard] generating dashboard data', { effectiveRange });
    const dashboardData = generateDashboardDataPure(channels, states, currentWatch || undefined, this.storageManager, { timeRange: effectiveRange });

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
            { id: 'timeline', label: 'Timeline', active: mainView === 'timeline' }
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
        const baseCSS = DASHBOARD_CSS;
        const baseScripts = this.getBaseScripts(nonce);
        
        // PHASE 1: CSS URI Generation (EXPERIMENTAL)
        // NOTE: This adds CSS bundle support without replacing existing inline CSS yet
        // SECURITY: Must comply with VS Code CSP - no external frameworks (Risk R15)
        let dashboardCssUri: string | undefined;
        
        if (this.context && this.panel) {
            const metricsBundleUri = vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'metrics-view.js');
            reactBundleUri = this.panel.webview.asWebviewUri(metricsBundleUri).toString();
            
            const overviewBundleUriPath = vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'overview-view.js');
            overviewBundleUri = this.panel.webview.asWebviewUri(overviewBundleUriPath).toString();
            
            const timelineBundleUriPath = vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'timeline-view.js');
            timelineBundleUri = this.panel.webview.asWebviewUri(timelineBundleUriPath).toString();
            
            const monitorBundleUriPath = vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'monitor-view.js');
            monitorBundleUri = this.panel.webview.asWebviewUri(monitorBundleUriPath).toString();
            
            // PHASE 1: Add CSS bundle URI (testing only - no replacement yet)
            const dashboardCssPath = vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'dashboard.css');
            dashboardCssUri = this.panel.webview.asWebviewUri(dashboardCssPath).toString();
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
                const heatmapTimeRange = options.timeRange || this.currentState.timeRange || '7D';
                const heatmapDays = this.getTimeRangeDays(heatmapTimeRange);
                const heatmapData = generateHourlyHeatmapData(channels, heatmapDays, this.storageManager);
                return generateTimelineHeatmapView({
                    channels,
                    states,
                    heatmapData,
                    timeRange: heatmapTimeRange,
                    navigation,
                    baseCSS,
                    baseScripts,
                    nonce,
                    cspSource,
                    timelineBundleUri
                });
                
            case 'timeline-incidents':
                const incidentsTimeRange = options.timeRange || this.currentState.timeRange || '7d';
                const incidentsDays = this.getTimeRangeDays(incidentsTimeRange);
                const incidents = generateIncidentsData(channels, incidentsDays, this.storageManager);
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







    // getBaseCSS() method removed - CSS extracted to modular files in src/ui/styles/

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
                // Debug: log all incoming messages to help diagnose missing updates
                try { console.log('[webview] incoming message', message); } catch {}
                if (message.command === 'updateContent') {
                    updateDashboardContent(message.data, message.options);
                } else if (message.command === 'ping') {
                    // Reply quickly so extension can measure latency and confirm webview is alive
                    try {
                        const pong = { command: 'pong', id: message.id, ts: Date.now() };
                        console.debug('[webview] replying pong', pong);
                        vscode.postMessage(pong);
                    } catch (err) {
                        console.warn('[webview] failed to reply pong', err);
                    }
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
                try {
                    var requestId = 'req-' + Math.random().toString(36).slice(2,9);
                    console.debug('[webview] posting changeTimeRange', { range: range, requestId: requestId });
                    vscode.postMessage({
                        command: 'changeTimeRange',
                        range: range,
                        requestId: requestId
                    });
                } catch (err) {
                    try { console.warn('[webview] changeTimeRange post failed', err); } catch(e) {}
                }
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
            // New FilterPanel format
            case '5m': return 0.003; // 5 minutes ≈ 0.003 days
            case '1h': return 0.042; // 1 hour ≈ 0.042 days  
            case '6h': return 0.25;  // 6 hours = 0.25 days
            case '12h': return 0.5;  // 12 hours = 0.5 days
            case '1d': return 1;
            case '7d': return 7;
            case '30d': return 30;
            // Legacy format support
            case '24H': return 1;
            case '3D': return 3; 
            case '7D': return 7;
            case '30D': return 30;
            default: return 7;
        }
    }

    private getTimeRangeLabel(range: string): string {
        switch (range) {
            // New FilterPanel format
            case '5m': return 'Last 5 Minutes';
            case '1h': return 'Last 1 Hour';
            case '6h': return 'Last 6 Hours';
            case '12h': return 'Last 12 Hours';
            case '1d': return 'Last 1 Day';
            case '7d': return 'Last 7 Days';
            case '30d': return 'Last 30 Days';
            // Legacy format support
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