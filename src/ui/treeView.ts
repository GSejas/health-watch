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
        
        // Enhanced state display with emojis
        if (this.channelInfo.isPaused) {
            parts.push('⏸️ PAUSED');
        } else if (this.channelInfo.isRunning) {
            parts.push('🔄 RUNNING');
        } else {
            const stateEmoji = this.channelInfo.state === 'online' ? '🟢' :
                             this.channelInfo.state === 'offline' ? '🔴' : '🟡';
            parts.push(stateEmoji);
        }
        
        // Enhanced latency display with formatting
        if (this.channelInfo.lastLatency !== undefined) {
            const latency = this.channelInfo.lastLatency;
            const latencyDisplay = latency < 100 ? `✓ ${latency}ms` :
                                  latency < 300 ? `⚠️ ${latency}ms` :
                                  `❌ ${latency}ms`;
            parts.push(latencyDisplay);
        }
        
        // Enhanced next probe display
        if (this.channelInfo.nextProbe && !this.channelInfo.isPaused) {
            const diffMs = this.channelInfo.nextProbe - Date.now();
            if (diffMs > 0) {
                const diffSec = Math.ceil(diffMs / 1000);
                parts.push(`${diffSec}s`);
            } else {
                parts.push('⚡ Now');
            }
        }
        
        return parts.join(' ');
    }

    private getIcon(): vscode.ThemeIcon {
        // Priority-based icon selection for better visual feedback
        if (this.channelInfo.isPaused) {
            return new vscode.ThemeIcon('debug-pause', new vscode.ThemeColor('debugIcon.pauseForeground'));
        }
        
        if (this.channelInfo.isRunning) {
            return new vscode.ThemeIcon('sync~spin', new vscode.ThemeColor('progressBar.background'));
        }
        
        // Enhanced state-based icons with improved colors
        switch (this.channelInfo.state) {
            case 'online':
                return new vscode.ThemeIcon('check-all', new vscode.ThemeColor('charts.green'));
            case 'offline':
                return new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'));
            case 'unknown':
                return new vscode.ThemeIcon('question', new vscode.ThemeColor('charts.yellow'));
            default:
                return new vscode.ThemeIcon('pulse', new vscode.ThemeColor('charts.blue'));
        }
    }

    private getContextValue(): string {
        const parts = ['channel'];
        
        // Add state-based context values for enhanced menu options
        if (this.channelInfo.isPaused) {
            parts.push('paused');
        } else if (this.channelInfo.isRunning) {
            parts.push('running');
        } else {
            parts.push('idle');
        }
        
        // Add state-based context for conditional menus
        parts.push(this.channelInfo.state);
        
        // Add type-based context for type-specific actions
        parts.push(this.channelInfo.type);
        
        return parts.join('-');
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
        vscode.window.showInformationMessage(`⏹️ Channel '${channelId}' stopped`);
    }
    
    /**
     * Toggle channel enabled/disabled state in configuration
     */
    async toggleChannelEnabled(channelId: string): Promise<void> {
        try {
            const channels = this.configManager.getChannels();
            const channelIndex = channels.findIndex(ch => ch.id === channelId);
            
            if (channelIndex === -1) {
                throw new Error(`Channel '${channelId}' not found in configuration`);
            }
            
            const currentChannel = channels[channelIndex];
            const newEnabledState = !(currentChannel.enabled !== false); // Default to enabled if not specified
            
            // Update the channel configuration
            const updatedChannel = { ...currentChannel, enabled: newEnabledState };
            
            // This would require config manager to support updating individual channels
            // For now, show a message directing user to edit config file
            const action = newEnabledState ? 'enabled' : 'disabled';
            const emoji = newEnabledState ? '✅' : '🚫';
            
            vscode.window.showInformationMessage(
                `${emoji} Channel '${channelId}' ${action}. ` +
                `Note: To persist this change, edit your .healthwatch.json configuration file.`,
                'Open Config'
            ).then(selection => {
                if (selection === 'Open Config') {
                    this.openConfigurationFile();
                }
            });
            
            // Apply the change temporarily to the scheduler
            if (newEnabledState) {
                this.scheduler.resumeChannel(channelId);
            } else {
                this.scheduler.pauseChannel(channelId);
            }
            
            this.refresh();
            
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to toggle channel '${channelId}': ${error}`);
        }
    }
    
    /**
     * Open the configuration file for editing
     */
    async openConfigurationFile(): Promise<void> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                vscode.window.showWarningMessage('No workspace folder open. Cannot locate configuration file.');
                return;
            }
            
            const configPath = vscode.Uri.joinPath(workspaceFolder.uri, '.healthwatch.json');
            
            try {
                // Try to open existing config file
                const document = await vscode.workspace.openTextDocument(configPath);
                await vscode.window.showTextDocument(document);
            } catch {
                // Config file doesn't exist, offer to create it
                const createConfig = await vscode.window.showInformationMessage(
                    'Configuration file .healthwatch.json not found. Create it?',
                    'Create Configuration',
                    'Cancel'
                );
                
                if (createConfig === 'Create Configuration') {
                    await this.createDefaultConfigurationFile(configPath);
                }
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to open configuration: ${error}`);
        }
    }
    
    /**
     * Create a default configuration file with current channels
     */
    private async createDefaultConfigurationFile(configPath: vscode.Uri): Promise<void> {
        try {
            const defaultConfig = {
                "$schema": "./resources/schema/vscode-healthwatch.schema.json",
                "version": "1.0",
                "defaults": {
                    "intervalSec": 60,
                    "timeoutMs": 3000,
                    "threshold": 3,
                    "jitterPct": 10
                },
                "channels": [
                    {
                        "id": "example-https",
                        "name": "Example HTTPS",
                        "type": "https",
                        "url": "https://httpbin.org/status/200",
                        "enabled": true,
                        "expect": {
                            "statusRange": [200, 299]
                        }
                    },
                    {
                        "id": "example-dns",
                        "name": "Example DNS",
                        "type": "dns",
                        "hostname": "google.com",
                        "enabled": true
                    }
                ]
            };
            
            const configContent = JSON.stringify(defaultConfig, null, 2);
            await vscode.workspace.fs.writeFile(configPath, Buffer.from(configContent, 'utf8'));
            
            // Open the newly created file
            const document = await vscode.workspace.openTextDocument(configPath);
            await vscode.window.showTextDocument(document);
            
            vscode.window.showInformationMessage(
                '✓ Created default configuration file. Customize it for your monitoring needs!'
            );
            
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create configuration file: ${error}`);
        }
    }
    
    /**
     * Show detailed channel information
     */
    async showChannelDetails(channelId: string): Promise<void> {
        try {
            const channels = this.configManager.getChannels();
            const channel = channels.find(ch => ch.id === channelId);
            const state = this.scheduler.getChannelRunner().getChannelStates().get(channelId);
            const scheduleInfo = this.scheduler.getScheduleInfo().get(channelId);
            
            if (!channel) {
                throw new Error(`Channel '${channelId}' not found`);
            }
            
            // Create detailed information panel
            const panel = vscode.window.createWebviewPanel(
                'channelDetails',
                `Channel Details: ${channel.name || channel.id}`,
                vscode.ViewColumn.Two,
                { enableScripts: false }
            );
            
            panel.webview.html = this.generateChannelDetailsHTML(channel, state, scheduleInfo);
            
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to show channel details: ${error}`);
        }
    }
    
    private generateChannelDetailsHTML(channel: any, state: any, schedule: any): string {
        const stateIcon = state?.state === 'online' ? '🟢' :
                         state?.state === 'offline' ? '🔴' : '🟡';
        
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        color: var(--vscode-foreground);
                        background: var(--vscode-editor-background);
                        padding: 20px;
                        line-height: 1.5;
                    }
                    .header {
                        border-bottom: 2px solid var(--vscode-panel-border);
                        padding-bottom: 15px;
                        margin-bottom: 20px;
                    }
                    .status {
                        font-size: 24px;
                        font-weight: bold;
                        margin-bottom: 10px;
                    }
                    .section {
                        background: var(--vscode-textBlockQuote-background);
                        border-radius: 8px;
                        padding: 15px;
                        margin-bottom: 15px;
                        border-left: 4px solid var(--vscode-charts-blue);
                    }
                    .section h3 {
                        margin: 0 0 10px 0;
                        color: var(--vscode-charts-blue);
                    }
                    .property {
                        display: flex;
                        justify-content: space-between;
                        margin: 8px 0;
                        padding: 4px 0;
                        border-bottom: 1px dotted var(--vscode-panel-border);
                    }
                    .property:last-child {
                        border-bottom: none;
                    }
                    .label { font-weight: bold; }
                    .value { color: var(--vscode-descriptionForeground); }
                    .online { color: var(--vscode-charts-green); }
                    .offline { color: var(--vscode-charts-red); }
                    .unknown { color: var(--vscode-charts-yellow); }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="status">
                        ${stateIcon} ${channel.name || channel.id}
                    </div>
                    <div class="${state?.state || 'unknown'}">
                        Status: ${(state?.state || 'unknown').toUpperCase()}
                    </div>
                </div>
                
                <div class="section">
                    <h3>🔧 Configuration</h3>
                    <div class="property">
                        <span class="label">ID:</span>
                        <span class="value">${channel.id}</span>
                    </div>
                    <div class="property">
                        <span class="label">Type:</span>
                        <span class="value">${channel.type}</span>
                    </div>
                    <div class="property">
                        <span class="label">Target:</span>
                        <span class="value">${channel.url || channel.hostname || channel.target || 'N/A'}</span>
                    </div>
                    <div class="property">
                        <span class="label">Enabled:</span>
                        <span class="value">${channel.enabled !== false ? '✓ Yes' : '✗ No'}</span>
                    </div>
                    ${channel.intervalSec ? `
                    <div class="property">
                        <span class="label">Interval:</span>
                        <span class="value">${channel.intervalSec}s</span>
                    </div>
                    ` : ''}
                </div>
                
                <div class="section">
                    <h3>📈 Current State</h3>
                    <div class="property">
                        <span class="label">State:</span>
                        <span class="value ${state?.state || 'unknown'}">${(state?.state || 'unknown').toUpperCase()}</span>
                    </div>
                    ${state?.lastSample ? `
                    <div class="property">
                        <span class="label">Last Latency:</span>
                        <span class="value">${state.lastSample.latencyMs || 'N/A'}ms</span>
                    </div>
                    <div class="property">
                        <span class="label">Last Check:</span>
                        <span class="value">${new Date(state.lastSample.timestamp).toLocaleString()}</span>
                    </div>
                    <div class="property">
                        <span class="label">Success:</span>
                        <span class="value">${state.lastSample.ok ? '✓ Yes' : '✗ No'}</span>
                    </div>
                    ` : ''}
                </div>
                
                <div class="section">
                    <h3>⏰ Schedule</h3>
                    <div class="property">
                        <span class="label">Paused:</span>
                        <span class="value">${schedule?.isPaused ? '✓ Yes' : '✗ No'}</span>
                    </div>
                    ${schedule?.nextRun ? `
                    <div class="property">
                        <span class="label">Next Probe:</span>
                        <span class="value">${new Date(schedule.nextRun).toLocaleString()}</span>
                    </div>
                    ` : ''}
                </div>
            </body>
            </html>
        `;
    }

    dispose() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
        }
        this._onDidChangeTreeData.dispose();
    }
}