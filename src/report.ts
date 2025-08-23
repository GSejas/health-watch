import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { WatchSession, ChannelStats, Sample, Outage } from './types';
import { ConfigManager } from './config';
import { StorageManager } from './storage';
import { StatsCalculator } from './stats';
import { formatDuration, formatTimestamp } from './ui/dashboardUtils';

export interface ReportData {
    session: WatchSession;
    channelStats: Map<string, ChannelStats>;
    globalStats: any;
    outages: Outage[];
    recommendations: Array<{ recommendation: string; priority: string }>;
    sloBreaches: any;
}

export class ReportGenerator {
    private configManager = ConfigManager.getInstance();
    private storageManager = StorageManager.getInstance();
    private statsCalculator = new StatsCalculator();

    async generateReport(session: WatchSession): Promise<{ markdownPath: string; jsonPath: string }> {
        const reportData = this.prepareReportData(session);
        const timestamp = formatTimestamp(session.endTime || Date.now());
        
        const markdownContent = this.generateMarkdownReport(reportData, timestamp);
        const jsonContent = this.generateJsonReport(reportData);
        
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const baseDir = workspaceFolder?.uri.fsPath || process.cwd();
        
        const markdownPath = path.join(baseDir, `HealthWatch-Report-${timestamp}.md`);
        const jsonPath = path.join(baseDir, `HealthWatch-Report-${timestamp}.json`);
        
        fs.writeFileSync(markdownPath, markdownContent, 'utf8');
        fs.writeFileSync(jsonPath, jsonContent, 'utf8');
        
        return { markdownPath, jsonPath };
    }

    private prepareReportData(session: WatchSession): ReportData {
        const channelStats = this.statsCalculator.getWatchSessionStats(session);
        const globalStats = this.statsCalculator.calculateGlobalStats({
            windowStartMs: session.startTime,
            windowEndMs: session.endTime,
            includeCurrentWatch: false
        });
        
        const outages = this.storageManager.getOutages(undefined, session.startTime);
        const recommendations = this.statsCalculator.generateRecommendations(Array.from(channelStats.values()));
        const reportConfig = this.configManager.getReportConfig();
        const sloBreaches = this.statsCalculator.calculateSLOBreach(
            Array.from(channelStats.values()),
            reportConfig.sloTarget
        );

        return {
            session,
            channelStats,
            globalStats,
            outages,
            recommendations,
            sloBreaches
        };
    }

    private generateMarkdownReport(data: ReportData, timestamp: string): string {
        const { session, channelStats, globalStats, outages, recommendations, sloBreaches } = data;
        const reportConfig = this.configManager.getReportConfig();
        const duration = formatDuration(session.endTime! - session.startTime);
        
        const lines: string[] = [];
        lines.push(`# Health Watch Report`);
        lines.push(`Generated: ${new Date().toLocaleString()}`);
        lines.push('');
        
        // Session Overview
        lines.push(`## Session Overview`);
        lines.push(`- **Start Time**: ${new Date(session.startTime).toLocaleString()}`);
        lines.push(`- **End Time**: ${new Date(session.endTime!).toLocaleString()}`);
        lines.push(`- **Duration**: ${duration}`);
        lines.push(`- **Channels Monitored**: ${channelStats.size}`);
        lines.push('');

        // TL;DR Summary Table
        lines.push(`## TL;DR Summary`);
        lines.push('');
        lines.push('| Channel | Availability | Outages | MTTR | Longest | p95 Latency | Top Failure |');
        lines.push('|---------|--------------|---------|------|---------|-------------|-------------|');
        
        for (const [channelId, stats] of channelStats.entries()) {
            const availability = `${stats.availability.toFixed(1)}%`;
            const mttr = formatDuration(stats.mttr);
            const longest = formatDuration(stats.longestOutage);
            const p95Latency = `${Math.round(stats.latencyStats.p95)}ms`;
            const topFailure = stats.topFailureReason.length > 20 
                ? stats.topFailureReason.substring(0, 17) + '...'
                : stats.topFailureReason;
            
            lines.push(`| ${channelId} | ${availability} | ${stats.outageCount} | ${mttr} | ${longest} | ${p95Latency} | ${topFailure} |`);
        }
        lines.push('');

        // Mermaid Diagrams
        this.addStateTapeDiagram(lines, data);
        this.addFailureReasonsPieChart(lines, data);
        
        if (reportConfig.includeSequenceDiagram) {
            this.addSequenceDiagram(lines, data);
        }
        
        if (reportConfig.includeTopologyDiagram) {
            this.addTopologyDiagram(lines, data);
        }

        // Latency Analysis
        lines.push(`## Latency Analysis`);
        lines.push('');
        lines.push('| Channel | Min | p50 | p95 | Max | Avg |');
        lines.push('|---------|-----|-----|-----|-----|-----|');
        
        for (const [channelId, stats] of channelStats.entries()) {
            const { min, p50, p95, max, avg } = stats.latencyStats;
            lines.push(`| ${channelId} | ${Math.round(min)}ms | ${Math.round(p50)}ms | ${Math.round(p95)}ms | ${Math.round(max)}ms | ${Math.round(avg)}ms |`);
        }
        lines.push('');

        // Outage Log
        if (outages.length > 0) {
            lines.push(`## Outage Log`);
            lines.push('');
            lines.push('| Channel | Start | End | Duration | Reason |');
            lines.push('|---------|-------|-----|----------|--------|');
            
            for (const outage of outages.slice(-10)) {
                const start = new Date(outage.startTime).toLocaleTimeString();
                const end = outage.endTime ? new Date(outage.endTime).toLocaleTimeString() : 'Ongoing';
                const duration = outage.duration ? formatDuration(outage.duration) : 'N/A';
                const reasonText = (outage.reason || 'Unknown');
                const reason = reasonText.length > 30 ? reasonText.substring(0, 27) + '...' : reasonText;
                
                lines.push(`| ${outage.channelId} | ${start} | ${end} | ${duration} | ${reason} |`);
            }
            lines.push('');
        }

        // SLO Check
        lines.push(`## SLO Analysis`);
        lines.push(`**Target Availability**: ${reportConfig.sloTarget}%`);
        lines.push('');
        
        if (sloBreaches.breachedChannels.length > 0) {
            lines.push(`⚠️ **SLO Breaches Detected**: ${sloBreaches.breachedChannels.length} channel(s)`);
            for (const channelId of sloBreaches.breachedChannels) {
                const stats = channelStats.get(channelId)!;
                lines.push(`- ${channelId}: ${stats.availability.toFixed(1)}% (${(reportConfig.sloTarget - stats.availability).toFixed(1)}% below target)`);
            }
        } else {
            lines.push(`✅ **All channels met SLO target**`);
        }
        lines.push('');

        // Recommendations
        if (recommendations.length > 0) {
            lines.push(`## Recommendations`);
            lines.push('');
            
            for (const rec of recommendations) {
                const icon = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
                lines.push(`${icon} **${rec.priority.toUpperCase()}**: ${rec.recommendation}`);
                lines.push('');
            }
        }

        // Data Export
        lines.push(`## Data Export`);
        lines.push('');
        lines.push(`📊 [JSON Export](./HealthWatch-Report-${timestamp}.json) - Raw data for further analysis`);
        lines.push('');

        // Footer
        lines.push('---');
        lines.push('*Generated by Health Watch VS Code Extension*');

        return lines.join('\n');
    }

    private addStateTapeDiagram(lines: string[], data: ReportData) {
        lines.push('## State Tape Visualization');
        lines.push('');
        lines.push('```mermaid');
        lines.push('gantt');
        lines.push('  dateFormat  YYYY-MM-DDTHH:mm:ss');
        lines.push('  axisFormat  %H:%M');
        lines.push('  title State Tape — Channel Availability');
        
        for (const [channelId, stats] of data.channelStats.entries()) {
            if (stats.totalSamples === 0) {continue;}
            
            lines.push(`  section ${channelId}`);
            
            const samples = this.getSamplesForChannel(channelId, data.session);
            const stateSegments = this.createStateSegments(samples, data.session.startTime, data.session.endTime!);
            
            for (let i = 0; i < stateSegments.length; i++) {
                const segment = stateSegments[i];
                const status = segment.online ? 'done' : 'active';
                const label = segment.online ? 'Online' : 'Offline';
                const startTime = new Date(segment.startTime).toISOString();
                const endTime = new Date(segment.endTime).toISOString();
                
                lines.push(`  ${label}  :${status}, s${channelId}${i}, ${startTime}, ${endTime}`);
            }
        }
        
        lines.push('```');
        lines.push('');
    }

    private addFailureReasonsPieChart(lines: string[], data: ReportData) {
        const failureReasons = new Map<string, number>();
        
        for (const [channelId, stats] of data.channelStats.entries()) {
            const samples = this.getSamplesForChannel(channelId, data.session);
            const failedSamples = samples.filter(s => !s.success);
            
            for (const sample of failedSamples) {
                const reason = sample.error || 'Unknown error';
                const simplified = this.simplifyErrorReason(reason);
                failureReasons.set(simplified, (failureReasons.get(simplified) || 0) + 1);
            }
        }

        if (failureReasons.size > 0) {
            lines.push('## Failure Reasons Distribution');
            lines.push('');
            lines.push('```mermaid');
            lines.push('pie title Failure Reasons');
            
            for (const [reason, count] of failureReasons.entries()) {
                lines.push(`  "${reason}" : ${count}`);
            }
            
            lines.push('```');
            lines.push('');
        }
    }

    private addSequenceDiagram(lines: string[], data: ReportData) {
        lines.push('## Connectivity Sequence');
        lines.push('');
        lines.push('```mermaid');
        lines.push('sequenceDiagram');
        lines.push('  participant HW as Health Watch');
        lines.push('  participant CH as Channel');
        lines.push('  participant SV as Service');
        lines.push('');
        
        // Show a sample sequence for the first channel with outages
        const channelWithOutages = Array.from(data.channelStats.entries())
            .find(([_, stats]) => stats.outageCount > 0);
        
        if (channelWithOutages) {
            const [channelId] = channelWithOutages;
            const outages = data.outages.filter(o => o.channelId === channelId).slice(0, 3);
            
            for (const outage of outages) {
                const startTime = new Date(outage.startTime).toLocaleTimeString();
                const endTime = outage.endTime ? new Date(outage.endTime).toLocaleTimeString() : 'ongoing';
                
                lines.push(`  HW->>CH: Probe (${startTime})`);
                lines.push(`  CH->>SV: Connect`);
                lines.push(`  SV-->>CH: Timeout/Error`);
                lines.push(`  CH-->>HW: Failed`);
                lines.push(`  Note over HW,SV: Outage detected`);
                
                if (outage.endTime) {
                    lines.push(`  HW->>CH: Retry (${endTime})`);
                    lines.push(`  CH->>SV: Connect`);
                    lines.push(`  SV->>CH: Success`);
                    lines.push(`  CH->>HW: Online`);
                    lines.push(`  Note over HW,SV: Service restored`);
                }
                lines.push('');
            }
        }
        
        lines.push('```');
        lines.push('');
    }

    private addTopologyDiagram(lines: string[], data: ReportData) {
        lines.push('## Network Topology');
        lines.push('');
        lines.push('```mermaid');
        lines.push('flowchart TD');
        lines.push('  HW[Health Watch] --> Dev[Development Machine]');
        
        const channels = this.configManager.getChannels();
        const hasVpnChannels = channels.some(c => c.guards?.includes('vpn'));
        const hasPublicChannels = channels.some(c => !c.guards?.includes('vpn'));
        
        if (hasVpnChannels) {
            lines.push('  Dev --> VPN[VPN Gateway]');
            lines.push('  VPN --> Corp[Corporate Network]');
        }
        
        if (hasPublicChannels) {
            lines.push('  Dev --> Internet[Public Internet]');
        }
        
        for (const channel of channels.slice(0, 5)) { // Limit to 5 for readability
            const isVpn = channel.guards?.includes('vpn');
            const parent = isVpn ? 'Corp' : 'Internet';
            const serviceId = `Svc${channel.id.replace(/[^a-zA-Z0-9]/g, '')}`;
            
            lines.push(`  ${parent} --> ${serviceId}[${channel.name || channel.id}]`);
            
            const stats = data.channelStats.get(channel.id);
            if (stats) {
                const color = stats.availability >= 95 ? 'green' : stats.availability >= 80 ? 'yellow' : 'red';
                lines.push(`  ${serviceId}:::${color}`);
            }
        }
        
        lines.push('');
        lines.push('  classDef green fill:#90EE90');
        lines.push('  classDef yellow fill:#FFD700');
        lines.push('  classDef red fill:#FFB6C1');
        lines.push('```');
        lines.push('');
    }

    private generateJsonReport(data: ReportData): string {
        const jsonData = {
            reportMetadata: {
                generated: new Date().toISOString(),
                sessionId: data.session.id,
                startTime: new Date(data.session.startTime).toISOString(),
                endTime: new Date(data.session.endTime!).toISOString(),
                duration: data.session.endTime! - data.session.startTime
            },
            summary: {
                totalChannels: data.channelStats.size,
                overallAvailability: data.globalStats.overallAvailability,
                totalOutages: data.outages.length,
                sloTarget: this.configManager.getReportConfig().sloTarget,
                sloBreaches: data.sloBreaches.breachedChannels.length
            },
            channels: Object.fromEntries(
                Array.from(data.channelStats.entries()).map(([id, stats]) => [
                    id,
                    {
                        ...stats,
                        samples: this.getSamplesForChannel(id, data.session)
                    }
                ])
            ),
            outages: data.outages,
            recommendations: data.recommendations,
            sloAnalysis: data.sloBreaches,
            rawData: {
                sessionSamples: data.session.samples ? Object.fromEntries(data.session.samples.entries()) : {}
            }
        };

        return JSON.stringify(jsonData, null, 2);
    }

    private getSamplesForChannel(channelId: string, session: WatchSession): Sample[] {
    return (session.samples && session.samples.get(channelId)) || [];
    }

    private createStateSegments(samples: Sample[], startTime: number, endTime: number) {
        if (samples.length === 0) {
            return [{ startTime, endTime, online: false }];
        }

        const segments: Array<{ startTime: number; endTime: number; online: boolean }> = [];
        let currentState = samples[0].success;
        let segmentStart = startTime;

        for (const sample of samples) {
            if (sample.success !== currentState) {
                segments.push({
                    startTime: segmentStart,
                    endTime: sample.timestamp,
                    online: currentState
                });
                
                currentState = sample.success;
                segmentStart = sample.timestamp;
            }
        }

        // Add final segment
        segments.push({
            startTime: segmentStart,
            endTime: endTime,
            online: currentState
        });

        return segments;
    }

    private simplifyErrorReason(error: string): string {
        const patterns = [
            { pattern: /timeout/i, replacement: 'Timeout' },
            { pattern: /dns/i, replacement: 'DNS Error' },
            { pattern: /connection/i, replacement: 'Connection Error' },
            { pattern: /network/i, replacement: 'Network Error' },
            { pattern: /refused/i, replacement: 'Connection Refused' },
            { pattern: /unreachable/i, replacement: 'Host Unreachable' },
            { pattern: /guard/i, replacement: 'Guard Failed' }
        ];

        for (const { pattern, replacement } of patterns) {
            if (pattern.test(error)) {
                return replacement;
            }
        }

        return 'Other Error';
    }

    // formatDuration method removed - now using centralized utility from dashboardUtils

    // formatTimestamp method removed - now using centralized utility from dashboardUtils
}