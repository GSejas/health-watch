import * as vscode from 'vscode';
import { ConfigManager } from '../config';
import { StorageManager } from '../storage';
import { Scheduler } from '../runner/scheduler';

export class StatusBarManager {
    private statusBarItem: vscode.StatusBarItem;
    private configManager = ConfigManager.getInstance();
    private storageManager = StorageManager.getInstance();
    private scheduler: Scheduler;
    private updateTimer?: NodeJS.Timeout;

    constructor(scheduler: Scheduler) {
        this.scheduler = scheduler;
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left, 
            100
        );
        this.statusBarItem.command = 'healthWatch.showDetails';
        this.setupEventListeners();
        this.updateStatusBar();
        this.startPeriodicUpdates();
    }

    private setupEventListeners() {
        this.scheduler.on('stateChange', () => {
            this.updateStatusBar();
        });

        this.scheduler.on('sample', () => {
            this.updateStatusBar();
        });

        this.scheduler.on('started', () => {
            this.updateStatusBar();
        });

        this.scheduler.on('stopped', () => {
            this.updateStatusBar();
        });
    }

    private startPeriodicUpdates() {
        // Update every 5 seconds to show countdown
        this.updateTimer = setInterval(() => {
            this.updateStatusBar();
        }, 5000);
    }

    private updateStatusBar() {
        if (!this.configManager.isEnabled()) {
            this.statusBarItem.hide();
            return;
        }

        const channels = this.configManager.getChannels();
        if (channels.length === 0) {
            this.statusBarItem.text = '$(pulse) Health Watch: No channels';
            this.statusBarItem.tooltip = 'No monitoring channels configured';
            this.statusBarItem.backgroundColor = undefined;
            this.statusBarItem.show();
            return;
        }

        const states = this.scheduler.getChannelRunner().getChannelStates();
        const worstState = this.getWorstState(states);
        const currentWatch = this.storageManager.getCurrentWatch();

        let text: string;
        let tooltip: string;
        let backgroundColor: vscode.ThemeColor | undefined;

        if (currentWatch?.isActive) {
            const remaining = this.formatWatchRemaining(currentWatch);
            text = `$(eye) Watch: ${remaining} | ${this.getStateIcon(worstState)} ${worstState}`;
            tooltip = this.buildWatchTooltip(currentWatch, states);
        } else {
            text = `${this.getStateIcon(worstState)} Health Watch: ${worstState}`;
            tooltip = this.buildTooltip(states);
        }

        // Set background color for critical states
        if (worstState === 'offline') {
            backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        } else if (worstState === 'unknown') {
            backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        } else {
            backgroundColor = undefined;
        }

        this.statusBarItem.text = text;
        this.statusBarItem.tooltip = tooltip;
        this.statusBarItem.backgroundColor = backgroundColor;
        this.statusBarItem.show();
    }

    private getWorstState(states: Map<string, any>): 'online' | 'offline' | 'unknown' {
        let hasOffline = false;
        let hasUnknown = false;

        for (const state of states.values()) {
            if (state.state === 'offline') {
                hasOffline = true;
            } else if (state.state === 'unknown') {
                hasUnknown = true;
            }
        }

        if (hasOffline) {return 'offline';}
        if (hasUnknown) {return 'unknown';}
        return 'online';
    }

    private getStateIcon(state: string): string {
        switch (state) {
            case 'online': return '$(check)';
            case 'offline': return '$(error)';
            case 'unknown': return '$(question)';
            default: return '$(pulse)';
        }
    }

    private formatWatchRemaining(watch: any): string {
        if (watch.duration === 'forever') {
            return 'Forever';
        }

        const durationMs = this.parseDuration(watch.duration);
        const elapsed = Date.now() - watch.startTime;
        const remaining = Math.max(0, durationMs - elapsed);

        if (remaining === 0) {
            return 'Ending...';
        }

        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    }

    private parseDuration(duration: string | number): number {
        if (typeof duration === 'number') {
            return duration;
        }

        switch (duration) {
            case '1h': return 60 * 60 * 1000;
            case '12h': return 12 * 60 * 60 * 1000;
            case 'forever': return Number.MAX_SAFE_INTEGER;
            default: return 60 * 60 * 1000;
        }
    }

    private buildTooltip(states: Map<string, any>): string {
        const channels = this.configManager.getChannels();
        const lines: string[] = ['Health Watch Status'];
        lines.push('');

        if (channels.length === 0) {
            lines.push('No channels configured');
            return lines.join('\n');
        }

        const summary = this.buildSummary(states);
        lines.push(`Summary: ${summary}`);
        lines.push('');

        for (const channel of channels) {
            const state = states.get(channel.id);
            if (!state) {continue;}

            const icon = this.getStateIcon(state.state);
            const name = channel.name || channel.id;
            const latency = state.lastSample?.latencyMs 
                ? ` (${state.lastSample.latencyMs}ms)`
                : '';
            
            lines.push(`${icon} ${name}: ${state.state}${latency}`);
        }

        lines.push('');
        lines.push('Click to view details');

        return lines.join('\n');
    }

    private buildWatchTooltip(watch: any, states: Map<string, any>): string {
        const lines: string[] = ['Active Watch'];
        lines.push('');

        const duration = watch.duration === 'forever' 
            ? 'Forever' 
            : this.formatWatchRemaining(watch);
        lines.push(`Duration: ${duration}`);
        lines.push(`Started: ${new Date(watch.startTime).toLocaleTimeString()}`);
        lines.push('');

        const summary = this.buildSummary(states);
        lines.push(`Current Status: ${summary}`);
        lines.push('');
        lines.push('Click to view details');

        return lines.join('\n');
    }

    private buildSummary(states: Map<string, any>): string {
        let online = 0;
        let offline = 0;
        let unknown = 0;

        for (const state of states.values()) {
            switch (state.state) {
                case 'online': online++; break;
                case 'offline': offline++; break;
                case 'unknown': unknown++; break;
            }
        }

        const parts: string[] = [];
        if (online > 0) {parts.push(`${online} online`);}
        if (offline > 0) {parts.push(`${offline} offline`);}
        if (unknown > 0) {parts.push(`${unknown} unknown`);}

        return parts.join(', ') || 'No channels';
    }

    dispose() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
        }
        this.statusBarItem.dispose();
    }
}