import * as vscode from 'vscode';
import { ConfigManager } from '../config';
import { StorageManager } from '../storage';
import { Scheduler } from '../runner/scheduler';
import { ChannelInfo, ChannelState } from '../types';
import { ChannelDefinition } from '../config';
import { TerminologyMap, MarketingCopy } from '../terminology/semanticMapping';
import { CoordinatedScheduler } from '../coordination/coordinatedScheduler';
import { InternetCheckService, InternetStatus } from '../services/internetCheckService';

export class StatusBarManager {
    private statusBarItem: vscode.StatusBarItem;
    private channelItems: Map<string, vscode.StatusBarItem> = new Map();
    private compactChannelsItem?: vscode.StatusBarItem;
    private debugStatusBarItem?: vscode.StatusBarItem;
    private coordinationStatusBarItem?: vscode.StatusBarItem;
    private configManager = ConfigManager.getInstance();
    private storageManager = StorageManager.getInstance();
    private scheduler: Scheduler;
    private updateTimer?: NodeJS.Timeout;
    private debugMode: boolean = false;
    private internetService?: InternetCheckService;
    private currentInternetStatus?: InternetStatus;
    private showCoordinationStatus: boolean = false;

    constructor(scheduler: Scheduler, internetService?: InternetCheckService) {
        this.scheduler = scheduler;
        this.internetService = internetService;
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left, 
            100
        );
        this.statusBarItem.command = 'healthWatch.internetOptions';
        this.setupEventListeners();
        this.createCoordinationStatusBarItem();
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

        // Listen for coordination changes if using CoordinatedScheduler
        if (this.scheduler instanceof CoordinatedScheduler) {
            this.scheduler.on('coordinationChanged', () => {
                this.updateStatusBar();
                this.updateCoordinationStatusBar();
            });
        }

        // Listen for internet status changes
        if (this.internetService) {
            this.internetService.on('statusChanged', (status: InternetStatus) => {
                this.currentInternetStatus = status;
                this.updateStatusBar();
            });

            this.internetService.on('sample', (status: InternetStatus) => {
                this.currentInternetStatus = status;
                this.updateStatusBar();
            });
        }
    }

    private startPeriodicUpdates() {
        // Update every 5 seconds to show countdown
        this.updateTimer = setInterval(() => {
            this.updateStatusBar();
            this.updateCoordinationStatusBar();
        }, 5000);
    }

    private createCoordinationStatusBarItem(): void {
        const config = vscode.workspace.getConfiguration('healthWatch.statusBar');
        this.showCoordinationStatus = config.get('showCoordination', false);
        
        if (!this.showCoordinationStatus || !(this.scheduler instanceof CoordinatedScheduler)) {
            return;
        }

        if (this.coordinationStatusBarItem) {
            this.coordinationStatusBarItem.dispose();
        }
        
        // Create coordination status item with lower priority than main item
        this.coordinationStatusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left, 
            98  // Lower priority than main item (100)
        );
        this.coordinationStatusBarItem.command = 'healthWatch.showCoordinationDetails';
        this.updateCoordinationStatusBar();
    }

    private updateCoordinationStatusBar(): void {
        if (!this.coordinationStatusBarItem || !this.showCoordinationStatus) {
            return;
        }

        if (!(this.scheduler instanceof CoordinatedScheduler)) {
            this.coordinationStatusBarItem.hide();
            return;
        }

        const coordinationManager = (this.scheduler as any)['coordinationManager'];
        
        if (!coordinationManager) {
            this.coordinationStatusBarItem.text = '❓ Coord';
            this.coordinationStatusBarItem.tooltip = 'Health Watch Coordination\n\nStatus: Manager not available';
            this.coordinationStatusBarItem.show();
            return;
        }

        const isEnabled = this.scheduler.isCoordinationEnabled();
        const isLeader = coordinationManager.isLeader?.() || false;
        const hasLock = coordinationManager.hasLock?.() || false;
        const instanceId = coordinationManager.getInstanceId?.() || 'unknown';

        let statusText: string;
        let statusTooltip: string;
        let backgroundColor: vscode.ThemeColor | undefined;

        if (!isEnabled) {
            // Single window mode
            statusText = '🔧 Solo';
            statusTooltip = 'Health Watch Coordination\n\nMode: Single Window\nAll monitoring is handled by this window';
            backgroundColor = undefined;
        } else {
            // Multi-window coordination active
            if (isLeader) {
                if (hasLock) {
                    statusText = '👑🔒 Master';
                    statusTooltip = 'Health Watch Coordination\n\nRole: Master (Leader)\nLock: Acquired ✅\nThis window is actively monitoring';
                    backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
                } else {
                    statusText = '👑🔓 Leader';
                    statusTooltip = 'Health Watch Coordination\n\nRole: Leader\nLock: Released ⚠️\nTrying to acquire lock...';
                    backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
                }
            } else {
                statusText = '👥 Follower';
                statusTooltip = 'Health Watch Coordination\n\nRole: Follower\nThis window is delegating monitoring to the master';
                backgroundColor = undefined;
            }
        }

        // Add instance info to tooltip
        statusTooltip += `\n\nInstance ID: ${instanceId.substring(0, 8)}...`;
        
        // Add timing information if available
        const nextElectionTime = coordinationManager.getNextElectionTime?.();
        if (nextElectionTime) {
            const remaining = Math.max(0, nextElectionTime - Date.now());
            if (remaining > 0) {
                const seconds = Math.ceil(remaining / 1000);
                statusTooltip += `\nNext election: ${seconds}s`;
            }
        }

        // Add heartbeat info if available
        const lastHeartbeat = coordinationManager.getLastHeartbeat?.();
        if (lastHeartbeat) {
            const heartbeatAge = Math.floor((Date.now() - lastHeartbeat) / 1000);
            statusTooltip += `\nLast heartbeat: ${heartbeatAge}s ago`;
        }

        statusTooltip += '\n\nClick for coordination details';

        this.coordinationStatusBarItem.text = statusText;
        this.coordinationStatusBarItem.tooltip = statusTooltip;
        this.coordinationStatusBarItem.backgroundColor = backgroundColor;
        this.coordinationStatusBarItem.show();
    }

    private updateStatusBar() {
        // Always show global internet indicator when enabled (base layer)
        this.updateGlobalInternetIndicator();
        
        // Add channel items based on mode (additional layer)
        const mode = this.getStatusBarMode();

        if (mode === 'none' || !this.configManager.isEnabled()) {
            this.disposeChannelItems();
            return;
        }

        if (mode === 'mini-multi-channel') {
            this.updateChannelItems();
            return;
        }

        if (mode === 'compact') {
            this.updateCompactItem();
            return;
        }

        // Default: minimal mode (no additional channel items)
        this.disposeChannelItems();
    }

    private updateGlobalInternetIndicator() {
        // Check if internet monitoring is enabled
        const internetConfig = vscode.workspace.getConfiguration('healthWatch.internet');
        const internetEnabled = internetConfig.get('enabled', true);
        
        if (!internetEnabled || !this.internetService) {
            this.statusBarItem.hide();
            return;
        }

        // Use internet service status
        const internetStatus = this.currentInternetStatus || this.internetService.getCurrentStatus();
        const statusIcon = this.getInternetStatusIcon(internetStatus.status);
        const currentWatch = this.storageManager.getCurrentWatch();

        let text: string;
        let tooltip: string;
        let backgroundColor: vscode.ThemeColor | undefined;

        // Build status bar text
        const latency = internetStatus.latencyMs ? `${internetStatus.latencyMs}ms` : '';

        if (currentWatch?.isActive) {
            const remaining = this.formatWatchRemaining(currentWatch);
            text = `${statusIcon}${latency ? ' ' + latency : ''} ${TerminologyMap.UILabels.statusBarActiveMonitoring}: ${remaining}`;
            tooltip = this.buildInternetServiceTooltip(internetStatus, currentWatch);
        } else {
            if (internetStatus.status === 'online' && latency) {
                text = `$(globe) ${latency}`;
            } else if (internetStatus.status === 'offline') {
                text = `$(globe) Offline`;
            } else if (internetStatus.status === 'captive') {
                text = `$(globe) $(shield) Sign-in`;
            } else {
                text = `$(globe) Unknown`;
            }
            tooltip = this.buildInternetServiceTooltip(internetStatus);
        }

        // Set background color for critical states
        if (internetStatus.status === 'offline') {
            backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        } else if (internetStatus.status === 'captive') {
            backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        } else if (internetStatus.status === 'unknown') {
            backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        } else {
            backgroundColor = undefined;
        }

        this.statusBarItem.text = text;
        this.statusBarItem.tooltip = tooltip;
        this.statusBarItem.backgroundColor = backgroundColor;
        this.statusBarItem.show();
        
        // Update debug status bar if enabled
        if (this.debugMode) {
            this.updateDebugStatusBar();
        }
    }

    private getStatusBarMode(): 'none' | 'minimal' | 'mini-multi-channel' | 'compact' {
        const cfg = vscode.workspace.getConfiguration('healthWatch.statusBar');
        const mode = cfg.get<string>('mode', 'minimal');
        if (mode === 'none' || mode === 'minimal' || mode === 'mini-multi-channel' || mode === 'compact') return mode as any;
        return 'minimal';
    }

    private updateCompactItem() {
        const channels = this.configManager.getChannels().filter((ch: ChannelDefinition) => ch.enabled !== false);
        const states = this.scheduler.getChannelRunner().getChannelStates() as Map<string, ChannelState>;
        const fmt = vscode.workspace.getConfiguration('healthWatch.statusBar.format');
        const showLatency = fmt.get<boolean>('showLatency', false);
        const separator = fmt.get<string>('separator', ':');
        const maxItems = fmt.get<number>('maxChannelItems', 6);
        const order = fmt.get<string>('order', 'explicit');

        // Filter channels that opted into status bar (same logic as multi)
        const mode = this.getStatusBarMode();
        let opted = channels.filter((ch: ChannelDefinition) => {
            if ((ch as ChannelDefinition).showInStatusBar === false) return false;
            if ((ch as ChannelDefinition).showInStatusBar === true) return true;
            return mode === 'mini-multi-channel' || mode === 'compact';
        });

        if (order === 'worst-first') {
            opted.sort((a: any, b: any) => {
                const sa = (states.get(a.id)?.state) || 'online';
                const sb = (states.get(b.id)?.state) || 'online';
                const rank = (s: string) => s === 'offline' ? 0 : s === 'unknown' ? 1 : 2;
                return rank(sa) - rank(sb);
            });
        }

        const display = opted.slice(0, maxItems);

        // Build compact text tokens with minimal spacing
        const tokens: string[] = [];
        for (const ch of display) {
            const state = states.get(ch.id) as ChannelState | undefined;
            const effectiveState: ChannelState = state ?? ({ state: 'unknown' } as ChannelState);
            const stateIcon = this.getCustomStatusIcon(effectiveState.state || 'unknown');
            const leftIcon = ch.icon || '$(server)';
            let token = `${leftIcon}${stateIcon}`;
            if (showLatency && effectiveState.lastSample?.latencyMs) {
                token += `${effectiveState.lastSample.latencyMs}ms`;
            }
            tokens.push(token);
        }

        // If there are more channels than maxItems, indicate truncation
        if (channels.length > display.length) {
            tokens.push('...');
        }

        // Create or update compact channels item (separate from global internet)
        if (!this.compactChannelsItem) {
            this.compactChannelsItem = vscode.window.createStatusBarItem(
                vscode.StatusBarAlignment.Left, 
                99  // Lower priority than main internet item
            );
            this.compactChannelsItem.command = 'healthWatch.openDashboard';
        }

        if (tokens.length > 0) {
            // Determine aggregated background color by worst displayed state
            let worst: 'online' | 'offline' | 'unknown' = 'online';
            for (const ch of display) {
                const s = states.get(ch.id);
                if (!s) { worst = worst === 'offline' ? 'offline' : 'unknown'; continue; }
                if (s.state === 'offline') { worst = 'offline'; break; }
                if (s.state === 'unknown' && worst !== 'offline') { worst = 'unknown'; }
            }

            let backgroundColor: vscode.ThemeColor | undefined;
            if (worst === 'offline') {
                backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
            } else if (worst === 'unknown') {
                backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            } else {
                backgroundColor = undefined;
            }

            // Tooltip with per-channel details
            const tooltip = this.buildTooltip(states as unknown as Map<string, any>);

            this.compactChannelsItem.text = tokens.join(' ');
            this.compactChannelsItem.tooltip = tooltip;
            this.compactChannelsItem.backgroundColor = backgroundColor;
            this.compactChannelsItem.show();
        } else {
            this.compactChannelsItem.hide();
        }
        
        // Update debug status bar if enabled
        if (this.debugMode) {
            this.updateDebugStatusBar();
        }
    }

    private updateChannelItems() {
    const channels = this.configManager.getChannels().filter((ch: ChannelDefinition) => ch.enabled !== false);
    const states = this.scheduler.getChannelRunner().getChannelStates() as Map<string, ChannelState>;
        const fmt = vscode.workspace.getConfiguration('healthWatch.statusBar.format');
        const showLatency = fmt.get<boolean>('showLatency', false);
        const separator = fmt.get<string>('separator', ':');
        const maxItems = fmt.get<number>('maxChannelItems', 6);
        const order = fmt.get<string>('order', 'explicit');

        // Filter channels that opted into status bar
        const mode = this.getStatusBarMode();
        let opted = channels.filter((ch: ChannelDefinition) => {
            // explicit false takes priority
            if ((ch as ChannelDefinition).showInStatusBar === false) return false;
            // explicit true honors preference
            if ((ch as ChannelDefinition).showInStatusBar === true) return true;
            // otherwise default to enabled only when global mode is mini-multi-channel
            return mode === 'mini-multi-channel';
        });

        // Order channels if requested
        if (order === 'worst-first') {
            opted.sort((a: any, b: any) => {
                const sa = (states.get(a.id)?.state) || 'online';
                    const sb = (states.get(b.id)?.state) || 'online';
                const rank = (s: string) => s === 'offline' ? 0 : s === 'unknown' ? 1 : 2;
                return rank(sa) - rank(sb);
            });
        }

        // Respect max items
        const display = opted.slice(0, maxItems);
        const displayIds = new Set(display.map((c: any) => c.id));

        // Create or update items
        let priority = 200; // start priority for channel items
        for (const ch of display) {
            let item = this.channelItems.get(ch.id);
            if (!item) {
                item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, priority);
                item.command = 'healthWatch.openDashboard';
                this.channelItems.set(ch.id, item);
            }

            const state = states.get(ch.id) as ChannelState | undefined;
            const effectiveState: ChannelState = state ?? ({ state: 'unknown' } as ChannelState);
            const stateIcon = this.getCustomStatusIcon(effectiveState.state || 'unknown');
            const leftIcon = ch.icon || '$(server)';
            let text = `${leftIcon}${separator}${stateIcon}`;
            if (showLatency && effectiveState.lastSample?.latencyMs) {
                text += `${effectiveState.lastSample.latencyMs}ms`;
            }

            item.text = text;
            item.tooltip = `${leftIcon} ${ch.name || ch.id}\nStatus: ${String(effectiveState.state).toUpperCase()}${effectiveState.lastSample?.latencyMs ? `\nLatency: ${effectiveState.lastSample.latencyMs}ms` : ''}\nClick to open dashboard`;

            if (effectiveState.state === 'offline') {
                item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
            } else if (effectiveState.state === 'unknown') {
                item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            } else {
                item.backgroundColor = undefined;
            }

            item.show();
            priority -= 1; // keep subsequent items ordered
        }

        // Dispose items that are no longer displayed
        for (const [id, itm] of Array.from(this.channelItems.entries())) {
            if (!displayIds.has(id)) {
                itm.dispose();
                this.channelItems.delete(id);
            }
        }
    }

    private disposeChannelItems() {
        for (const itm of this.channelItems.values()) {
            try { itm.dispose(); } catch (e) { /* ignore */ }
        }
        this.channelItems.clear();
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

    private getCustomStatusIcon(state: string): string {
        const config = vscode.workspace.getConfiguration('healthWatch.statusBar.icons');
        switch (state) {
            case 'online': return config.get('online', '$(check)');
            case 'offline': return config.get('offline', '$(error)');
            case 'unknown': return config.get('unknown', '$(question)');
            default: return config.get('unknown', '$(question)');
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
    const channels = this.configManager.getChannels().filter((ch: ChannelDefinition) => ch.enabled !== false);
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
        const lines: string[] = [TerminologyMap.MonitoringModes.intensive.new];
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
        if (online > 0) {parts.push(`${online} ${TerminologyMap.ServiceStates.online.new.toLowerCase()}`);}
        if (offline > 0) {parts.push(`${offline} ${TerminologyMap.ServiceStates.offline.new.toLowerCase()}`);}
        if (unknown > 0) {parts.push(`${unknown} ${TerminologyMap.ServiceStates.unknown.new.toLowerCase()}`);}

        return parts.join(', ') || 'No channels';
    }

    // Debug mode methods for multi-window coordination visibility
    toggleDebugMode(): void {
        this.debugMode = !this.debugMode;
        
        if (this.debugMode) {
            this.createDebugStatusBarItem();
            this.updateDebugStatusBar();
        } else {
            this.disposeDebugStatusBarItem();
        }
        
        console.log(`Health Watch debug mode: ${this.debugMode ? 'enabled' : 'disabled'}`);
    }

    private createDebugStatusBarItem(): void {
        if (this.debugStatusBarItem) {
            this.debugStatusBarItem.dispose();
        }
        
        // Create debug item to the right of main status bar item
        this.debugStatusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left, 
            99  // Just slightly lower priority than main item (100)
        );
        this.debugStatusBarItem.command = 'healthWatch.toggleDebugMode';
    }

    private updateDebugStatusBar(): void {
        if (!this.debugMode || !this.debugStatusBarItem) {
            return;
        }

        let debugText = '';
        let debugTooltip = 'Health Watch Debug Mode\n\n';
        
        if (this.scheduler instanceof CoordinatedScheduler) {
            const coordinationManager = (this.scheduler as any)['coordinationManager'];
            
            if (coordinationManager) {
                const isEnabled = this.scheduler.isCoordinationEnabled();
                const isLeader = coordinationManager.isLeader();
                const hasLock = coordinationManager.hasLock?.() || false;
                const instanceId = coordinationManager.getInstanceId?.() || 'unknown';
                
                // Build debug text with coordination status
                if (!isEnabled) {
                    debugText = '🔧 Solo';
                    debugTooltip += 'Coordination: Disabled (single window)\n';
                } else {
                    const roleIcon = isLeader ? '👑' : '👥';
                    const lockIcon = hasLock ? '🔒' : '🔓';
                    debugText = `${roleIcon}${lockIcon}`;
                    
                    debugTooltip += `Coordination: Enabled (multi-window)\n`;
                    debugTooltip += `Role: ${isLeader ? 'Leader' : 'Follower'}\n`;
                    debugTooltip += `Lock: ${hasLock ? 'Acquired' : 'Released'}\n`;
                    debugTooltip += `Instance: ${instanceId.substring(0, 8)}...\n`;
                }
                
                // Add timing information if available
                const nextElectionTime = coordinationManager.getNextElectionTime?.();
                if (nextElectionTime) {
                    const remaining = Math.max(0, nextElectionTime - Date.now());
                    if (remaining > 0) {
                        const seconds = Math.ceil(remaining / 1000);
                        debugTooltip += `Next election: ${seconds}s\n`;
                    }
                }
                
                // Add active channels count
                const channelStates = this.scheduler.getChannelRunner().getChannelStates();
                const activeChannels = Array.from(channelStates.values()).filter(state => state.state !== 'unknown').length;
                debugTooltip += `Active channels: ${activeChannels}\n`;
            } else {
                debugText = '❓ Coord';
                debugTooltip += 'Coordination: Manager not available\n';
            }
        } else {
            debugText = '🔧 Basic';
            debugTooltip += 'Coordination: Not using CoordinatedScheduler\n';
        }
        
        // Add current watch information
        const currentWatch = this.storageManager.getCurrentWatch();
        if (currentWatch?.isActive) {
            debugText += ' 🎯';
            debugTooltip += `\nWatch: Active (${currentWatch.duration})\n`;
            debugTooltip += `Started: ${new Date(currentWatch.startTime).toLocaleTimeString()}\n`;
        } else {
            debugTooltip += '\nWatch: Inactive\n';
        }
        
        debugTooltip += '\nClick to toggle debug mode';
        
        this.debugStatusBarItem.text = debugText;
        this.debugStatusBarItem.tooltip = debugTooltip;
        this.debugStatusBarItem.show();
    }

    private disposeDebugStatusBarItem(): void {
        if (this.debugStatusBarItem) {
            this.debugStatusBarItem.dispose();
            this.debugStatusBarItem = undefined;
        }
    }

    isDebugModeEnabled(): boolean {
        return this.debugMode;
    }

    /**
     * Get internet status icon for status bar
     */
    private getInternetStatusIcon(status: string): string {
        switch (status) {
            case 'online': return '$(globe)';
            case 'offline': return '$(globe)';
            case 'captive': return '$(shield)';
            case 'unknown': 
            default: return '$(globe)';
        }
    }

    /**
     * Build tooltip for internet service status
     */
    private buildInternetServiceTooltip(status: InternetStatus, currentWatch?: any): string {
        let tooltip = '';
        
        // Status line
        switch (status.status) {
            case 'online':
                tooltip += `✅ Internet: Connected`;
                if (status.latencyMs) {
                    tooltip += ` (${status.latencyMs}ms)`;
                }
                break;
            case 'offline':
                tooltip += `❌ Internet: Disconnected`;
                if (status.consecutiveFailures > 0) {
                    tooltip += `\nFailed ${status.consecutiveFailures} consecutive checks`;
                }
                break;
            case 'captive':
                tooltip += `⚠️ Internet: Captive Portal\nClick to open browser`;
                break;
            case 'unknown':
            default:
                tooltip += `❓ Internet: Status unknown\nChecking...`;
                break;
        }
        
        // Last check time
        if (status.timestamp) {
            const lastCheck = Math.floor((Date.now() - status.timestamp) / 1000);
            if (lastCheck < 60) {
                tooltip += `\nLast check: ${lastCheck}s ago`;
            } else {
                tooltip += `\nLast check: ${Math.floor(lastCheck / 60)}m ago`;
            }
        }
        
        // Target info
        if (status.target) {
            try {
                const url = new URL(status.target);
                tooltip += `\nTarget: ${url.hostname}`;
            } catch {
                tooltip += `\nTarget: ${status.target}`;
            }
        }
        
        // Error info
        if (status.error && status.status !== 'online') {
            tooltip += `\nError: ${status.error}`;
        }
        
        // Watch info
        if (currentWatch?.isActive) {
            tooltip += `\n\n🎯 Watch Active`;
            tooltip += `\nStarted: ${new Date(currentWatch.startTime).toLocaleString()}`;
            if (currentWatch.duration !== 'forever') {
                tooltip += `\nDuration: ${currentWatch.duration}`;
            }
        }
        
        // Actions
        tooltip += `\n\n🔄 Click for options`;
        
        return tooltip;
    }

    dispose() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
        }
        this.statusBarItem.dispose();
        this.disposeDebugStatusBarItem();
        this.disposeCoordinationStatusBarItem();
        this.disposeChannelItems();
        if (this.compactChannelsItem) {
            this.compactChannelsItem.dispose();
        }
    }

    private disposeCoordinationStatusBarItem(): void {
        if (this.coordinationStatusBarItem) {
            this.coordinationStatusBarItem.dispose();
            this.coordinationStatusBarItem = undefined;
        }
    }
}