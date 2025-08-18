import * as vscode from 'vscode';
import { ConfigManager } from '../config';
import { StorageManager } from '../storage';
import { Scheduler } from '../runner/scheduler';
import { ChannelInfo } from '../types';

export class ChannelTreeItem extends vscode.TreeItem {
    constructor(
        public readonly channelInfo: ChannelInfo,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
    ) {
        super(channelInfo.name || channelInfo.id, collapsibleState);
        
        this.tooltip = this.buildTooltip();
        this.description = this.buildDescription();
        this.iconPath = this.getIcon();
        this.contextValue = this.getContextValue();
        this.id = channelInfo.id;
    }

    private buildTooltip(): string {
        const lines: string[] = [];
        lines.push(this.channelInfo.name || this.channelInfo.id);
        lines.push(`Type: ${this.channelInfo.type}`);
        lines.push(`State: ${this.channelInfo.state}`);
        
        if (this.channelInfo.description) {
            lines.push(`Description: ${this.channelInfo.description}`);
        }
        
        if (this.channelInfo.lastLatency !== undefined) {
            lines.push(`Last Latency: ${this.channelInfo.lastLatency}ms`);
        }
        
        if (this.channelInfo.nextProbe) {
            const nextProbeTime = new Date(this.channelInfo.nextProbe);
            const now = new Date();
            const diffMs = this.channelInfo.nextProbe - now.getTime();
            
            if (diffMs > 0) {
                const diffSec = Math.ceil(diffMs / 1000);
                lines.push(`Next probe: ${diffSec}s`);
            } else {
                lines.push('Next probe: Now');
            }
        }
        
        if (this.channelInfo.isPaused) {
            lines.push('Status: PAUSED');
        }
        
        return lines.join('\n');
    }

    private buildDescription(): string {
        const parts: string[] = [];
        
        if (this.channelInfo.isPaused) {
            parts.push('PAUSED');
        } else {
            parts.push(this.channelInfo.state.toUpperCase());
        }
        
        if (this.channelInfo.lastLatency !== undefined) {
            parts.push(`${this.channelInfo.lastLatency}ms`);
        }
        
        if (this.channelInfo.nextProbe && !this.channelInfo.isPaused) {
            const diffMs = this.channelInfo.nextProbe - Date.now();
            if (diffMs > 0) {
                const diffSec = Math.ceil(diffMs / 1000);
                parts.push(`${diffSec}s`);
            }
        }
        
        return parts.join(' | ');
    }

    private getIcon(): vscode.ThemeIcon {
        if (this.channelInfo.isPaused) {
            return new vscode.ThemeIcon('debug-pause');
        }
        
        if (this.channelInfo.isRunning) {
            return new vscode.ThemeIcon('loading~spin');
        }
        
        switch (this.channelInfo.state) {
            case 'online':
                return new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'));
            case 'offline':
                return new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'));
            case 'unknown':
                return new vscode.ThemeIcon('question', new vscode.ThemeColor('testing.iconSkipped'));
            default:
                return new vscode.ThemeIcon('pulse');
        }
    }

    private getContextValue(): string {
        if (this.channelInfo.isPaused) {
            return 'channel-paused';
        }
        
        if (this.channelInfo.isRunning) {
            return 'channel-running';
        }
        
        return 'channel-idle';
    }
}

export class ChannelTreeProvider implements vscode.TreeDataProvider<ChannelTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ChannelTreeItem | undefined | null | void> = new vscode.EventEmitter<ChannelTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ChannelTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private configManager = ConfigManager.getInstance();
    private storageManager = StorageManager.getInstance();
    private scheduler: Scheduler;
    private refreshTimer?: NodeJS.Timeout;

    constructor(scheduler: Scheduler) {
        this.scheduler = scheduler;
        this.setupEventListeners();
        this.startPeriodicRefresh();
    }

    private setupEventListeners() {
        this.scheduler.on('stateChange', () => {
            this.refresh();
        });

        this.scheduler.on('sample', () => {
            this.refresh();
        });

        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('healthWatch')) {
                this.refresh();
            }
        });
    }

    private startPeriodicRefresh() {
        // Refresh every 5 seconds to update next probe times
        this.refreshTimer = setInterval(() => {
            this.refresh();
        }, 5000);
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ChannelTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ChannelTreeItem): Thenable<ChannelTreeItem[]> {
        if (!this.configManager.isEnabled()) {
            return Promise.resolve([]);
        }

        if (element) {
            // No nested items for now
            return Promise.resolve([]);
        }

        return Promise.resolve(this.getChannelItems());
    }

    private getChannelItems(): ChannelTreeItem[] {
        const channels = this.configManager.getChannels();
        const states = this.scheduler.getChannelRunner().getChannelStates();
        const scheduleInfo = this.scheduler.getScheduleInfo();
        
        return channels.map(channel => {
            const state = states.get(channel.id);
            const schedule = scheduleInfo.get(channel.id);
            
            const channelInfo: ChannelInfo = {
                id: channel.id,
                name: channel.name,
                description: channel.description,
                type: channel.type,
                state: state?.state || 'unknown',
                lastLatency: state?.lastSample?.latencyMs,
                nextProbe: schedule?.nextRun,
                isPaused: schedule?.isPaused || false,
                isRunning: this.scheduler.getChannelRunner().isChannelRunning(channel.id)
            };
            
            return new ChannelTreeItem(channelInfo);
        });
    }

    async runChannel(channelId: string): Promise<void> {
        try {
            await this.scheduler.runChannelNow(channelId);
            vscode.window.showInformationMessage(`Channel '${channelId}' probe completed`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to run channel '${channelId}': ${error}`);
        }
    }

    pauseChannel(channelId: string): void {
        this.scheduler.pauseChannel(channelId);
        this.refresh();
        vscode.window.showInformationMessage(`Channel '${channelId}' paused`);
    }

    resumeChannel(channelId: string): void {
        this.scheduler.resumeChannel(channelId);
        this.refresh();
        vscode.window.showInformationMessage(`Channel '${channelId}' resumed`);
    }

    stopChannel(channelId: string): void {
        this.scheduler.stopChannel(channelId);
        this.refresh();
        vscode.window.showInformationMessage(`Channel '${channelId}' stopped`);
    }

    dispose() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
        }
        this._onDidChangeTreeData.dispose();
    }
}