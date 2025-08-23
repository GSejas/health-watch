import * as vscode from 'vscode';
import { ConfigManager } from '../config';
import { StorageManager } from '../storage';
import { Scheduler } from '../runner/scheduler';
import { ChannelInfo, ChannelState } from '../types';
import { ChannelDefinition } from '../config';
import { TerminologyMap, MarketingCopy } from '../terminology/semanticMapping';
import { CoordinatedScheduler } from '../coordination/coordinatedScheduler';

export class StatusBarManager {
    private statusBarItem: vscode.StatusBarItem;
    private channelItems: Map<string, vscode.StatusBarItem> = new Map();
    private debugStatusBarItem?: vscode.StatusBarItem;
    private configManager = ConfigManager.getInstance();
    private storageManager = StorageManager.getInstance();
    private scheduler: Scheduler;
    private updateTimer?: NodeJS.Timeout;
    private debugMode: boolean = false;

    constructor(scheduler: Scheduler) {
        this.scheduler = scheduler;
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left, 
            100
        );
        this.statusBarItem.command = 'healthWatch.openDashboard';
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

        // Listen for coordination changes if using CoordinatedScheduler
        if (this.scheduler instanceof CoordinatedScheduler) {
            this.scheduler.on('coordinationChanged', () => {
                this.updateStatusBar();
            });
        }
    }

    private startPeriodicUpdates() {
        // Update every 5 seconds to show countdown
        this.updateTimer = setInterval(() => {
            this.updateStatusBar();
        }, 5000);
    }

    private updateStatusBar() {
        // Determine mode (none | minimal | mini-multi-channel)
        const mode = this.getStatusBarMode();

        if (mode === 'none' || !this.configManager.isEnabled()) {
            // hide everything
            this.statusBarItem.hide();
            this.disposeChannelItems();
            return;
        }

        if (mode === 'mini-multi-channel') {
            // create/update per-channel items and hide global item
            this.statusBarItem.hide();
            this.updateChannelItems();
            return;
        }

        if (mode === 'compact') {
            // show a single compact status bar item that aggregates channels
            this.disposeChannelItems();
            this.updateCompactItem();
            return;
        }

        // Default: minimal mode (single global status item)
        this.disposeChannelItems();

        if (!this.getShowInternetSetting()) {
            this.statusBarItem.hide();
            return;
        }

    const channels = this.configManager.getChannels();
    const states = this.scheduler.getChannelRunner().getChannelStates() as Map<string, ChannelState>;
        
        // Focus on internet connectivity - find first internet/public channel
        const internetChannel = this.findInternetChannel(channels);
        const internetState = internetChannel ? states.get(internetChannel.id) : null;

        const statusIcon = this.getCustomStatusIcon(internetState?.state || 'unknown');
        const currentWatch = this.storageManager.getCurrentWatch();

        let text: string;
        let tooltip: string;
        let backgroundColor: vscode.ThemeColor | undefined;

        if (internetChannel && internetState) {
            const latency = internetState.lastSample?.latencyMs ? `${internetState.lastSample.latencyMs}ms` : '';

            if (currentWatch?.isActive) {
                const remaining = this.formatWatchRemaining(currentWatch);
                text = `${statusIcon}${latency ? ' ' + latency : ''} ${TerminologyMap.UILabels.statusBarActiveMonitoring}: ${remaining}`;
                tooltip = this.buildInternetTooltip(internetChannel, internetState, currentWatch);
            } else {
                text = `${statusIcon}${latency ? ' ' + latency : ''}`;
                tooltip = this.buildInternetTooltip(internetChannel, internetState);
            }

            // Set background color for critical states
            if (internetState.state === 'offline') {
                backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
            } else if (internetState.state === 'unknown') {
                backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            } else {
                backgroundColor = undefined;
            }
        } else {
            text = `🟡 Internet: Not configured`;
            tooltip = 'No internet connectivity channel configured\n\nAdd an internet check to .healthwatch.json\n\nClick to open dashboard';
            backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
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
        const channels = this.configManager.getChannels();
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

        // Set main status bar item text and tooltip
        this.statusBarItem.text = tokens.join(' ');
        this.statusBarItem.tooltip = tooltip;
        this.statusBarItem.backgroundColor = backgroundColor;
        this.statusBarItem.command = 'healthWatch.openDashboard';
        this.statusBarItem.show();
        
        // Update debug status bar if enabled
        if (this.debugMode) {
            this.updateDebugStatusBar();
        }
    }

    private updateChannelItems() {
        const channels = this.configManager.getChannels();
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

    private getShowInternetSetting(): boolean {
        return vscode.workspace.getConfiguration('healthWatch.statusBar').get('showInternet', true);
    }

    private findInternetChannel(channels: Array<ChannelInfo | ChannelDefinition>): ChannelInfo | ChannelDefinition | null {
        // Look for internet/public connectivity channels
        const internetKeywords = ['internet', 'public', 'google', 'cloudflare', '8.8.8.8', '1.1.1.1', 'connectivity'];
        
        // First try to find by common internet hostnames
        for (const channel of channels) {
            if ((channel.type === 'https' || channel.type === 'http') && (channel as any).url) {
                const url = String((channel as any).url).toLowerCase();
                if (internetKeywords.some(keyword => url.includes(keyword))) {
                    return channel;
                }
            }
        }
        
        // Then try to find any public HTTP/HTTPS endpoint
        for (const channel of channels) {
            if ((channel.type === 'https' || channel.type === 'http') && (channel as any).url) {
                const url = String((channel as any).url).toLowerCase();
                if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
                    return channel;
                }
            }
        }
        
        // Finally, return the first channel if available
        return channels.length > 0 ? channels[0] : null;
    }

    private buildInternetTooltip(channel: any, state: any, watch?: any): string {
        const lines: string[] = [];
        
        if (watch?.isActive) {
            lines.push(`Health Watch - ${TerminologyMap.MonitoringModes.intensive.new}`);
            const remaining = this.formatWatchRemaining(watch);
            lines.push(`Duration: ${remaining}`);
            lines.push(`Started: ${new Date(watch.startTime).toLocaleTimeString()}`);
        } else {
            lines.push(`Health Watch - ${TerminologyMap.MonitoringModes.baseline.new}`);
        }
        
        // Add coordination status if enabled
        if (this.scheduler instanceof CoordinatedScheduler) {
            const isCoordinationEnabled = this.scheduler.isCoordinationEnabled();
            if (isCoordinationEnabled) {
                const coordinationManager = (this.scheduler as any)['coordinationManager'];
                if (coordinationManager) {
                    const isLeader = coordinationManager.isLeader();
                    lines.push(`Mode: ${isLeader ? 'Leader' : 'Follower'} (Multi-window)`);
                }
            }
        }
        
        lines.push('');
        lines.push(`Channel: ${channel.name || channel.id}`);
        lines.push(`Type: ${channel.type.toUpperCase()}`);
        
        if (channel.url) {
            lines.push(`Target: ${channel.url}`);
        } else if (channel.target) {
            lines.push(`Target: ${channel.target}`);
        }
        
        const displayState = state.state === 'online' ? TerminologyMap.ServiceStates.online.new : 
                            state.state === 'offline' ? TerminologyMap.ServiceStates.offline.new : 
                            TerminologyMap.ServiceStates.unknown.new;
        lines.push(`Status: ${displayState.toUpperCase()}`);
        
        if (state.lastSample?.latencyMs) {
            lines.push(`Latency: ${state.lastSample.latencyMs}ms`);
        }
        
        if (state.lastSample?.error) {
            lines.push(`Last Error: ${state.lastSample.error}`);
        }
        
        lines.push('');
        lines.push('Click to open dashboard');
        
        return lines.join('\n');
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

    dispose() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
        }
        this.statusBarItem.dispose();
        this.disposeDebugStatusBarItem();
        this.disposeChannelItems();
    }
}