import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Sample, ChannelState, WatchSession, Outage } from './types';

/**
 * Disk-based storage manager for Health Watch extension.
 * 
 * This replaces the global state storage to avoid the large extension state warning.
 * It stores large data structures on disk using VSCode's storage URIs.
 */
export class DiskStorageManager {
    private static instance: DiskStorageManager;
    private context: vscode.ExtensionContext;
    private storageDir: string;
    
    // File paths for different data types
    private readonly CHANNEL_STATES_FILE = 'channelStates.json';
    private readonly CURRENT_WATCH_FILE = 'currentWatch.json';
    private readonly WATCH_HISTORY_FILE = 'watchHistory.json';
    private readonly OUTAGES_FILE = 'outages.json';

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.storageDir = context.globalStorageUri.fsPath;
        this.ensureStorageDirectory();
    }

    static initialize(context: vscode.ExtensionContext): DiskStorageManager {
        if (!DiskStorageManager.instance) {
            DiskStorageManager.instance = new DiskStorageManager(context);
        }
        return DiskStorageManager.instance;
    }

    static getInstance(): DiskStorageManager {
        if (!DiskStorageManager.instance) {
            throw new Error('DiskStorageManager not initialized. Call initialize() first.');
        }
        return DiskStorageManager.instance;
    }

    private ensureStorageDirectory(): void {
        const maxRetries = 3;
        let lastError: Error | undefined;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                if (!fs.existsSync(this.storageDir)) {
                    fs.mkdirSync(this.storageDir, { recursive: true });
                }
                
                // Verify directory is writable
                const testFile = path.join(this.storageDir, '.write-test');
                fs.writeFileSync(testFile, 'test', 'utf8');
                fs.unlinkSync(testFile);
                
                return; // Success
            } catch (error) {
                lastError = error as Error;
                console.error(`Failed to create/verify storage directory (attempt ${attempt}/${maxRetries}):`, error);
                
                if (attempt < maxRetries) {
                    // Wait before retry
                    const delayMs = 100 * attempt;
                    setTimeout(() => {}, delayMs);
                }
            }
        }
        
        // All retries failed - this is a critical error but don't throw to avoid breaking extension activation
        console.error(`CRITICAL: Storage directory creation failed after ${maxRetries} attempts:`, lastError);
        vscode.window.showErrorMessage(`Health Watch: Storage directory creation failed. Extension may not function properly.`);
    }

    private getFilePath(filename: string): string {
        return path.join(this.storageDir, filename);
    }

    private async readJsonFile<T>(filename: string, defaultValue: T): Promise<T> {
        const maxRetries = 3;
        let lastError: Error | undefined;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const filePath = this.getFilePath(filename);
                if (fs.existsSync(filePath)) {
                    const data = fs.readFileSync(filePath, 'utf8');
                    
                    // Validate JSON before parsing
                    if (data.trim().length === 0) {
                        console.warn(`Empty file detected: ${filename}, using default value`);
                        return defaultValue;
                    }
                    
                    return JSON.parse(data);
                }
                // File doesn't exist, return default
                return defaultValue;
            } catch (error) {
                lastError = error as Error;
                console.error(`Failed to read ${filename} (attempt ${attempt}/${maxRetries}):`, error);
                
                if (attempt < maxRetries) {
                    // Exponential backoff: 100ms, 200ms, 400ms
                    const delayMs = 100 * Math.pow(2, attempt - 1);
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                }
            }
        }
        
        // All retries failed, log error and return default
        console.error(`Failed to read ${filename} after ${maxRetries} attempts, using default value:`, lastError);
        return defaultValue;
    }

    private async writeJsonFile<T>(filename: string, data: T): Promise<void> {
        const maxRetries = 3;
        let lastError: Error | undefined;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const filePath = this.getFilePath(filename);
                const tempFilePath = `${filePath}.tmp`;
                
                // Write to temporary file first for atomic operation
                const jsonString = JSON.stringify(data, null, 2);
                fs.writeFileSync(tempFilePath, jsonString, 'utf8');
                
                // Verify the temporary file was written correctly
                const verifyData = fs.readFileSync(tempFilePath, 'utf8');
                JSON.parse(verifyData); // Ensure valid JSON
                
                // Atomic move to final location
                fs.renameSync(tempFilePath, filePath);
                return; // Success
                
            } catch (error) {
                lastError = error as Error;
                console.error(`Failed to write ${filename} (attempt ${attempt}/${maxRetries}):`, error);
                
                // Clean up temporary file if it exists
                try {
                    const tempFilePath = `${this.getFilePath(filename)}.tmp`;
                    if (fs.existsSync(tempFilePath)) {
                        fs.unlinkSync(tempFilePath);
                    }
                } catch (cleanupError) {
                    console.warn(`Failed to cleanup temp file for ${filename}:`, cleanupError);
                }
                
                if (attempt < maxRetries) {
                    // Exponential backoff: 100ms, 200ms, 400ms
                    const delayMs = 100 * Math.pow(2, attempt - 1);
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                }
            }
        }
        
        // All retries failed, throw error to notify caller
        throw new Error(`Failed to write ${filename} after ${maxRetries} attempts: ${lastError?.message}`);
    }

    // Channel States Management
    async getChannelStates(): Promise<Map<string, ChannelState>> {
        const data = await this.readJsonFile<Record<string, ChannelState>>(this.CHANNEL_STATES_FILE, {});
        return new Map(Object.entries(data));
    }

    async saveChannelStates(states: Map<string, ChannelState>): Promise<void> {
        const data = Object.fromEntries(states);
        await this.writeJsonFile(this.CHANNEL_STATES_FILE, data);
    }

    async getChannelState(channelId: string): Promise<ChannelState | null> {
        const states = await this.getChannelStates();
        return states.get(channelId) || null;
    }

    async setChannelState(channelId: string, state: ChannelState): Promise<void> {
        const states = await this.getChannelStates();
        states.set(channelId, state);
        await this.saveChannelStates(states);
    }

    // Current Watch Management
    async getCurrentWatch(): Promise<WatchSession | null> {
        return await this.readJsonFile<WatchSession | null>(this.CURRENT_WATCH_FILE, null);
    }

    async setCurrentWatch(watch: WatchSession | null): Promise<void> {
        await this.writeJsonFile(this.CURRENT_WATCH_FILE, watch);
    }

    // Watch History Management
    async getWatchHistory(): Promise<WatchSession[]> {
        return await this.readJsonFile<WatchSession[]>(this.WATCH_HISTORY_FILE, []);
    }

    async addToWatchHistory(watch: WatchSession): Promise<void> {
        const history = await this.getWatchHistory();
        history.push(watch);
        
        // Keep only last 100 watch sessions to prevent unbounded growth
        if (history.length > 100) {
            history.splice(0, history.length - 100);
        }
        
        await this.writeJsonFile(this.WATCH_HISTORY_FILE, history);
    }

    async clearWatchHistory(): Promise<void> {
        await this.writeJsonFile(this.WATCH_HISTORY_FILE, []);
    }

    // Outages Management
    async getOutages(): Promise<Outage[]> {
        return await this.readJsonFile<Outage[]>(this.OUTAGES_FILE, []);
    }

    async addOutage(outage: Outage): Promise<void> {
        const outages = await this.getOutages();
        outages.push(outage);
        
        // Keep only last 500 outages to prevent unbounded growth
        if (outages.length > 500) {
            outages.splice(0, outages.length - 500);
        }
        
        await this.writeJsonFile(this.OUTAGES_FILE, outages);
    }

    async clearOutages(): Promise<void> {
        await this.writeJsonFile(this.OUTAGES_FILE, []);
    }

    // Custom data storage (for backward compatibility)
    async getCustomData<T>(key: string): Promise<T | undefined> {
        try {
            const filename = `custom_${key}.json`;
            const data = await this.readJsonFile<T | undefined>(filename, undefined);
            return data;
        } catch {
            return undefined;
        }
    }

    async setCustomData<T>(key: string, data: T): Promise<void> {
        const filename = `custom_${key}.json`;
        await this.writeJsonFile(filename, data);
    }

    async deleteCustomData(key: string): Promise<void> {
        try {
            const filename = `custom_${key}.json`;
            const filePath = this.getFilePath(filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (error) {
            console.error(`Failed to delete custom data ${key}:`, error);
        }
    }

    // Migration helpers
    async migrateFromGlobalState(): Promise<void> {
        try {
            // Migrate channel states
            const channelStatesData = this.context.globalState.get<Record<string, ChannelState>>('healthWatch.channelStates');
            if (channelStatesData) {
                const states = new Map(Object.entries(channelStatesData));
                await this.saveChannelStates(states);
                await this.context.globalState.update('healthWatch.channelStates', undefined);
            }

            // Migrate current watch
            const currentWatch = this.context.globalState.get<WatchSession | null>('healthWatch.currentWatch');
            if (currentWatch) {
                await this.setCurrentWatch(currentWatch);
                await this.context.globalState.update('healthWatch.currentWatch', undefined);
            }

            // Migrate watch history
            const watchHistory = this.context.globalState.get<WatchSession[]>('healthWatch.watchHistory');
            if (watchHistory && watchHistory.length > 0) {
                await this.writeJsonFile(this.WATCH_HISTORY_FILE, watchHistory);
                await this.context.globalState.update('healthWatch.watchHistory', undefined);
            }

            // Migrate outages
            const outages = this.context.globalState.get<Outage[]>('healthWatch.outages');
            if (outages && outages.length > 0) {
                await this.writeJsonFile(this.OUTAGES_FILE, outages);
                await this.context.globalState.update('healthWatch.outages', undefined);
            }

            console.log('Migration from global state to disk storage completed successfully');
        } catch (error) {
            console.error('Failed to migrate from global state:', error);
        }
    }

    // Cleanup methods
    async cleanupOldData(daysToKeep: number = 30): Promise<void> {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
            const cutoffTime = cutoffDate.getTime();

            // Clean old watch history
            const watchHistory = await this.getWatchHistory();
            const filteredHistory = watchHistory.filter(watch => 
                watch.startTime && new Date(watch.startTime).getTime() > cutoffTime
            );
            if (filteredHistory.length !== watchHistory.length) {
                await this.writeJsonFile(this.WATCH_HISTORY_FILE, filteredHistory);
            }

            // Clean old outages
            const outages = await this.getOutages();
            const filteredOutages = outages.filter(outage => 
                outage.startTime && new Date(outage.startTime).getTime() > cutoffTime
            );
            if (filteredOutages.length !== outages.length) {
                await this.writeJsonFile(this.OUTAGES_FILE, filteredOutages);
            }

            console.log(`Cleaned up data older than ${daysToKeep} days`);
        } catch (error) {
            console.error('Failed to cleanup old data:', error);
        }
    }
}
