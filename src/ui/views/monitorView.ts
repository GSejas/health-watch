/**
 * Live monitoring dashboard view component.
 * 
 * INTERFACE: generateLiveMonitorView(data: MonitorViewData) -> string
 * PURPOSE: Real-time monitoring view with live samples and activity feed
 * DEPENDENCIES: formatRelativeTime from dashboardUtils
 */

import { formatRelativeTime } from '../dashboardUtils';
import { RecentSample } from '../dashboardData';

export interface MonitorViewData {
    channels: any[];
    states: Map<string, any>;
    currentWatch?: any;
    recentSamples: RecentSample[];
    navigation: string;
    baseCSS: string;
    baseScripts: string;
    nonce?: string;
    cspSource?: string;
}

/**
 * Generates live monitoring dashboard HTML view
 * @param data - Complete data needed for monitor view
 * @returns HTML string for live monitoring interface
 */
export function generateLiveMonitorView(data: MonitorViewData): string {
    const { channels, states, currentWatch, recentSamples, navigation, baseCSS, baseScripts } = data;

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${data.cspSource || ''} https:; script-src ${data.cspSource || ''} 'nonce-${data.nonce || ''}'; style-src ${data.cspSource || ''} 'unsafe-inline';">
        <title>Health Watch - Live Monitor</title>
        ${baseCSS}
    </head>
    <body>
        ${navigation}
        
        <div class="dashboard-content">
            <!-- Live Status Header -->
            <div class="monitor-header">
                <div class="monitor-title">
                    <h2>Live Monitor</h2>
                    <div class="live-indicator">
                        <div class="pulse-dot"></div>
                        <span>Live</span>
                    </div>
                </div>
                
                ${currentWatch?.isActive ? `
                <div class="watch-indicator">
                    <span class="watch-icon">🔍</span>
                    <span>Watch Active</span>
                </div>
                ` : ''}
            </div>

            <!-- Real-time Channel Status -->
            <div class="live-channels">
                <h3>Channel Status</h3>
                <div class="live-channels-grid">
                    ${channels.map(channel => {
                        const state = states.get(channel.id);
                        const status = state?.state || 'unknown';
                        const latency = state?.lastSample?.latencyMs;
                        
                        return `
                        <div class="live-channel-card status-${status}">
                            <div class="channel-status-indicator ${status}"></div>
                            <div class="channel-info">
                                <div class="channel-name">${channel.name || channel.id}</div>
                                <div class="channel-latency">
                                    ${latency ? latency + 'ms' : 'N/A'}
                                </div>
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>

            <!-- Activity Feed -->
            <div class="activity-feed">
                <h3>Recent Activity</h3>
                <div class="activity-list">
                    ${recentSamples.slice(0, 50).map(sample => `
                        <div class="activity-item ${sample.success ? 'success' : 'failure'}">
                            <div class="activity-time">
                                ${formatRelativeTime(sample.timestamp)}
                            </div>
                            <div class="activity-status">
                                <div class="status-dot ${sample.success ? 'success' : 'failure'}"></div>
                            </div>
                            <div class="activity-details">
                                <div class="activity-channel">${sample.channelName}</div>
                                <div class="activity-info">
                                    ${sample.success 
                                        ? `✓ ${sample.latencyMs ? sample.latencyMs + 'ms' : 'OK'}`
                                        : `✗ ${sample.error || 'Failed'}`
                                    }
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>

                ${recentSamples.length === 0 ? `
                <div class="no-activity">
                    <div class="no-activity-icon">📊</div>
                    <div class="no-activity-text">No recent activity</div>
                </div>
                ` : ''}
            </div>
        </div>
        
        ${baseScripts}
    </body>
    </html>
    `;
}