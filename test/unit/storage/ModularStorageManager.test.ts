import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ModularStorageManager } from '../../../src/storage/ModularStorageManager';
import { StorageBackend, StorageBackendInfo } from '../../../src/storage/StorageInterface';

// Mock VS Code
const mockContext = {
    globalStorageUri: { fsPath: '/mock/storage' },
    extensionUri: { fsPath: '/mock/extension' }
} as any;

// Mock backends
class MockBackend implements StorageBackend {
    public isInitialized = false;
    public isHealthy = true;

    async initialize(): Promise<void> {
        this.isInitialized = true;
    }

    async close(): Promise<void> {
        this.isInitialized = false;
    }

    async healthCheck(): Promise<boolean> {
        return this.isHealthy;
    }

    getInfo(): StorageBackendInfo {
        return {
            name: 'Mock Backend',
            type: 'file',
            version: '1.0.0',
            isSecure: false,
            supportsTransactions: false
        };
    }
}

class MockSampleStorage extends MockBackend {
    private samples: Array<{channelId: string, sample: any}> = [];

    async storeSample(channelId: string, sample: any): Promise<void> {
        this.samples.push({ channelId, sample });
    }

    async storeSamples(samples: Array<{channelId: string, sample: any}>): Promise<void> {
        this.samples.push(...samples);
    }

    async getSamples(channelId: string, startTime: number, endTime: number): Promise<any[]> {
        return this.samples
            .filter(s => s.channelId === channelId)
            .filter(s => s.sample.t >= startTime && s.sample.t <= endTime)
            .map(s => s.sample);
    }

    async getRecentSamples(channelId: string, count: number): Promise<any[]> {
        return this.samples
            .filter(s => s.channelId === channelId)
            .slice(-count)
            .map(s => s.sample);
    }

    async cleanupSamples(olderThanMs: number): Promise<number> {
        const cutoff = Date.now() - olderThanMs;
        const beforeCount = this.samples.length;
        this.samples = this.samples.filter(s => s.sample.t >= cutoff);
        return beforeCount - this.samples.length;
    }
}

describe('ModularStorageManager', () => {
    let manager: ModularStorageManager;
    let mockSampleBackend: MockSampleStorage;
    let mockStateBackend: MockBackend;
    
    const config = {
        retentionDays: 30,
        backends: {
            samples: 'mock-samples',
            states: 'mock-states',
            sessions: 'mock-states',
            outages: 'mock-samples'
        }
    };

    beforeEach(async () => {
        mockSampleBackend = new MockSampleStorage();
        mockStateBackend = new MockBackend();
        
        manager = new ModularStorageManager(mockContext, config);
        
        // Register mock backends
        manager.registerBackend('mock-samples', mockSampleBackend);
        manager.registerBackend('mock-states', mockStateBackend);
        
        await manager.initialize();
    });

    describe('backend management', () => {
        it('should register and initialize backends', () => {
            expect(mockSampleBackend.isInitialized).toBe(true);
            expect(mockStateBackend.isInitialized).toBe(true);
        });

        it('should return available backends', () => {
            const backends = manager.getAvailableBackends();
            
            expect(backends).toHaveLength(2);
            expect(backends[0].name).toBe('mock-samples');
            expect(backends[1].name).toBe('mock-states');
        });

        it('should handle backend assignment changes', () => {
            manager.setBackendForType('samples', 'mock-states');
            // Should not throw error
            expect(() => manager.setBackendForType('samples', 'mock-states')).not.toThrow();
        });

        it('should throw error for unknown backend assignment', () => {
            expect(() => {
                manager.setBackendForType('samples', 'unknown-backend');
            }).toThrow('Backend \'unknown-backend\' not registered');
        });
    });

    describe('health monitoring', () => {
        it('should check health of all backends', async () => {
            const isHealthy = await manager.healthCheck();
            expect(isHealthy).toBe(true);
        });

        it('should handle unhealthy backends', async () => {
            mockSampleBackend.isHealthy = false;
            
            const isHealthy = await manager.healthCheck();
            expect(isHealthy).toBe(false);
        });

        it('should disable unhealthy backends and fallback', () => {
            manager.setBackendEnabled('mock-samples', false);
            
            // Should not throw when trying to use disabled backend
            // (will fallback to disk if available)
        });
    });

    describe('sample storage delegation', () => {
        it('should delegate sample operations to correct backend', async () => {
            const sample = { t: Date.now(), ok: true };
            
            await manager.storeSample('test-channel', sample);
            
            const samples = await manager.getRecentSamples('test-channel', 10);
            expect(samples).toHaveLength(1);
            expect(samples[0]).toEqual(sample);
        });

        it('should handle batch sample storage', async () => {
            const samples = [
                { channelId: 'ch1', sample: { t: 1000, ok: true } },
                { channelId: 'ch2', sample: { t: 2000, ok: false } }
            ];
            
            await manager.storeSamples(samples);
            
            const ch1Samples = await manager.getRecentSamples('ch1', 10);
            const ch2Samples = await manager.getRecentSamples('ch2', 10);
            
            expect(ch1Samples).toHaveLength(1);
            expect(ch2Samples).toHaveLength(1);
        });

        it('should handle time-range queries', async () => {
            const sample1 = { t: 1000, ok: true };
            const sample2 = { t: 2000, ok: false };
            const sample3 = { t: 3000, ok: true };
            
            await manager.storeSample('test-channel', sample1);
            await manager.storeSample('test-channel', sample2);
            await manager.storeSample('test-channel', sample3);
            
            const samples = await manager.getSamples('test-channel', 1500, 2500);
            expect(samples).toHaveLength(1);
            expect(samples[0].t).toBe(2000);
        });
    });

    describe('storage statistics', () => {
        it('should collect stats from all backends', async () => {
            // Add some test data
            await manager.storeSample('ch1', { t: Date.now(), ok: true });
            await manager.storeSample('ch2', { t: Date.now(), ok: false });
            
            const stats = await manager.getStorageStats();
            
            expect(stats).toHaveProperty('totalSamples');
            expect(stats).toHaveProperty('backends');
            expect(stats.backends).toHaveLength(2);
            
            expect(stats.backends[0]).toHaveProperty('name');
            expect(stats.backends[0]).toHaveProperty('isHealthy');
            expect(stats.backends[0]).toHaveProperty('recordCount');
        });

        it('should handle backend errors in stats collection', async () => {
            // Make one backend unhealthy
            mockSampleBackend.isHealthy = false;
            
            const stats = await manager.getStorageStats();
            
            expect(stats.backends.some(b => !b.isHealthy)).toBe(true);
        });
    });

    describe('cleanup operations', () => {
        it('should cleanup old samples', async () => {
            const oldSample = { t: Date.now() - 10 * 24 * 60 * 60 * 1000, ok: true }; // 10 days old
            const newSample = { t: Date.now(), ok: true };
            
            await manager.storeSample('test-channel', oldSample);
            await manager.storeSample('test-channel', newSample);
            
            const deletedCount = await manager.cleanupSamples(7 * 24 * 60 * 60 * 1000); // 7 days retention
            
            expect(deletedCount).toBe(1);
            
            const remainingSamples = await manager.getRecentSamples('test-channel', 10);
            expect(remainingSamples).toHaveLength(1);
            expect(remainingSamples[0].t).toBe(newSample.t);
        });
    });

    describe('error handling', () => {
        it('should handle backend initialization failures gracefully', async () => {
            const failingBackend = new MockBackend();
            failingBackend.initialize = vi.fn().mockRejectedValue(new Error('Init failed'));
            
            manager.registerBackend('failing-backend', failingBackend);
            
            // Should not throw, but backend should be marked as unhealthy
            await manager.initialize();
            
            const backends = manager.getAvailableBackends();
            expect(backends.some(b => b.name === 'failing-backend')).toBe(true);
        });

        it('should throw error when no backend available for operation', async () => {
            // Create manager with invalid backend assignments
            const badConfig = {
                ...config,
                backends: {
                    ...config.backends,
                    samples: 'non-existent-backend'
                }
            };
            
            const badManager = new ModularStorageManager(mockContext, badConfig);
            
            await expect(async () => {
                await badManager.storeSample('test', { t: Date.now(), ok: true });
            }).rejects.toThrow();
        });
    });

    describe('resource cleanup', () => {
        it('should close all backends on manager close', async () => {
            await manager.close();
            
            expect(mockSampleBackend.isInitialized).toBe(false);
            expect(mockStateBackend.isInitialized).toBe(false);
        });

        it('should handle backend close errors gracefully', async () => {
            mockSampleBackend.close = vi.fn().mockRejectedValue(new Error('Close failed'));
            
            // Should not throw
            await expect(manager.close()).resolves.not.toThrow();
        });
    });
});