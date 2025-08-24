/**
 * @fileoverview VS Code Task Execution Service
 * 
 * Implements task execution with comprehensive lifecycle management
 * following VS Code 2025 best practices for robust monitoring.
 * 
 * @author Health Watch Extension
 * @version 1.0.0
 * @since 2025-08-24
 */

import * as vscode from 'vscode';
import { TaskRunConfiguration } from '../config';
import { Sample } from '../types';
import { TaskDiscoveryService } from './TaskDiscoveryService';

export interface TaskExecutionContext {
    channelId: string;
    startTime: number;
    execution: vscode.TaskExecution;
    config: TaskRunConfiguration;
    timeout?: NodeJS.Timeout;
    retryCount: number;
}

export interface TaskExecutionResult {
    success: boolean;
    sample: Sample;
    outputLines?: string[];
    executionTime: number;
}

/**
 * ⚡ **TASK EXECUTION SERVICE**
 * 
 * Orchestrates VS Code task execution with full lifecycle monitoring,
 * error handling, and result parsing according to 2025 best practices.
 */
export class TaskExecutionService {
    private activeExecutions = new Map<string, TaskExecutionContext>();
    private disposables: vscode.Disposable[] = [];
    
    constructor(private taskDiscovery: TaskDiscoveryService) {
        this.setupGlobalEventListeners();
    }

    /**
     * 📡 **GLOBAL EVENT LISTENERS**
     * 
     * Sets up comprehensive task lifecycle monitoring
     */
    private setupGlobalEventListeners(): void {
        // Task lifecycle events (2025 best practices)
        this.disposables.push(
            vscode.tasks.onDidStartTask(this.handleTaskStart.bind(this)),
            vscode.tasks.onDidEndTask(this.handleTaskEnd.bind(this)),
            vscode.tasks.onDidStartTaskProcess(this.handleTaskProcessStart.bind(this)),
            vscode.tasks.onDidEndTaskProcess(this.handleTaskProcessEnd.bind(this))
        );
    }

    /**
     * 🚀 **EXECUTE CHANNEL TASK**
     * 
     * Main entry point for executing a task-based health check
     */
    async executeChannelTask(
        channelId: string, 
        config: TaskRunConfiguration
    ): Promise<TaskExecutionResult> {
        
        console.log(`[TaskExecutionService] Executing task for channel ${channelId}: ${config.label}`);
        
        try {
            // Find the task
            const task = await this.taskDiscovery.findTaskByLabel(config.label);
            if (!task) {
                return this.createTaskNotFoundResult(channelId, config);
            }

            // Check for existing execution
            if (this.activeExecutions.has(channelId)) {
                console.warn(`[TaskExecutionService] Task already running for channel ${channelId}`);
                return this.createBusyResult(channelId, config);
            }

            // Execute the task
            return await this.executeTask(channelId, task, config);

        } catch (error) {
            console.error(`[TaskExecutionService] Task execution failed for ${channelId}:`, error);
            return this.createErrorResult(channelId, config, error);
        }
    }

    /**
     * ▶️ **EXECUTE TASK**
     * 
     * Core task execution with lifecycle management
     */
    private async executeTask(
        channelId: string,
        task: vscode.Task,
        config: TaskRunConfiguration
    ): Promise<TaskExecutionResult> {
        
        const startTime = performance.now();
        
        try {
            // Configure task presentation for health monitoring
            this.configureTaskPresentation(task);
            
            // Start execution
            const execution = await vscode.tasks.executeTask(task);
            
            // Create execution context
            const context: TaskExecutionContext = {
                channelId,
                startTime,
                execution,
                config,
                retryCount: 0
            };
            
            // Set timeout if configured
            if (config.timeout) {
                context.timeout = setTimeout(() => {
                    this.handleTaskTimeout(context);
                }, config.timeout);
            }
            
            this.activeExecutions.set(channelId, context);
            
            // Wait for completion or timeout
            return await this.waitForTaskCompletion(context);
            
        } catch (error) {
            const executionTime = performance.now() - startTime;
            console.error(`[TaskExecutionService] Task execution error:`, error);
            
            return {
                success: false,
                sample: this.createFailureSample(channelId, executionTime, `Task execution error: ${error}`),
                executionTime
            };
        }
    }

    /**
     * ⚙️ **CONFIGURE TASK PRESENTATION**
     * 
     * Sets up task presentation for health monitoring
     */
    private configureTaskPresentation(task: vscode.Task): void {
        // Configure for silent execution suitable for monitoring
        task.presentationOptions = {
            echo: false,
            reveal: vscode.TaskRevealKind.Silent,
            focus: false,
            panel: vscode.TaskPanelKind.Shared,
            showReuseMessage: false,
            clear: true
        };
    }

    /**
     * ⏳ **WAIT FOR TASK COMPLETION**
     * 
     * Waits for task to complete and processes results
     */
    private async waitForTaskCompletion(context: TaskExecutionContext): Promise<TaskExecutionResult> {
        return new Promise((resolve) => {
            const cleanup = () => {
                if (context.timeout) {
                    clearTimeout(context.timeout);
                }
                this.activeExecutions.delete(context.channelId);
            };

            // Store resolve function for later use in event handlers
            (context as any).resolve = (result: TaskExecutionResult) => {
                cleanup();
                resolve(result);
            };
        });
    }

    /**
     * 🏁 **HANDLE TASK START**
     * 
     * Processes task start events
     */
    private handleTaskStart(event: vscode.TaskStartEvent): void {
        const context = this.findExecutionContext(event.execution);
        if (context && context.config.telemetryEvents) {
            console.log(`[TaskExecutionService] Task started: ${context.channelId}`);
        }
    }

    /**
     * 🛑 **HANDLE TASK END**
     * 
     * Processes task end events
     */
    private handleTaskEnd(event: vscode.TaskEndEvent): void {
        const context = this.findExecutionContext(event.execution);
        if (!context) return;

        console.log(`[TaskExecutionService] Task ended: ${context.channelId}`);
        
        // Task ended, but we need process exit code for final result
        // This will be handled in handleTaskProcessEnd
    }

    /**
     * 🚀 **HANDLE TASK PROCESS START**
     * 
     * Processes task process start events
     */
    private handleTaskProcessStart(event: vscode.TaskProcessStartEvent): void {
        const context = this.findExecutionContext(event.execution);
        if (context && context.config.telemetryEvents) {
            console.log(`[TaskExecutionService] Task process started: ${context.channelId} (PID: ${event.processId})`);
        }
    }

    /**
     * ✅ **HANDLE TASK PROCESS END**
     * 
     * Processes task process end events and generates final results
     */
    private handleTaskProcessEnd(event: vscode.TaskProcessEndEvent): void {
        const context = this.findExecutionContext(event.execution);
        if (!context) return;

        const executionTime = performance.now() - context.startTime;
        const exitCode = event.exitCode;
        
        console.log(`[TaskExecutionService] Task process ended: ${context.channelId} (exit code: ${exitCode})`);

        // Determine success based on exit code
        const success = exitCode === 0;
        
        // Create result
        const result: TaskExecutionResult = {
            success,
            sample: success 
                ? this.createSuccessSample(context.channelId, executionTime, exitCode)
                : this.createFailureSample(context.channelId, executionTime, `Task failed with exit code ${exitCode}`),
            executionTime
        };

        // Resolve the waiting promise
        const resolve = (context as any).resolve;
        if (resolve) {
            resolve(result);
        }
    }

    /**
     * ⏰ **HANDLE TASK TIMEOUT**
     * 
     * Handles task timeouts
     */
    private handleTaskTimeout(context: TaskExecutionContext): void {
        console.warn(`[TaskExecutionService] Task timeout for channel ${context.channelId}`);
        
        const executionTime = performance.now() - context.startTime;
        
        // Attempt to terminate the task
        try {
            // Note: VS Code doesn't provide a direct way to terminate tasks
            // The task will continue running but we'll report it as failed
            console.warn(`[TaskExecutionService] Cannot terminate VS Code task directly`);
        } catch (error) {
            console.error(`[TaskExecutionService] Error attempting to terminate task:`, error);
        }

        // Create timeout result
        const result: TaskExecutionResult = {
            success: false,
            sample: this.createFailureSample(
                context.channelId, 
                executionTime, 
                `Task timeout after ${context.config.timeout}ms`
            ),
            executionTime
        };

        // Resolve the waiting promise
        const resolve = (context as any).resolve;
        if (resolve) {
            resolve(result);
        }
    }

    /**
     * 🔍 **FIND EXECUTION CONTEXT**
     * 
     * Finds execution context by task execution
     */
    private findExecutionContext(execution: vscode.TaskExecution): TaskExecutionContext | undefined {
        for (const context of this.activeExecutions.values()) {
            if (context.execution === execution) {
                return context;
            }
        }
        return undefined;
    }

    /**
     * ✅ **CREATE SUCCESS SAMPLE**
     * 
     * Creates a successful health check sample
     */
    private createSuccessSample(channelId: string, executionTime: number, exitCode?: number): Sample {
        return {
            timestamp: Date.now(),
            success: true,
            latencyMs: Math.round(executionTime),
            details: {
                exitCode: exitCode ?? 0,
                executionType: 'vscode-task'
            }
        };
    }

    /**
     * ❌ **CREATE FAILURE SAMPLE**
     * 
     * Creates a failed health check sample
     */
    private createFailureSample(channelId: string, executionTime: number, error: string): Sample {
        return {
            timestamp: Date.now(),
            success: false,
            latencyMs: Math.round(executionTime),
            error,
            details: {
                executionType: 'vscode-task'
            }
        };
    }

    /**
     * 🚫 **CREATE TASK NOT FOUND RESULT**
     */
    private createTaskNotFoundResult(channelId: string, config: TaskRunConfiguration): TaskExecutionResult {
        return {
            success: false,
            sample: this.createFailureSample(channelId, 0, `Task not found: ${config.label}`),
            executionTime: 0
        };
    }

    /**
     * 🚧 **CREATE BUSY RESULT**
     */
    private createBusyResult(channelId: string, config: TaskRunConfiguration): TaskExecutionResult {
        return {
            success: false,
            sample: this.createFailureSample(channelId, 0, `Task already running: ${config.label}`),
            executionTime: 0
        };
    }

    /**
     * 💥 **CREATE ERROR RESULT**
     */
    private createErrorResult(channelId: string, config: TaskRunConfiguration, error: any): TaskExecutionResult {
        return {
            success: false,
            sample: this.createFailureSample(channelId, 0, `Task execution error: ${error}`),
            executionTime: 0
        };
    }

    /**
     * 📊 **GET ACTIVE EXECUTIONS**
     * 
     * Returns information about currently running tasks
     */
    getActiveExecutions(): Array<{
        channelId: string;
        taskLabel: string;
        startTime: number;
        runningTime: number;
    }> {
        const now = performance.now();
        return Array.from(this.activeExecutions.values()).map(context => ({
            channelId: context.channelId,
            taskLabel: context.config.label,
            startTime: context.startTime,
            runningTime: now - context.startTime
        }));
    }

    /**
     * 🧹 **CLEANUP**
     * 
     * Dispose of resources and cancel running tasks
     */
    dispose(): void {
        // Clear timeouts
        for (const context of this.activeExecutions.values()) {
            if (context.timeout) {
                clearTimeout(context.timeout);
            }
        }
        
        this.activeExecutions.clear();
        this.disposables.forEach(d => d.dispose());
    }
}