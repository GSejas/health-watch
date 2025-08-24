/**
 * @fileoverview Unit tests for TaskDiscoveryService
 * 
 * Tests the task discovery service with mocked VS Code APIs
 * to ensure reliable task caching and lookup functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { TaskDiscoveryService } from '../../../src/services/TaskDiscoveryService';

// Mock VS Code APIs
vi.mock('vscode', () => ({
    tasks: {
        fetchTasks: vi.fn(),
        onDidStartTask: vi.fn(() => ({ dispose: vi.fn() })),
        onDidEndTask: vi.fn(() => ({ dispose: vi.fn() })),
    },
    workspace: {
        onDidChangeWorkspaceFolders: vi.fn(() => ({ dispose: vi.fn() })),
    },
}));

describe('TaskDiscoveryService', () => {
    let taskDiscoveryService: TaskDiscoveryService;
    let mockFetchTasks: ReturnType<typeof vi.fn>;

    const createMockTask = (name: string, label?: string, script?: string): vscode.Task => ({
        name,
        definition: {
            type: 'shell',
            label,
            script,
        },
        execution: undefined,
        problemMatchers: [],
        source: 'workspace',
        group: undefined,
        presentationOptions: undefined,
        runOptions: undefined,
        scope: undefined,
    } as any);

    beforeEach(() => {
        taskDiscoveryService = new TaskDiscoveryService();
        mockFetchTasks = vscode.tasks.fetchTasks as any;
    });

    afterEach(() => {
        taskDiscoveryService.dispose();
        vi.clearAllMocks();
    });

    describe('findTaskByLabel', () => {
        it('should find task by exact name match', async () => {
            const mockTasks = [
                createMockTask('test-task'),
                createMockTask('another-task'),
            ];
            mockFetchTasks.mockResolvedValue(mockTasks);

            const result = await taskDiscoveryService.findTaskByLabel('test-task');

            expect(result).toBe(mockTasks[0]);
            expect(mockFetchTasks).toHaveBeenCalledOnce();
        });

        it('should find task by definition label', async () => {
            const mockTasks = [
                createMockTask('build', 'healthwatch:build'),
                createMockTask('test'),
            ];
            mockFetchTasks.mockResolvedValue(mockTasks);

            const result = await taskDiscoveryService.findTaskByLabel('healthwatch:build');

            expect(result).toBe(mockTasks[0]);
        });

        it('should find task by definition script', async () => {
            const mockTasks = [
                createMockTask('npm-test', undefined, 'test'),
                createMockTask('npm-build', undefined, 'build'),
            ];
            mockFetchTasks.mockResolvedValue(mockTasks);

            const result = await taskDiscoveryService.findTaskByLabel('test');

            expect(result).toBe(mockTasks[0]);
        });

        it('should return null for non-existent task', async () => {
            mockFetchTasks.mockResolvedValue([]);

            const result = await taskDiscoveryService.findTaskByLabel('non-existent');

            expect(result).toBeNull();
        });

        it('should handle case-insensitive matching', async () => {
            const mockTasks = [createMockTask('Test-Task')];
            mockFetchTasks.mockResolvedValue(mockTasks);

            const result = await taskDiscoveryService.findTaskByLabel('test-task');

            expect(result).toBe(mockTasks[0]);
        });

        it('should cache tasks and not refetch on subsequent calls', async () => {
            const mockTasks = [createMockTask('test-task')];
            mockFetchTasks.mockResolvedValue(mockTasks);

            // First call
            await taskDiscoveryService.findTaskByLabel('test-task');
            // Second call
            await taskDiscoveryService.findTaskByLabel('test-task');

            expect(mockFetchTasks).toHaveBeenCalledOnce();
        });

        it('should handle fetchTasks failure gracefully', async () => {
            mockFetchTasks.mockRejectedValue(new Error('Failed to fetch tasks'));

            await expect(taskDiscoveryService.findTaskByLabel('any-task')).rejects.toThrow('Task discovery failed');
        });
    });

    describe('suggestSimilarTasks', () => {
        beforeEach(() => {
            const mockTasks = [
                createMockTask('healthwatch:api-check'),
                createMockTask('healthwatch:db-check'),
                createMockTask('test-api'),
                createMockTask('build-app'),
                createMockTask('check-health'),
            ];
            mockFetchTasks.mockResolvedValue(mockTasks);
        });

        it('should suggest tasks with partial matches', async () => {
            const suggestions = await taskDiscoveryService.suggestSimilarTasks('api');

            expect(suggestions).toHaveLength(2);
            expect(suggestions.map(t => t.name)).toContain('healthwatch:api-check');
            expect(suggestions.map(t => t.name)).toContain('test-api');
        });

        it('should suggest tasks with similar names', async () => {
            const suggestions = await taskDiscoveryService.suggestSimilarTasks('healthcheck');

            expect(suggestions).toHaveLength(3);
            expect(suggestions.map(t => t.name)).toContain('healthwatch:api-check');
            expect(suggestions.map(t => t.name)).toContain('healthwatch:db-check');
            expect(suggestions.map(t => t.name)).toContain('check-health');
        });

        it('should limit suggestions to maxSuggestions', async () => {
            const suggestions = await taskDiscoveryService.suggestSimilarTasks('check', 2);

            expect(suggestions).toHaveLength(2);
        });

        it('should return empty array when no similar tasks found', async () => {
            const suggestions = await taskDiscoveryService.suggestSimilarTasks('completely-different');

            expect(suggestions).toHaveLength(0);
        });

        it('should score exact substring matches higher', async () => {
            const suggestions = await taskDiscoveryService.suggestSimilarTasks('api-check');

            // Should prioritize 'healthwatch:api-check' over 'test-api'
            expect(suggestions[0].name).toBe('healthwatch:api-check');
        });
    });

    describe('getAllTasks', () => {
        const mockTasks = [
            { ...createMockTask('build-task'), group: vscode.TaskGroup.Build },
            { ...createMockTask('test-task'), group: vscode.TaskGroup.Test },
            { ...createMockTask('shell-task'), definition: { type: 'shell' } },
            { ...createMockTask('npm-task'), definition: { type: 'npm' } },
        ];

        beforeEach(() => {
            mockFetchTasks.mockResolvedValue(mockTasks);
        });

        it('should return all tasks when no filter provided', async () => {
            const result = await taskDiscoveryService.getAllTasks();

            expect(result).toHaveLength(4);
        });

        it('should filter by task type', async () => {
            const result = await taskDiscoveryService.getAllTasks({ type: 'shell' });

            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('shell-task');
        });

        it('should filter by task group', async () => {
            const result = await taskDiscoveryService.getAllTasks({ group: 'test' });

            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('test-task');
        });

        it('should combine multiple filters', async () => {
            const result = await taskDiscoveryService.getAllTasks({ 
                type: 'shell',
                group: 'build'
            });

            expect(result).toHaveLength(0); // No task matches both criteria in mock data
        });
    });

    describe('cache management', () => {
        it('should invalidate cache and refetch tasks', async () => {
            const initialTasks = [createMockTask('initial-task')];
            const updatedTasks = [createMockTask('updated-task')];
            
            mockFetchTasks.mockResolvedValueOnce(initialTasks);

            // First call - builds cache
            const firstResult = await taskDiscoveryService.findTaskByLabel('initial-task');
            expect(firstResult).toBe(initialTasks[0]);

            // Invalidate cache
            taskDiscoveryService.invalidateCache();
            mockFetchTasks.mockResolvedValueOnce(updatedTasks);

            // Second call - rebuilds cache
            const secondResult = await taskDiscoveryService.findTaskByLabel('updated-task');
            expect(secondResult).toBe(updatedTasks[0]);

            expect(mockFetchTasks).toHaveBeenCalledTimes(2);
        });

        it('should refresh cache based on age', async () => {
            // Mock Date.now to control cache age
            const originalNow = Date.now;
            let currentTime = 1000000;
            vi.spyOn(global.Date, 'now').mockImplementation(() => currentTime);

            const mockTasks = [createMockTask('test-task')];
            mockFetchTasks.mockResolvedValue(mockTasks);

            // First call
            await taskDiscoveryService.findTaskByLabel('test-task');
            expect(mockFetchTasks).toHaveBeenCalledTimes(1);

            // Advance time beyond cache validity (30 seconds)
            currentTime += 31000;

            // Second call should refresh cache
            await taskDiscoveryService.findTaskByLabel('test-task');
            expect(mockFetchTasks).toHaveBeenCalledTimes(2);

            // Restore Date.now
            global.Date.now = originalNow;
        });
    });

    describe('error handling', () => {
        it('should handle empty task list gracefully', async () => {
            mockFetchTasks.mockResolvedValue([]);

            const result = await taskDiscoveryService.findTaskByLabel('any-task');
            const suggestions = await taskDiscoveryService.suggestSimilarTasks('any-task');

            expect(result).toBeNull();
            expect(suggestions).toHaveLength(0);
        });

        it('should handle malformed task objects', async () => {
            const malformedTasks = [
                { name: 'valid-task', definition: { type: 'shell' } },
                { name: null, definition: null }, // Malformed task
                { name: 'another-valid-task', definition: { type: 'npm' } },
            ];
            mockFetchTasks.mockResolvedValue(malformedTasks as any);

            const result = await taskDiscoveryService.findTaskByLabel('valid-task');

            expect(result).toBeTruthy();
            expect(result.name).toBe('valid-task');
        });
    });
});