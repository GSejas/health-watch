import * as vscode from 'vscode';
import { StorageManager } from '../storage';

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
        return [
            {
                id: '1',
                timestamp: now - 2 * 60 * 60 * 1000, // 2 hours ago
                title: 'VPN Gateway Timeout',
                description: 'Multiple timeout errors connecting to corporate VPN gateway',
                severity: 'critical',
                type: 'outage',
                channel: 'corp-gateway',
                duration: 45,
                impact: '100% of VPN connections affected',
                resolved: false
            },
            {
                id: '2',
                timestamp: now - 6 * 60 * 60 * 1000, // 6 hours ago
                title: 'Public Site Slow Response',
                description: 'Elevated response times detected on public website',
                severity: 'warning',
                type: 'degraded',
                channel: 'public-site',
                duration: 120,
                impact: '30% slower than baseline',
                resolved: true,
                resolvedAt: now - 4 * 60 * 60 * 1000
            },
            {
                id: '3',
                timestamp: now - 24 * 60 * 60 * 1000, // 1 day ago
                title: 'Database Connection Recovery',
                description: 'Database connectivity restored after maintenance window',
                severity: 'info',
                type: 'recovery',
                channel: 'db-port',
                resolved: true,
                resolvedAt: now - 23 * 60 * 60 * 1000
            }
        ];
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
            timestamp: Date.now(),
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
        const actions = ['Edit Title', 'Edit Description', 'Change Severity', 'Change Status', 'Cancel'];
        
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