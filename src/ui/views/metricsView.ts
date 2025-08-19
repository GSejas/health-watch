/**
 * React-based metrics dashboard view component.
 * 
 * Provides a placeholder HTML structure and hydrates with React component.
 * The actual metrics rendering is handled by the React MetricsView component.
 */

import { DashboardMetrics } from '../dashboardData';

export interface MetricsViewData {
    channels: any[];
    states: Map<string, any>;
    currentWatch?: any;
    metricsData: DashboardMetrics;
    navigation: string;
    baseCSS: string;
    baseScripts: string;
    reactBundleUri?: string; // Converted webview URI for React bundle
    nonce?: string; // CSP nonce for scripts
    cspSource?: string; // VS Code webview CSP source
}

/**
 * Generates the metrics dashboard HTML with React component mount point
 */
export function generateCompactMetricsView(data: MetricsViewData): string {
    const { channels, states, currentWatch, metricsData, navigation, baseCSS, baseScripts } = data;
    
    // Convert Map to plain object for JSON serialization
    const statesObj: Record<string, any> = {};
    states.forEach((value, key) => {
        statesObj[key] = value;
    });
    
    // Prepare props for React component
    const reactProps = {
        channels,
        states: statesObj, // Pass as plain object
        currentWatch,
        metricsData
    };

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${data.cspSource || ''} https:; script-src ${data.cspSource || ''} 'nonce-${data.nonce || ''}'; style-src ${data.cspSource || ''} 'unsafe-inline';">
        <title>Health Watch - Metrics</title>
        ${baseCSS}
        <style>
            /* React Metrics Component Styles */
            .kpi-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 20px;
                margin-bottom: 30px;
            }
            .metric-panel {
                background: var(--vscode-textBlockQuote-background);
                border-radius: 8px;
                padding: 20px;
                border: 1px solid var(--vscode-panel-border);
            }
            .panel-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
                padding-bottom: 10px;
                border-bottom: 1px solid var(--vscode-panel-border);
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
            .trend-up { background: var(--vscode-charts-green); color: white; }
            .trend-down { background: var(--vscode-charts-red); color: white; }
            .trend-stable { background: var(--vscode-charts-blue); color: white; }
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
            .slo-bar {
                width: 100%;
                height: 4px;
                background: var(--vscode-panel-border);
                border-radius: 2px;
                overflow: hidden;
                margin: 10px 0;
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
            .channel-metrics {
                margin-top: 30px;
            }
            .channel-table .table-header {
                display: grid;
                grid-template-columns: 1fr auto auto auto auto;
                gap: 15px;
                padding: 10px 0;
                font-weight: bold;
                color: var(--vscode-descriptionForeground);
                border-bottom: 1px solid var(--vscode-panel-border);
                margin-bottom: 10px;
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
        </style>
    </head>
    <body>
        ${navigation}
        
        <!-- React component mount point -->
        <div id="metrics-root">
            <div style="text-align: center; padding: 40px; color: var(--vscode-descriptionForeground);">
                <div>Loading metrics dashboard...</div>
                <div style="margin-top: 10px; font-size: 12px;">Initializing React component</div>
            </div>
        </div>
        
        ${baseScripts}
        
        <!-- React bundle -->
        ${data.reactBundleUri ? `<script nonce="${data.nonce || ''}" src="${data.reactBundleUri}"></script>` : ''}
        
        <!-- Mount React component -->
        <script nonce="${data.nonce || ''}">
            // Convert states back to Map for React component
            const statesMap = new Map(Object.entries(${JSON.stringify(statesObj)}));
            
            // Mount the React component
            if (window.HealthWatch && window.HealthWatch.mountMetricsView) {
                window.HealthWatch.mountMetricsView('metrics-root', ${JSON.stringify(reactProps)});
            } else {
                console.error('HealthWatch React components not loaded');
            }
        </script>
    </body>
    </html>
    `;
}