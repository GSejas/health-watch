/**
 * @fileoverview Unit tests for TaskProbe
 * 
 * Tests the task probe integration with Health Watch probe system.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TaskProbe } from '../../../src/probes/task';
import { ChannelDefinition } from '../../../src/config';

// Mock the task services
vi.mock('../../../src/services/TaskDiscoveryService');
vi.mock('../../../src/services/TaskExecutionService');

describe('TaskProbe', () => {
    beforeEach(() => {
        // Reset static state
        TaskProbe.dispose();
    });

    afterEach(() => {
        TaskProbe.dispose();
        vi.clearAllMocks();
    });

    describe('executeProbe', () => {
        const createTaskChannel = (runTask?: any): ChannelDefinition => ({
            id: 'test-channel',
            name: 'Test Channel',
            type: 'task',
            runTask,
        });

        it('should successfully execute a task probe', async () => {
            const channel = createTaskChannel({
                label: 'test-task',
            });

            // Mock successful task execution
            const mockTaskExecutionService = {
                executeChannelTask: vi.fn().mockResolvedValue({
                    success: true,
                    sample: {
                        success: true,
                        details: {
                            exitCode: 0,
                            executionType: 'vscode-task',
                        },
                    },
                    executionTime: 1500,
                    outputLines: ['Task output line 1', 'Task output line 2'],
                }),
            };

            // Mock the static initialization
            (TaskProbe as any).taskExecutionService = mockTaskExecutionService;

            const result = await TaskProbe.executeProbe(channel);

            expect(result.success).toBe(true);
            expect(result.latencyMs).toBe(1500);
            expect(result.details).toMatchObject({
                exitCode: 0,
                executionType: 'vscode-task',
                taskLabel: 'test-task',
                outputLines: 2,
            });
            expect(mockTaskExecutionService.executeChannelTask).toHaveBeenCalledWith('test-channel', {
                label: 'test-task',
            });
        });

        it('should handle failed task execution', async () => {
            const channel = createTaskChannel({
                label: 'failing-task',
            });

            // Mock failed task execution
            const mockTaskExecutionService = {
                executeChannelTask: vi.fn().mockResolvedValue({
                    success: false,
                    sample: {
                        success: false,
                        error: 'Task failed with exit code 1',
                        details: {
                            exitCode: 1,
                            executionType: 'vscode-task',
                        },
                    },
                    executionTime: 800,
                }),
            };

            (TaskProbe as any).taskExecutionService = mockTaskExecutionService;

            const result = await TaskProbe.executeProbe(channel);

            expect(result.success).toBe(false);
            expect(result.latencyMs).toBe(800);
            expect(result.error).toBe('Task failed with exit code 1');
            expect(result.details).toMatchObject({
                exitCode: 1,
                taskLabel: 'failing-task',
            });
        });

        it('should reject probe without runTask configuration', async () => {
            const channel = createTaskChannel(); // No runTask

            await expect(TaskProbe.executeProbe(channel)).rejects.toThrow(
                'Task probe requires runTask configuration'
            );
        });

        it('should reject probe without task label', async () => {
            const channel = createTaskChannel({
                // Missing label
                timeout: 5000,
            });

            await expect(TaskProbe.executeProbe(channel)).rejects.toThrow(
                'Task probe requires runTask.label'
            );
        });

        it('should handle task execution service errors', async () => {
            const channel = createTaskChannel({
                label: 'error-task',
            });

            // Mock task execution service error
            const mockTaskExecutionService = {
                executeChannelTask: vi.fn().mockRejectedValue(new Error('Service error')),
            };

            (TaskProbe as any).taskExecutionService = mockTaskExecutionService;

            const result = await TaskProbe.executeProbe(channel);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Task probe failed: Error: Service error');
            expect(result.details).toMatchObject({
                taskLabel: 'error-task',
                executionType: 'vscode-task',
                errorType: 'probe-execution-error',
            });
        });

        it('should measure execution time even on errors', async () => {
            const channel = createTaskChannel({
                label: 'error-task',
            });

            // Mock task execution service that throws immediately
            const mockTaskExecutionService = {
                executeChannelTask: vi.fn().mockRejectedValue(new Error('Immediate error')),
            };

            (TaskProbe as any).taskExecutionService = mockTaskExecutionService;

            const startTime = performance.now();
            const result = await TaskProbe.executeProbe(channel);
            const endTime = performance.now();

            expect(result.success).toBe(false);
            expect(result.latencyMs).toBeGreaterThanOrEqual(0);
            expect(result.latencyMs).toBeLessThan(endTime - startTime + 100); // Some tolerance
        });
    });

    describe('validateTaskConfiguration', () => {
        const createTaskChannel = (runTask?: any): ChannelDefinition => ({
            id: 'test-channel',
            name: 'Test Channel',
            type: 'task',
            runTask,
        });

        it('should validate existing task successfully', async () => {
            const channel = createTaskChannel({
                label: 'existing-task',
            });

            // Mock task discovery service
            const mockTask = { name: 'existing-task' };
            const mockTaskDiscoveryService = {
                findTaskByLabel: vi.fn().mockResolvedValue(mockTask),
                suggestSimilarTasks: vi.fn(),
            };

            (TaskProbe as any).taskDiscoveryService = mockTaskDiscoveryService;

            const result = await TaskProbe.validateTaskConfiguration(channel);

            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
            expect(mockTaskDiscoveryService.findTaskByLabel).toHaveBeenCalledWith('existing-task');
        });

        it('should provide suggestions for non-existent task', async () => {
            const channel = createTaskChannel({
                label: 'non-existent-task',
            });

            // Mock task discovery service
            const mockSuggestions = [
                { name: 'similar-task-1' },
                { name: 'similar-task-2' },
            ];
            const mockTaskDiscoveryService = {
                findTaskByLabel: vi.fn().mockResolvedValue(null),
                suggestSimilarTasks: vi.fn().mockResolvedValue(mockSuggestions),
            };

            (TaskProbe as any).taskDiscoveryService = mockTaskDiscoveryService;

            const result = await TaskProbe.validateTaskConfiguration(channel);

            expect(result.valid).toBe(false);
            expect(result.error).toContain('Task not found: non-existent-task');
            expect(result.suggestions).toEqual(['similar-task-1', 'similar-task-2']);
            expect(mockTaskDiscoveryService.suggestSimilarTasks).toHaveBeenCalledWith('non-existent-task');
        });

        it('should reject channel without runTask configuration', async () => {
            const channel = createTaskChannel(); // No runTask

            const result = await TaskProbe.validateTaskConfiguration(channel);

            expect(result.valid).toBe(false);
            expect(result.error).toBe('Missing runTask configuration');
        });

        it('should reject channel without task label', async () => {
            const channel = createTaskChannel({
                // Missing label
                timeout: 5000,
            });

            const result = await TaskProbe.validateTaskConfiguration(channel);

            expect(result.valid).toBe(false);
            expect(result.error).toBe('Missing runTask.label');
        });

        it('should handle task discovery errors gracefully', async () => {
            const channel = createTaskChannel({
                label: 'test-task',
            });

            // Mock task discovery service error
            const mockTaskDiscoveryService = {
                findTaskByLabel: vi.fn().mockRejectedValue(new Error('Discovery error')),
            };

            (TaskProbe as any).taskDiscoveryService = mockTaskDiscoveryService;

            const result = await TaskProbe.validateTaskConfiguration(channel);

            expect(result.valid).toBe(false);
            expect(result.error).toContain('Task validation failed: Error: Discovery error');
        });
    });

    describe('getTaskProbeStatus', () => {
        it('should return uninitialized status when services not created', () => {
            const status = TaskProbe.getTaskProbeStatus();

            expect(status).toEqual({
                initialized: false,
                activeExecutions: 0,
                cachedTasks: 0,
            });
        });

        it('should return initialized status when services are created', () => {
            // Mock the services as initialized
            const mockTaskExecutionService = {
                getActiveExecutions: vi.fn().mockReturnValue([
                    { channelId: 'test-1', taskLabel: 'task-1' },
                    { channelId: 'test-2', taskLabel: 'task-2' },
                ]),
            };
            const mockTaskDiscoveryService = {};

            (TaskProbe as any).taskExecutionService = mockTaskExecutionService;
            (TaskProbe as any).taskDiscoveryService = mockTaskDiscoveryService;

            const status = TaskProbe.getTaskProbeStatus();

            expect(status).toEqual({
                initialized: true,
                activeExecutions: 2,
                cachedTasks: 0, // Discovery service doesn't expose cache size
            });
        });
    });

    describe('generateTaskTemplate', () => {
        it('should generate HTTP task template', () => {
            const template = TaskProbe.generateTaskTemplate('test-http-task', 'http');

            expect(template).toContain('"label": "test-http-task"');
            expect(template).toContain('"command": "curl"');
            expect(template).toContain('--max-time');
            expect(template).toContain('problemMatcher');
        });

        it('should generate database task template', () => {
            const template = TaskProbe.generateTaskTemplate('test-db-task', 'database');

            expect(template).toContain('"label": "test-db-task"');
            expect(template).toContain('"command": "pg_isready"');
            expect(template).toContain('${config:myapp.db.host}');
        });

        it('should generate service task template', () => {
            const template = TaskProbe.generateTaskTemplate('test-service-task', 'service');

            expect(template).toContain('"label": "test-service-task"');
            expect(template).toContain('${workspaceFolder}/scripts/health-check.sh');
        });

        it('should generate default template for unknown type', () => {
            const template = TaskProbe.generateTaskTemplate('test-default-task', 'unknown');

            expect(template).toContain('"label": "test-default-task"');
            expect(template).toContain('"command": "echo"');
            expect(template).toContain('Health check placeholder');
        });

        it('should generate default template when no type specified', () => {
            const template = TaskProbe.generateTaskTemplate('test-task');

            expect(template).toContain('"label": "test-task"');
            expect(template).toContain('"command": "echo"');
        });
    });

    describe('dispose', () => {
        it('should dispose services gracefully when they exist', () => {
            const mockTaskExecutionService = {
                dispose: vi.fn(),
            };
            const mockTaskDiscoveryService = {
                dispose: vi.fn(),
            };

            (TaskProbe as any).taskExecutionService = mockTaskExecutionService;
            (TaskProbe as any).taskDiscoveryService = mockTaskDiscoveryService;

            TaskProbe.dispose();

            expect(mockTaskExecutionService.dispose).toHaveBeenCalled();
            expect(mockTaskDiscoveryService.dispose).toHaveBeenCalled();
            expect((TaskProbe as any).taskExecutionService).toBeUndefined();
            expect((TaskProbe as any).taskDiscoveryService).toBeUndefined();
        });

        it('should handle dispose when services do not exist', () => {
            // Should not throw
            expect(() => {
                TaskProbe.dispose();
            }).not.toThrow();
        });
    });
});