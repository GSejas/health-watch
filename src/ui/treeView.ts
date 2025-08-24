import * as vscode from 'vscode';
import { ConfigManager } from '../config';
import { StorageManager } from '../storage';
import { Scheduler } from '../runner/scheduler';
import { ChannelInfo } from '../types';
import { TerminologyMap, MarketingCopy } from '../terminology/semanticMapping';

/**
 * ChannelTreeItem
 *
 * File header:
 *   /c:/Users/delir/Documents/repos/lossy/health-watch/src/ui/treeView.ts
 *
 * Summary:
 *   A VS Code TreeItem that represents a monitored "channel" in the extension's tree view.
 *   This class wraps a ChannelInfo model and computes presentation details used by the UI:
 *   - label (inherited via TreeItem constructor)
 *   - tooltip (multi-line information)
 *   - description (compact, emoji-enhanced status text)
 *   - iconPath (ThemeIcon selected by priority and state)
 *   - contextValue (composite string used to control context menu actions)
 *
 * Behavior:
 *   - The primary identity for the tree item is channelInfo.name || channelInfo.id.
 *   - Tooltip is built as multiple lines and contains name/id, type, state, optional description,
 *     last latency (if available), next probe countdown (relative seconds or "Now"), and a paused
 *     status marker when the channel is paused.
 *   - Description is a single-line, space-delimited summary combining:
 *       * A state indicator (paused/running/emoji by connectivity state)
 *       * A latency display that uses check/warning/error emojis depending on thresholds
 *       * A next-probe countdown (seconds) or immediate indicator when due
 *     The description is intended for quick at-a-glance readability in the tree view.
 *   - Icon selection is priority-driven:
 *       * paused state overrides all and maps to a pause icon/color
 *       * running maps to a spinning sync icon
 *       * otherwise the connectivity state (online/offline/unknown/default) maps to semantic icons
 *     ThemeColors are used so icons adapt to editor themes.
 *   - contextValue is a deterministic, hyphen-separated string that encodes:
 *       ['channel', primary-state (paused|running|idle), connectivity-state (online|offline|unknown|...), channel-type]
 *     Examples: "channel-idle-online-https", "channel-paused-offline-tcp".
 *     This enables fine-grained conditional context menu contributions in package.json.
 *
 * Constructor:
 *   @param channelInfo - The source data describing the channel (id, name, type, state, latencies, probes, flags).
 *   @param collapsibleState - Optional vscode.TreeItemCollapsibleState (defaults to None).
 *
 * Notes and implementation details:
 *   - Time calculations for nextProbe use Date arithmetic; nextProbe values are treated as epoch ms.
 *   - Latency thresholds used in the description are:
 *       * < 100ms : success/check mark
 *       * < 300ms : warning
 *       * >= 300ms : error
 *   - TerminologyMap is referenced for localized/centralized labels and icon strings; it is assumed to be available
 *     in the surrounding module.
 *   - All presentation logic is pure derived data from channelInfo and is safe to call repeatedly for UI refreshes.
 *
 * Example:
 *   const item = new ChannelTreeItem(channelInfo, vscode.TreeItemCollapsibleState.None);
 *
 * @public
 */
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
            lines.push(`Status: ${TerminologyMap.UserActions.pauseChannel.new.toUpperCase()}`);
        }
        
        return lines.join('\n');
    }

    private buildDescription(): string {
        const parts: string[] = [];
        
        // Enhanced state display with emojis
        if (this.channelInfo.isPaused) {
            parts.push(`⏸️ ${TerminologyMap.UserActions.pauseChannel.new.toUpperCase()}`);
        } else if (this.channelInfo.isRunning) {
            parts.push('🔄 RUNNING');
        } else {
            const stateEmoji = this.channelInfo.state === 'online' ? TerminologyMap.ServiceStates.online.icon :
                             this.channelInfo.state === 'offline' ? TerminologyMap.ServiceStates.offline.icon : 
                             TerminologyMap.ServiceStates.unknown.icon;
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
        
        // Add primary state context (idle, paused, running)
        if (this.channelInfo.isPaused) {
            parts.push('paused');
        } else if (this.channelInfo.isRunning) {
            parts.push('running');
        } else {
            parts.push('idle');
        }
        
        // Add connectivity state for conditional menus
        parts.push(this.channelInfo.state);
        
        // Add type for type-specific actions
        parts.push(this.channelInfo.type);
        
        // Final contextValue format: channel-{primary-state}-{connectivity-state}-{type}
        // Examples: channel-idle-online-https, channel-paused-offline-tcp, channel-running-unknown-dns
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

    // Map channelId -> location in config file { uri, line }
    private configLocations: Map<string, { uri: vscode.Uri; line: number }> = new Map();
    private disposables: vscode.Disposable[] = [];

    constructor(scheduler: Scheduler) {
        this.scheduler = scheduler;
        this.setupEventListeners();
        this.startPeriodicRefresh();
        // Parse config immediately and register command to open channel config
        this.parseConfigFile().catch(() => {});

        // Register command to open a channel's config location
        const cmd = vscode.commands.registerCommand('healthWatch.openChannelConfig', async (channelId: string) => {
            await this.openChannelConfig(channelId);
        });
        this.disposables.push(cmd);
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

        // Re-parse the config when the config file is opened or changed
        this.disposables.push(vscode.workspace.onDidOpenTextDocument(async (doc) => {
            if (doc && doc.fileName.endsWith('.healthwatch.json')) {
                await this.parseConfigFile();
                this.refresh();
            }
        }));

        this.disposables.push(vscode.workspace.onDidChangeTextDocument(async (e) => {
            if (e.document && e.document.fileName.endsWith('.healthwatch.json')) {
                await this.parseConfigFile();
                this.refresh();
            }
        }));
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
            
            const item = new ChannelTreeItem(channelInfo);
            // Make the tree item clickable to open the channel config at the stored location
            item.command = {
                command: 'healthWatch.openChannelConfig',
                title: 'Open Channel Config',
                arguments: [channel.id]
            };

            return item;
        });
    }

    /**
     * Parse workspace .healthwatch.json and cache a mapping of channelId -> {uri, line}
     * Attempts to locate the channel object's starting line by finding the "id" property
     * and scanning backwards for the opening '{'. This is heuristic but reliable for
     * standard formatted JSON files.
     */
    private async parseConfigFile(): Promise<void> {
        this.configLocations.clear();

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) return;

        const configUri = vscode.Uri.joinPath(workspaceFolder.uri, '.healthwatch.json');
        try {
            const doc = await vscode.workspace.openTextDocument(configUri);
            const text = doc.getText();
            const lines = text.split(/\r?\n/);

            const channels = this.configManager.getChannels();
            for (const ch of channels) {
                const needle = `"id": "${ch.id}"`;
                const idx = lines.findIndex(l => l.includes(needle));
                if (idx === -1) {
                    this.configLocations.delete(ch.id);
                    continue;
                }

                // scan backwards to find a preceding line that starts an object
                let start = idx;
                while (start > 0 && !lines[start].trim().startsWith('{')) {
                    start--;
                }

                const startLine = Math.max(1, start + 1); // 1-based line number
                this.configLocations.set(ch.id, { uri: configUri, line: startLine });
            }
        } catch (error) {
            // ignore - file may not exist; leave map empty
            this.configLocations.clear();
        }
    }

    /**
     * Open the configuration file at the cached line for a channel, or fallback to opening the config file
     */
    async openChannelConfig(channelId: string): Promise<void> {
        const loc = this.configLocations.get(channelId);
        if (loc) {
            try {
                const doc = await vscode.workspace.openTextDocument(loc.uri);
                const editor = await vscode.window.showTextDocument(doc);
                const line = Math.max(0, loc.line - 1);
                const range = new vscode.Range(line, 0, line, 0);
                editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
                editor.selection = new vscode.Selection(range.start, range.start);
                return;
            } catch (err) {
                // fallback below
            }
        }

        // fallback: open config file (create if missing)
        await this.openConfigurationFile();
        vscode.window.showInformationMessage(`Could not locate channel '${channelId}' exact position in .healthwatch.json; opened config instead.`);
    }

    async runChannel(channelId: string): Promise<void> {
        try {
            await this.scheduler.runChannelNow(channelId);
            vscode.window.showInformationMessage(`${TerminologyMap.DataEvents.sample.new} for '${channelId}' completed`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to run channel '${channelId}': ${error}`);
        }
    }

    pauseChannel(channelId: string): void {
        this.scheduler.pauseChannel(channelId);
        this.refresh();
        vscode.window.showInformationMessage(`${TerminologyMap.UserActions.pauseChannel.description.replace('this service', `'${channelId}'`)}`);
    }

    resumeChannel(channelId: string): void {
        this.scheduler.resumeChannel(channelId);
        this.refresh();
        vscode.window.showInformationMessage(`Resumed monitoring '${channelId}'`);
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
     * Show detailed channel information using proper React architecture
     */
    async showChannelDetails(channelId: string): Promise<void> {
        try {
            // Defensive: if channelId is falsy or invalid, prompt the user to pick one
            let targetId = channelId;
            const channels = this.configManager.getChannels();

            if (!targetId || !channels.find(ch => ch.id === targetId)) {
                if (!channels || channels.length === 0) {
                    vscode.window.showWarningMessage('No channels configured');
                    return;
                }

                const picks = channels.map(ch => ({ label: ch.name || ch.id, description: ch.type, channelId: ch.id }));
                const sel = await vscode.window.showQuickPick(picks, { placeHolder: 'Select channel to view details' });
                if (!sel) return;
                targetId = sel.channelId;
            }

            const channel = channels.find(ch => ch.id === targetId);
            const state = this.scheduler.getChannelRunner().getChannelStates().get(targetId as string);
            const scheduleInfo = this.scheduler.getScheduleInfo().get(targetId as string);
            const globalDefaults = this.configManager.getDefaults();

            if (!channel) {
                vscode.window.showErrorMessage(`Channel '${targetId}' not found`);
                return;
            }

            // Create detailed information panel with proper React architecture
            let panel: vscode.WebviewPanel;
            try {
                panel = vscode.window.createWebviewPanel(
                    'channelDetails',
                    `Channel Details: ${channel.name || channel.id}`,
                    vscode.ViewColumn.Two,
                    { 
                        enableScripts: true,
                        retainContextWhenHidden: true
                    }
                );
            } catch (err) {
                console.error('Failed to create webview panel for channel details:', err);
                vscode.window.showErrorMessage('Failed to open channel details panel (webview unavailable)');
                return;
            }

            // Use proper HTML generation with React and CSS security
            try {
                panel.webview.html = this.generateChannelDetailsHTML(channel, state, scheduleInfo, globalDefaults);
            } catch (err) {
                console.error('Failed to generate channel details HTML:', err);
                panel.dispose();
                vscode.window.showErrorMessage('Failed to render channel details');
                return;
            }

            // Handle messages from React components
            panel.webview.onDidReceiveMessage(async (message) => {
                switch (message.command) {
                    case 'runChannel':
                        await this.runChannel(message.channelId || targetId as string);
                        this.refreshChannelDetailsPanel(panel, targetId as string);
                        break;
                    case 'pauseChannel':
                        this.pauseChannel(message.channelId || targetId as string);
                        this.refreshChannelDetailsPanel(panel, targetId as string);
                        break;
                    case 'resumeChannel':
                        this.resumeChannel(message.channelId || targetId as string);
                        this.refreshChannelDetailsPanel(panel, targetId as string);
                        break;
                    case 'openConfig':
                        await this.openConfigurationFile();
                        break;
                    case 'viewLogs':
                        await this.showChannelLogs(message.channelId || targetId as string);
                        break;
                    case 'exportData':
                        await this.exportChannelData(message.channelId || targetId as string);
                        break;
                }
            });

        } catch (error) {
            console.error('Failed to show channel details:', error);
            vscode.window.showErrorMessage(`Failed to show channel details: ${error}`);
        }
    }
    
    /**
     * Refresh the channel details panel with updated data
     */
    private refreshChannelDetailsPanel(panel: vscode.WebviewPanel, channelId: string): void {
        const channels = this.configManager.getChannels();
        const channel = channels.find(ch => ch.id === channelId);
        const state = this.scheduler.getChannelRunner().getChannelStates().get(channelId);
        const scheduleInfo = this.scheduler.getScheduleInfo().get(channelId);
        const globalDefaults = this.configManager.getDefaults();
        
        if (channel) {
            panel.webview.html = this.generateChannelDetailsHTML(channel, state, scheduleInfo, globalDefaults);
        }
    }
    
    private generateChannelDetailsHTML(channel: any, state: any, schedule: any, globalDefaults: any = {}): string {
        const { generateChannelDetailsView } = require('./views/channelDetailsView');
        const { DASHBOARD_CSS } = require('./styles/index');
        
        // Generate nonce for CSP compliance
        const nonce = this.generateNonce();
        
        // Create view data following dashboard architecture
        const viewData = {
            channel,
            state,
            schedule,
            globalDefaults,
            baseCSS: DASHBOARD_CSS,
            baseScripts: '', // No base scripts needed for channel details
            nonce,
            cspSource: 'vscode-webview:', // Standard VS Code webview CSP source
            reactBundleUri: undefined // We'll implement this if needed
        };
        
        return generateChannelDetailsView(viewData);
    }
    
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
    
    
    /**
     * Show channel logs in output channel
     */
    private async showChannelLogs(channelId: string): Promise<void> {
        try {
            const storage = StorageManager.getInstance();
            const channelState = storage.getChannelState(channelId);
            const samples = channelState.samples.slice(-100); // Get last 100 samples
            
            const outputChannel = vscode.window.createOutputChannel(`Health Watch: ${channelId}`);
            outputChannel.clear();
            
            outputChannel.appendLine(`Channel Logs: ${channelId}`);
            outputChannel.appendLine(`Generated: ${new Date().toLocaleString()}`);
            outputChannel.appendLine('='.repeat(50));
            
            if (samples.length === 0) {
                outputChannel.appendLine('No samples found for this channel.');
            } else {
                outputChannel.appendLine(`Showing last ${samples.length} samples:\n`);
                
                samples.reverse().forEach((sample: any, index: number) => {
                    const timestamp = new Date(sample.timestamp).toLocaleString();
                    const status = sample.success ? '✅ SUCCESS' : '❌ FAILURE';
                    const latency = sample.latencyMs ? `${sample.latencyMs}ms` : 'N/A';
                    
                    outputChannel.appendLine(`[${timestamp}] ${status} - ${latency}`);
                    
                    if (sample.error) {
                        outputChannel.appendLine(`  Error: ${sample.error}`);
                    }
                    
                    if (sample.details) {
                        outputChannel.appendLine(`  Details: ${JSON.stringify(sample.details)}`);
                    }
                    
                    if (index < samples.length - 1) {
                        outputChannel.appendLine('');
                    }
                });
            }
            
            outputChannel.show();
            
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to show channel logs: ${error}`);
        }
    }
    
    /**
     * Export channel data as JSON
     */
    private async exportChannelData(channelId: string): Promise<void> {
        try {
            const storage = StorageManager.getInstance();
            const channelState = storage.getChannelState(channelId);
            const samples = channelState.samples.slice(-1000); // Get last 1000 samples
            const channels = this.configManager.getChannels();
            const channel = channels.find(ch => ch.id === channelId);
            
            const exportData = {
                channel: channel,
                exportedAt: new Date().toISOString(),
                sampleCount: samples.length,
                samples: samples
            };
            
            const exportJson = JSON.stringify(exportData, null, 2);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
            const filename = `health-watch-${channelId}-${timestamp}.json`;
            
            // Save to workspace or show save dialog
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (workspaceFolder) {
                const exportPath = vscode.Uri.joinPath(workspaceFolder.uri, filename);
                await vscode.workspace.fs.writeFile(exportPath, Buffer.from(exportJson, 'utf8'));
                
                const action = await vscode.window.showInformationMessage(
                    `Channel data exported to ${filename}`,
                    'Open File',
                    'Show in Explorer'
                );
                
                if (action === 'Open File') {
                    const document = await vscode.workspace.openTextDocument(exportPath);
                    await vscode.window.showTextDocument(document);
                } else if (action === 'Show in Explorer') {
                    await vscode.commands.executeCommand('revealFileInOS', exportPath);
                }
            } else {
                // Show save dialog if no workspace
                const saveUri = await vscode.window.showSaveDialog({
                    defaultUri: vscode.Uri.file(filename),
                    filters: {
                        'JSON files': ['json'],
                        'All files': ['*']
                    }
                });
                
                if (saveUri) {
                    await vscode.workspace.fs.writeFile(saveUri, Buffer.from(exportJson, 'utf8'));
                    vscode.window.showInformationMessage('Channel data exported successfully!');
                }
            }
            
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to export channel data: ${error}`);
        }
    }

    dispose() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
        }
        this._onDidChangeTreeData.dispose();
    for (const d of this.disposables) { d.dispose(); }
    }
}