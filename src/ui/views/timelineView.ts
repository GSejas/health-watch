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
    timeRange: string;
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
 * Generates timeline swimlanes view - React-based implementation
 */
export function generateTimelineSwimlanesView(data: TimelineSwimlanesViewData & { timelineBundleUri?: string }): string {
    const { channels, timelineData, timeRange, navigation, baseCSS, baseScripts } = data;
    
    // Convert Map to plain object for JSON serialization
    const statesObj: Record<string, any> = {};
    if (data.states instanceof Map) {
        data.states.forEach((value, key) => {
            statesObj[key] = value;
        });
    } else {
        Object.assign(statesObj, data.states);
    }
    
    // Prepare props for React component
    const reactProps = {
        channels,
        states: statesObj,
        timelineData,
        timeRange
    };

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${data.cspSource || ''} https:; script-src ${data.cspSource || ''} 'nonce-${data.nonce || ''}'; style-src ${data.cspSource || ''} https: 'unsafe-inline';">
        <title>Health Watch - Timeline Swimlanes</title>
        <!-- Timeline Component Styles -->
        ${baseCSS}
    </head>
    <body>
        ${navigation}
        
        <!-- React mount point for TimelineSwimlanesView -->
        <div id="timeline-swimlanes-root" class="dashboard-content"></div>
        
        ${baseScripts}
        
        <!-- Load React Timeline Bundle -->
        ${data.timelineBundleUri ? `
            <script nonce="${data.nonce || ''}" src="${data.timelineBundleUri}"></script>
            <script nonce="${data.nonce || ''}">
                // Mount the React Timeline Swimlanes component
                if (window.HealthWatch && window.HealthWatch.mountTimelineSwimlanesView) {
                    window.HealthWatch.mountTimelineSwimlanesView('timeline-swimlanes-root', ${JSON.stringify(reactProps)});
                } else {
                    console.error('HealthWatch timeline components not loaded');
                }
            </script>
        ` : `
            <!-- Fallback content when React bundle is not available -->
            <div class="loading">
                <div class="loading-spinner"></div>
                Loading timeline view...
            </div>
        `}
    </body>
    </html>
    `;
}

/**
 * Generates timeline heatmap view - React-based implementation
 */
export function generateTimelineHeatmapView(data: TimelineHeatmapViewData & { timelineBundleUri?: string }): string {
    const { channels, heatmapData, timeRange, navigation, baseCSS, baseScripts } = data;
    
    // Convert Map to plain object for JSON serialization
    const statesObj: Record<string, any> = {};
    if (data.states instanceof Map) {
        data.states.forEach((value, key) => {
            statesObj[key] = value;
        });
    } else {
        Object.assign(statesObj, data.states);
    }
    
    // Prepare props for React component
    const reactProps = {
        channels,
        states: statesObj,
        heatmapData,
        timeRange
    };
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${data.cspSource || ''} https:; script-src ${data.cspSource || ''} 'nonce-${data.nonce || ''}'; style-src ${data.cspSource || ''} https: 'unsafe-inline';">
        <title>Health Watch - Timeline Heatmap</title>
        <!-- Timeline Component Styles -->
        ${baseCSS}
    </head>
    <body>
        ${navigation}
        
        <!-- React mount point for TimelineHeatmapView -->
        <div id="timeline-heatmap-root" class="dashboard-content"></div>
        
        ${baseScripts}
        
        <!-- Load React Timeline Bundle -->
        ${data.timelineBundleUri ? `
            <script nonce="${data.nonce || ''}" src="${data.timelineBundleUri}"></script>
            <script nonce="${data.nonce || ''}">
                // Mount the React Timeline Heatmap component
                if (window.HealthWatch && window.HealthWatch.mountTimelineHeatmapView) {
                    window.HealthWatch.mountTimelineHeatmapView('timeline-heatmap-root', ${JSON.stringify(reactProps)});
                } else {
                    console.error('HealthWatch timeline components not loaded');
                }
            </script>
        ` : `
            <!-- Fallback content when React bundle is not available -->
            <div class="loading">
                <div class="loading-spinner"></div>
                Loading timeline heatmap view...
            </div>
        `}
    </body>
    </html>
    `;
}

/**
 * Generates timeline incidents view - React-based implementation
 */
export function generateTimelineIncidentsView(data: TimelineIncidentsViewData & { timelineBundleUri?: string }): string {
    const { incidents, navigation, baseCSS, baseScripts } = data;
    
    // Convert Map to plain object for JSON serialization
    const statesObj: Record<string, any> = {};
    if (data.states instanceof Map) {
        data.states.forEach((value, key) => {
            statesObj[key] = value;
        });
    } else {
        Object.assign(statesObj, data.states);
    }
    
    // Prepare props for React component
    const reactProps = {
        channels: data.channels,
        states: statesObj,
        incidents
    };

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${data.cspSource || ''} https:; script-src ${data.cspSource || ''} 'nonce-${data.nonce || ''}'; style-src ${data.cspSource || ''} https: 'unsafe-inline';">
        <title>Health Watch - Incidents Timeline</title>
        <!-- Timeline Component Styles -->
        ${baseCSS}
    </head>
    <body>
        ${navigation}
        
        <!-- React mount point for TimelineIncidentsView -->
        <div id="timeline-incidents-root" class="dashboard-content"></div>
        
        ${baseScripts}
        
        <!-- Load React Timeline Bundle -->
        ${data.timelineBundleUri ? `
            <script nonce="${data.nonce || ''}" src="${data.timelineBundleUri}"></script>
            <script nonce="${data.nonce || ''}">
                // Mount the React Timeline Incidents component
                if (window.HealthWatch && window.HealthWatch.mountTimelineIncidentsView) {
                    window.HealthWatch.mountTimelineIncidentsView('timeline-incidents-root', ${JSON.stringify(reactProps)});
                } else {
                    console.error('HealthWatch timeline components not loaded');
                }
            </script>
        ` : `
            <!-- Fallback content when React bundle is not available -->
            <div class="loading">
                <div class="loading-spinner"></div>
                Loading timeline incidents view...
            </div>
        `}
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