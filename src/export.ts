import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { StorageManager } from './storage';
import { StatsCalculator } from './stats';
import { ConfigManager } from './config';

export interface ExportOptions {
    windowMs?: number;
    includeCurrentWatch?: boolean;
    format?: 'json' | 'csv';
    path?: string;
}

export class DataExporter {
    private storageManager = StorageManager.getInstance();
    private statsCalculator = new StatsCalculator();
    private configManager = ConfigManager.getInstance();

    async exportJSON(options: ExportOptions = {}): Promise<vscode.Uri> {
        const {
            windowMs,
            includeCurrentWatch = true,
            path: exportPath
        } = options;

        const data = this.storageManager.exportData(windowMs);
        
        // Add computed statistics
        const enrichedData = {
            ...data,
            statistics: this.generateStatistics(data, windowMs, includeCurrentWatch),
            metadata: {
                exportedAt: new Date().toISOString(),
                extensionVersion: '1.0.0',
                windowMs,
                includeCurrentWatch
            }
        };

        const json = JSON.stringify(enrichedData, null, 2);
        const filePath = exportPath || await this.getExportPath('json');
        
        fs.writeFileSync(filePath, json, 'utf8');
        
        return vscode.Uri.file(filePath);
    }

    async exportCSV(options: ExportOptions = {}): Promise<vscode.Uri> {
        const {
            windowMs,
            includeCurrentWatch = true,
            path: exportPath
        } = options;

        const data = this.storageManager.exportData(windowMs);
        const csv = this.convertToCSV(data);
        
        const filePath = exportPath || await this.getExportPath('csv');
        fs.writeFileSync(filePath, csv, 'utf8');
        
        return vscode.Uri.file(filePath);
    }

    async exportForAnalysis(options: ExportOptions = {}): Promise<{ jsonUri: vscode.Uri; csvUri: vscode.Uri }> {
        const jsonUri = await this.exportJSON(options);
        const csvUri = await this.exportCSV(options);
        
        return { jsonUri, csvUri };
    }

    private generateStatistics(data: any, windowMs?: number, includeCurrentWatch?: boolean) {
        const channelIds = Object.keys(data.channels);
        const statsOptions = {
            windowStartMs: windowMs ? Date.now() - windowMs : 0,
            windowEndMs: Date.now(),
            includeCurrentWatch
        };

        const channelStats = channelIds.map(id => 
            this.statsCalculator.calculateChannelStats(id, statsOptions)
        );

        const globalStats = this.statsCalculator.calculateGlobalStats(statsOptions);
        const recommendations = this.statsCalculator.generateRecommendations(channelStats);
        const reportConfig = this.configManager.getReportConfig();
        const sloBreaches = this.statsCalculator.calculateSLOBreach(channelStats, reportConfig.sloTarget);

        return {
            perChannel: Object.fromEntries(channelStats.map(s => [s.channelId, s])),
            global: globalStats,
            recommendations,
            sloAnalysis: sloBreaches,
            computedAt: new Date().toISOString()
        };
    }

    private convertToCSV(data: any): string {
        const rows: string[] = [];
        
        // Header
        rows.push([
            'Timestamp',
            'Channel ID',
            'Channel Name',
            'Channel Type',
            'Success',
            'Latency (ms)',
            'Error',
            'Details'
        ].join(','));

        // Data rows
        for (const [channelId, channelData] of Object.entries(data.channels)) {
            const channel = this.configManager.getChannels().find(c => c.id === channelId);
            const channelName = channel?.name || '';
            const channelType = channel?.type || '';
            
            for (const sample of (channelData as any).samples) {
                const row = [
                    new Date(sample.timestamp).toISOString(),
                    this.escapeCsvValue(channelId),
                    this.escapeCsvValue(channelName),
                    this.escapeCsvValue(channelType),
                    sample.success ? 'TRUE' : 'FALSE',
                    sample.latencyMs || '',
                    this.escapeCsvValue(sample.error || ''),
                    this.escapeCsvValue(JSON.stringify(sample.details || {}))
                ];
                rows.push(row.join(','));
            }
        }

        return rows.join('\n');
    }

    private escapeCsvValue(value: string): string {
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
    }

    private async getExportPath(extension: 'json' | 'csv'): Promise<string> {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        const fileName = `HealthWatch-Export-${timestamp}.${extension}`;
        
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
            return path.join(workspaceFolder.uri.fsPath, fileName);
        }

        // Fallback to user's choice
        const saveUri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(fileName),
            filters: {
                [extension.toUpperCase()]: [extension]
            }
        });

        if (!saveUri) {
            throw new Error('Export cancelled by user');
        }

        return saveUri.fsPath;
    }

    async showExportDialog(): Promise<void> {
        const options = await this.getExportOptions();
        if (!options) {
            return; // User cancelled
        }

        try {
            let result: { jsonUri?: vscode.Uri; csvUri?: vscode.Uri };
            
            if (options.format === 'csv') {
                const csvUri = await this.exportCSV(options);
                result = { csvUri };
            } else if (options.format === 'json') {
                const jsonUri = await this.exportJSON(options);
                result = { jsonUri };
            } else {
                result = await this.exportForAnalysis(options);
            }

            await this.showExportSuccess(result);
            
        } catch (error) {
            vscode.window.showErrorMessage(`Export failed: ${error}`);
        }
    }

    private async getExportOptions(): Promise<ExportOptions | null> {
        // Format selection
        const format = await vscode.window.showQuickPick([
            { label: 'JSON', value: 'json', description: 'Complete data with metadata' },
            { label: 'CSV', value: 'csv', description: 'Sample data for spreadsheet analysis' },
            { label: 'Both', value: 'both', description: 'Export both JSON and CSV files' }
        ], {
            placeHolder: 'Select export format'
        });

        if (!format) {
            return null;
        }

        // Time window selection
        const timeWindow = await vscode.window.showQuickPick([
            { label: 'Last Hour', value: 60 * 60 * 1000 },
            { label: 'Last 12 Hours', value: 12 * 60 * 60 * 1000 },
            { label: 'Last 24 Hours', value: 24 * 60 * 60 * 1000 },
            { label: 'Last Week', value: 7 * 24 * 60 * 60 * 1000 },
            { label: 'All Data', value: undefined }
        ], {
            placeHolder: 'Select time window'
        });

        if (!timeWindow) {
            return null;
        }

        return {
            format: format.value === 'both' ? undefined : format.value as 'json' | 'csv',
            windowMs: timeWindow.value,
            includeCurrentWatch: true
        };
    }

    private async showExportSuccess(result: { jsonUri?: vscode.Uri; csvUri?: vscode.Uri }) {
        const files: string[] = [];
        if (result.jsonUri) {files.push(path.basename(result.jsonUri.fsPath));}
        if (result.csvUri) {files.push(path.basename(result.csvUri.fsPath));}
        
        const message = `Exported: ${files.join(', ')}`;
        const action = await vscode.window.showInformationMessage(
            message,
            'Open Folder',
            'View JSON',
            'View CSV'
        );

        if (action === 'Open Folder') {
            const uri = result.jsonUri || result.csvUri!;
            const folderUri = vscode.Uri.file(path.dirname(uri.fsPath));
            await vscode.commands.executeCommand('vscode.openFolder', folderUri, true);
        } else if (action === 'View JSON' && result.jsonUri) {
            const doc = await vscode.workspace.openTextDocument(result.jsonUri);
            await vscode.window.showTextDocument(doc);
        } else if (action === 'View CSV' && result.csvUri) {
            const doc = await vscode.workspace.openTextDocument(result.csvUri);
            await vscode.window.showTextDocument(doc);
        }
    }
}