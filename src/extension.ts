import * as vscode from 'vscode';
import { ConfigManager } from './config';
import { StorageManager } from './storage';
import { GuardManager } from './guards';
import { Scheduler } from './runner/scheduler';
import { StatusBarManager } from './ui/statusBar';
import { ChannelTreeProvider } from './ui/treeView';
import { StatusTreeDataProvider } from './ui/statusTreeView';
import { NotificationManager } from './ui/notifications';
import { HealthWatchAPIImpl } from './api';
import { DataExporter } from './export';
import { ReportGenerator } from './report';

let healthWatchAPI: HealthWatchAPIImpl;

export function activate(context: vscode.ExtensionContext): HealthWatchAPIImpl {
    console.log('Health Watch extension is activating...');

    try {
        // Initialize core managers
        const configManager = ConfigManager.getInstance();
        const storageManager = StorageManager.initialize(context);
        const guardManager = GuardManager.getInstance();
        
        // Initialize scheduler and runners
        const scheduler = new Scheduler();
        
        // Initialize UI components
        const statusBarManager = new StatusBarManager(scheduler);
        const treeProvider = new ChannelTreeProvider(scheduler);
        const notificationManager = new NotificationManager(scheduler);

        const statusProvider = new StatusTreeDataProvider(scheduler);

        // Initialize utilities
        const dataExporter = new DataExporter();
        const reportGenerator = new ReportGenerator();
        
        // Initialize public API
        healthWatchAPI = new HealthWatchAPIImpl(scheduler);
        
        // Register tree view
        const treeView = vscode.window.createTreeView('healthWatchChannels', {
            treeDataProvider: treeProvider,
            showCollapseAll: false
        });
        
        // Register status tree view (view id must match package.json contributes.views)
        const statusTreeView = vscode.window.createTreeView('healthWatchStatus', {
            treeDataProvider: statusProvider,
            showCollapseAll: false
        });
        
        // Register commands
        registerCommands(context, scheduler, healthWatchAPI, dataExporter, reportGenerator, treeProvider, notificationManager);
        
        // Set context for when clauses
        vscode.commands.executeCommand('setContext', 'healthWatch.enabled', configManager.isEnabled());
        
        // Load configuration and start monitoring
        setupExtension(configManager, guardManager, scheduler);
        
        // Register disposables
        context.subscriptions.push(
            statusBarManager,
            treeProvider,
            statusProvider,
            treeView,
            statusTreeView,
            notificationManager,
            healthWatchAPI,
            configManager
        );
        
        console.log('Health Watch extension activated successfully');
        
        return healthWatchAPI;
        
    } catch (error) {
        console.error('Failed to activate Health Watch extension:', error);
        vscode.window.showErrorMessage(`Health Watch activation failed: ${error}`);
        throw error;
    }
}

function registerCommands(
    context: vscode.ExtensionContext,
    scheduler: Scheduler,
    api: HealthWatchAPIImpl,
    dataExporter: DataExporter,
    reportGenerator: ReportGenerator,
    treeProvider: ChannelTreeProvider,
    notificationManager: NotificationManager
) {
    const commands: Array<[string, (...args: any[]) => any]> = [
        ['healthWatch.startWatch', async (duration?: string) => {
            try {
                const watchDuration = duration || await showWatchDurationPicker();
                if (watchDuration) {
                    api.startWatch({ duration: watchDuration as any });
                    vscode.window.showInformationMessage(`Health Watch started for ${watchDuration}`);
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to start watch: ${error}`);
            }
        }],
        
        ['healthWatch.stopWatch', () => {
            try {
                api.stopWatch();
                vscode.window.showInformationMessage('Health Watch stopped');
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to stop watch: ${error}`);
            }
        }],
        
        ['healthWatch.runAllNow', async () => {
            try {
                await scheduler.runAllChannelsNow();
                vscode.window.showInformationMessage('All channels probed');
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to run probes: ${error}`);
            }
        }],
        
        ['healthWatch.openLastReport', async () => {
            try {
                await api.openLastReport();
            } catch (error) {
                vscode.window.showErrorMessage(`No report available: ${error}`);
            }
        }],
        
        ['healthWatch.exportJSON', async () => {
            try {
                await dataExporter.showExportDialog();
            } catch (error) {
                vscode.window.showErrorMessage(`Export failed: ${error}`);
            }
        }],
        
        ['healthWatch.refreshChannels', () => {
            scheduler.refreshChannels();
            treeProvider.refresh();
        }],
        
        ['healthWatch.runChannelNow', async (item) => {
            if (item && item.channelInfo) {
                await treeProvider.runChannel(item.channelInfo.id);
            }
        }],
        
        ['healthWatch.pauseChannel', (item) => {
            if (item && item.channelInfo) {
                treeProvider.pauseChannel(item.channelInfo.id);
            }
        }],
        
        ['healthWatch.resumeChannel', (item) => {
            if (item && item.channelInfo) {
                treeProvider.resumeChannel(item.channelInfo.id);
            }
        }],
        
        ['healthWatch.stopChannel', (item) => {
            if (item && item.channelInfo) {
                treeProvider.stopChannel(item.channelInfo.id);
            }
        }],
        
        ['healthWatch.showDetails', () => {
            showDetailsWebview(context, api);
        }]
    ];
    
    for (const [command, handler] of commands) {
        context.subscriptions.push(
            vscode.commands.registerCommand(command, handler)
        );
    }
}

async function setupExtension(
    configManager: ConfigManager,
    guardManager: GuardManager,
    scheduler: Scheduler
) {
    try {
        // Load workspace configuration
        await configManager.loadWorkspaceConfig();
        
        // Initialize guards from configuration
        const guards = configManager.getGuards();
        guardManager.updateGuards(guards);
        
        // Start monitoring if enabled
        if (configManager.isEnabled()) {
            scheduler.start();
        }
        
        // Set up configuration change listener
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('healthWatch')) {
                const isEnabled = configManager.isEnabled();
                vscode.commands.executeCommand('setContext', 'healthWatch.enabled', isEnabled);
                
                if (isEnabled) {
                    scheduler.start();
                    scheduler.refreshChannels();
                } else {
                    scheduler.stop();
                }
            }
        });
        
    } catch (error) {
        console.error('Failed to setup extension:', error);
    }
}

async function showWatchDurationPicker(): Promise<string | undefined> {
    const options = [
        { label: '1 Hour', value: '1h' },
        { label: '12 Hours', value: '12h' },
        { label: 'Forever', value: 'forever' },
        { label: 'Custom...', value: 'custom' }
    ];
    
    const selection = await vscode.window.showQuickPick(options, {
        placeHolder: 'Select watch duration'
    });
    
    if (!selection) {
        return undefined;
    }
    
    if (selection.value === 'custom') {
        const input = await vscode.window.showInputBox({
            prompt: 'Enter duration in minutes',
            placeHolder: 'e.g., 30, 120, 480',
            validateInput: (value) => {
                const minutes = parseInt(value);
                if (isNaN(minutes) || minutes <= 0) {
                    return 'Please enter a valid number of minutes';
                }
                return null;
            }
        });
        
        if (input) {
            return (parseInt(input) * 60 * 1000).toString(); // Convert to milliseconds
        }
        return undefined;
    }
    
    return selection.value;
}

function showDetailsWebview(context: vscode.ExtensionContext, api: HealthWatchAPIImpl) {
    const panel = vscode.window.createWebviewPanel(
        'healthWatchDetails',
        'Health Watch Details',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true
        }
    );
    
    const channels = api.listChannels();
    const currentWatch = api.getCurrentWatch();
    const states = api.getChannelStates();
    
    panel.webview.html = generateDetailsHTML(channels, currentWatch, states);
    
    // Refresh webview when data changes
    const disposable = api.onStateChange(() => {
        const updatedChannels = api.listChannels();
        const updatedWatch = api.getCurrentWatch();
        const updatedStates = api.getChannelStates();
        panel.webview.html = generateDetailsHTML(updatedChannels, updatedWatch, updatedStates);
    });
    
    panel.onDidDispose(() => {
        disposable.dispose();
    });
}

function generateDetailsHTML(channels: any[], currentWatch: any, states: Map<string, any>): string {
    console.log('generateDetailsHTML called with:', { channelsCount: channels.length, currentWatch: !!currentWatch, statesSize: states.size });
    
    let channelRows = '';
    
    if (channels.length === 0) {
        channelRows = `
            <tr>
                <td colspan="5" style="text-align: center; color: var(--vscode-descriptionForeground);">
                    No channels configured. Add a .healthwatch.json file to your workspace.
                </td>
            </tr>
        `;
    } else {
        channelRows = channels.map(ch => {
            console.log('Processing channel:', ch);
            const statusIcon = ch.state === 'online' ? '🟢' : ch.state === 'offline' ? '🔴' : '🟡';
            const latency = ch.lastLatency ? `${ch.lastLatency}ms` : 'N/A';
            
            return `
                <tr>
                    <td>${statusIcon} ${ch.name || ch.id}</td>
                    <td>${ch.type}</td>
                    <td>${ch.state}</td>
                    <td>${latency}</td>
                    <td>${ch.isPaused ? 'Paused' : 'Active'}</td>
                </tr>
            `;
        }).join('');
    }
    
    const watchInfo = currentWatch 
        ? `<p><strong>Active Watch:</strong> Started ${new Date(currentWatch.startTime).toLocaleString()}</p>`
        : `
            <p><strong>No active watch</strong></p>
            <p>Click "Start Watch" in the command palette or use the tree view to begin monitoring.</p>
            <p>💡 <em>Tip: Health Watch runs background probes at low frequency. Start a watch session for intensive monitoring with automated reports.</em></p>
        `;
    
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Health Watch Details</title>
            <style>
                body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { text-align: left; padding: 8px; border-bottom: 1px solid var(--vscode-panel-border); }
                th { background-color: var(--vscode-editor-background); }
                .watch-info { background-color: var(--vscode-textBlockQuote-background); padding: 10px; border-radius: 4px; }
            </style>
        </head>
        <body>
            <h1>Health Watch Status</h1>
            <div class="watch-info">
                ${watchInfo}
            </div>
            <h2>Channel Status</h2>
            <table>
                <thead>
                    <tr>
                        <th>Channel</th>
                        <th>Type</th>
                        <th>State</th>
                        <th>Latency</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${channelRows}
                </tbody>
            </table>
        </body>
        </html>
    `;
}

export function deactivate(): void {
    if (healthWatchAPI) {
        healthWatchAPI.dispose();
    }
    console.log('Health Watch extension deactivated');
}
