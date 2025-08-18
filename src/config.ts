/**
 * @fileoverview Configuration Management System
 * 
 * This module handles all aspects of Health Watch configuration including:
 * - JSON schema validation for .healthwatch.json files
 * - Workspace configuration detection and loading
 * - VS Code settings integration
 * - Configuration file watching and hot-reload
 * - Default configuration generation
 * 
 * @module config
 * @version 1.0.0
 * @author Health Watch Extension
 * 
 * @description
 * The configuration system is responsible for:
 * - Loading and validating .healthwatch.json configuration files
 * - Managing channel definitions for different probe types (HTTPS, TCP, DNS, Script)
 * - Handling guard definitions for conditional monitoring
 * - Integrating with VS Code workspace settings
 * - Providing real-time configuration updates via file watching
 * 
 * @interfaces
 * - ChannelDefinition: Defines individual monitoring channels
 * - GuardDefinition: Defines conditional guard checks
 * - HealthWatchConfig: Complete configuration structure
 * - ExpectationRules: HTTP response validation rules
 * 
 * @classes
 * - ConfigManager: Singleton manager for all configuration operations
 * 
 * @dependencies
 * - vscode: VS Code API for workspace and settings integration
 * - fs: File system operations for configuration loading
 * - path: Path utilities for file resolution
 * - ajv: JSON schema validation library
 * - ../resources/schema/vscode-healthwatch.schema.json: Configuration schema
 * 
 * @validation
 * Uses JSON Schema (Draft 7) to validate:
 * - Required fields for each probe type
 * - Data type validation (numbers, strings, arrays)
 * - Format validation (URLs, hostnames, ports)
 * - Conditional validation based on probe type
 * - Guard reference validation
 * 
 * @example
 * ```typescript
 * const configManager = ConfigManager.getInstance();
 * 
 * // Load configuration from workspace
 * await configManager.loadWorkspaceConfig();
 * 
 * // Get validated channel definitions
 * const channels = configManager.getChannels();
 * 
 * // Watch for configuration changes
 * configManager.onConfigChange(() => {
 *   console.log('Configuration updated');
 * });
 * ```
 * 
 * @see {@link ../resources/schema/vscode-healthwatch.schema.json} for schema definition
 * @see {@link ../docs/testing/manual-test-plan.md#configuration-management-tests} for testing
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import Ajv from 'ajv';

export interface ProbeDefaults {
    intervalSec: number;
    timeoutMs: number;
    threshold: number;
    jitterPct: number;
}

export interface GuardDefinition {
    type: 'netIfUp' | 'dns';
    name?: string;
    hostname?: string;
}

export interface ExpectationRules {
    status?: number[];
    statusRange?: [number, number];
    headerHas?: Record<string, string>;
    bodyRegex?: string;
    treatAuthAsReachable?: boolean;
}

export interface ChannelDefinition {
    id: string;
    name?: string;
    description?: string;
    type: 'https' | 'tcp' | 'dns' | 'script';
    intervalSec?: number;
    timeoutMs?: number;
    threshold?: number;
    jitterPct?: number;
    guards?: string[];
    
    url?: string;
    expect?: ExpectationRules;
    
    target?: string;
    
    hostname?: string;
    recordType?: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT';
    
    command?: string;
    shell?: 'cmd' | 'powershell' | 'bash';
}

export interface HealthWatchConfig {
    defaults?: ProbeDefaults;
    guards?: Record<string, GuardDefinition>;
    channels?: ChannelDefinition[];
}

export interface WatchConfig {
    defaultDuration: '1h' | '12h' | 'forever';
    highCadenceIntervalSec: number;
}

export interface QuietHoursConfig {
    enabled: boolean;
    start: string;
    end: string;
}

export interface ReportConfig {
    autoOpen: boolean;
    includeSequenceDiagram: boolean;
    includeTopologyDiagram: boolean;
    sloTarget: number;
}

export interface OnlyWhenFishyConfig {
    enabled: boolean;
    baselineIntervalSec: number;
}

export class ConfigManager {
    private static instance: ConfigManager;
    private ajv: any;
    private schema: any;
    private workspaceConfig: HealthWatchConfig | null = null;
    private configWatcher: vscode.FileSystemWatcher | null = null;

    private constructor() {
        this.ajv = new Ajv({ allErrors: true });
        this.loadSchema();
        this.setupConfigWatcher();
    }

    static getInstance(): ConfigManager {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }

    private loadSchema() {
        try {
            const schemaPath = path.join(__dirname, '..', 'resources', 'schema', 'vscode-healthwatch.schema.json');
            if (fs.existsSync(schemaPath)) {
                this.schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
            }
        } catch (error) {
            console.error('Failed to load schema:', error);
        }
    }

    private setupConfigWatcher() {
        if (vscode.workspace.workspaceFolders) {
            const pattern = new vscode.RelativePattern(
                vscode.workspace.workspaceFolders[0],
                '.healthwatch.json'
            );
            this.configWatcher = vscode.workspace.createFileSystemWatcher(pattern);
            
            this.configWatcher.onDidChange(() => this.loadWorkspaceConfig());
            this.configWatcher.onDidCreate(() => this.loadWorkspaceConfig());
            this.configWatcher.onDidDelete(() => {
                this.workspaceConfig = null;
                this.notifyConfigChange();
            });
        }
    }

    async loadWorkspaceConfig(): Promise<void> {
        if (!vscode.workspace.workspaceFolders) {
            return;
        }

        const configPath = path.join(
            vscode.workspace.workspaceFolders[0].uri.fsPath,
            '.healthwatch.json'
        );

        try {
            if (fs.existsSync(configPath)) {
                const configContent = fs.readFileSync(configPath, 'utf8');
                const config = JSON.parse(configContent);
                
                if (this.validateConfig(config)) {
                    this.workspaceConfig = config;
                    this.notifyConfigChange();
                } else {
                    vscode.window.showErrorMessage('Invalid .healthwatch.json configuration');
                }
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to load .healthwatch.json: ${error}`);
        }
    }

    private validateConfig(config: any): boolean {
        if (!this.schema) {
            return true;
        }

        const validate = this.ajv.compile(this.schema);
        const isValid = validate(config);
        
        if (!isValid && validate.errors) {
            console.error('Config validation errors:', validate.errors);
        }
        
        return isValid;
    }

    private notifyConfigChange() {
        vscode.commands.executeCommand('healthWatch.refreshChannels');
    }

    getDefaults(): ProbeDefaults {
        const vsConfig = vscode.workspace.getConfiguration('healthWatch.defaults');
        const workspaceDefaults = this.workspaceConfig?.defaults;
        
        return {
            intervalSec: workspaceDefaults?.intervalSec ?? vsConfig.get('intervalSec', 60),
            timeoutMs: workspaceDefaults?.timeoutMs ?? vsConfig.get('timeoutMs', 3000),
            threshold: workspaceDefaults?.threshold ?? vsConfig.get('threshold', 3),
            jitterPct: workspaceDefaults?.jitterPct ?? vsConfig.get('jitterPct', 10),
        };
    }

    getWatchConfig(): WatchConfig {
        const vsConfig = vscode.workspace.getConfiguration('healthWatch.watch');
        return {
            defaultDuration: vsConfig.get('defaultDuration', '1h'),
            highCadenceIntervalSec: vsConfig.get('highCadenceIntervalSec', 15),
        };
    }

    getQuietHoursConfig(): QuietHoursConfig {
        const vsConfig = vscode.workspace.getConfiguration('healthWatch.quietHours');
        return {
            enabled: vsConfig.get('enabled', false),
            start: vsConfig.get('start', '22:00'),
            end: vsConfig.get('end', '08:00'),
        };
    }

    getReportConfig(): ReportConfig {
        const vsConfig = vscode.workspace.getConfiguration('healthWatch.report');
        return {
            autoOpen: vsConfig.get('autoOpen', true),
            includeSequenceDiagram: vsConfig.get('includeSequenceDiagram', false),
            includeTopologyDiagram: vsConfig.get('includeTopologyDiagram', false),
            sloTarget: vsConfig.get('sloTarget', 99.0),
        };
    }

    getOnlyWhenFishyConfig(): OnlyWhenFishyConfig {
        const vsConfig = vscode.workspace.getConfiguration('healthWatch.onlyWhenFishy');
        return {
            enabled: vsConfig.get('enabled', true),
            baselineIntervalSec: vsConfig.get('baselineIntervalSec', 60),
        };
    }

    isEnabled(): boolean {
        return vscode.workspace.getConfiguration('healthWatch').get('enabled', true);
    }

    isScriptProbeEnabled(): boolean {
        return vscode.workspace.getConfiguration('healthWatch.script').get('enabled', false);
    }

    getHttpsConfig() {
        const vsConfig = vscode.workspace.getConfiguration('healthWatch.https');
        return {
            allowProxy: vsConfig.get('allowProxy', true),
            userAgent: vsConfig.get('userAgent', 'Health Watch VS Code Extension'),
        };
    }

    getChannels(): ChannelDefinition[] {
        return this.workspaceConfig?.channels ?? [];
    }

    getGuards(): Record<string, GuardDefinition> {
        return this.workspaceConfig?.guards ?? {};
    }

    isInQuietHours(): boolean {
        const config = this.getQuietHoursConfig();
        if (!config.enabled) {
            return false;
        }

        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        
        const [startHour, startMin] = config.start.split(':').map(Number);
        const [endHour, endMin] = config.end.split(':').map(Number);
        
        const startTime = startHour * 60 + startMin;
        const endTime = endHour * 60 + endMin;
        
        if (startTime <= endTime) {
            return currentTime >= startTime && currentTime <= endTime;
        } else {
            return currentTime >= startTime || currentTime <= endTime;
        }
    }

    dispose() {
        if (this.configWatcher) {
            this.configWatcher.dispose();
        }
    }
}