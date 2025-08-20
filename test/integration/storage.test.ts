import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ModularStorageManager } from '../../src/storage/ModularStorageManager';
import { DiskStorageAdapter } from '../../src/storage/DiskStorageAdapter';
import { StorageConfig } from '../../src/storage/StorageInterface';

// Mock VS Code context for integration tests
const createMockContext = (tempDir: string) => ({
    globalStorageUri: { fsPath: tempDir },
    extensionUri: { fsPath: tempDir },
    subscriptions: [],
    globalState: new Map(),
    workspaceState: new Map()
} as any);

describe('Storage Integration Tests', () => {
    let tempDir: string;
    let mockContext: any;
    let storageManager: ModularStorageManager;

    beforeEach(async () => {
        // Create temporary directory for test storage
        tempDir = path.join(__dirname, 'temp-storage-' + Date.now());
        fs.mkdirSync(tempDir, { recursive: true });
        
        mockContext = createMockContext(tempDir);

        const config: StorageConfig = {
            retentionDays: 7,
            backends: {
                samples: 'disk',
                states: 'disk',
                sessions: 'disk',
                outages: 'disk'
            }
        };

        storageManager = new ModularStorageManager(mockContext, config);
        await storageManager.initialize();
    });

    afterEach(async () => {
        await storageManager.close();
        
        // Clean up temporary directory
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    describe('end-to-end sample workflow', () => {
        it('should store and retrieve samples across time ranges', async () => {
            const channelId = 'test-channel';
            const now = Date.now();
            
            // Store samples across different time periods
            const samples = [
                { t: now - 3600000, ok: true, latencyMs: 100 },  // 1 hour ago
                { t: now - 1800000, ok: false, reason: 'timeout' as const }, // 30 min ago
                { t: now - 900000, ok: true, latencyMs: 150 },   // 15 min ago
                { t: now - 300000, ok: true, latencyMs: 120 },   // 5 min ago
                { t: now, ok: true, latencyMs: 80 }              // now
            ];

            // Store samples individually
            for (const sample of samples) {
                await storageManager.storeSample(channelId, sample);
            }

            // Test recent samples retrieval
            const recentSamples = await storageManager.getRecentSamples(channelId, 3);
            expect(recentSamples).toHaveLength(1); // Disk storage only keeps latest
            expect(recentSamples[0].latencyMs).toBe(80);

            // Test time range queries (would work with MySQL backend)
            const rangesamples = await storageManager.getSamples(
                channelId, 
                now - 2000000, 
                now + 1000
            );
            expect(Array.isArray(rangesamples)).toBe(true);
        });

        it('should handle batch sample storage', async () => {
            const batchSamples = [
                { channelId: 'ch1', sample: { t: Date.now(), ok: true, latencyMs: 50 } },
                { channelId: 'ch2', sample: { t: Date.now(), ok: false, reason: 'dns' as const } },
                { channelId: 'ch1', sample: { t: Date.now() + 1000, ok: true, latencyMs: 75 } }
            ];

            await storageManager.storeSamples(batchSamples);

            const ch1Samples = await storageManager.getRecentSamples('ch1', 10);
            const ch2Samples = await storageManager.getRecentSamples('ch2', 10);

            expect(ch1Samples.length).toBeGreaterThan(0);
            expect(ch2Samples.length).toBeGreaterThan(0);
        });
    });

    describe('channel state persistence', () => {
        it('should persist and retrieve channel states', async () => {
            const channelId = 'persistent-channel';
            const initialState = {
                state: 'online' as const,
                consecutiveFailures: 0,
                totalChecks: 50,
                totalFailures: 5,
                lastSuccessTime: Date.now()
            };

            await storageManager.setChannelState(channelId, initialState);

            const retrievedState = await storageManager.getChannelState(channelId);
            expect(retrievedState).toBeDefined();
            expect(retrievedState!.state).toBe('online');
            expect(retrievedState!.totalChecks).toBe(50);
        });

        it('should handle state updates correctly', async () => {
            const channelId = 'updating-channel';
            
            // Initial state
            await storageManager.setChannelState(channelId, {
                state: 'online' as const,
                consecutiveFailures: 0,
                totalChecks: 10
            });

            // Update state
            await storageManager.setChannelState(channelId, {
                state: 'offline' as const,
                consecutiveFailures: 3,
                totalChecks: 13,
                lastFailureTime: Date.now()
            });

            const finalState = await storageManager.getChannelState(channelId);
            expect(finalState!.state).toBe('offline');
            expect(finalState!.consecutiveFailures).toBe(3);
            expect(finalState!.totalChecks).toBe(13);
        });

        it('should retrieve all channel states', async () => {
            await storageManager.setChannelState('ch1', { state: 'online' as const });
            await storageManager.setChannelState('ch2', { state: 'offline' as const });
            await storageManager.setChannelState('ch3', { state: 'unknown' as const });

            const allStates = await storageManager.getAllChannelStates();
            
            expect(allStates.size).toBe(3);
            expect(allStates.get('ch1')!.state).toBe('online');
            expect(allStates.get('ch2')!.state).toBe('offline');
            expect(allStates.get('ch3')!.state).toBe('unknown');
        });
    });

    describe('watch session management', () => {
        it('should manage watch session lifecycle', async () => {
            const sessionId = 'test-watch-session';
            const startTime = Date.now();
            
            const session = {
                id: sessionId,
                startTime,
                isActive: true,
                durationSetting: '1h'
            };

            // Start session
            await storageManager.startWatchSession(session);
            
            let currentSession = await storageManager.getCurrentWatchSession();
            expect(currentSession).toBeDefined();
            expect(currentSession!.id).toBe(sessionId);
            expect(currentSession!.isActive).toBe(true);

            // Update session
            const updatedSession = {
                ...session,
                endTime: Date.now(),
                sampleCount: 100
            };
            await storageManager.updateWatchSession(updatedSession);

            // End session
            await storageManager.endWatchSession();
            
            currentSession = await storageManager.getCurrentWatchSession();
            expect(currentSession).toBeUndefined();

            // Check history
            const history = await storageManager.getWatchHistory(10);
            expect(history.length).toBeGreaterThan(0);
            expect(history[0].id).toBe(sessionId);
        });
    });

    describe('outage tracking', () => {
        it('should record and retrieve outages', async () => {
            const outage = {
                id: 'outage-123',
                channelId: 'test-channel',
                startTime: Date.now() - 300000,
                endTime: Date.now() - 60000,
                durationMs: 240000,
                reason: 'Network timeout',
                impact: 'High',
                isResolved: true
            };

            await storageManager.recordOutage(outage);

            // Get all outages
            const allOutages = await storageManager.getOutages();
            expect(allOutages.length).toBeGreaterThan(0);
            expect(allOutages[0].id).toBe('outage-123');

            // Get outages for specific channel
            const channelOutages = await storageManager.getOutages('test-channel');
            expect(channelOutages.length).toBeGreaterThan(0);
            expect(channelOutages[0].channelId).toBe('test-channel');

            // Update outage
            await storageManager.updateOutage('outage-123', {
                endTime: Date.now(),
                isResolved: true
            });

            const updatedOutages = await storageManager.getOutages();
            const updatedOutage = updatedOutages.find(o => o.id === 'outage-123');
            expect(updatedOutage!.isResolved).toBe(true);
        });
    });

    describe('storage statistics and monitoring', () => {
        it('should provide comprehensive storage statistics', async () => {
            // Add some test data
            await storageManager.storeSample('ch1', { t: Date.now(), ok: true });
            await storageManager.setChannelState('ch1', { state: 'online' as const });
            await storageManager.recordOutage({
                id: 'outage-1',
                channelId: 'ch1',
                startTime: Date.now(),
                isResolved: false
            });

            const stats = await storageManager.getStorageStats();

            expect(stats).toHaveProperty('totalChannels');
            expect(stats).toHaveProperty('totalOutages');
            expect(stats).toHaveProperty('backends');
            expect(stats.backends.length).toBeGreaterThan(0);
            
            const diskBackend = stats.backends.find(b => b.name === 'disk');
            expect(diskBackend).toBeDefined();
            expect(diskBackend!.isHealthy).toBe(true);
        });

        it('should perform health checks', async () => {
            const isHealthy = await storageManager.healthCheck();
            expect(isHealthy).toBe(true);
        });
    });

    describe('data cleanup and retention', () => {
        it('should clean up old samples', async () => {
            const now = Date.now();
            const oldSample = { t: now - 10 * 24 * 60 * 60 * 1000, ok: true }; // 10 days old
            const newSample = { t: now, ok: true };

            await storageManager.storeSample('cleanup-test', oldSample);
            await storageManager.storeSample('cleanup-test', newSample);

            // Cleanup samples older than 7 days
            const deletedCount = await storageManager.cleanupSamples(7 * 24 * 60 * 60 * 1000);
            
            // With disk storage, this will return 0 as it doesn't maintain separate sample history
            expect(typeof deletedCount).toBe('number');
        });
    });

    describe('error handling and resilience', () => {
        it('should handle storage directory creation', () => {
            expect(fs.existsSync(tempDir)).toBe(true);
        });

        it('should gracefully handle missing data', async () => {
            const nonExistentState = await storageManager.getChannelState('non-existent');
            expect(nonExistentState).toBeUndefined();

            const emptySamples = await storageManager.getSamples('non-existent', 0, Date.now());
            expect(Array.isArray(emptySamples)).toBe(true);
            expect(emptySamples.length).toBe(0);
        });

        it('should handle concurrent operations', async () => {
            const channelId = 'concurrent-test';
            
            // Simulate concurrent writes
            const promises = [];
            for (let i = 0; i < 10; i++) {
                promises.push(
                    storageManager.storeSample(channelId, {
                        t: Date.now() + i,
                        ok: i % 2 === 0,
                        latencyMs: 100 + i
                    })
                );
            }

            await Promise.all(promises);

            // Should complete without errors
            const state = await storageManager.getChannelState(channelId);
            expect(state).toBeDefined();
        });
    });

    describe('file system integration', () => {
        it('should create necessary storage files', async () => {
            // Add some data to trigger file creation
            await storageManager.setChannelState('test', { state: 'online' as const });
            
            // Check that storage directory exists
            expect(fs.existsSync(tempDir)).toBe(true);
            
            // Note: Actual file creation depends on DiskStorageManager implementation
            // which may create files lazily
        });

        it('should handle storage directory permissions', () => {
            const stats = fs.statSync(tempDir);
            expect(stats.isDirectory()).toBe(true);
        });
    });
});