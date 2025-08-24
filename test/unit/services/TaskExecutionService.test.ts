/**
 * @fileoverview Unit tests for TaskExecutionService
 * 
 * Tests task execution with comprehensive lifecycle monitoring
 * and result parsing according to 2025 best practices.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { TaskExecutionService } from '../../../src/services/TaskExecutionService';
import { TaskDiscoveryService } from '../../../src/services/TaskDiscoveryService';
import { TaskRunConfiguration } from '../../../src/config';

// Mock VS Code APIs
vi.mock('vscode', () => ({
    tasks: {
        executeTask: vi.fn(),
        onDidStartTask: vi.fn(() => ({ dispose: vi.fn() })),
        onDidEndTask: vi.fn(() => ({ dispose: vi.fn() })),
        onDidStartTaskProcess: vi.fn(() => ({ dispose: vi.fn() })),
        onDidEndTaskProcess: vi.fn(() => ({ dispose: vi.fn() })),
    },
    TaskRevealKind: {
        Silent: 3,
    },
    TaskPanelKind: {
        Shared: 2,
    },
}));

// Mock TaskDiscoveryService
vi.mock('../../../src/services/TaskDiscoveryService');

describe('TaskExecutionService', () => {
    let taskExecutionService: TaskExecutionService;
    let mockTaskDiscoveryService: jest.Mocked<TaskDiscoveryService>;
    let mockExecuteTask: ReturnType<typeof vi.fn>;

    const createMockTask = (name: string): vscode.Task => ({
        name,
        definition: { type: 'shell' },
        execution: undefined,
        problemMatchers: [],
        source: 'workspace',
        group: undefined,
        presentationOptions: undefined,
        runOptions: undefined,
        scope: undefined,
    } as any);

    const createMockTaskExecution = (task: vscode.Task): vscode.TaskExecution => ({
        task,
        terminate: vi.fn(),
    } as any);

    beforeEach(() => {
        mockTaskDiscoveryService = {
            findTaskByLabel: vi.fn(),
            suggestSimilarTasks: vi.fn(),
            getAllTasks: vi.fn(),
            invalidateCache: vi.fn(),
            dispose: vi.fn(),
        } as any;

        taskExecutionService = new TaskExecutionService(mockTaskDiscoveryService);
        mockExecuteTask = vscode.tasks.executeTask as any;
    });

    afterEach(() => {
        taskExecutionService.dispose();
        vi.clearAllMocks();
    });

    describe('executeChannelTask', () => {
        const mockConfig: TaskRunConfiguration = {
            label: 'test-task',
            timeout: 5000,
            telemetryEvents: true,
        };

        it('should successfully execute a found task', async () => {
            const mockTask = createMockTask('test-task');
            const mockExecution = createMockTaskExecution(mockTask);
            
            mockTaskDiscoveryService.findTaskByLabel.mockResolvedValue(mockTask);
            mockExecuteTask.mockResolvedValue(mockExecution);

            // Simulate successful task completion
            setTimeout(() => {
                const processEndEvent = {
                    execution: mockExecution,
                    exitCode: 0,
                };
                (taskExecutionService as any).handleTaskProcessEnd(processEndEvent);
            }, 100);

            const result = await taskExecutionService.executeChannelTask('test-channel', mockConfig);

            expect(result.success).toBe(true);
            expect(result.sample.success).toBe(true);
            expect(result.sample.details?.exitCode).toBe(0);
            expect(mockTaskDiscoveryService.findTaskByLabel).toHaveBeenCalledWith('test-task');
            expect(mockExecuteTask).toHaveBeenCalledWith(mockTask);
        });

        it('should handle task not found gracefully', async () => {
            mockTaskDiscoveryService.findTaskByLabel.mockResolvedValue(null);

            const result = await taskExecutionService.executeChannelTask('test-channel', mockConfig);

            expect(result.success).toBe(false);
            expect(result.sample.error).toContain('Task not found: test-task');
            expect(mockExecuteTask).not.toHaveBeenCalled();
        });

        it('should handle task execution failure', async () => {
            const mockTask = createMockTask('test-task');
            const mockExecution = createMockTaskExecution(mockTask);
            
            mockTaskDiscoveryService.findTaskByLabel.mockResolvedValue(mockTask);
            mockExecuteTask.mockResolvedValue(mockExecution);

            // Simulate failed task completion
            setTimeout(() => {
                const processEndEvent = {
                    execution: mockExecution,
                    exitCode: 1,
                };
                (taskExecutionService as any).handleTaskProcessEnd(processEndEvent);
            }, 100);

            const result = await taskExecutionService.executeChannelTask('test-channel', mockConfig);

            expect(result.success).toBe(false);
            expect(result.sample.error).toContain('Task failed with exit code 1');
        });

        it('should handle concurrent execution attempts', async () => {
            const mockTask = createMockTask('test-task');
            const mockExecution = createMockTaskExecution(mockTask);
            
            mockTaskDiscoveryService.findTaskByLabel.mockResolvedValue(mockTask);
            mockExecuteTask.mockResolvedValue(mockExecution);

            // Don't complete the first execution immediately
            const firstExecution = taskExecutionService.executeChannelTask('test-channel', mockConfig);
            
            // Try to start second execution immediately
            const secondExecution = taskExecutionService.executeChannelTask('test-channel', mockConfig);

            const secondResult = await secondExecution;
            expect(secondResult.success).toBe(false);
            expect(secondResult.sample.error).toContain('Task already running');

            // Complete first execution
            setTimeout(() => {
                const processEndEvent = {
                    execution: mockExecution,
                    exitCode: 0,
                };
                (taskExecutionService as any).handleTaskProcessEnd(processEndEvent);
            }, 100);

            await firstExecution;
        });

        it('should handle task execution timeout', async () => {
            const mockTask = createMockTask('test-task');
            const mockExecution = createMockTaskExecution(mockTask);
            
            mockTaskDiscoveryService.findTaskByLabel.mockResolvedValue(mockTask);
            mockExecuteTask.mockResolvedValue(mockExecution);

            const shortTimeoutConfig: TaskRunConfiguration = {
                label: 'test-task',
                timeout: 100, // Very short timeout
            };

            const result = await taskExecutionService.executeChannelTask('test-channel', shortTimeoutConfig);

            expect(result.success).toBe(false);
            expect(result.sample.error).toContain('Task timeout after 100ms');
        });

        it('should configure task presentation correctly', async () => {
            const mockTask = createMockTask('test-task');
            const mockExecution = createMockTaskExecution(mockTask);
            
            mockTaskDiscoveryService.findTaskByLabel.mockResolvedValue(mockTask);
            mockExecuteTask.mockResolvedValue(mockExecution);

            setTimeout(() => {
                const processEndEvent = {
                    execution: mockExecution,
                    exitCode: 0,
                };
                (taskExecutionService as any).handleTaskProcessEnd(processEndEvent);
            }, 100);

            await taskExecutionService.executeChannelTask('test-channel', mockConfig);

            expect(mockTask.presentationOptions).toEqual({
                echo: false,
                reveal: vscode.TaskRevealKind.Silent,
                focus: false,
                panel: vscode.TaskPanelKind.Shared,
                showReuseMessage: false,
                clear: true,
            });
        });

        it('should handle VS Code API errors gracefully', async () => {
            const mockTask = createMockTask('test-task');
            
            mockTaskDiscoveryService.findTaskByLabel.mockResolvedValue(mockTask);
            mockExecuteTask.mockRejectedValue(new Error('VS Code API error'));

            const result = await taskExecutionService.executeChannelTask('test-channel', mockConfig);

            expect(result.success).toBe(false);
            expect(result.sample.error).toContain('Task execution error');
        });
    });

    describe('lifecycle event handling', () => {
        let mockTask: vscode.Task;
        let mockExecution: vscode.TaskExecution;
        let executionPromise: Promise<any>;

        beforeEach(() => {
            mockTask = createMockTask('test-task');
            mockExecution = createMockTaskExecution(mockTask);
            
            mockTaskDiscoveryService.findTaskByLabel.mockResolvedValue(mockTask);
            mockExecuteTask.mockResolvedValue(mockExecution);

            const mockConfig: TaskRunConfiguration = {
                label: 'test-task',
                telemetryEvents: true,
            };

            executionPromise = taskExecutionService.executeChannelTask('test-channel', mockConfig);
        });

        it('should handle task start events', () => {
            const startEvent = { execution: mockExecution };
            
            // Should not throw
            expect(() => {
                (taskExecutionService as any).handleTaskStart(startEvent);
            }).not.toThrow();
        });

        it('should handle task end events', () => {
            const endEvent = { execution: mockExecution };
            
            // Should not throw
            expect(() => {
                (taskExecutionService as any).handleTaskEnd(endEvent);
            }).not.toThrow();
        });

        it('should handle task process start events', () => {
            const processStartEvent = { 
                execution: mockExecution, 
                processId: 12345 
            };
            
            // Should not throw
            expect(() => {
                (taskExecutionService as any).handleTaskProcessStart(processStartEvent);
            }).not.toThrow();
        });

        it('should complete execution on process end', async () => {
            // Complete the execution
            setTimeout(() => {
                const processEndEvent = {
                    execution: mockExecution,
                    exitCode: 0,
                };
                (taskExecutionService as any).handleTaskProcessEnd(processEndEvent);
            }, 100);

            const result = await executionPromise;
            
            expect(result.success).toBe(true);
        });

        it('should handle events for unknown executions gracefully', () => {
            const unknownExecution = createMockTaskExecution(createMockTask('unknown'));
            
            const processEndEvent = {
                execution: unknownExecution,
                exitCode: 0,
            };

            // Should not throw
            expect(() => {
                (taskExecutionService as any).handleTaskProcessEnd(processEndEvent);
            }).not.toThrow();
        });
    });

    describe('getActiveExecutions', () => {
        it('should return empty array when no executions are active', () => {
            const activeExecutions = taskExecutionService.getActiveExecutions();
            
            expect(activeExecutions).toHaveLength(0);
        });

        it('should return information about active executions', async () => {
            const mockTask = createMockTask('test-task');
            const mockExecution = createMockTaskExecution(mockTask);
            
            mockTaskDiscoveryService.findTaskByLabel.mockResolvedValue(mockTask);
            mockExecuteTask.mockResolvedValue(mockExecution);

            const mockConfig: TaskRunConfiguration = {
                label: 'test-task',
            };

            // Start execution but don't complete it
            const executionPromise = taskExecutionService.executeChannelTask('test-channel', mockConfig);
            
            // Check active executions after a small delay
            await new Promise(resolve => setTimeout(resolve, 50));
            
            const activeExecutions = taskExecutionService.getActiveExecutions();
            
            expect(activeExecutions).toHaveLength(1);
            expect(activeExecutions[0]).toMatchObject({
                channelId: 'test-channel',
                taskLabel: 'test-task',
            });
            expect(activeExecutions[0].runningTime).toBeGreaterThan(0);

            // Complete the execution
            setTimeout(() => {
                const processEndEvent = {
                    execution: mockExecution,
                    exitCode: 0,
                };
                (taskExecutionService as any).handleTaskProcessEnd(processEndEvent);
            }, 10);

            await executionPromise;
        });
    });

    describe('sample creation', () => {
        it('should create success sample with correct format', () => {
            const sample = (taskExecutionService as any).createSuccessSample('test-channel', 1500, 0);

            expect(sample).toMatchObject({
                success: true,
                latencyMs: 1500,
                details: {
                    exitCode: 0,
                    executionType: 'vscode-task',
                },
            });
            expect(sample.timestamp).toBeGreaterThan(0);
        });

        it('should create failure sample with error message', () => {
            const sample = (taskExecutionService as any).createFailureSample('test-channel', 800, 'Test error');

            expect(sample).toMatchObject({
                success: false,
                latencyMs: 800,
                error: 'Test error',
                details: {
                    executionType: 'vscode-task',
                },
            });
            expect(sample.timestamp).toBeGreaterThan(0);
        });
    });

    describe('dispose', () => {
        it('should clean up resources and cancel timeouts', () => {
            const mockTask = createMockTask('test-task');
            const mockExecution = createMockTaskExecution(mockTask);
            
            mockTaskDiscoveryService.findTaskByLabel.mockResolvedValue(mockTask);
            mockExecuteTask.mockResolvedValue(mockExecution);

            // Start an execution with timeout
            const mockConfig: TaskRunConfiguration = {
                label: 'test-task',
                timeout: 10000,
            };

            taskExecutionService.executeChannelTask('test-channel', mockConfig);

            // Dispose should clean up without throwing
            expect(() => {
                taskExecutionService.dispose();
            }).not.toThrow();

            // Active executions should be cleared
            expect(taskExecutionService.getActiveExecutions()).toHaveLength(0);
        });
    });
});