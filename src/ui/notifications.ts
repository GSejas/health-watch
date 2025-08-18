import * as vscode from 'vscode';
import { ConfigManager } from '../config';
import { StorageManager } from '../storage';
import { Scheduler, FishyCondition } from '../runner/scheduler';

export class NotificationManager {
    private configManager = ConfigManager.getInstance();
    private storageManager = StorageManager.getInstance();
    private scheduler: Scheduler;
    private recentNotifications = new Set<string>();
    private readonly NOTIFICATION_COOLDOWN = 5 * 60 * 1000; // 5 minutes

    constructor(scheduler: Scheduler) {
        this.scheduler = scheduler;
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

        const channels = this.configManager.getChannels();
        const channel = channels.find(c => c.id === channelId);
        const channelName = channel?.name || channelId;

        // Only notify on significant state changes
        if (oldState === 'online' && newState === 'offline') {
            this.showNotification(
                `🔴 ${channelName} is now OFFLINE`,
                'Health Watch detected connectivity issues',
                'error'
            );
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
            'Ignore (45m)'
        );

        if (choice && choice !== 'Ignore (45m)') {
            if (choice === 'Customize...') {
                await this.showCustomWatchDialog();
            } else {
                await this.startWatch(choice as '1h' | '12h' | 'forever');
            }
        } else if (choice === 'Ignore (45m)') {
            // Temporarily disable fishy condition checking
            const ignoreKey = `fishy-ignore-${channelId}`;
            this.recentNotifications.add(ignoreKey);
            setTimeout(() => {
                this.recentNotifications.delete(ignoreKey);
            }, 45 * 60 * 1000);
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
        // No cleanup needed for now
    }
}