/**
 * @fileoverview VS Code Task Discovery Service
 * 
 * Implements modern task discovery patterns with event-driven caching
 * as recommended by VS Code 2025 best practices.
 * 
 * @author Health Watch Extension
 * @version 1.0.0
 * @since 2025-08-24
 */

import * as vscode from 'vscode';

export interface TaskCacheEntry {
    task: vscode.Task;
    lastSeen: number;
}

/**
 * 🔍 **TASK DISCOVERY SERVICE**
 * 
 * Manages task discovery with intelligent caching and event-driven updates.
 * Follows 2025 best practices for VS Code extension development.
 */
export class TaskDiscoveryService {
    private taskCache = new Map<string, TaskCacheEntry>();
    private cacheBuilt = false;
    private readonly CACHE_VALIDITY_MS = 30000; // 30 seconds
    
    private disposables: vscode.Disposable[] = [];

    constructor() {
        this.setupEventListeners();
    }

    /**
     * 📡 **EVENT-DRIVEN CACHE MANAGEMENT**
     * 
     * Sets up listeners for task changes to maintain cache freshness
     */
    private setupEventListeners(): void {
        // Listen for task changes and refresh cache
        const taskChangeListener = vscode.tasks.onDidStartTask(() => {
            this.refreshCacheIfNeeded();
        });

        const taskEndListener = vscode.tasks.onDidEndTask(() => {
            this.refreshCacheIfNeeded();
        });

        this.disposables.push(taskChangeListener, taskEndListener);

        // Refresh cache when workspace folders change
        const workspaceListener = vscode.workspace.onDidChangeWorkspaceFolders(() => {
            this.invalidateCache();
        });

        this.disposables.push(workspaceListener);
    }

    /**
     * 🔄 **INTELLIGENT CACHE REFRESH**
     * 
     * Refreshes cache only when needed, preventing excessive API calls
     */
    private async refreshCacheIfNeeded(): Promise<void> {
        const now = Date.now();
        const cacheAge = now - (this.taskCache.size > 0 ? 
            Math.min(...Array.from(this.taskCache.values()).map(e => e.lastSeen)) : 0
        );

        if (!this.cacheBuilt || cacheAge > this.CACHE_VALIDITY_MS) {
            await this.buildTaskCache();
        }
    }

    /**
     * 🏗️ **BUILD TASK CACHE**
     * 
     * Fetches all available tasks and builds searchable cache
     */
    private async buildTaskCache(): Promise<void> {
        try {
            console.log('[TaskDiscoveryService] Building task cache...');
            
            const allTasks = await vscode.tasks.fetchTasks();
            const now = Date.now();
            
            this.taskCache.clear();
            
            for (const task of allTasks) {
                // Index by multiple keys for flexible lookup
                const keys = this.generateTaskKeys(task);
                
                for (const key of keys) {
                    this.taskCache.set(key, {
                        task,
                        lastSeen: now
                    });
                }
            }

            this.cacheBuilt = true;
            console.log(`[TaskDiscoveryService] Cache built with ${allTasks.length} tasks`);
            
        } catch (error) {
            console.error('[TaskDiscoveryService] Failed to build task cache:', error);
            throw new Error(`Task discovery failed: ${error}`);
        }
    }

    /**
     * 🔑 **GENERATE TASK KEYS**
     * 
     * Creates multiple searchable keys for flexible task lookup
     */
    private generateTaskKeys(task: vscode.Task): string[] {
        const keys: string[] = [];
        
        // Primary key: task name
        if (task.name) {
            keys.push(task.name.toLowerCase());
        }
        
        // Definition-based keys
        if (task.definition) {
            if (task.definition.label) {
                keys.push(task.definition.label.toLowerCase());
            }
            if (task.definition.script) {
                keys.push(task.definition.script.toLowerCase());
            }
            if (task.definition.taskName) {
                keys.push(task.definition.taskName.toLowerCase());
            }
        }

        return keys;
    }

    /**
     * 🎯 **FIND TASK BY LABEL**
     * 
     * Primary method for task lookup with exact and fuzzy matching
     */
    async findTaskByLabel(label: string): Promise<vscode.Task | null> {
        await this.refreshCacheIfNeeded();
        
        const normalizedLabel = label.toLowerCase();
        
        // Try exact match first
        const exactMatch = this.taskCache.get(normalizedLabel);
        if (exactMatch) {
            console.log(`[TaskDiscoveryService] Found exact match for task: ${label}`);
            return exactMatch.task;
        }

        console.log(`[TaskDiscoveryService] No exact match found for task: ${label}`);
        return null;
    }

    /**
     * 🔍 **SUGGEST SIMILAR TASKS**
     * 
     * Provides fuzzy matching for helpful error messages
     */
    async suggestSimilarTasks(label: string, maxSuggestions = 5): Promise<vscode.Task[]> {
        await this.refreshCacheIfNeeded();
        
        const normalizedLabel = label.toLowerCase();
        const suggestions: Array<{ task: vscode.Task; score: number }> = [];

        for (const [key, entry] of this.taskCache) {
            let score = 0;
            
            // Partial match scoring
            if (key.includes(normalizedLabel)) {
                score += 10;
            }
            if (normalizedLabel.includes(key)) {
                score += 5;
            }
            
            // Levenshtein distance scoring (simplified)
            const distance = this.calculateDistance(normalizedLabel, key);
            if (distance <= 3) {
                score += (3 - distance) * 2;
            }

            if (score > 0) {
                suggestions.push({ task: entry.task, score });
            }
        }

        // Sort by score and return top suggestions
        return suggestions
            .sort((a, b) => b.score - a.score)
            .slice(0, maxSuggestions)
            .map(s => s.task);
    }

    /**
     * 📏 **CALCULATE EDIT DISTANCE**
     * 
     * Simple Levenshtein distance for fuzzy matching
     */
    private calculateDistance(str1: string, str2: string): number {
        const matrix: number[][] = [];
        const len1 = str1.length;
        const len2 = str2.length;

        if (len1 === 0) return len2;
        if (len2 === 0) return len1;

        // Initialize matrix
        for (let i = 0; i <= len1; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= len2; j++) {
            matrix[0][j] = j;
        }

        // Fill matrix
        for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
                const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,      // deletion
                    matrix[i][j - 1] + 1,      // insertion
                    matrix[i - 1][j - 1] + cost // substitution
                );
            }
        }

        return matrix[len1][len2];
    }

    /**
     * 🗂️ **GET ALL TASKS**
     * 
     * Returns all cached tasks with optional filtering
     */
    async getAllTasks(filter?: {
        type?: string;
        group?: string;
        source?: string;
    }): Promise<vscode.Task[]> {
        await this.refreshCacheIfNeeded();
        
        const allTasks = Array.from(this.taskCache.values()).map(entry => entry.task);
        
        if (!filter) {
            return allTasks;
        }

        return allTasks.filter(task => {
            if (filter.type && task.definition.type !== filter.type) {
                return false;
            }
            if (filter.group) {
                const taskGroupName = task.group?.id || task.group?.toString() || '';
                if (taskGroupName !== filter.group) {
                    return false;
                }
            }
            if (filter.source && task.source !== filter.source) {
                return false;
            }
            return true;
        });
    }

    /**
     * ❌ **INVALIDATE CACHE**
     * 
     * Forces cache rebuild on next lookup
     */
    invalidateCache(): void {
        console.log('[TaskDiscoveryService] Cache invalidated');
        this.taskCache.clear();
        this.cacheBuilt = false;
    }

    /**
     * 🧹 **CLEANUP**
     * 
     * Dispose of event listeners and resources
     */
    dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this.taskCache.clear();
    }
}