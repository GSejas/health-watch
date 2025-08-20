/**
 * Disk Storage Adapter for the new modular storage interface
 * 
 * Wraps the existing DiskStorageManager to implement the new storage interfaces
 */

import * as vscode from 'vscode';
import { Sample, ChannelState, WatchSession, Outage } from '../types';
import {
    SampleStorage,
    StateStorage,
    SessionStorage,
    OutageStorage,
    StorageBackendInfo
} from './StorageInterface';
import { DiskStorageManager } from '../diskStorage';

export class DiskStorageAdapter implements SampleStorage, StateStorage, SessionStorage, OutageStorage {
    private diskStorage: DiskStorageManager;
    private isInitialized = false;

    constructor(context: vscode.ExtensionContext) {
        this.diskStorage = DiskStorageManager.initialize(context);
    }

    async initialize(): Promise<void> {
        // DiskStorageManager doesn't have an async initialize method
        // but we can mark as initialized
        this.isInitialized = true;
    }

    async close(): Promise<void> {
        // DiskStorageManager doesn't need explicit closing
        this.isInitialized = false;
    }

    async healthCheck(): Promise<boolean> {
        try {
            // Try to perform a simple operation to verify disk storage is working
            const testStates = await this.getAllChannelStates();
            return true;
        } catch (error) {
            console.error('Disk storage health check failed:', error);
            return false;
        }
    }

    getInfo(): StorageBackendInfo {
        return {
            name: 'File System Storage',
            type: 'file',
            version: '1.0.0',
            isSecure: false, // Local file storage, no encryption by default
            supportsTransactions: false,
            maxRetentionDays: 30 // Default retention for file storage
        };
    }

    // === Sample Storage Methods ===

    async storeSample(channelId: string, sample: Sample): Promise<void> {
        // The existing DiskStorageManager doesn't have direct sample storage
        // We'll need to work through the main storage interface
        // For now, we'll store it as part of channel state updates
        
        // Get current state
        let state = await this.getChannelState(channelId);
        if (!state) {
            state = {
                id: channelId,
                state: sample.success ? 'online' : 'offline',
                consecutiveFailures: sample.success ? 0 : 1,
                lastSample: sample,
                lastStateChange: Date.now(),
                backoffMultiplier: 1,
                samples: []
            } as ChannelState;
        }

        // Update state with new sample
        state.lastSample = sample;
        state.consecutiveFailures = sample.success ? 0 : (state.consecutiveFailures || 0) + 1;


        await this.setChannelState(channelId, state);
    }

    async storeSamples(samples: Array<{ channelId: string; sample: Sample }>): Promise<void> {
        // Store samples individually for file storage
        for (const { channelId, sample } of samples) {
            await this.storeSample(channelId, sample);
        }
    }

    async getSamples(channelId: string, startTime: number, endTime: number): Promise<Sample[]> {
        // File storage doesn't maintain historical samples efficiently
        // Return empty array or implement a simple file-based sample log
        console.warn('Historical sample retrieval not efficiently supported by file storage');
        return [];
    }

    async getRecentSamples(channelId: string, count: number): Promise<Sample[]> {
        // Return the last sample from channel state if available
        const state = await this.getChannelState(channelId);
        if (state?.lastSample) {
            return [state.lastSample];
        }
        return [];
    }

    async cleanupSamples(olderThanMs: number): Promise<number> {
        // File storage doesn't maintain separate sample history
        // Return 0 as no cleanup needed
        return 0;
    }

    // === State Storage Methods ===

    async getChannelState(channelId: string): Promise<ChannelState | undefined> {
    const states = await this.diskStorage.getChannelStates();
    return states.get(channelId) || undefined;
    }

    async setChannelState(channelId: string, state: ChannelState): Promise<void> {
    await this.diskStorage.setChannelState(channelId, state);
    }

    async getAllChannelStates(): Promise<Map<string, ChannelState>> {
    return await this.diskStorage.getChannelStates();
    }

    async removeChannelState(channelId: string): Promise<void> {
    const states = await this.diskStorage.getChannelStates();
    states.delete(channelId);
    await this.diskStorage.saveChannelStates(states);
    }

    // === Session Storage Methods ===

    async startWatchSession(session: WatchSession): Promise<void> {
        await this.diskStorage.setCurrentWatch(session);
    }

    async updateWatchSession(session: WatchSession): Promise<void> {
        await this.diskStorage.setCurrentWatch(session);
    }

    async endWatchSession(): Promise<void> {
        const currentWatch = await this.diskStorage.getCurrentWatch();
        if (currentWatch) {
            currentWatch.isActive = false;
            currentWatch.endTime = Date.now();

            // Move to history
            await this.diskStorage.addToWatchHistory(currentWatch);

            // Clear current watch
            await this.diskStorage.setCurrentWatch(null);
        }
    }

    async getCurrentWatchSession(): Promise<WatchSession | undefined> {
        const cw = await this.diskStorage.getCurrentWatch();
        return cw ?? undefined;
    }

    async getWatchHistory(limit: number = 50): Promise<WatchSession[]> {
        const history = await this.diskStorage.getWatchHistory();
        return history.slice(-limit).reverse(); // Return most recent first
    }

    // === Outage Storage Methods ===

    async recordOutage(outage: Outage): Promise<void> {
        await this.diskStorage.addOutage(outage);
    }

    async getOutages(channelId?: string, startTime?: number, endTime?: number): Promise<Outage[]> {
        let outages = await this.diskStorage.getOutages();

        if (channelId) {
            outages = outages.filter(o => o.channelId === channelId);
        }

        if (startTime) {
            outages = outages.filter(o => o.startTime >= startTime);
        }

        if (endTime) {
            outages = outages.filter(o => o.startTime <= endTime);
        }

        return outages.sort((a, b) => b.startTime - a.startTime); // Most recent first
    }

    async updateOutage(outageId: string, updates: Partial<Outage>): Promise<void> {
        const outages = await this.diskStorage.getOutages();
        const outageIndex = outages.findIndex(o => o.id === outageId);

        if (outageIndex >= 0) {
            outages[outageIndex] = { ...outages[outageIndex], ...updates };
            // Rewrite outages by clearing and re-adding
            await this.diskStorage.clearOutages();
            for (const o of outages) {
                await this.diskStorage.addOutage(o);
            }
        }
    }
}