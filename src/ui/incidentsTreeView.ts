import * as vscode from 'vscode';
import { StorageManager } from '../storage';
import { ConfigManager } from '../config';

export interface Incident {
    id: string;
    timestamp: number;
    title: string;
    description: string;
    severity: 'critical' | 'warning' | 'info';
    type: 'outage' | 'degraded' | 'recovery' | 'maintenance';
    channel?: string;
    duration?: number;
    impact?: string;
    resolved: boolean;
    resolvedAt?: number;
}

export class IncidentsTreeProvider implements vscode.TreeDataProvider<IncidentItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<IncidentItem | undefined | null | void> = new vscode.EventEmitter<IncidentItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<IncidentItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private incidents: Incident[] = [];
    private storageManager = StorageManager.getInstance();
    private configManager = ConfigManager.getInstance();

    constructor() {
        this.loadIncidents();
    }

    refresh(): void {
        this.loadIncidents();
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: IncidentItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: IncidentItem): Thenable<IncidentItem[]> {
        if (!element) {
            // Root level - show incidents grouped by status
            const activeIncidents = this.incidents.filter(i => !i.resolved);
            const resolvedIncidents = this.incidents.filter(i => i.resolved);
            
            const items: IncidentItem[] = [];
            
            if (activeIncidents.length > 0) {
                items.push(new IncidentItem(
                    `Active Incidents (${activeIncidents.length})`,
                    vscode.TreeItemCollapsibleState.Expanded,
                    'group'
                ));
            }
            
            if (resolvedIncidents.length > 0) {
                items.push(new IncidentItem(
                    `Resolved Incidents (${resolvedIncidents.length})`,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'group'
                ));
            }
            
            if (items.length === 0) {
                items.push(new IncidentItem(
                    'No incidents recorded',
                    vscode.TreeItemCollapsibleState.None,
                    'placeholder'
                ));
            }
            
            return Promise.resolve(items);
        } else if (element.contextValue === 'group') {
            // Show incidents in the group
            const isActive = element.label?.toString().includes('Active');
            const filteredIncidents = this.incidents.filter(i => isActive ? !i.resolved : i.resolved);
            
            return Promise.resolve(filteredIncidents.map(incident => {
                const item = new IncidentItem(
                    incident.title,
                    vscode.TreeItemCollapsibleState.None,
                    'incident'
                );
                
                item.description = this.formatIncidentDescription(incident);
                item.tooltip = this.formatIncidentTooltip(incident);
                item.incident = incident;
                
                // Set icon based on severity and type
                item.iconPath = this.getIncidentIcon(incident);
                
                return item;
            }));
        }
        
        return Promise.resolve([]);
    }

    private loadIncidents(): void {
        try {
            // Try to load from storage, fallback to demo data
            const stored = this.storageManager.getCustomData('incidents');
            if (stored && Array.isArray(stored)) {
                this.incidents = stored;
            } else {
                // Initialize with some demo incidents
                this.incidents = this.generateDemoIncidents();
                this.saveIncidents();
            }
        } catch (error) {
            console.error('Failed to load incidents:', error);
            this.incidents = this.generateDemoIncidents();
        }
    }

    private saveIncidents(): void {
        try {
            this.storageManager.setCustomData('incidents', this.incidents);
        } catch (error) {
            console.error('Failed to save incidents:', error);
        }
    }

    private generateDemoIncidents(): Incident[] {
        const now = Date.now();
        const historyDays = vscode.workspace.getConfiguration('healthWatch.demo').get<number>('incidentHistoryDays', 7);
        const historyMs = historyDays * 24 * 60 * 60 * 1000;
        
        // Generate incidents spread across the configured time range
        const incidents: Incident[] = [];
        
        // Recent critical incident (last 10% of time range)
        const recentCutoff = historyMs * 0.1;
        incidents.push({
            id: '1',
            timestamp: now - Math.random() * recentCutoff,
            title: 'VPN Gateway Timeout',
            description: 'Multiple timeout errors connecting to corporate VPN gateway',
            severity: 'critical',
            type: 'outage',
            channel: 'corp-gateway',
            duration: Math.floor(Math.random() * 120) + 15, // 15-135 minutes
            impact: '100% of VPN connections affected',
            resolved: false
        });
        
        // Mid-range warning (middle 40% of time range)
        const midStart = historyMs * 0.3;
        const midEnd = historyMs * 0.7;
        const warningTime = now - (midStart + Math.random() * (midEnd - midStart));
        const warningDuration = Math.floor(Math.random() * 180) + 30; // 30-210 minutes
        incidents.push({
            id: '2',
            timestamp: warningTime,
            title: 'Public Site Slow Response',
            description: 'Elevated response times detected on public website',
            severity: 'warning',
            type: 'degraded',
            channel: 'public-site',
            duration: warningDuration,
            impact: `${Math.floor(Math.random() * 50) + 20}% slower than baseline`,
            resolved: true,
            resolvedAt: warningTime + (warningDuration * 60 * 1000)
        });
        
        // Older recovery incident (last 30% of time range)
        const oldStart = historyMs * 0.7;
        const recoveryTime = now - (oldStart + Math.random() * (historyMs - oldStart));
        incidents.push({
            id: '3',
            timestamp: recoveryTime,
            title: 'Database Connection Recovery',
            description: 'Database connectivity restored after maintenance window',
            severity: 'info',
            type: 'recovery',
            channel: 'db-port',
            resolved: true,
            resolvedAt: recoveryTime + (Math.random() * 60 * 60 * 1000) // Resolved within 1 hour
        });
        
        // Add more incidents for longer time ranges
        if (historyDays >= 14) {
            // SSL certificate renewal
            const sslTime = now - (historyMs * 0.8 + Math.random() * historyMs * 0.15);
            incidents.push({
                id: '4',
                timestamp: sslTime,
                title: 'SSL Certificate Renewal',
                description: 'Automated SSL certificate renewal completed successfully',
                severity: 'info',
                type: 'maintenance',
                channel: 'public-site',
                duration: 5,
                impact: 'Brief service interruption during renewal',
                resolved: true,
                resolvedAt: sslTime + (5 * 60 * 1000)
            });
        }
        
        if (historyDays >= 21) {
            // Network maintenance
            const maintenanceTime = now - (historyMs * 0.9 + Math.random() * historyMs * 0.08);
            incidents.push({
                id: '5',
                timestamp: maintenanceTime,
                title: 'Scheduled Network Maintenance',
                description: 'Planned network infrastructure maintenance completed',
                severity: 'warning',
                type: 'maintenance',
                channel: 'infrastructure',
                duration: 240, // 4 hours
                impact: 'Intermittent connectivity during maintenance window',
                resolved: true,
                resolvedAt: maintenanceTime + (240 * 60 * 1000)
            });
        }
        
        // Sort by timestamp descending (newest first)
        return incidents.sort((a, b) => b.timestamp - a.timestamp);
    }

    private formatIncidentDescription(incident: Incident): string {
        const timeAgo = this.getRelativeTime(incident.timestamp);
        const status = incident.resolved ? '✅' : '🔴';
        return `${status} ${timeAgo} • ${incident.severity}`;
    }

    private formatIncidentTooltip(incident: Incident): vscode.MarkdownString {
        const markdown = new vscode.MarkdownString();
        markdown.appendMarkdown(`**${incident.title}**\n\n`);
        markdown.appendMarkdown(`*${incident.description}*\n\n`);
        markdown.appendMarkdown(`**Severity:** ${incident.severity.toUpperCase()}\n\n`);
        markdown.appendMarkdown(`**Type:** ${incident.type}\n\n`);
        markdown.appendMarkdown(`**Time:** ${new Date(incident.timestamp).toLocaleString()}\n\n`);
        
        if (incident.channel) {
            markdown.appendMarkdown(`**Channel:** ${incident.channel}\n\n`);
        }
        
        if (incident.duration) {
            markdown.appendMarkdown(`**Duration:** ${incident.duration} minutes\n\n`);
        }
        
        if (incident.impact) {
            markdown.appendMarkdown(`**Impact:** ${incident.impact}\n\n`);
        }
        
        if (incident.resolved && incident.resolvedAt) {
            markdown.appendMarkdown(`**Resolved:** ${new Date(incident.resolvedAt).toLocaleString()}\n\n`);
        }
        
        return markdown;
    }

    private getIncidentIcon(incident: Incident): vscode.ThemeIcon {
        if (incident.resolved) {
            return new vscode.ThemeIcon('check-all', new vscode.ThemeColor('charts.green'));
        }
        
        switch (incident.severity) {
            case 'critical':
                return new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'));
            case 'warning':
                return new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.orange'));
            case 'info':
                return new vscode.ThemeIcon('info', new vscode.ThemeColor('charts.blue'));
            default:
                return new vscode.ThemeIcon('circle-outline');
        }
    }

    private getRelativeTime(timestamp: number): string {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / (60 * 1000));
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) {
            return `${days}d ago`;
        } else if (hours > 0) {
            return `${hours}h ago`;
        } else if (minutes > 0) {
            return `${minutes}m ago`;
        } else {
            return 'Just now';
        }
    }

    // CRUD operations
    async addIncident(): Promise<void> {
        const title = await vscode.window.showInputBox({
            prompt: 'Enter incident title',
            placeHolder: 'e.g., Service Outage - Payment Gateway'
        });

        if (!title) { return; }

        const description = await vscode.window.showInputBox({
            prompt: 'Enter incident description',
            placeHolder: 'Brief description of the incident'
        });

        if (!description) { return; }

        // Date/Time selection
        const dateTimeOption = await vscode.window.showQuickPick([
            { label: 'Now', detail: 'Set incident time to current date/time', value: 'now' },
            { label: 'Custom Date & Time', detail: 'Choose a specific date and time', value: 'custom' },
            { label: 'Recent Times', detail: 'Select from common recent timeframes', value: 'recent' }
        ], {
            placeHolder: 'When did this incident occur?'
        });

        if (!dateTimeOption) { return; }

        let timestamp = Date.now();

        if (dateTimeOption.value === 'custom') {
            const customTime = await this.selectCustomDateTime();
            if (!customTime) { return; }
            timestamp = customTime;
        } else if (dateTimeOption.value === 'recent') {
            const recentTime = await this.selectRecentTime();
            if (!recentTime) { return; }
            timestamp = recentTime;
        }

        const severityOptions = [
            { label: 'Critical', value: 'critical' },
            { label: 'Warning', value: 'warning' },
            { label: 'Info', value: 'info' }
        ];

        const severitySelection = await vscode.window.showQuickPick(severityOptions, {
            placeHolder: 'Select incident severity'
        });

        if (!severitySelection) { return; }

        const typeOptions = [
            { label: 'Outage', value: 'outage' },
            { label: 'Degraded', value: 'degraded' },
            { label: 'Recovery', value: 'recovery' },
            { label: 'Maintenance', value: 'maintenance' }
        ];

        const typeSelection = await vscode.window.showQuickPick(typeOptions, {
            placeHolder: 'Select incident type'
        });

        if (!typeSelection) { return; }

        const newIncident: Incident = {
            id: Date.now().toString(),
            timestamp,
            title,
            description,
            severity: severitySelection.value as Incident['severity'],
            type: typeSelection.value as Incident['type'],
            resolved: false
        };

        this.incidents.unshift(newIncident); // Add to beginning
        this.saveIncidents();
        this.refresh();

        vscode.window.showInformationMessage(`Incident "${title}" added successfully.`);
    }

    async editIncident(item: IncidentItem): Promise<void> {
        if (!item.incident) { return; }

        const incident = item.incident;
        const actions = ['Edit Title', 'Edit Description', 'Change Date & Time', 'Change Severity', 'Change Status', 'Cancel'];
        
        const action = await vscode.window.showQuickPick(actions, {
            placeHolder: 'What would you like to edit?'
        });

        if (!action || action === 'Cancel') { return; }

        switch (action) {
            case 'Edit Title':
                const newTitle = await vscode.window.showInputBox({
                    prompt: 'Enter new title',
                    value: incident.title
                });
                if (newTitle) {
                    incident.title = newTitle;
                }
                break;

            case 'Edit Description':
                const newDescription = await vscode.window.showInputBox({
                    prompt: 'Enter new description',
                    value: incident.description
                });
                if (newDescription) {
                    incident.description = newDescription;
                }
                break;

            case 'Change Date & Time':
                const currentDateTime = this.formatDateTime(incident.timestamp);
                const result = await vscode.window.showInformationMessage(
                    `Current date/time: ${currentDateTime}\n\nChoose how to update the incident time:`,
                    'Custom Date & Time',
                    'Recent Times',
                    'Cancel'
                );

                if (!result || result === 'Cancel') { break; }

                let newTimestamp: number | null = null;
                if (result === 'Custom Date & Time') {
                    newTimestamp = await this.selectCustomDateTime();
                } else if (result === 'Recent Times') {
                    newTimestamp = await this.selectRecentTime();
                }

                if (newTimestamp) {
                    incident.timestamp = newTimestamp;
                    vscode.window.showInformationMessage(
                        `Incident time updated to ${this.formatDateTime(newTimestamp)}`
                    );
                }
                break;

            case 'Change Severity':
                const newSeverityOptions = [
                    { label: 'Critical', value: 'critical', picked: incident.severity === 'critical' },
                    { label: 'Warning', value: 'warning', picked: incident.severity === 'warning' },
                    { label: 'Info', value: 'info', picked: incident.severity === 'info' }
                ];
                const newSeveritySelection = await vscode.window.showQuickPick(newSeverityOptions, {
                    placeHolder: 'Select new severity'
                });
                if (newSeveritySelection) {
                    incident.severity = newSeveritySelection.value as Incident['severity'];
                }
                break;

            case 'Change Status':
                const resolved = await vscode.window.showQuickPick(
                    [
                        { label: 'Active', value: false },
                        { label: 'Resolved', value: true }
                    ],
                    { placeHolder: 'Select status' }
                );
                if (resolved) {
                    incident.resolved = resolved.value;
                    if (resolved.value && !incident.resolvedAt) {
                        incident.resolvedAt = Date.now();
                    } else if (!resolved.value) {
                        incident.resolvedAt = undefined;
                    }
                }
                break;
        }

        this.saveIncidents();
        this.refresh();
        vscode.window.showInformationMessage('Incident updated successfully.');
    }

    async deleteIncident(item: IncidentItem): Promise<void> {
        if (!item.incident) { return; }

        const result = await vscode.window.showWarningMessage(
            `Are you sure you want to delete the incident "${item.incident.title}"?`,
            'Delete',
            'Cancel'
        );

        if (result === 'Delete') {
            this.incidents = this.incidents.filter(i => i.id !== item.incident?.id);
            this.saveIncidents();
            this.refresh();
            vscode.window.showInformationMessage('Incident deleted successfully.');
        }
    }

    getIncidents(): Incident[] {
        return this.incidents;
    }

    async resetDemoIncidents(): Promise<void> {
        const result = await vscode.window.showInformationMessage(
            'This will replace all current incidents with new demo data. Continue?',
            'Reset Demo Data',
            'Cancel'
        );

        if (result === 'Reset Demo Data') {
            this.incidents = this.generateDemoIncidents();
            this.saveIncidents();
            this.refresh();
            
            const historyDays = vscode.workspace.getConfiguration('healthWatch.demo').get<number>('incidentHistoryDays', 7);
            vscode.window.showInformationMessage(
                `Demo incidents reset with ${historyDays}-day history. You can change the time range in Settings → Health Watch → Demo Incident History Days.`
            );
        }
    }

    private async selectCustomDateTime(): Promise<number | null> {
        // Date selection
        const dateInput = await vscode.window.showInputBox({
            prompt: 'Enter date (YYYY-MM-DD or MM/DD/YYYY)',
            placeHolder: 'e.g., 2024-01-15 or 01/15/2024',
            value: new Date().toISOString().split('T')[0], // Today's date
            validateInput: (value) => {
                if (!value) { return 'Date is required'; }
                
                // Try parsing different date formats
                const date = this.parseDate(value);
                if (!date || isNaN(date.getTime())) {
                    return 'Invalid date format. Use YYYY-MM-DD or MM/DD/YYYY';
                }
                
                const now = new Date();
                const maxFuture = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 1 day in future
                const maxPast = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); // 1 year ago
                
                if (date > maxFuture) {
                    return 'Date cannot be more than 1 day in the future';
                }
                if (date < maxPast) {
                    return 'Date cannot be more than 1 year in the past';
                }
                
                return null;
            }
        });

        if (!dateInput) { return null; }

        // Time selection
        const timeInput = await vscode.window.showInputBox({
            prompt: 'Enter time (HH:MM or HH:MM:SS in 24-hour format)',
            placeHolder: 'e.g., 14:30 or 14:30:45',
            value: new Date().toLocaleTimeString('en-GB', { hour12: false }).substring(0, 5), // Current time
            validateInput: (value) => {
                if (!value) { return 'Time is required'; }
                
                const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])(:([0-5][0-9]))?$/;
                if (!timeRegex.test(value)) {
                    return 'Invalid time format. Use HH:MM (24-hour format)';
                }
                
                return null;
            }
        });

        if (!timeInput) { return null; }

        // Combine date and time
        const date = this.parseDate(dateInput);
        const [hours, minutes, seconds = 0] = timeInput.split(':').map(Number);
        
        date!.setHours(hours, minutes, seconds, 0);
        
        return date!.getTime();
    }

    private async selectRecentTime(): Promise<number | null> {
        const now = Date.now();
        const options = [
            { label: 'Just now', detail: 'Current time', value: now },
            { label: '15 minutes ago', detail: this.formatDateTime(now - 15 * 60 * 1000), value: now - 15 * 60 * 1000 },
            { label: '1 hour ago', detail: this.formatDateTime(now - 60 * 60 * 1000), value: now - 60 * 60 * 1000 },
            { label: '2 hours ago', detail: this.formatDateTime(now - 2 * 60 * 60 * 1000), value: now - 2 * 60 * 60 * 1000 },
            { label: '6 hours ago', detail: this.formatDateTime(now - 6 * 60 * 60 * 1000), value: now - 6 * 60 * 60 * 1000 },
            { label: '12 hours ago', detail: this.formatDateTime(now - 12 * 60 * 60 * 1000), value: now - 12 * 60 * 60 * 1000 },
            { label: '1 day ago', detail: this.formatDateTime(now - 24 * 60 * 60 * 1000), value: now - 24 * 60 * 60 * 1000 },
            { label: '2 days ago', detail: this.formatDateTime(now - 2 * 24 * 60 * 60 * 1000), value: now - 2 * 24 * 60 * 60 * 1000 },
            { label: '1 week ago', detail: this.formatDateTime(now - 7 * 24 * 60 * 60 * 1000), value: now - 7 * 24 * 60 * 60 * 1000 }
        ];

        const selection = await vscode.window.showQuickPick(options, {
            placeHolder: 'Select when the incident occurred'
        });

        return selection ? selection.value : null;
    }

    private parseDate(dateString: string): Date | null {
        // Try different date formats
        const formats = [
            // ISO format: YYYY-MM-DD
            /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
            // US format: MM/DD/YYYY
            /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
            // Alternative: DD/MM/YYYY
            /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
        ];

        for (const format of formats) {
            const match = dateString.match(format);
            if (match) {
                if (format === formats[0]) {
                    // ISO format: YYYY-MM-DD
                    return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
                } else if (format === formats[1]) {
                    // US format: MM/DD/YYYY
                    return new Date(parseInt(match[3]), parseInt(match[1]) - 1, parseInt(match[2]));
                }
            }
        }

        // Try native Date parsing as fallback
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? null : date;
    }

    private formatDateTime(timestamp: number): string {
        const date = new Date(timestamp);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }

    dispose(): void {
        // Cleanup if needed
    }
}

export class IncidentItem extends vscode.TreeItem {
    public incident?: Incident;

    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string
    ) {
        super(label, collapsibleState);
        this.tooltip = this.label;
    }
}