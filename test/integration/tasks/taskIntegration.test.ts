/**
 * @fileoverview Integration tests for VS Code Tasks Integration
 * 
 * Tests the complete integration of task-based monitoring with the Health Watch system.
 * Uses real VS Code APIs in a test environment.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { ConfigManager } from '../../../src/config';
import { StorageManager } from '../../../src/storage';
import { ChannelRunner } from '../../../src/runner/channelRunner';
import { TaskProbe } from '../../../src/probes/task';

describe('Tasks Integration - End to End', () => {
    let testWorkspaceUri: vscode.Uri;
    let configManager: ConfigManager;
    let storageManager: StorageManager;
    let channelRunner: ChannelRunner;

    beforeAll(async () => {
        // Create test workspace
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new Error('No workspace folder available for testing');
        }
        
        testWorkspaceUri = workspaceFolder.uri;
        
        // Initialize managers
        configManager = ConfigManager.getInstance();
        
        const mockContext = {
            extensionPath: path.join(__dirname, '../../../'),
            globalState: new Map(),
            workspaceState: new Map(),
            subscriptions: [],
        } as any;
        
        storageManager = StorageManager.initialize(mockContext);
        await storageManager.whenReady();
    });

    afterAll(async () => {
        // Cleanup
        TaskProbe.dispose();
        await cleanupTestFiles();
    });

    beforeEach(() => {
        channelRunner = new ChannelRunner();
    });

    afterEach(() => {
        // Reset configuration
        configManager.updateConfiguration({
            channels: [],
            guards: {},
        });
    });

    async function createTestTasksJson(tasks: any[]): Promise<void> {
        const tasksDir = path.join(testWorkspaceUri.fsPath, '.vscode');
        const tasksFile = path.join(tasksDir, 'tasks.json');
        
        await fs.mkdir(tasksDir, { recursive: true });
        await fs.writeFile(tasksFile, JSON.stringify({
            version: '2.0.0',
            tasks
        }, null, 2));
    }

    async function createTestScript(scriptPath: string, content: string, exitCode = 0): Promise<void> {
        const fullPath = path.join(testWorkspaceUri.fsPath, scriptPath);
        const dir = path.dirname(fullPath);
        
        await fs.mkdir(dir, { recursive: true });
        
        const isWindows = process.platform === 'win32';
        const scriptContent = isWindows 
            ? `@echo off\n${content}\nexit ${exitCode}`
            : `#!/bin/bash\n${content}\nexit ${exitCode}`;
            
        await fs.writeFile(fullPath, scriptContent);
        
        if (!isWindows) {
            // Make script executable on Unix systems
            await fs.chmod(fullPath, '755');
        }
    }

    async function cleanupTestFiles(): Promise<void> {
        try {
            const testDirs = ['.vscode', 'scripts', 'test-temp'];
            for (const dir of testDirs) {
                const dirPath = path.join(testWorkspaceUri.fsPath, dir);
                await fs.rm(dirPath, { recursive: true, force: true });
            }
        } catch (error) {
            console.warn('Cleanup warning:', error);
        }
    }

    describe('Basic Task Execution', () => {
        it('should execute a simple shell task successfully', async () => {
            // Create test task
            await createTestTasksJson([{
                label: 'healthwatch:test-success',
                type: 'shell',
                command: 'echo',
                args: ['Task executed successfully'],
                group: 'test',
                presentation: {
                    reveal: 'silent',
                    panel: 'shared'
                }
            }]);

            // Configure Health Watch channel
            configManager.updateConfiguration({
                channels: [{
                    id: 'test-channel',
                    name: 'Test Success Task',
                    type: 'task',
                    runTask: {
                        label: 'healthwatch:test-success'
                    }
                }]
            });

            // Wait for VS Code to pick up the new tasks.json
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Execute the channel
            const sample = await channelRunner.runChannel('test-channel');

            expect(sample.success).toBe(true);
            expect(sample.latencyMs).toBeGreaterThan(0);
            expect(sample.details?.executionType).toBe('vscode-task');
            expect(sample.details?.taskLabel).toBe('healthwatch:test-success');
        });

        it('should handle task failure correctly', async () => {
            // Create failing task
            await createTestTasksJson([{
                label: 'healthwatch:test-failure',
                type: 'shell',
                command: process.platform === 'win32' ? 'cmd' : 'bash',
                args: process.platform === 'win32' 
                    ? ['/c', 'exit 1']
                    : ['-c', 'exit 1'],
                group: 'test'
            }]);

            configManager.updateConfiguration({
                channels: [{
                    id: 'fail-channel',
                    name: 'Test Failure Task',
                    type: 'task',
                    runTask: {
                        label: 'healthwatch:test-failure'
                    }
                }]
            });

            await new Promise(resolve => setTimeout(resolve, 1000));

            const sample = await channelRunner.runChannel('fail-channel');

            expect(sample.success).toBe(false);
            expect(sample.error).toContain('Task failed with exit code 1');
            expect(sample.details?.executionType).toBe('vscode-task');
        });

        it('should handle non-existent task gracefully', async () => {
            configManager.updateConfiguration({
                channels: [{
                    id: 'missing-task-channel',
                    name: 'Missing Task',
                    type: 'task',
                    runTask: {
                        label: 'non-existent-task'
                    }
                }]
            });

            const sample = await channelRunner.runChannel('missing-task-channel');

            expect(sample.success).toBe(false);
            expect(sample.error).toContain('Task not found: non-existent-task');
        });
    });

    describe('Script-based Tasks', () => {
        it('should execute custom script tasks', async () => {
            // Create test script
            await createTestScript('scripts/health-check.sh', 'echo "Health check passed"', 0);

            // Create task that runs the script
            const scriptCommand = process.platform === 'win32' 
                ? '${workspaceFolder}\\scripts\\health-check.bat'
                : '${workspaceFolder}/scripts/health-check.sh';

            if (process.platform === 'win32') {
                await createTestScript('scripts/health-check.bat', 'echo Health check passed', 0);
            }

            await createTestTasksJson([{
                label: 'healthwatch:script-task',
                type: 'shell',
                command: scriptCommand,
                group: 'test'
            }]);

            configManager.updateConfiguration({
                channels: [{
                    id: 'script-channel',
                    name: 'Script-based Task',
                    type: 'task',
                    runTask: {
                        label: 'healthwatch:script-task'
                    }
                }]
            });

            await new Promise(resolve => setTimeout(resolve, 1000));

            const sample = await channelRunner.runChannel('script-channel');

            expect(sample.success).toBe(true);
            expect(sample.latencyMs).toBeGreaterThan(0);
        });

        it('should handle script failures', async () => {
            // Create failing script
            await createTestScript('scripts/failing-check.sh', 'echo "Health check failed"', 1);

            const scriptCommand = process.platform === 'win32'
                ? '${workspaceFolder}\\scripts\\failing-check.bat'
                : '${workspaceFolder}/scripts/failing-check.sh';

            if (process.platform === 'win32') {
                await createTestScript('scripts/failing-check.bat', 'echo Health check failed', 1);
            }

            await createTestTasksJson([{
                label: 'healthwatch:failing-script',
                type: 'shell',
                command: scriptCommand,
                group: 'test'
            }]);

            configManager.updateConfiguration({
                channels: [{
                    id: 'failing-script-channel',
                    name: 'Failing Script Task',
                    type: 'task',
                    runTask: {
                        label: 'healthwatch:failing-script'
                    }
                }]
            });

            await new Promise(resolve => setTimeout(resolve, 1000));

            const sample = await channelRunner.runChannel('failing-script-channel');

            expect(sample.success).toBe(false);
            expect(sample.error).toContain('Task failed with exit code 1');
        });
    });

    describe('Task Configuration Options', () => {
        it('should respect task timeout configuration', async () => {
            // Create long-running task
            const sleepCommand = process.platform === 'win32'
                ? 'timeout /t 10 /nobreak'
                : 'sleep 10';

            await createTestTasksJson([{
                label: 'healthwatch:long-running',
                type: 'shell',
                command: process.platform === 'win32' ? 'timeout' : 'sleep',
                args: process.platform === 'win32' 
                    ? ['/t', '10', '/nobreak']
                    : ['10'],
                group: 'test'
            }]);

            configManager.updateConfiguration({
                channels: [{
                    id: 'timeout-channel',
                    name: 'Timeout Test Task',
                    type: 'task',
                    runTask: {
                        label: 'healthwatch:long-running',
                        timeout: 2000 // 2 second timeout
                    }
                }]
            });

            await new Promise(resolve => setTimeout(resolve, 1000));

            const startTime = Date.now();
            const sample = await channelRunner.runChannel('timeout-channel');
            const executionTime = Date.now() - startTime;

            expect(sample.success).toBe(false);
            expect(sample.error).toContain('Task timeout after 2000ms');
            expect(executionTime).toBeLessThan(5000); // Should timeout well before 10 seconds
        }, 10000); // Increase test timeout

        it('should include telemetry information when enabled', async () => {
            await createTestTasksJson([{
                label: 'healthwatch:telemetry-test',
                type: 'shell',
                command: 'echo',
                args: ['Telemetry test'],
                group: 'test'
            }]);

            configManager.updateConfiguration({
                channels: [{
                    id: 'telemetry-channel',
                    name: 'Telemetry Test Task',
                    type: 'task',
                    runTask: {
                        label: 'healthwatch:telemetry-test',
                        telemetryEvents: true
                    }
                }]
            });

            await new Promise(resolve => setTimeout(resolve, 1000));

            const sample = await channelRunner.runChannel('telemetry-channel');

            expect(sample.success).toBe(true);
            expect(sample.details?.executionType).toBe('vscode-task');
            expect(sample.details?.taskLabel).toBe('healthwatch:telemetry-test');
        });
    });

    describe('Integration with Storage', () => {
        it('should properly store task execution samples', async () => {
            await createTestTasksJson([{
                label: 'healthwatch:storage-test',
                type: 'shell',
                command: 'echo',
                args: ['Storage test'],
                group: 'test'
            }]);

            configManager.updateConfiguration({
                channels: [{
                    id: 'storage-channel',
                    name: 'Storage Test Task',
                    type: 'task',
                    runTask: {
                        label: 'healthwatch:storage-test'
                    }
                }]
            });

            await new Promise(resolve => setTimeout(resolve, 1000));

            // Execute task
            await channelRunner.runChannel('storage-channel');

            // Check that sample was stored
            const channelState = storageManager.getChannelState('storage-channel');
            expect(channelState.lastSample).toBeDefined();
            expect(channelState.lastSample?.success).toBe(true);
            expect(channelState.lastSample?.details?.executionType).toBe('vscode-task');
            expect(channelState.samples.length).toBeGreaterThan(0);
        });

        it('should update channel state correctly on task success/failure', async () => {
            // Test successful task
            await createTestTasksJson([{
                label: 'healthwatch:state-success',
                type: 'shell',
                command: 'echo',
                args: ['Success'],
                group: 'test'
            }]);

            configManager.updateConfiguration({
                channels: [{
                    id: 'state-success-channel',
                    name: 'State Success Task',
                    type: 'task',
                    runTask: {
                        label: 'healthwatch:state-success'
                    }
                }]
            });

            await new Promise(resolve => setTimeout(resolve, 1000));

            await channelRunner.runChannel('state-success-channel');
            let channelState = storageManager.getChannelState('state-success-channel');
            expect(channelState.state).toBe('online');
            expect(channelState.consecutiveFailures).toBe(0);

            // Test failing task
            await createTestTasksJson([{
                label: 'healthwatch:state-failure',
                type: 'shell',
                command: process.platform === 'win32' ? 'cmd' : 'bash',
                args: process.platform === 'win32' 
                    ? ['/c', 'exit 1']
                    : ['-c', 'exit 1'],
                group: 'test'
            }]);

            configManager.updateConfiguration({
                channels: [{
                    id: 'state-failure-channel',
                    name: 'State Failure Task',
                    type: 'task',
                    runTask: {
                        label: 'healthwatch:state-failure'
                    }
                }]
            });

            await new Promise(resolve => setTimeout(resolve, 1000));

            await channelRunner.runChannel('state-failure-channel');
            channelState = storageManager.getChannelState('state-failure-channel');
            expect(channelState.state).toBe('offline'); // Assuming threshold defaults allow immediate offline
            expect(channelState.consecutiveFailures).toBeGreaterThan(0);
        });
    });

    describe('Error Scenarios', () => {
        it('should handle malformed tasks.json gracefully', async () => {
            // Create malformed tasks.json
            const tasksFile = path.join(testWorkspaceUri.fsPath, '.vscode', 'tasks.json');
            await fs.mkdir(path.dirname(tasksFile), { recursive: true });
            await fs.writeFile(tasksFile, '{ invalid json }');

            configManager.updateConfiguration({
                channels: [{
                    id: 'malformed-channel',
                    name: 'Malformed Tasks',
                    type: 'task',
                    runTask: {
                        label: 'any-task'
                    }
                }]
            });

            await new Promise(resolve => setTimeout(resolve, 1000));

            const sample = await channelRunner.runChannel('malformed-channel');

            expect(sample.success).toBe(false);
            expect(sample.error).toContain('Task not found');
        });

        it('should handle permission errors on script execution', async () => {
            if (process.platform !== 'win32') {
                // Create non-executable script
                await createTestScript('scripts/no-exec.sh', 'echo "Should not run"', 0);
                await fs.chmod(path.join(testWorkspaceUri.fsPath, 'scripts/no-exec.sh'), '644'); // Remove execute permission

                await createTestTasksJson([{
                    label: 'healthwatch:no-permission',
                    type: 'shell',
                    command: '${workspaceFolder}/scripts/no-exec.sh',
                    group: 'test'
                }]);

                configManager.updateConfiguration({
                    channels: [{
                        id: 'permission-channel',
                        name: 'Permission Test Task',
                        type: 'task',
                        runTask: {
                            label: 'healthwatch:no-permission'
                        }
                    }]
                });

                await new Promise(resolve => setTimeout(resolve, 1000));

                const sample = await channelRunner.runChannel('permission-channel');

                expect(sample.success).toBe(false);
                // The exact error depends on shell and system, but should indicate failure
                expect(sample.error).toBeDefined();
            }
        });
    });

    describe('Performance', () => {
        it('should execute tasks with reasonable performance', async () => {
            await createTestTasksJson([{
                label: 'healthwatch:performance-test',
                type: 'shell',
                command: 'echo',
                args: ['Performance test'],
                group: 'test'
            }]);

            configManager.updateConfiguration({
                channels: [{
                    id: 'perf-channel',
                    name: 'Performance Test Task',
                    type: 'task',
                    runTask: {
                        label: 'healthwatch:performance-test'
                    }
                }]
            });

            await new Promise(resolve => setTimeout(resolve, 1000));

            const startTime = Date.now();
            const sample = await channelRunner.runChannel('perf-channel');
            const totalTime = Date.now() - startTime;

            expect(sample.success).toBe(true);
            expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
            expect(sample.latencyMs).toBeLessThan(totalTime);
        });

        it('should handle concurrent task executions', async () => {
            await createTestTasksJson([
                {
                    label: 'healthwatch:concurrent-1',
                    type: 'shell',
                    command: 'echo',
                    args: ['Concurrent test 1'],
                    group: 'test'
                },
                {
                    label: 'healthwatch:concurrent-2',
                    type: 'shell',
                    command: 'echo',
                    args: ['Concurrent test 2'],
                    group: 'test'
                }
            ]);

            configManager.updateConfiguration({
                channels: [
                    {
                        id: 'concurrent-1',
                        name: 'Concurrent Task 1',
                        type: 'task',
                        runTask: { label: 'healthwatch:concurrent-1' }
                    },
                    {
                        id: 'concurrent-2',
                        name: 'Concurrent Task 2',
                        type: 'task',
                        runTask: { label: 'healthwatch:concurrent-2' }
                    }
                ]
            });

            await new Promise(resolve => setTimeout(resolve, 1000));

            // Execute both channels concurrently
            const [sample1, sample2] = await Promise.all([
                channelRunner.runChannel('concurrent-1'),
                channelRunner.runChannel('concurrent-2')
            ]);

            expect(sample1.success).toBe(true);
            expect(sample2.success).toBe(true);
            expect(sample1.details?.taskLabel).toBe('healthwatch:concurrent-1');
            expect(sample2.details?.taskLabel).toBe('healthwatch:concurrent-2');
        });
    });
});