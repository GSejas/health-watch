import * as vscode from 'vscode';
import { ConfigManager } from '../config';
import { StorageManager } from '../storage';
import { formatDuration } from './dashboardUtils';
import { Scheduler } from '../runner/scheduler';
import { TerminologyMap, MarketingCopy } from '../terminology/semanticMapping';

interface SnoozeState {
    channelId: string;
    duration: number; // milliseconds
    startTime: number;
    reason: 'outage' | 'multi-channel';
}

export class NotificationManager {
    private configManager = ConfigManager.getInstance();
    private storageManager = StorageManager.getInstance();
    private scheduler: Scheduler;
    private recentNotifications = new Set<string>();
    private snoozeStates = new Map<string, SnoozeState>();
    private readonly NOTIFICATION_COOLDOWN = 5 * 60 * 1000; // 5 minutes
    private readonly SNOOZE_STORAGE_KEY = 'healthWatch.snoozeStates';
    
    // Notification logging
    private notificationLog: Array<{
        timestamp: number;
        type: 'info' | 'warning' | 'error';
        message: string;
        channelId?: string;
        reason?: string;
        actions?: string[];
        wasSnoozed?: boolean;
        snoozeReason?: string;
    }> = [];
    private readonly MAX_LOG_ENTRIES = 100;

    constructor(scheduler: Scheduler) {
        this.scheduler = scheduler;
        this.loadSnoozeStates();
        this.setupEventListeners();
    }

    private setupEventListeners() {
        this.scheduler.on('stateChange', (event) => {
            this.handleStateChange(event.channelId, event.oldState, event.newState);
        });

        this.scheduler.on('outageStart', (event) => {
            this.handleOutageStart(event.channelId, event.reason);
        });

        this.scheduler.on('outageEnd', (event) => {
            this.handleOutageEnd(event.channelId, event.duration);
        });

    }

    /**
     * 📝 Notification Logging Methods
     */
    private logNotification(
        type: 'info' | 'warning' | 'error',
        message: string,
        options?: {
            channelId?: string;
            reason?: string;
            actions?: string[];
            wasSnoozed?: boolean;
            snoozeReason?: string;
        }
    ) {
        const entry = {
            timestamp: Date.now(),
            type,
            message,
            channelId: options?.channelId,
            reason: options?.reason,
            actions: options?.actions,
            wasSnoozed: options?.wasSnoozed,
            snoozeReason: options?.snoozeReason
        };

        this.notificationLog.push(entry);
        
        // Keep log size manageable
        if (this.notificationLog.length > this.MAX_LOG_ENTRIES) {
            this.notificationLog.shift();
        }

        // Console logging for debugging
        const logPrefix = `🔔 [${type.toUpperCase()}]`;
        const channelInfo = options?.channelId ? ` [${options.channelId}]` : '';
        const reasonInfo = options?.reason ? ` (${options.reason})` : '';
        const snoozeInfo = options?.wasSnoozed ? ` [SNOOZED: ${options.snoozeReason}]` : '';
        
        console.log(`${logPrefix}${channelInfo}${reasonInfo}${snoozeInfo} ${message}`);
        
        if (options?.actions) {
            console.log(`🔔   Actions: [${options.actions.join(', ')}]`);
        }
    }

    /**
     * 📊 Get notification history for debugging
     */
    getNotificationLog(): typeof this.notificationLog {
        return [...this.notificationLog];
    }

    /**
     * 🧹 Clear notification log
     */
    clearNotificationLog(): void {
        const count = this.notificationLog.length;
        this.notificationLog = [];
        console.log(`🔔 Cleared ${count} notification log entries`);
    }

    /**
     * 📈 Get notification statistics
     */
    getNotificationStats(): {
        total: number;
        byType: Record<'info' | 'warning' | 'error', number>;
        byChannel: Record<string, number>;
        recentCount: number; // last hour
        snoozeCount: number;
    } {
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        
        const stats = {
            total: this.notificationLog.length,
            byType: { info: 0, warning: 0, error: 0 },
            byChannel: {} as Record<string, number>,
            recentCount: 0,
            snoozeCount: 0
        };

        this.notificationLog.forEach(entry => {
            stats.byType[entry.type]++;
            
            if (entry.channelId) {
                stats.byChannel[entry.channelId] = (stats.byChannel[entry.channelId] || 0) + 1;
            }
            
            if (entry.timestamp > oneHourAgo) {
                stats.recentCount++;
            }
            
            if (entry.wasSnoozed) {
                stats.snoozeCount++;
            }
        });

        return stats;
    }

    /**
     * 🧠 Smart Dev Server Detection with User Override
     */
    private isLikelyDevServer(channelId: string, channelName: string): boolean {
        // First check if user has explicitly classified this channel
        const userClassification = this.getUserChannelClassification(channelId);
        if (userClassification !== null) {
            return userClassification === 'dev';
        }
        
        // Fall back to heuristic detection for unclassified channels
        const devIndicators = [
            'vite', 'webpack', 'dev-server', 'localhost', '127.0.0.1',
            'dev', 'local', 'parcel', 'rollup', 'esbuild', 'next',
            ':3000', ':8080', ':5173', ':4200'  // Common dev ports
        ];
        
        const lowerChannelId = channelId.toLowerCase();
        const lowerChannelName = channelName.toLowerCase();
        
        return devIndicators.some(indicator => 
            lowerChannelId.includes(indicator) || lowerChannelName.includes(indicator)
        );
    }
    
    /**
     * Get user's explicit classification for a channel
     */
    private getUserChannelClassification(channelId: string): 'dev' | 'production' | null {
        const classifications = vscode.workspace.getConfiguration('healthWatch').get<Record<string, 'dev' | 'production'>>('channelClassifications', {});
        return classifications[channelId] || null;
    }
    
    /**
     * Set user's explicit classification for a channel
     */
    private async setUserChannelClassification(channelId: string, classification: 'dev' | 'production'): Promise<void> {
        const config = vscode.workspace.getConfiguration('healthWatch');
        const classifications = config.get<Record<string, 'dev' | 'production'>>('channelClassifications', {});
        classifications[channelId] = classification;
        await config.update('channelClassifications', classifications, vscode.ConfigurationTarget.Workspace);
    }

    /**
     * 🎯 Adaptive Snooze Durations based on Context
     */
    private getContextualSnoozeOptions(channelId: string, reason: 'outage' | 'multi-channel'): Array<{label: string, duration: number}> {
        const isDevServer = this.isLikelyDevServer(channelId, channelId);
        
        if (isDevServer) {
            return [
                { label: '⏰ Quick break (30m)', duration: 30 * 60 * 1000 },
                { label: '🍕 Lunch (2h)', duration: 2 * 60 * 60 * 1000 },
                { label: '🔥 Working session (8h)', duration: 8 * 60 * 60 * 1000 },
                { label: '🌙 Overnight (12h)', duration: 12 * 60 * 60 * 1000 },
                { label: '📅 Daily dev (24h)', duration: 24 * 60 * 60 * 1000 },
                { label: '🗓️ Weekly sprint (7d)', duration: 7 * 24 * 60 * 60 * 1000 }
            ];
        }

        // Standard production service snooze options
        return [
            { label: '⏰ Brief issue (15m)', duration: 15 * 60 * 1000 },
            { label: '🔧 Maintenance (1h)', duration: 60 * 60 * 1000 },
            { label: '📞 Investigation (4h)', duration: 4 * 60 * 60 * 1000 },
            { label: '🌙 Overnight (12h)', duration: 12 * 60 * 60 * 1000 },
            { label: '📅 Daily (24h)', duration: 24 * 60 * 60 * 1000 }
        ];
    }

    /**
     * 🚨 Logged VS Code notification wrappers
     */
    private async showLoggedNotification(
        type: 'info' | 'warning' | 'error',
        message: string,
        options?: { modal?: boolean },
        ...actions: string[]
    ): Promise<string | undefined> {
        this.logNotification(type, message, { actions });
        
        switch (type) {
            case 'error':
                return await vscode.window.showErrorMessage(message, options || {}, ...actions);
            case 'warning':
                return await vscode.window.showWarningMessage(message, options || {}, ...actions);
            case 'info':
            default:
                return await vscode.window.showInformationMessage(message, options || {}, ...actions);
        }
    }

    private handleStateChange(channelId: string, oldState: string, newState: string) {
        if (this.configManager.isInQuietHours()) {
            return;
        }

        // Check if this channel is snoozed for outage notifications
        if (this.isChannelSnoozed(channelId, 'outage')) {
            return;
        }

        const channels = this.configManager.getChannels();
        const channel = channels.find(c => c.id === channelId);
        const channelName = channel?.name || channelId;

        // Only notify on significant state changes
        if (oldState === 'online' && newState === 'offline') {
            // Check for multi-channel outage scenario
            const offlineChannels = this.detectMultiChannelOutage();
            
            if (offlineChannels.length >= 3) {
                // Multi-channel outage detected - smart snoozing
                this.handleMultiChannelOutage(offlineChannels);
            } else {
                this.showNotificationWithSnooze(
                    `${TerminologyMap.ServiceStates.offline.icon} ${channelName} is now ${TerminologyMap.ServiceStates.offline.new.toUpperCase()}`,
                    `Health Watch detected ${TerminologyMap.DataEvents.incident.new.toLowerCase()}`,
                    'error',
                    channelId,
                    'outage'
                );
            }
        } else if (oldState === 'offline' && newState === 'online') {
            this.showNotification(
                `${TerminologyMap.ServiceStates.online.icon} ${channelName} is back ${TerminologyMap.ServiceStates.online.new.toUpperCase()}`,
                `${TerminologyMap.UILabels.serviceRecovered}`,
                'info'
            );
        }
    }

    private handleOutageStart(channelId: string, reason: string) {
        if (this.configManager.isInQuietHours()) {
            return;
        }

        const channels = this.configManager.getChannels();
        const channel = channels.find(c => c.id === channelId);
        const channelName = channel?.name || channelId;

        this.showNotification(
            `⚠️ ${TerminologyMap.DataEvents.outage.new} detected: ${channelName}`,
            `Reason: ${reason}`,
            'warning'
        );
    }

    private handleOutageEnd(channelId: string, duration: number) {
        if (this.configManager.isInQuietHours()) {
            return;
        }

        const channels = this.configManager.getChannels();
        const channel = channels.find(c => c.id === channelId);
        const channelName = channel?.name || channelId;
        const durationStr = formatDuration(duration);

        this.showNotification(
            `✅ ${TerminologyMap.DataEvents.outage.new} resolved: ${channelName}`,
            `Duration: ${durationStr}`,
            'info'
        );
    }


    private async showCustomWatchDialog() {
        const input = await vscode.window.showInputBox({
            prompt: 'Enter watch duration',
            placeHolder: 'Examples: 2h, 30m, 1440 (minutes)',
            validateInput: (value) => {
                if (!value) {return 'Duration is required';}
                if (!/^\d+[hm]?$/.test(value)) {
                    return 'Invalid format. Use: 2h, 30m, or number of minutes';
                }
                return null;
            }
        });

        if (input) {
            const durationMs = this.parseDurationInput(input);
            await this.startWatch(durationMs);
        }
    }

    private parseDurationInput(input: string): number {
        const match = input.match(/^(\d+)([hm])?$/);
        if (!match) {return 60 * 60 * 1000;} // Default 1h

        const value = parseInt(match[1]);
        const unit = match[2];

        switch (unit) {
            case 'h': return value * 60 * 60 * 1000;
            case 'm': return value * 60 * 1000;
            default: return value * 60 * 1000; // Default to minutes
        }
    }

    private async startWatch(duration: '1h' | '12h' | 'forever' | number) {
        try {
            await vscode.commands.executeCommand('healthWatch.startWatch', duration);
            
            const durationStr = typeof duration === 'string' 
                ? duration 
                : formatDuration(duration);
            
            vscode.window.showInformationMessage(
                `🔍 ${TerminologyMap.MonitoringModes.intensive.new} started for ${durationStr}`
            );
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to start watch: ${error}`);
        }
    }

    private showNotification(
        message: string, 
        detail?: string, 
        severity: 'info' | 'warning' | 'error' = 'info'
    ) {
        // Prevent notification spam
        const key = `${message}:${detail}`;
        if (this.recentNotifications.has(key)) {
            return;
        }

        this.recentNotifications.add(key);
        setTimeout(() => {
            this.recentNotifications.delete(key);
        }, this.NOTIFICATION_COOLDOWN);

        const fullMessage = detail ? `${message}\n${detail}` : message;

        switch (severity) {
            case 'error':
                vscode.window.showErrorMessage(fullMessage);
                break;
            case 'warning':
                vscode.window.showWarningMessage(fullMessage);
                break;
            case 'info':
            default:
                vscode.window.showInformationMessage(fullMessage);
                break;
        }
    }

    private async loadSnoozeStates(): Promise<void> {
        try {
            const context = (this.storageManager as any).context;
            const snoozeStatesData = context.globalState.get(this.SNOOZE_STORAGE_KEY, {}) as Record<string, SnoozeState>;
            
            const now = Date.now();
            for (const [key, snooze] of Object.entries(snoozeStatesData)) {
                if (snooze.startTime + snooze.duration > now) {
                    // Snooze is still active
                    this.snoozeStates.set(key, snooze);
                    
                    // Set timer to automatically clear when expires
                    const remainingTime = (snooze.startTime + snooze.duration) - now;
                    setTimeout(() => {
                        this.clearSnooze(key);
                    }, remainingTime);
                }
            }
        } catch (error) {
            console.error('Failed to load snooze states:', error);
        }
    }

    private async saveSnoozeStates(): Promise<void> {
        try {
            const context = (this.storageManager as any).context;
            const snoozeData = Object.fromEntries(this.snoozeStates.entries());
            await context.globalState.update(this.SNOOZE_STORAGE_KEY, snoozeData);
        } catch (error) {
            console.error('Failed to save snooze states:', error);
        }
    }

    private async showSnoozeDialog(channelId: string, reason: 'outage' | 'multi-channel'): Promise<void> {
        const channels = this.configManager.getChannels();
        const channel = channels.find(c => c.id === channelId);
        const channelName = channel?.name || channelId;
        
        const title = reason === 'outage'
            ? `Snooze outage notifications for ${channelName}`
            : 'Snooze notifications for affected channels';
        
        const choice = await vscode.window.showQuickPick([
            {
                label: '$(clock) 5 minutes',
                description: 'Short break',
                duration: 5 * 60 * 1000
            },
            {
                label: '$(clock) 1 hour', 
                description: 'Standard snooze',
                duration: 60 * 60 * 1000
            },
            {
                label: '$(clock) 6 hours',
                description: 'Extended quiet period', 
                duration: 6 * 60 * 60 * 1000
            },
            {
                label: '$(settings-gear) Custom duration...',
                description: 'Specify your own duration',
                duration: -1
            }
        ], {
            title,
            placeHolder: 'Select snooze duration'
        });

        if (!choice) {
            return;
        }

        let duration = choice.duration;
        if (duration === -1) {
            const customDuration = await this.getCustomSnoozeTime();
            if (!customDuration) {
                return;
            }
            duration = customDuration;
        }

        await this.setSnooze(channelId, duration, reason);
        
        const durationStr = formatDuration(duration);
        const message = reason === 'multi-channel' 
            ? `🔕 Snoozed notifications for multiple channels (${durationStr})`
            : `🔕 Snoozed notifications for ${channelName} (${durationStr})`;
        
        const action = await vscode.window.showInformationMessage(
            message,
            'Cancel Snooze',
            'View Snoozes'
        );

        if (action === 'Cancel Snooze') {
            await this.clearSnooze(this.getSnoozeKey(channelId, reason));
        } else if (action === 'View Snoozes') {
            await this.showActiveSnoozes();
        }
    }

    /**
     * 🎯 Contextual snooze dialog with smart durations
     */
    private async showContextualSnoozeDialog(channelId: string, reason: 'outage' | 'multi-channel') {
        const options = this.getContextualSnoozeOptions(channelId, reason);
        
        const channels = this.configManager.getChannels();
        const channel = channels.find(c => c.id === channelId);
        const channelName = channel?.name || channelId;
        const isDevServer = this.isLikelyDevServer(channelId, channelName);
        
        const title = isDevServer 
            ? `🛠️ Snooze Dev Server: ${channelName}`
            : `🔕 Snooze Channel: ${channelName}`;

        const choice = await vscode.window.showQuickPick([
            ...options.map(opt => ({
                label: opt.label,
                description: `Snooze for ${formatDuration(opt.duration)}`,
                duration: opt.duration
            })),
            {
                label: '⚙️ Custom duration...',
                description: 'Enter a custom snooze time',
                duration: -1
            }
        ], {
            title,
            placeHolder: isDevServer ? 'Choose dev-friendly snooze duration' : 'Select snooze duration'
        });

        if (!choice) {
            return;
        }

        let duration = choice.duration;
        if (duration === -1) {
            const customDuration = await this.getCustomSnoozeTime();
            if (!customDuration) {
                return;
            }
            duration = customDuration;
        }

        await this.setSnooze(channelId, duration, reason);
        
        // 📝 LOG: Snooze action
        this.logNotification('info', `Snoozed ${channelName} for ${formatDuration(duration)}`, {
            channelId,
            reason,
            wasSnoozed: true,
            snoozeReason: isDevServer ? 'dev_server_snooze' : 'standard_snooze'
        });
        
        const durationStr = formatDuration(duration);
        const message = reason === 'multi-channel' 
            ? `🔕 Snoozed notifications for multiple channels (${durationStr})`
            : `🔕 Snoozed notifications for ${channelName} (${durationStr})`;
        
        const action = await this.showLoggedNotification('info', message, undefined, 'Cancel Snooze', 'View Snoozes');
        
        if (action === 'Cancel Snooze') {
            await this.cancelSnooze(channelId);
        } else if (action === 'View Snoozes') {
            await this.showActiveSnoozes();
        }
    }

    private async getCustomSnoozeTime(): Promise<number | null> {
        const input = await vscode.window.showInputBox({
            prompt: 'Enter snooze duration',
            placeHolder: 'Examples: 15m, 2h, 30 (minutes)',
            validateInput: (value) => {
                if (!value) return 'Duration is required';
                if (!/^\d+[hm]?$/.test(value)) {
                    return 'Invalid format. Use: 15m, 2h, or number of minutes';
                }
                const parsed = this.parseDurationInput(value);
                if (parsed < 60 * 1000) {
                    return 'Minimum duration is 1 minute';
                }
                if (parsed > 7 * 24 * 60 * 60 * 1000) {
                    return 'Maximum duration is 7 days';
                }
                return null;
            }
        });

        return input ? this.parseDurationInput(input) : null;
    }

    private getSnoozeKey(channelId: string, reason: string): string {
        return `${channelId}-${reason}`;
    }

    private async setSnooze(channelId: string, duration: number, reason: 'outage' | 'multi-channel'): Promise<void> {
        const key = this.getSnoozeKey(channelId, reason);
        const snooze: SnoozeState = {
            channelId,
            duration,
            startTime: Date.now(),
            reason
        };
        
        this.snoozeStates.set(key, snooze);
        await this.saveSnoozeStates();
        
        // Auto-clear when expired
        setTimeout(() => {
            this.clearSnooze(key);
        }, duration);
    }

    private async clearSnooze(key: string): Promise<void> {
        const snooze = this.snoozeStates.get(key);
        if (snooze) {
            this.snoozeStates.delete(key);
            await this.saveSnoozeStates();
            
            const channels = this.configManager.getChannels();
            const channel = channels.find(c => c.id === snooze.channelId);
            const channelName = channel?.name || snooze.channelId;
            
            vscode.window.showInformationMessage(
                `🔔 Snooze expired for ${channelName} (${snooze.reason})`
            );
        }
    }

    private isChannelSnoozed(channelId: string, reason: 'outage' | 'multi-channel'): boolean {
        const key = this.getSnoozeKey(channelId, reason);
        const snooze = this.snoozeStates.get(key);
        
        if (!snooze) {
            return false;
        }
        
        const now = Date.now();
        if (snooze.startTime + snooze.duration <= now) {
            // Expired, clean up
            this.clearSnooze(key);
            return false;
        }
        
        return true;
    }

    async showActiveSnoozes(): Promise<void> {
        const activeSnoozes = Array.from(this.snoozeStates.values())
            .filter(snooze => {
                const now = Date.now();
                return snooze.startTime + snooze.duration > now;
            });
        
        if (activeSnoozes.length === 0) {
            vscode.window.showInformationMessage('No active snoozes');
            return;
        }
        
        const channels = this.configManager.getChannels();
        const items = activeSnoozes.map(snooze => {
            const channel = channels.find(c => c.id === snooze.channelId);
            const channelName = channel?.name || snooze.channelId;
            const remaining = (snooze.startTime + snooze.duration) - Date.now();
            const remainingStr = formatDuration(remaining);
            
            return {
                label: `$(mute) ${channelName}`,
                description: `${snooze.reason} • ${remainingStr} remaining`,
                snooze
            };
        });
        
        const choice = await vscode.window.showQuickPick(items, {
            title: 'Active Snoozes',
            placeHolder: 'Select a snooze to cancel'
        });
        
        if (choice) {
            const key = this.getSnoozeKey(choice.snooze.channelId, choice.snooze.reason);
            await this.clearSnooze(key);
        }
    }

    private detectMultiChannelOutage(): string[] {
        const offlineChannels: string[] = [];
        const channels = this.configManager.getChannels();
        
        for (const channel of channels) {
            const state = this.storageManager.getChannelState(channel.id);
            if (state.state === 'offline') {
                offlineChannels.push(channel.id);
            }
        }
        
        return offlineChannels;
    }

    private async handleMultiChannelOutage(offlineChannels: string[]): Promise<void> {
        // Check if multi-channel scenario is already snoozed
        if (this.isChannelSnoozed('*', 'multi-channel')) {
            return;
        }

        const message = `🚨 Multiple services ${TerminologyMap.ServiceStates.offline.new.toLowerCase()} (${offlineChannels.length}). Network-wide issue detected.`;
        
        const choice = await vscode.window.showErrorMessage(
            message,
            { modal: false },
            TerminologyMap.UserActions.startWatch.buttonText,
            'Snooze All',
            'View Details'
        );

        if (choice === TerminologyMap.UserActions.startWatch.buttonText) {
            await this.startWatch('1h'); // Default to 1 hour for multi-channel issues
        } else if (choice === 'Snooze All') {
            await this.showSnoozeDialog('*', 'multi-channel');
        } else if (choice === 'View Details') {
            await vscode.commands.executeCommand('healthWatch.showDashboard');
        }
    }

    private async showNotificationWithSnooze(
        message: string,
        detail: string | undefined,
        severity: 'info' | 'warning' | 'error',
        channelId: string,
        reason: 'outage'
    ): Promise<void> {
        const fullMessage = detail ? `${message}\n${detail}` : message;
        
        let choice: string | undefined;
        
        switch (severity) {
            case 'error':
                choice = await vscode.window.showErrorMessage(
                    fullMessage,
                    'Snooze',
                    'Dismiss'
                );
                break;
            case 'warning':
                choice = await vscode.window.showWarningMessage(
                    fullMessage,
                    'Snooze',
                    'Dismiss'
                );
                break;
            case 'info':
            default:
                choice = await vscode.window.showInformationMessage(
                    fullMessage,
                    'Snooze',
                    'Dismiss'
                );
                break;
        }
        
        if (choice === 'Snooze') {
            await this.showSnoozeDialog(channelId, reason);
        }
    }

    async getSnoozeStatus(): Promise<{ active: SnoozeState[], count: number }> {
        const activeSnoozes = Array.from(this.snoozeStates.values())
            .filter(snooze => {
                const now = Date.now();
                return snooze.startTime + snooze.duration > now;
            });
        
        return {
            active: activeSnoozes,
            count: activeSnoozes.length
        };
    }

    async clearAllSnoozes(): Promise<void> {
        const count = this.snoozeStates.size;
        this.snoozeStates.clear();
        await this.saveSnoozeStates();
        
        if (count > 0) {
            vscode.window.showInformationMessage(
                `🔔 Cleared ${count} active snooze${count > 1 ? 's' : ''}`
            );
        } else {
            vscode.window.showInformationMessage('No active snoozes to clear');
        }
    }

    // formatDuration method removed - now using centralized utility from dashboardUtils

    async showWatchEndNotification(watch: any, reportPath: string) {
        if (this.configManager.isInQuietHours()) {
            return;
        }

        const duration = formatDuration(watch.endTime - watch.startTime);
        const message = `🔍 ${TerminologyMap.MonitoringModes.intensive.new} completed (${duration})`;
        
        const choice = await vscode.window.showInformationMessage(
            message,
            'View Report',
            'Export Data'
        );

        if (choice === 'View Report') {
            await vscode.commands.executeCommand('healthWatch.openLastReport');
        } else if (choice === 'Export Data') {
            await vscode.commands.executeCommand('healthWatch.exportJSON');
        }
    }
    
    /**
     * Cancel snooze for a specific channel
     */
    private async cancelSnooze(channelId?: string): Promise<void> {
        if (channelId) {
            // Find and cancel all snoozes for this channel
            const keysToDelete: string[] = [];
            for (const [key, snooze] of this.snoozeStates.entries()) {
                if (snooze.channelId === channelId) {
                    keysToDelete.push(key);
                }
            }
            
            for (const key of keysToDelete) {
                await this.clearSnooze(key);
            }
            
            if (keysToDelete.length > 0) {
                vscode.window.showInformationMessage(`✓ Cancelled ${keysToDelete.length} snooze(s) for channel ${channelId}`);
            } else {
                vscode.window.showInformationMessage(`No active snoozes found for channel ${channelId}`);
            }
        } else {
            // Cancel all snoozes
            const count = this.snoozeStates.size;
            this.snoozeStates.clear();
            await this.saveSnoozeStates();
            vscode.window.showInformationMessage(`✓ Cancelled all ${count} snoozes`);
        }
    }

    /**
     * Show dialog to let user classify a channel as dev or production
     */
    async showChannelClassificationDialog(channelId: string, channelName: string): Promise<void> {
        const currentClassification = this.getUserChannelClassification(channelId);
        const autoDetected = currentClassification ? '' : ' (auto-detected)';
        
        const choice = await vscode.window.showQuickPick([
            {
                label: '🛠️ Development Server',
                description: 'Local development, testing, or staging environment',
                detail: 'Gets development-friendly snooze options (8h sessions, daily/weekly cycles)',
                classification: 'dev' as const
            },
            {
                label: '🏭 Production Service',
                description: 'Live production service or critical infrastructure',
                detail: 'Gets production-focused snooze options (15m quick fixes, 1h maintenance)',
                classification: 'production' as const
            },
            {
                label: '🤖 Use Auto-Detection',
                description: 'Let Health Watch automatically classify based on channel name',
                detail: 'Uses heuristics like "localhost", ":3000", "dev", "vite", etc.',
                classification: null
            }
        ], {
            title: `🏷️ Classify Channel: ${channelName}`,
            placeHolder: `Current: ${currentClassification ? currentClassification : 'auto-detected'}${autoDetected}`
        });
        
        if (choice) {
            if (choice.classification === null) {
                // Remove explicit classification, use auto-detection
                const config = vscode.workspace.getConfiguration('healthWatch');
                const classifications = config.get<Record<string, 'dev' | 'production'>>('channelClassifications', {});
                delete classifications[channelId];
                await config.update('channelClassifications', classifications, vscode.ConfigurationTarget.Workspace);
                vscode.window.showInformationMessage(`✓ Channel "${channelName}" will use auto-detection`);
            } else {
                await this.setUserChannelClassification(channelId, choice.classification);
                const icon = choice.classification === 'dev' ? '🛠️' : '🏭';
                vscode.window.showInformationMessage(`${icon} Channel "${channelName}" classified as ${choice.classification}`);
            }
        }
    }

    dispose() {
        // Save snooze states on dispose
        this.saveSnoozeStates();
    }
}