/**
 * @fileoverview Health Watch Public API
 * 
 * This module provides the main public API for the Health Watch VS Code extension.
 * It serves as the primary interface for programmatic interaction with the monitoring system.
 * 
 * @module api
 * @version 1.0.0
 * @author Health Watch Extension
 * 
 * @description
 * The HealthWatchAPI provides methods for:
 * - Starting and stopping monitoring sessions (watches)
 * - Managing channel definitions and custom guards
 * - Accessing monitoring data and statistics
 * - Generating and exporting reports
 * - Subscribing to monitoring events
 * 
 * @interfaces
 * - HealthWatchAPI: Main public interface with all monitoring operations
 * 
 * @dependencies
 * - vscode: VS Code Extension API for UI integration and file operations
 * - events: Node.js EventEmitter for event-driven architecture
 * - ./types: Core type definitions (Sample, ChannelInfo, etc.)
 * - ./config: Configuration management (ChannelDefinition, GuardDefinition)
 * - ./guards: Guard system for conditional monitoring
 * - ./runner/scheduler: Core monitoring scheduler
 * - ./storage: Data persistence layer
 * - ./stats: Statistics calculation and analysis
 * - ./report: Report generation and export
 * 
 * @example
 * ```typescript
 * // Get API instance from extension activation
 * const api = vscode.extensions.getExtension('GSejas.health-watch')?.exports;
 * 
 * // Start a monitoring session
 * await api.startWatch({ duration: '1h' });
 * 
 * // Subscribe to monitoring events
 * api.onSample(({id, sample}) => {
 *   console.log(`Channel ${id}: ${sample.success ? 'OK' : 'FAIL'}`);
 * });
 * 
 * // Export monitoring data
 * const report = await api.exportJSON({ windowMs: 3600000 });
 * ```
 * 
 * @see {@link ./types.ts} for data structure definitions
 * @see {@link ./config.ts} for configuration management
 * @see {@link ../docs/testing/manual-test-plan.md} for testing procedures
 */

import * as vscode from 'vscode';
import { EventEmitter } from 'events';
import { Sample, ChannelInfo } from './types';
import { ChannelDefinition, GuardDefinition, ConfigManager } from './config';
import { GuardImpl, GuardManager } from './guards';
import { Scheduler } from './runner/scheduler';
import { StorageManager } from './storage';
import { DataExporter } from './export';
import { ReportGenerator } from './report';
import { IndividualWatchManager } from './watch/individualWatchManager';

export interface HealthWatchAPI {
    registerChannel(def: ChannelDefinition): vscode.Disposable;
    registerGuard(name: string, impl: GuardImpl): vscode.Disposable;
    startWatch(opts?: { duration: '1h' | '12h' | 'forever' | number }): void;
    stopWatch(): void;
    runChannelNow(id: string): Promise<Sample>;
    onSample(cb: (e: { id: string; sample: Sample }) => void): vscode.Disposable;
    onStateChange(cb: (e: { id: string; state: string }) => void): vscode.Disposable;
    openLastReport(): Promise<void>;
    exportJSON(opts?: { windowMs?: number; path?: string }): Promise<vscode.Uri>;
    listChannels(): ChannelInfo[];
}

export class HealthWatchAPIImpl implements HealthWatchAPI {
    // Promise that resolves when the extension initialization has completed and the
    // real runtime components (scheduler, storage, etc.) are available.
    public ready: Promise<void> = Promise.resolve();
    private scheduler: Scheduler;
    private storageManager = StorageManager.getInstance();
    private guardManager = GuardManager.getInstance();
    private dataExporter = new DataExporter();
    private reportGenerator = new ReportGenerator();
    private eventEmitter = new EventEmitter();
    private dynamicChannels = new Map<string, ChannelDefinition>();
    private lastReportPath: string | null = null;
    public individualWatchManager?: IndividualWatchManager;

    constructor(scheduler: Scheduler | null) {
        this.scheduler = scheduler as any;
        if (scheduler) {
            this.setupEventForwarding();
        }
    }

    private setupEventForwarding() {
        if (!this.scheduler) {
            return; // Skip if scheduler is null during initialization
        }
        
        this.scheduler.on('sample', (event) => {
            this.eventEmitter.emit('sample', event);
        });

        this.scheduler.on('stateChange', (event) => {
            this.eventEmitter.emit('stateChange', event);
        });
    }

    registerChannel(def: ChannelDefinition): vscode.Disposable {
        // Validate channel definition
        if (!def.id || !def.type) {
            throw new Error('Channel definition must have id and type');
        }

        if (this.dynamicChannels.has(def.id)) {
            throw new Error(`Channel with id '${def.id}' already exists`);
        }

        // Store the dynamic channel
        this.dynamicChannels.set(def.id, def);
        
        // Refresh scheduler to pick up new channel (only if scheduler is ready)
        if (this.scheduler) {
            this.scheduler.refreshChannels();
        }

        return new vscode.Disposable(() => {
            this.dynamicChannels.delete(def.id);
            if (this.scheduler) {
                this.scheduler.refreshChannels();
            }
        });
    }

    registerGuard(name: string, impl: GuardImpl): vscode.Disposable {
        this.guardManager.registerGuard(name, impl);

        return new vscode.Disposable(() => {
            this.guardManager.removeGuard(name);
        });
    }

    startWatch(opts?: { duration: '1h' | '12h' | 'forever' | number }): void {
        if (!this.scheduler) {
            throw new Error('Health Watch is still initializing. Please try again in a moment.');
        }
        
        const duration = opts?.duration || '1h';
        const session = this.storageManager.startWatch(duration);
        
        // Trigger immediate probes for all channels
        this.scheduler.runAllChannelsNow().catch(error => {
            console.error('Failed to run initial probes for watch:', error);
        });

        // Schedule watch end if not forever
        if (duration !== 'forever' && typeof duration !== 'number') {
            const durationMs = this.parseDuration(duration);
            setTimeout(() => {
                this.stopWatch();
            }, durationMs);
        } else if (typeof duration === 'number') {
            setTimeout(() => {
                this.stopWatch();
            }, duration);
        }
    }

    stopWatch(): void {
        const endedSession = this.storageManager.endWatch();
        if (endedSession) {
            this.generateWatchReport(endedSession);
        }
    }

    async runChannelNow(id: string): Promise<Sample> {
        if (!this.scheduler) {
            throw new Error('Health Watch is still initializing. Please try again in a moment.');
        }
        return await this.scheduler.runChannelNow(id);
    }

    onSample(cb: (e: { id: string; sample: Sample }) => void): vscode.Disposable {
        this.eventEmitter.on('sample', cb);
        return new vscode.Disposable(() => {
            this.eventEmitter.removeListener('sample', cb);
        });
    }

    onStateChange(cb: (e: { id: string; state: string }) => void): vscode.Disposable {
        this.eventEmitter.on('stateChange', cb);
        return new vscode.Disposable(() => {
            this.eventEmitter.removeListener('stateChange', cb);
        });
    }

    async openLastReport(): Promise<void> {
        if (!this.lastReportPath) {
            throw new Error('No report available');
        }

        const doc = await vscode.workspace.openTextDocument(this.lastReportPath);
        await vscode.window.showTextDocument(doc);
    }

    async exportJSON(opts?: { windowMs?: number; path?: string }): Promise<vscode.Uri> {
        return await this.dataExporter.exportJSON(opts);
    }

    listChannels(): ChannelInfo[] {
        if (!this.scheduler) {
            // Return empty array if scheduler is not ready yet
            return [];
        }
        
        const scheduleInfo = this.scheduler.getScheduleInfo();
        const channelStates = this.scheduler.getChannelRunner().getChannelStates();
        const allChannels = this.getAllChannels();

        return allChannels.map(channel => {
            const state = channelStates.get(channel.id);
            const schedule = scheduleInfo.get(channel.id);

            return {
                id: channel.id,
                name: channel.name,
                description: channel.description,
                type: channel.type,
                state: state?.state || 'unknown',
                lastLatency: state?.lastSample?.latencyMs,
                nextProbe: schedule?.nextRun,
                isPaused: schedule?.isPaused || false
            };
        });
    }

    private async generateWatchReport(session: any) {
        try {
            const { markdownPath } = await this.reportGenerator.generateReport(session);
            this.lastReportPath = markdownPath;

            // Auto-open report if configured
            const reportConfig = (this.storageManager as any).configManager?.getReportConfig?.() || { autoOpen: true };
            if (reportConfig.autoOpen) {
                await this.openLastReport();
            }
        } catch (error) {
            console.error('Failed to generate watch report:', error);
            vscode.window.showErrorMessage(`Failed to generate report: ${error}`);
        }
    }

    private parseDuration(duration: '1h' | '12h'): number {
        switch (duration) {
            case '1h': return 60 * 60 * 1000;
            case '12h': return 12 * 60 * 60 * 1000;
            default: return 60 * 60 * 1000;
        }
    }

    private getAllChannels(): ChannelDefinition[] {
        // Get workspace channels from ConfigManager
        const configManager = ConfigManager.getInstance();
        const workspaceChannels = configManager.getChannels();
        
        // Merge with dynamic channels
        const allChannels = [...workspaceChannels];
        for (const dynamicChannel of this.dynamicChannels.values()) {
            if (!allChannels.find(ch => ch.id === dynamicChannel.id)) {
                allChannels.push(dynamicChannel);
            }
        }
        
        return allChannels;
    }

    // Additional API methods for advanced usage
    
    getCurrentWatch() {
        return this.storageManager.getCurrentWatch();
    }

    getChannelStates() {
        return this.scheduler.getChannelRunner().getChannelStates();
    }

    pauseChannel(id: string): void {
        this.scheduler.pauseChannel(id);
    }

    resumeChannel(id: string): void {
        this.scheduler.resumeChannel(id);
    }

    isChannelPaused(id: string): boolean {
        return this.scheduler.getChannelRunner().isChannelPaused(id);
    }

    async exportCSV(opts?: { windowMs?: number; path?: string }): Promise<vscode.Uri> {
        return await this.dataExporter.exportCSV(opts);
    }

    getLastReportPath(): string | null {
        return this.lastReportPath;
    }

    // Event forwarding methods
    emit(event: string, ...args: any[]): void {
        this.eventEmitter.emit(event, ...args);
    }

    on(event: string, listener: (...args: any[]) => void): vscode.Disposable {
        this.eventEmitter.on(event, listener);
        return new vscode.Disposable(() => {
            this.eventEmitter.removeListener(event, listener);
        });
    }

    dispose(): void {
        this.eventEmitter.removeAllListeners();
        this.dynamicChannels.clear();
    }
}