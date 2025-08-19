import * as vscode from 'vscode';
import { ConfigManager } from '../config';
import { StorageManager } from '../storage';
import { Scheduler, FishyCondition } from '../runner/scheduler';

interface SnoozeState {
    channelId: string;
    duration: number; // milliseconds
    startTime: number;
    reason: 'fishy' | 'outage' | 'multi-channel';
}

export class NotificationManager {
    private configManager = ConfigManager.getInstance();
    private storageManager = StorageManager.getInstance();
    private scheduler: Scheduler;
    private recentNotifications = new Set<string>();
    private snoozeStates = new Map<string, SnoozeState>();
    private readonly NOTIFICATION_COOLDOWN = 5 * 60 * 1000; // 5 minutes
    private readonly SNOOZE_STORAGE_KEY = 'healthWatch.snoozeStates';

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

        this.scheduler.on('fishyConditionDetected', (event) => {
            this.handleFishyCondition(event.channelId, event.condition);
        });
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
                    `🔴 ${channelName} is now OFFLINE`,
                    'Health Watch detected connectivity issues',
                    'error',
                    channelId,
                    'outage'
                );
            }
        } else if (oldState === 'offline' && newState === 'online') {
            this.showNotification(
                `🟢 ${channelName} is back ONLINE`,
                'Connectivity has been restored',
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
            `⚠️ Outage detected: ${channelName}`,
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
        const durationStr = this.formatDuration(duration);

        this.showNotification(
            `✅ Outage resolved: ${channelName}`,
            `Duration: ${durationStr}`,
            'info'
        );
    }

    private async handleFishyCondition(channelId: string, condition: FishyCondition) {
        if (this.configManager.isInQuietHours()) {
            return;
        }

        // Check if this channel is snoozed for fishy notifications  
        if (this.isChannelSnoozed(channelId, 'fishy')) {
            return;
        }

        const channels = this.configManager.getChannels();
        const channel = channels.find(c => c.id === channelId);
        const channelName = channel?.name || channelId;

        const message = `Connectivity looks unstable on ${channelName}: ${condition.description}. Start a Watch?`;
        
        const choice = await vscode.window.showWarningMessage(
            message,
            { modal: false },
            '1h',
            '12h',
            'Forever',
            'Customize...',
            'Snooze...'
        );

        if (choice && choice !== 'Snooze...') {
            if (choice === 'Customize...') {
                await this.showCustomWatchDialog();
            } else {
                await this.startWatch(choice as '1h' | '12h' | 'forever');
            }
        } else if (choice === 'Snooze...') {
            await this.showSnoozeDialog(channelId, 'fishy');
        }
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
                : this.formatDuration(duration);
            
            vscode.window.showInformationMessage(
                `🔍 Health Watch started for ${durationStr}`
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

    private async showSnoozeDialog(channelId: string, reason: 'fishy' | 'outage' | 'multi-channel'): Promise<void> {
        const channels = this.configManager.getChannels();
        const channel = channels.find(c => c.id === channelId);
        const channelName = channel?.name || channelId;
        
        const title = reason === 'fishy' 
            ? `Snooze notifications for ${channelName}` 
            : reason === 'outage'
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
        
        const durationStr = this.formatDuration(duration);
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

    private async setSnooze(channelId: string, duration: number, reason: 'fishy' | 'outage' | 'multi-channel'): Promise<void> {
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

    private isChannelSnoozed(channelId: string, reason: 'fishy' | 'outage' | 'multi-channel'): boolean {
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
            const remainingStr = this.formatDuration(remaining);
            
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

        const message = `🚨 Multiple channels offline (${offlineChannels.length}). Network-wide issue detected.`;
        
        const choice = await vscode.window.showErrorMessage(
            message,
            { modal: false },
            'Start Watch',
            'Snooze All',
            'View Details'
        );

        if (choice === 'Start Watch') {
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
        reason: 'outage' | 'fishy'
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

    private formatDuration(durationMs: number): string {
        const seconds = Math.floor(durationMs / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) {
            return `${days}d ${hours % 24}h`;
        } else if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    async showWatchEndNotification(watch: any, reportPath: string) {
        if (this.configManager.isInQuietHours()) {
            return;
        }

        const duration = this.formatDuration(watch.endTime - watch.startTime);
        const message = `🔍 Health Watch completed (${duration})`;
        
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

    dispose() {
        // Save snooze states on dispose
        this.saveSnoozeStates();
    }
}