/**
 * Live Markdown Report Generator with Mermaid Charts
 * 
 * Generates real-time Markdown reports with interactive filtering
 */

import { Sample, ChannelState } from '../../types';
import { formatDuration, formatTimestamp } from '../dashboardUtils';

export interface ReportFilter {
    channels?: string[];
    timeRange?: '1h' | '6h' | '12h' | '1d' | '7d' | '30d';
    includeCharts?: boolean;
    includeStats?: boolean;
    includeTrends?: boolean;
}

export interface ChannelMetrics {
    availability: number;
    avgLatency: number;
    p95Latency: number;
    totalSamples: number;
    outages: Array<{ start: number; end?: number; duration?: number }>;
    trend: 'improving' | 'stable' | 'degrading';
}

export class LiveMarkdownGenerator {
    
    /**
     * Generate filtered connectivity report in real-time
     */
    generateConnectivityReport(
        channels: any[],
        states: Map<string, ChannelState>,
        samples: Map<string, Sample[]>,
        filter: ReportFilter = {}
    ): string {
        const { 
            channels: channelFilter, 
            timeRange = '6h',
            includeCharts = true,
            includeStats = true,
            includeTrends = true
        } = filter;

        const filteredChannels = channelFilter ? 
            channels.filter(ch => channelFilter.includes(ch.id)) : 
            channels;

        const timeRangeMs = this.getTimeRangeMs(timeRange);
        const now = Date.now();
        const startTime = now - timeRangeMs;

        let markdown = `# 🔍 Health Watch Live Report\n\n`;
        markdown += `**Generated:** ${new Date().toLocaleString()}\n`;
        markdown += `**Time Range:** ${timeRange.toUpperCase()}\n`;
        markdown += `**Channels:** ${filteredChannels.length}\n\n`;

        // Quick Stats Table
        if (includeStats) {
            markdown += this.generateStatsTable(filteredChannels, states, samples, startTime, now);
        }

        // Connectivity Trend Chart
        if (includeCharts) {
            markdown += this.generateConnectivityChart(filteredChannels, samples, startTime, now);
        }

        // Latency Performance Chart  
        if (includeCharts) {
            markdown += this.generateLatencyChart(filteredChannels, samples, startTime, now);
        }

        // Per-Channel Details
        markdown += this.generateChannelDetails(filteredChannels, states, samples, startTime, now, includeTrends);

        // Quick Actions
        markdown += this.generateQuickActions(filteredChannels);

        return markdown;
    }

    private generateStatsTable(
        channels: any[],
        states: Map<string, ChannelState>,
        samples: Map<string, Sample[]>,
        startTime: number,
        endTime: number
    ): string {
        let table = `## 📊 Quick Stats\n\n`;
        table += `| Channel | Status | Availability | Avg Latency | Last Check |\n`;
        table += `|---------|--------|--------------|-------------|------------|\n`;

        for (const channel of channels) {
            const state = states.get(channel.id);
            const channelSamples = samples.get(channel.id) || [];
                const recentSamples = channelSamples.filter(s => s.timestamp >= startTime && s.timestamp <= endTime);
            
            const availability = this.calculateAvailability(recentSamples);
            const avgLatency = this.calculateAverageLatency(recentSamples);
            const lastCheck = state?.lastSample?.timestamp;
            
            const statusIcon = state?.state === 'online' ? '🟢' : 
                             state?.state === 'offline' ? '🔴' : '🟡';
            
            table += `| ${channel.name || channel.id} | ${statusIcon} ${state?.state || 'unknown'} | `;
            table += `${availability.toFixed(1)}% | ${avgLatency ? avgLatency.toFixed(0) + 'ms' : 'N/A'} | `;
            table += `${lastCheck ? formatTimestamp(lastCheck) : 'Never'} |\n`;
        }

        return table + `\n`;
    }

    private generateConnectivityChart(
        channels: any[],
        samples: Map<string, Sample[]>,
        startTime: number,
        endTime: number
    ): string {
        const dataPoints = this.generateTimeSeriesData(channels, samples, startTime, endTime, 12);
        
        let chart = `## 📈 Connectivity Trends\n\n`;
        chart += `\`\`\`mermaid\n`;
        chart += `xychart-beta\n`;
        chart += `    title "Connectivity Over Time"\n`;
        chart += `    x-axis "Time" ${JSON.stringify(dataPoints.timeLabels)}\n`;
        chart += `    y-axis "Availability %" 0 --> 100\n`;

        for (const channel of channels) {
            const channelData = dataPoints.series[channel.id] || [];
            const availabilityData = channelData.map(d => (d.availability * 100).toFixed(1));
            chart += `    line "${channel.name || channel.id}" ${JSON.stringify(availabilityData)}\n`;
        }

        chart += `\`\`\`\n\n`;
        return chart;
    }

    private generateLatencyChart(
        channels: any[],
        samples: Map<string, Sample[]>,
        startTime: number,
        endTime: number
    ): string {
        const dataPoints = this.generateTimeSeriesData(channels, samples, startTime, endTime, 12);
        
        let chart = `## ⚡ Latency Performance\n\n`;
        chart += `\`\`\`mermaid\n`;
        chart += `xychart-beta\n`;
        chart += `    title "Response Times"\n`;
        chart += `    x-axis "Time" ${JSON.stringify(dataPoints.timeLabels)}\n`;
        chart += `    y-axis "Latency (ms)" 0 --> 500\n`;

        for (const channel of channels) {
            const channelData = dataPoints.series[channel.id] || [];
            const latencyData = channelData.map(d => d.avgLatency?.toFixed(0) || '0');
            chart += `    line "${channel.name || channel.id}" ${JSON.stringify(latencyData)}\n`;
        }

        chart += `\`\`\`\n\n`;
        return chart;
    }

    private generateChannelDetails(
        channels: any[],
        states: Map<string, ChannelState>,
        samples: Map<string, Sample[]>,
        startTime: number,
        endTime: number,
        includeTrends: boolean
    ): string {
        let details = `## 🔧 Channel Details\n\n`;

        for (const channel of channels) {
            const state = states.get(channel.id);
            const channelSamples = samples.get(channel.id) || [];
            const recentSamples = channelSamples.filter(s => s.timestamp >= startTime && s.timestamp <= endTime);
            
            details += `### ${channel.name || channel.id}\n\n`;
            details += `**Type:** ${channel.type?.toUpperCase()}\n`;
            details += `**Target:** ${channel.url || channel.target}\n`;
            details += `**Status:** ${this.getStatusBadge(state?.state)} ${state?.state}\n`;
            
            const availability = this.calculateAvailability(recentSamples);
            const avgLatency = this.calculateAverageLatency(recentSamples);
            const p95Latency = this.calculateP95Latency(recentSamples);
            
            details += `**Availability:** ${availability.toFixed(1)}%\n`;
            details += `**Avg Latency:** ${avgLatency ? avgLatency.toFixed(0) + 'ms' : 'N/A'}\n`;
            details += `**P95 Latency:** ${p95Latency ? p95Latency.toFixed(0) + 'ms' : 'N/A'}\n`;
            details += `**Samples:** ${recentSamples.length}\n`;

            if (includeTrends) {
                const trend = this.calculateTrend(recentSamples);
                details += `**Trend:** ${this.getTrendIcon(trend)} ${trend}\n`;
            }

            // Recent outages
            const outages = this.detectOutages(recentSamples);
            if (outages.length > 0) {
                details += `\n**Recent Outages:**\n`;
                for (const outage of outages.slice(0, 3)) {
                    const duration = outage.end ? outage.end - outage.start : Date.now() - outage.start;
                    details += `- ${formatTimestamp(outage.start)} (${formatDuration(duration)})\n`;
                }
            }

            details += `\n`;
        }

        return details;
    }

    private generateQuickActions(channels: any[]): string {
        let actions = `## ⚡ Quick Actions\n\n`;
        
        actions += `**Filter Options:**\n`;
        actions += `- [📊 Overview](command:healthwatch.showOverview)\n`;
        actions += `- [📈 Timeline](command:healthwatch.showTimeline)\n`;
        actions += `- [🔍 Start Watch](command:healthwatch.startWatch)\n`;
        actions += `- [⚙️ Configure](command:healthwatch.openConfig)\n\n`;

        actions += `**Channel Actions:**\n`;
        for (const channel of channels.slice(0, 5)) {
            actions += `- [▶️ Test ${channel.name || channel.id}](command:healthwatch.runChannelNow?${channel.id})\n`;
        }

        if (channels.length > 5) {
            actions += `- ... and ${channels.length - 5} more channels\n`;
        }

        actions += `\n---\n`;
        actions += `*Generated by Health Watch v1.0.4 at ${new Date().toISOString()}*\n`;

        return actions;
    }

    // Utility methods
    private generateTimeSeriesData(
        channels: any[],
        samples: Map<string, Sample[]>,
        startTime: number,
        endTime: number,
        buckets: number
    ) {
        const bucketSize = (endTime - startTime) / buckets;
        const timeLabels: string[] = [];
        const series: Record<string, Array<{availability: number, avgLatency?: number}>> = {};

        // Generate time labels
        for (let i = 0; i < buckets; i++) {
            const bucketStart = startTime + (i * bucketSize);
            timeLabels.push(new Date(bucketStart).toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit' 
            }));
        }

        // Generate data for each channel
        for (const channel of channels) {
            const channelSamples = samples.get(channel.id) || [];
            series[channel.id] = [];

            for (let i = 0; i < buckets; i++) {
                const bucketStart = startTime + (i * bucketSize);
                const bucketEnd = bucketStart + bucketSize;
                    const bucketSamples = channelSamples.filter(s => s.timestamp >= bucketStart && s.timestamp < bucketEnd);
                
                const availability = this.calculateAvailability(bucketSamples);
                const avgLatency = this.calculateAverageLatency(bucketSamples);
                
                series[channel.id].push({ availability, avgLatency });
            }
        }

        return { timeLabels, series };
    }

    private getTimeRangeMs(timeRange: string): number {
        const ranges = {
            '1h': 60 * 60 * 1000,
            '6h': 6 * 60 * 60 * 1000,
            '12h': 12 * 60 * 60 * 1000,
            '1d': 24 * 60 * 60 * 1000,
            '7d': 7 * 24 * 60 * 60 * 1000,
            '30d': 30 * 24 * 60 * 60 * 1000
        };
    return (ranges as any)[timeRange] || ranges['6h'];
    }

    private calculateAvailability(samples: Sample[]): number {
        if (samples.length === 0) return 0;
        const successful = samples.filter(s => s.success).length;
        return (successful / samples.length) * 100;
    }

    private calculateAverageLatency(samples: Sample[]): number | undefined {
    const successfulSamples = samples.filter(s => s.success && s.latencyMs);
        if (successfulSamples.length === 0) return undefined;
        
        const sum = successfulSamples.reduce((acc, s) => acc + (s.latencyMs || 0), 0);
        return sum / successfulSamples.length;
    }

    private calculateP95Latency(samples: Sample[]): number | undefined {
        const latencies = samples
            .filter(s => s.success && s.latencyMs)
            .map(s => s.latencyMs!)
            .sort((a, b) => a - b);
        
        if (latencies.length === 0) return undefined;
        
        const p95Index = Math.floor(latencies.length * 0.95);
        return latencies[p95Index];
    }

    private calculateTrend(samples: Sample[]): 'improving' | 'stable' | 'degrading' {
        if (samples.length < 10) return 'stable';
        
        const midPoint = Math.floor(samples.length / 2);
        const firstHalf = samples.slice(0, midPoint);
        const secondHalf = samples.slice(midPoint);
        
        const firstAvailability = this.calculateAvailability(firstHalf);
        const secondAvailability = this.calculateAvailability(secondHalf);
        
        const diff = secondAvailability - firstAvailability;
        
        if (diff > 5) return 'improving';
        if (diff < -5) return 'degrading';
        return 'stable';
    }

    private detectOutages(samples: Sample[]): Array<{start: number, end?: number}> {
        const outages: Array<{start: number, end?: number}> = [];
        let currentOutage: {start: number, end?: number} | null = null;
        
        for (const sample of samples) {
            if (!sample.success) {
                if (!currentOutage) {
                    currentOutage = { start: sample.timestamp };
                }
            } else {
                if (currentOutage) {
                    currentOutage.end = sample.timestamp;
                    outages.push(currentOutage);
                    currentOutage = null;
                }
            }
        }
        
        // If outage is ongoing
        if (currentOutage) {
            outages.push(currentOutage);
        }
        
        return outages;
    }

    private getStatusBadge(status?: string): string {
        switch (status) {
            case 'online': return '🟢';
            case 'offline': return '🔴';
            case 'unknown': return '🟡';
            default: return '⚫';
        }
    }

    private getTrendIcon(trend: string): string {
        switch (trend) {
            case 'improving': return '📈';
            case 'degrading': return '📉';
            case 'stable': return '➡️';
            default: return '❓';
        }
    }
}