import * as vscode from 'vscode';
import { StorageManager } from '../storage';
import { Scheduler } from '../runner/scheduler';
import { StatsCalculator } from '../stats';

export class StatusTreeItem extends vscode.TreeItem {
    constructor(
        label: string,
        value: string,
        collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None,
        description?: string,
        iconPath?: vscode.ThemeIcon
    ) {
        super(label, collapsibleState);
        
        this.description = description || value;
        this.tooltip = `${label}: ${value}`;
        this.iconPath = iconPath;
    }
}

export class StatusTreeDataProvider implements vscode.TreeDataProvider<StatusTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<StatusTreeItem | undefined | null | void> = new vscode.EventEmitter<StatusTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<StatusTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private storageManager = StorageManager.getInstance();
    private statsCalculator = new StatsCalculator();

    constructor(private scheduler: Scheduler) {
        // Refresh tree when data changes
        this.scheduler.on('stateChange', () => this.refresh());
        this.scheduler.on('sample', () => this.refresh());
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: StatusTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: StatusTreeItem): Thenable<StatusTreeItem[]> {
        if (!element) {
            return Promise.resolve(this.getStatusItems());
        }
        return Promise.resolve([]);
    }

    dispose(): void {
        // No cleanup needed currently
    }

    private getStatusItems(): StatusTreeItem[] {
        const items: StatusTreeItem[] = [];
        
        try {
            // Current watch status
            const currentWatch = this.storageManager.getCurrentWatch();
            if (currentWatch?.isActive) {
                const startedAt = new Date(currentWatch.startTime).toLocaleTimeString();
                const duration = typeof currentWatch.duration === 'string' 
                    ? currentWatch.duration 
                    : `${Math.round(currentWatch.duration / 60000)}m`;
                
                items.push(new StatusTreeItem(
                    'Active Watch',
                    `${duration} (started ${startedAt})`,
                    vscode.TreeItemCollapsibleState.None,
                    undefined,
                    new vscode.ThemeIcon('eye', new vscode.ThemeColor('charts.green'))
                ));
            } else {
                items.push(new StatusTreeItem(
                    'Watch Status',
                    'No active watch',
                    vscode.TreeItemCollapsibleState.None,
                    'Click "Start Watch" to begin monitoring',
                    new vscode.ThemeIcon('eye-closed', new vscode.ThemeColor('charts.gray'))
                ));
            }

            // Channel summary
            const channelStates = this.scheduler.getChannelRunner().getChannelStates();
            let online = 0, offline = 0, unknown = 0;
            
            for (const state of channelStates.values()) {
                switch (state.state) {
                    case 'online': online++; break;
                    case 'offline': offline++; break;
                    case 'unknown': unknown++; break;
                }
            }

            const total = online + offline + unknown;
            if (total > 0) {
                items.push(new StatusTreeItem(
                    'Channels',
                    `${total} configured`,
                    vscode.TreeItemCollapsibleState.None,
                    `${online} online, ${offline} offline, ${unknown} unknown`,
                    new vscode.ThemeIcon('radio-tower')
                ));

                // Overall health
                // const healthPercentage = total > 0 ? Math.round((online / total) * 100) : 0;
                // const healthIcon = healthPercentage >= 90 
                //     ? new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'))
                //     : healthPercentage >= 70
                //     ? new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.yellow'))
                //     : new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'));

                // items.push(new StatusTreeItem(
                //     'Overall Health',
                //     `${healthPercentage}%`,
                //     vscode.TreeItemCollapsibleState.None,
                //     `${online}/${total} channels online`,
                //     healthIcon
                // ));
            } else {
                items.push(new StatusTreeItem(
                    'Channels',
                    'None configured',
                    vscode.TreeItemCollapsibleState.None,
                    'Add a .healthwatch.json file to configure monitoring',
                    new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.yellow'))
                ));
            }

            // Stats for current watch or recent data
            if (currentWatch?.isActive && currentWatch.samples.size > 0) {
                let totalSamples = 0;
                let successfulSamples = 0;
                
                for (const samples of currentWatch.samples.values()) {
                    totalSamples += samples.length;
                    successfulSamples += samples.filter(s => s.success).length;
                }

                if (totalSamples > 0) {
                    const availability = Math.round((successfulSamples / totalSamples) * 100);
                    items.push(new StatusTreeItem(
                        'Session Availability',
                        `${availability}%`,
                        vscode.TreeItemCollapsibleState.None,
                        `${successfulSamples}/${totalSamples} samples successful`,
                        new vscode.ThemeIcon('graph')
                    ));

                    items.push(new StatusTreeItem(
                        'Total Samples',
                        totalSamples.toString(),
                        vscode.TreeItemCollapsibleState.None,
                        'Samples collected in current watch session',
                        new vscode.ThemeIcon('pulse')
                    ));
                }
            }

            // Quick actions (if no watch is active)
            if (!currentWatch?.isActive) {
                items.push(new StatusTreeItem(
                    'Quick Actions',
                    'Start monitoring',
                    vscode.TreeItemCollapsibleState.None,
                    'Click to access monitoring commands',
                    new vscode.ThemeIcon('play', new vscode.ThemeColor('charts.blue'))
                ));
            }

        } catch (error) {
            items.push(new StatusTreeItem(
                'Error',
                'Failed to load status',
                vscode.TreeItemCollapsibleState.None,
                error instanceof Error ? error.message : 'Unknown error',
                new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'))
            ));
        }

        return items;
    }
}