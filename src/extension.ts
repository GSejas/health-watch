import * as vscode from 'vscode';
import { ConfigManager } from './config';
import { StorageManager } from './storage';
import { GuardManager } from './guards';
import { Scheduler } from './runner/scheduler';
import { StatusBarManager } from './ui/statusBar';
import { ChannelTreeProvider } from './ui/treeView';
import { StatusTreeDataProvider } from './ui/statusTreeView';
import { IncidentsTreeProvider } from './ui/incidentsTreeView';
import { NotificationManager } from './ui/notifications';
import { DashboardManager } from './ui/dashboard';
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
        
        // Wait for storage to be ready before creating components that depend on it
        // Note: We return the API immediately but start async initialization
        const initPromise = initializeAsync(context, configManager, storageManager, guardManager);
        
        // Return API immediately - the async initialization will complete in background
        return createHealthWatchAPI(initPromise);
        
    } catch (error) {
        console.error('Failed to activate Health Watch extension:', error);
        vscode.window.showErrorMessage(`Health Watch activation failed: ${error}`);
        throw error;
    }
}

async function initializeAsync(
    context: vscode.ExtensionContext, 
    configManager: ConfigManager, 
    storageManager: StorageManager, 
    guardManager: GuardManager
): Promise<{
    scheduler: Scheduler;
    statusBarManager: StatusBarManager;
    treeProvider: ChannelTreeProvider;
    notificationManager: NotificationManager;
    dashboardManager: DashboardManager;
    statusProvider: StatusTreeDataProvider;
    incidentsProvider: IncidentsTreeProvider;
    dataExporter: DataExporter;
    reportGenerator: ReportGenerator;
    healthWatchAPI: HealthWatchAPIImpl;
}> {
    // Wait for storage to be ready
    await storageManager.whenReady();
    console.log('Storage is ready, initializing components...');
    
    // Now safely initialize scheduler and runners
    const scheduler = new Scheduler();
    
    // Initialize UI components
    const statusBarManager = new StatusBarManager(scheduler);
    const treeProvider = new ChannelTreeProvider(scheduler);
    const notificationManager = new NotificationManager(scheduler);
    const dashboardManager = new DashboardManager(scheduler);

    const statusProvider = new StatusTreeDataProvider(scheduler);
    const incidentsProvider = new IncidentsTreeProvider();

    // Initialize utilities
    const dataExporter = new DataExporter();
    const reportGenerator = new ReportGenerator();
    
    // Initialize public API
    const healthWatchAPIInstance = new HealthWatchAPIImpl(scheduler);
    
    // Register tree views
    const treeView = vscode.window.createTreeView('healthWatchChannels', {
        treeDataProvider: treeProvider,
        showCollapseAll: false
    });
    
    const statusTreeView = vscode.window.createTreeView('healthWatchStatus', {
        treeDataProvider: statusProvider,
        showCollapseAll: false
    });
    
    const incidentsTreeView = vscode.window.createTreeView('healthWatchIncidents', {
        treeDataProvider: incidentsProvider,
        showCollapseAll: false
    });
    
    // Register commands
    registerCommands(context, scheduler, healthWatchAPIInstance, dataExporter, reportGenerator, treeProvider, notificationManager, dashboardManager, statusBarManager, incidentsProvider);
    
    // Set context for when clauses
    vscode.commands.executeCommand('setContext', 'healthWatch.enabled', configManager.isEnabled());
    
    // Load configuration and start monitoring
    await setupExtension(configManager, guardManager, scheduler);
    
    // Register disposables
    context.subscriptions.push(
        statusBarManager,
        treeProvider,
        statusProvider,
        incidentsProvider,
        treeView,
        statusTreeView,
        incidentsTreeView,
        notificationManager,
        dashboardManager,
        healthWatchAPIInstance,
        configManager
    );
    
    console.log('Health Watch extension activated successfully');
    
    return {
        scheduler,
        statusBarManager,
        treeProvider,
        notificationManager,
        dashboardManager,
        statusProvider,
        incidentsProvider,
        dataExporter,
        reportGenerator,
        healthWatchAPI: healthWatchAPIInstance
    };
}

function createHealthWatchAPI(initPromise: Promise<any>): HealthWatchAPIImpl {
    // Create a placeholder API that will be populated once initialization completes
    const api = new HealthWatchAPIImpl(null as any); // Temporary null scheduler
    
    // Initialize properly in background
    initPromise.then(async (components) => {
        console.log('Async initialization completed');
        const { healthWatchAPI: realAPI } = components;
        
        // Replace the placeholder API properties with the real ones
        Object.setPrototypeOf(api, Object.getPrototypeOf(realAPI));
        Object.assign(api, realAPI);
        
        // Store global reference
        healthWatchAPI = api;
    }).catch(error => {
        console.error('Failed to complete async initialization:', error);
        vscode.window.showErrorMessage(`Health Watch initialization failed: ${error}`);
    });
    
    return api;
}

function registerCommands(
    context: vscode.ExtensionContext,
    scheduler: Scheduler,
    api: HealthWatchAPIImpl,
    dataExporter: DataExporter,
    reportGenerator: ReportGenerator,
    treeProvider: ChannelTreeProvider,
    notificationManager: NotificationManager,
    dashboardManager: DashboardManager,
    statusBarManager?: StatusBarManager,
    incidentsProvider?: IncidentsTreeProvider
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
        }],

        ['healthWatch.openDashboard', async () => {
            try {
                await dashboardManager.openDashboard(context);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to open dashboard: ${error}`);
            }
        }],

        ['healthWatch.addIncident', async () => {
            if (incidentsProvider) {
                await incidentsProvider.addIncident();
            }
        }],

        ['healthWatch.editIncident', async (item) => {
            if (incidentsProvider && item) {
                await incidentsProvider.editIncident(item);
            }
        }],

        ['healthWatch.deleteIncident', async (item) => {
            if (incidentsProvider && item) {
                await incidentsProvider.deleteIncident(item);
            }
        }],

        ['healthWatch.refreshIncidents', () => {
            if (incidentsProvider) {
                incidentsProvider.refresh();
            }
        }],

        ['healthWatch.resetDemoIncidents', async () => {
            if (incidentsProvider) {
                await incidentsProvider.resetDemoIncidents();
            }
        }],

        ['healthWatch.showActiveSnoozes', async () => {
            try {
                await notificationManager.showActiveSnoozes();
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to show active snoozes: ${error}`);
            }
        }],

        ['healthWatch.clearAllSnoozes', async () => {
            try {
                await notificationManager.clearAllSnoozes();
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to clear snoozes: ${error}`);
            }
        }],

        ['healthWatch.openConfig', async () => {
            try {
                const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                if (!workspaceFolder) {
                    vscode.window.showErrorMessage('No workspace folder found');
                    return;
                }
                
                const configPath = vscode.Uri.joinPath(workspaceFolder.uri, '.healthwatch.json');
                
                try {
                    // Try to open existing config
                    const doc = await vscode.workspace.openTextDocument(configPath);
                    await vscode.window.showTextDocument(doc);
                } catch (error) {
                    // Config doesn't exist, create it
                    const choice = await vscode.window.showInformationMessage(
                        'No .healthwatch.json found. Create a new configuration file?',
                        'Create',
                        'Cancel'
                    );
                    
                    if (choice === 'Create') {
                        const defaultConfig = {
                            "$schema": "./resources/schema/vscode-healthwatch.schema.json",
                            "defaults": {
                                "intervalSec": 60,
                                "timeoutMs": 3000,
                                "threshold": 3,
                                "jitterPct": 10
                            },
                            "guards": {},
                            "channels": [
                                {
                                    "id": "example",
                                    "name": "Example Service",
                                    "type": "https",
                                    "url": "https://example.com/health",
                                    "expect": {
                                        "statusRange": [200, 299]
                                    }
                                }
                            ]
                        };
                        
                        const configContent = JSON.stringify(defaultConfig, null, 2);
                        await vscode.workspace.fs.writeFile(configPath, Buffer.from(configContent, 'utf8'));
                        
                        const doc = await vscode.workspace.openTextDocument(configPath);
                        await vscode.window.showTextDocument(doc);
                        
                        vscode.window.showInformationMessage('Created .healthwatch.json with example configuration');
                    }
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to open configuration: ${error}`);
            }
        }],

        // Individual Channel Watch Commands
        ['healthWatch.startChannelWatch', async (item?: any) => {
            try {
                // item can be a TreeItem from context menu or undefined from command palette
                const channelId = item?.channelId || item?.id;
                
                if (!channelId) {
                    // Show channel picker if no channel specified
                    const channels = api.listChannels();
                    if (channels.length === 0) {
                        vscode.window.showWarningMessage('No channels configured');
                        return;
                    }
                    
                    const channelItems = channels.map(ch => ({ 
                        label: ch.name || ch.id, 
                        description: ch.type, 
                        channelId: ch.id 
                    }));
                    
                    const selectedChannel = await vscode.window.showQuickPick(channelItems, 
                        { placeHolder: 'Select channel to watch' }
                    );
                    
                    if (!selectedChannel) return;
                    
                    const duration = await showWatchDurationPicker();
                    if (!duration) return;
                    
                    api.individualWatchManager?.startChannelWatch(selectedChannel.channelId, { duration: duration as any });
                    vscode.window.showInformationMessage(`Started individual watch for ${selectedChannel.label}`);
                } else {
                    // Start watch for specific channel
                    const duration = await showWatchDurationPicker();
                    if (!duration) return;
                    
                    api.individualWatchManager?.startChannelWatch(channelId, { duration: duration as any });
                    vscode.window.showInformationMessage(`Started individual watch for channel ${channelId}`);
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to start channel watch: ${error}`);
            }
        }],

        ['healthWatch.stopChannelWatch', async (item?: any) => {
            try {
                const channelId = item?.channelId || item?.id;
                
                if (!channelId) {
                    // Show active watches picker
                    const activeWatches = api.individualWatchManager?.getActiveWatches() || [];
                    if (activeWatches.length === 0) {
                        vscode.window.showInformationMessage('No active individual watches');
                        return;
                    }
                    
                    const watchItems = activeWatches.map((watch: any) => ({ 
                        label: `${watch.channelId}`, 
                        description: `Started ${new Date(watch.startTime).toLocaleTimeString()}`,
                        channelId: watch.channelId 
                    }));
                    
                    const selectedWatch = await vscode.window.showQuickPick(watchItems,
                        { placeHolder: 'Select watch to stop' }
                    );
                    
                    if (!selectedWatch) return;
                    
                    api.individualWatchManager?.stopChannelWatch(selectedWatch.channelId);
                    vscode.window.showInformationMessage(`Stopped individual watch for ${selectedWatch.label}`);
                } else {
                    // Stop watch for specific channel
                    api.individualWatchManager?.stopChannelWatch(channelId);
                    vscode.window.showInformationMessage(`Stopped individual watch for channel ${channelId}`);
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to stop channel watch: ${error}`);
            }
        }],

        ['healthWatch.toggleDebugMode', () => {
            if (statusBarManager) {
                statusBarManager.toggleDebugMode();
                const isEnabled = statusBarManager.isDebugModeEnabled();
                vscode.window.showInformationMessage(
                    `Health Watch debug mode ${isEnabled ? 'enabled' : 'disabled'}`
                );
            } else {
                vscode.window.showWarningMessage('Status bar manager not available');
            }
        }],

        ['healthWatch.runInternetCheck', async () => {
            try {
                // Find internet channel and run it immediately
                const channels = api.listChannels();
                const internetChannel = channels.find(ch => 
                    ch.id === 'internet' || 
                    ch.name?.toLowerCase().includes('internet') ||
                    ch.type === 'https'
                );
                
                if (internetChannel) {
                    await api.runChannelNow(internetChannel.id);
                    vscode.window.showInformationMessage(`Internet check completed for ${internetChannel.name || internetChannel.id}`);
                } else {
                    vscode.window.showWarningMessage('No internet channel found to test');
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Internet check failed: ${error}`);
            }
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
