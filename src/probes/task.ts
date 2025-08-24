/**
 * @fileoverview VS Code Task Probe Implementation
 * 
 * Integrates task execution service with Health Watch probe system.
 * Provides seamless task-based monitoring alongside traditional probes.
 * 
 * @author Health Watch Extension  
 * @version 1.0.0
 * @since 2025-08-24
 */

import * as vscode from 'vscode';
import { ChannelDefinition } from '../config';
import { ProbeResult, Sample } from '../types';
import { TaskDiscoveryService } from '../services/TaskDiscoveryService';
import { TaskExecutionService } from '../services/TaskExecutionService';

/**
 * 🎯 **TASK PROBE**
 * 
 * Executes VS Code tasks as health monitoring probes.
 * Integrates seamlessly with existing Health Watch probe architecture.
 */
export class TaskProbe {
    private static taskDiscoveryService?: TaskDiscoveryService;
    private static taskExecutionService?: TaskExecutionService;

    /**
     * 🏗️ **INITIALIZE SERVICES**
     * 
     * Lazy initialization of task services
     */
    private static initializeServices(): void {
        if (!this.taskDiscoveryService) {
            console.log('[TaskProbe] Initializing task services...');
            
            this.taskDiscoveryService = new TaskDiscoveryService();
            this.taskExecutionService = new TaskExecutionService(this.taskDiscoveryService);
            
            console.log('[TaskProbe] Task services initialized');
        }
    }

    /**
     * 🚀 **EXECUTE TASK PROBE**
     * 
     * Main probe execution method that integrates with Health Watch
     */
    static async executeProbe(channel: ChannelDefinition): Promise<ProbeResult> {
        console.log(`[TaskProbe] Executing task probe for channel: ${channel.id}`);

        // Validate configuration
        if (!channel.runTask) {
            throw new Error('Task probe requires runTask configuration');
        }

        if (!channel.runTask.label) {
            throw new Error('Task probe requires runTask.label');
        }

        // Initialize services
        this.initializeServices();

        const startTime = performance.now();

        try {
            // Execute the task
            const result = await this.taskExecutionService!.executeChannelTask(
                channel.id,
                channel.runTask
            );

            const endTime = performance.now();
            const executionTime = endTime - startTime;

            console.log(`[TaskProbe] Task execution completed for ${channel.id}: ${result.success ? 'SUCCESS' : 'FAILED'} (${Math.round(executionTime)}ms)`);

            // Convert to ProbeResult format
            return {
                success: result.success,
                latencyMs: result.executionTime,
                error: result.sample.error,
                details: {
                    ...result.sample.details,
                    taskLabel: channel.runTask.label,
                    outputLines: result.outputLines?.length || 0
                }
            };

        } catch (error) {
            const endTime = performance.now();
            const executionTime = endTime - startTime;

            console.error(`[TaskProbe] Task probe execution failed for ${channel.id}:`, error);

            return {
                success: false,
                latencyMs: executionTime,
                error: `Task probe failed: ${error}`,
                details: {
                    taskLabel: channel.runTask.label,
                    executionType: 'vscode-task',
                    errorType: 'probe-execution-error'
                }
            };
        }
    }

    /**
     * 🔍 **VALIDATE TASK CONFIGURATION**
     * 
     * Validates that the task exists and configuration is correct
     */
    static async validateTaskConfiguration(channel: ChannelDefinition): Promise<{
        valid: boolean;
        error?: string;
        suggestions?: string[];
    }> {
        if (!channel.runTask) {
            return {
                valid: false,
                error: 'Missing runTask configuration'
            };
        }

        if (!channel.runTask.label) {
            return {
                valid: false,
                error: 'Missing runTask.label'
            };
        }

        this.initializeServices();

        try {
            // Check if task exists
            const task = await this.taskDiscoveryService!.findTaskByLabel(channel.runTask.label);
            
            if (task) {
                return { valid: true };
            }

            // Task not found, get suggestions
            const suggestions = await this.taskDiscoveryService!.suggestSimilarTasks(channel.runTask.label);
            
            return {
                valid: false,
                error: `Task not found: ${channel.runTask.label}`,
                suggestions: suggestions.map(t => t.name)
            };

        } catch (error) {
            return {
                valid: false,
                error: `Task validation failed: ${error}`
            };
        }
    }

    /**
     * 📊 **GET TASK PROBE STATUS**
     * 
     * Returns status information about task probes
     */
    static getTaskProbeStatus(): {
        initialized: boolean;
        activeExecutions: number;
        cachedTasks: number;
    } {
        if (!this.taskDiscoveryService || !this.taskExecutionService) {
            return {
                initialized: false,
                activeExecutions: 0,
                cachedTasks: 0
            };
        }

        return {
            initialized: true,
            activeExecutions: this.taskExecutionService.getActiveExecutions().length,
            cachedTasks: 0 // Task discovery service doesn't expose cache size
        };
    }

    /**
     * 🛠️ **SUGGEST TASK CREATION**
     * 
     * Provides guidance for creating missing tasks
     */
    static generateTaskTemplate(taskLabel: string, channelType?: string): string {
        const templates = {
            http: this.generateHttpTaskTemplate(taskLabel),
            database: this.generateDatabaseTaskTemplate(taskLabel),
            service: this.generateServiceTaskTemplate(taskLabel),
            default: this.generateDefaultTaskTemplate(taskLabel)
        };

        return templates[channelType as keyof typeof templates] || templates.default;
    }

    private static generateHttpTaskTemplate(taskLabel: string): string {
        return `{
  "label": "${taskLabel}",
  "type": "shell",
  "command": "curl",
  "args": [
    "-f", "-s", "-o", "/dev/null",
    "--max-time", "30",
    "\${config:myapp.apiUrl}/health"
  ],
  "group": "test",
  "presentation": {
    "reveal": "silent",
    "panel": "shared"
  },
  "problemMatcher": {
    "owner": "healthwatch",
    "pattern": {
      "regexp": "^ERROR: (.*)$",
      "message": 1
    }
  }
}`;
    }

    private static generateDatabaseTaskTemplate(taskLabel: string): string {
        return `{
  "label": "${taskLabel}",
  "type": "shell",
  "command": "pg_isready",
  "args": [
    "-h", "\${config:myapp.db.host}",
    "-p", "\${config:myapp.db.port}",
    "-U", "\${config:myapp.db.user}"
  ],
  "group": "test",
  "presentation": {
    "reveal": "silent",
    "panel": "shared"
  }
}`;
    }

    private static generateServiceTaskTemplate(taskLabel: string): string {
        return `{
  "label": "${taskLabel}",
  "type": "shell",
  "command": "\${workspaceFolder}/scripts/health-check.sh",
  "group": "test",
  "presentation": {
    "reveal": "silent",
    "panel": "shared"
  }
}`;
    }

    private static generateDefaultTaskTemplate(taskLabel: string): string {
        return `{
  "label": "${taskLabel}",
  "type": "shell",
  "command": "echo",
  "args": ["Health check placeholder - configure your actual command"],
  "group": "test",
  "presentation": {
    "reveal": "silent",
    "panel": "shared"
  }
}`;
    }

    /**
     * 🧹 **CLEANUP**
     * 
     * Dispose of task services when shutting down
     */
    static dispose(): void {
        console.log('[TaskProbe] Disposing task services...');
        
        if (this.taskExecutionService) {
            this.taskExecutionService.dispose();
            this.taskExecutionService = undefined;
        }

        if (this.taskDiscoveryService) {
            this.taskDiscoveryService.dispose();
            this.taskDiscoveryService = undefined;
        }

        console.log('[TaskProbe] Task services disposed');
    }
}