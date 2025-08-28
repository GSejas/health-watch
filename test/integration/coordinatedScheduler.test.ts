// path: test/integration/coordinatedScheduler.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { CoordinatedScheduler } from '../../src/coordination/coordinatedScheduler';
import { StorageManager } from '../../src/storage';
import { ChannelDefinition, Sample } from '../../src/types';

// Mock VS Code API
const mockContext = {
    globalStorageUri: { fsPath: '' },
    subscriptions: []
};

// Mock storage manager
class MockStorageManager extends StorageManager {
    private channelStates = new Map();
    private samples = new Map();

    constructor(storageDir: string) {
        super(mockContext as any);
        this.storageDir = storageDir;
    }

    async getChannelState(channelId: string) {
        return this.channelStates.get(channelId) || {
            state: 'unknown',
            lastProbe: 0,
            consecutiveFailures: 0,
            backoffMultiplier: 1
        };
    }

    async updateChannelState(channelId: string, state: any) {
        this.channelStates.set(channelId, state);
    }

    async updateChannelStateInMemory(channelId: string, state: any) {
        // Simulate in-memory only update for followers
        this.channelStates.set(channelId, { ...state, inMemoryOnly: true });
    }

    async storeSample(channelId: string, sample: Sample) {
        if (!this.samples.has(channelId)) {
            this.samples.set(channelId, []);
        }
        this.samples.get(channelId).push(sample);
    }

    async getRecentSamples(channelId: string, limit: number = 100) {
        return this.samples.get(channelId)?.slice(-limit) || [];
    }
}

describe('CoordinatedScheduler Integration', () => {
    let tempDir: string;
    let storageManager: MockStorageManager;
    let scheduler: CoordinatedScheduler;
    let testChannels: ChannelDefinition[];

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'healthwatch-coord-test-'));
        storageManager = new MockStorageManager(tempDir);
        
        testChannels = [
            {
                id: 'test-https',
                label: 'Test HTTPS',
                type: 'https',
                url: 'https://httpbin.org/status/200',
                intervalSec: 5,
                timeoutMs: 2000,
                threshold: 2
            },
            {
                id: 'test-dns',
                label: 'Test DNS',
                type: 'dns',
                hostname: 'google.com',
                intervalSec: 10,
                timeoutMs: 1000,
                threshold: 3
            }
        ];

        const coordinationConfig = {
            enabled: true,
            lockFilePath: path.join(tempDir, 'leader.lock'),
            sharedStateFilePath: path.join(tempDir, 'shared-state.json'),
            heartbeatIntervalMs: 100,
            leaderTimeoutMs: 300
        };

        scheduler = new CoordinatedScheduler(storageManager, coordinationConfig);
    });

    afterEach(async () => {
        if (scheduler) {
            await scheduler.stop();
        }
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        } catch (error) {
            // Ignore cleanup errors
        }
    });

    describe('Leader-Follower Coordination', () => {
        it('should start as leader when no other instances exist', async () => {
            scheduler.setChannels(testChannels);
            
            const coordinationEvents: Array<{type: string, isLeader: boolean}> = [];
            scheduler.on('coordinationChanged', (isLeader) => {
                coordinationEvents.push({ type: 'coordinationChanged', isLeader });
            });

            await scheduler.startWithCoordination();
            
            // Wait for leadership establishment
            await new Promise(resolve => setTimeout(resolve, 200));
            
            expect(scheduler.isCoordinationEnabled()).toBe(true);
            expect(coordinationEvents.some(e => e.isLeader === true)).toBe(true);
        });

        it('should sync channel state to shared storage when leader', async () => {
            scheduler.setChannels(testChannels);
            await scheduler.startWithCoordination();
            
            // Wait for leadership
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Simulate a probe result
            const testSample: Sample = {
                t: Date.now(),
                ok: true,
                latencyMs: 150
            };
            
            // Update channel state directly to simulate probe result
            await storageManager.updateChannelState('test-https', {
                state: 'online',
                lastProbe: Date.now(),
                consecutiveFailures: 0,
                backoffMultiplier: 1
            });
            
            await storageManager.storeSample('test-https', testSample);
            
            // Trigger state sync (normally done by scheduler internals)
            await scheduler['coordinationManager']?.updateChannelState('test-https', {
                state: 'online',
                lastProbe: Date.now(),
                consecutiveFailures: 0
            });
            
            // Verify shared state was updated
            const sharedState = await scheduler['coordinationManager']?.getSharedState();
            expect(sharedState?.channelStates['test-https']).toBeDefined();
            expect(sharedState?.channelStates['test-https'].state).toBe('online');
        });

        it('should follow shared state when not leader', async () => {
            // Create a lock file for another process to simulate existing leader
            const lockFile = path.join(tempDir, 'leader.lock');
            const otherProcessLock = {
                pid: 99999,
                windowId: 'other-window',
                timestamp: Date.now()
            };
            await fs.writeFile(lockFile, JSON.stringify(otherProcessLock));
            
            // Create shared state with some channel data
            const sharedStateFile = path.join(tempDir, 'shared-state.json');
            const sharedState = {
                lastUpdate: Date.now(),
                channels: {
                    'test-https': {
                        state: 'offline',
                        lastProbe: Date.now() - 5000,
                        consecutiveFailures: 3
                    }
                }
            };
            await fs.writeFile(sharedStateFile, JSON.stringify(sharedState));

            scheduler.setChannels(testChannels);
            
            const stateUpdates: Array<{channelId: string, state: any}> = [];
            scheduler.on('channelStateUpdated', (channelId, state) => {
                stateUpdates.push({ channelId, state });
            });

            await scheduler.startWithCoordination();
            
            // Wait for follower to read shared state
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Verify follower received shared state updates
            const channelState = await storageManager.getChannelState('test-https');
            expect(channelState.state).toBe('offline');
            expect(channelState.consecutiveFailures).toBe(3);
        });
    });

    describe('Failover Scenarios', () => {
        it('should take over leadership when leader becomes unavailable', async () => {
            // Start with another process as leader
            const lockFile = path.join(tempDir, 'leader.lock');
            const initialLock = {
                pid: 99999,
                windowId: 'initial-leader',
                timestamp: Date.now()
            };
            await fs.writeFile(lockFile, JSON.stringify(initialLock));

            scheduler.setChannels(testChannels);
            
            const leadershipEvents: boolean[] = [];
            scheduler.on('coordinationChanged', (isLeader) => {
                leadershipEvents.push(isLeader);
            });

            await scheduler.startWithCoordination();
            
            // Initially should be follower
            await new Promise(resolve => setTimeout(resolve, 150));
            expect(leadershipEvents).toContain(false);
            
            // Simulate leader becoming unavailable (stale timestamp)
            const staleLock = {
                pid: 99999,
                windowId: 'initial-leader',
                timestamp: Date.now() - 1000 // Old timestamp
            };
            await fs.writeFile(lockFile, JSON.stringify(staleLock));
            
            // Wait for takeover detection
            await new Promise(resolve => setTimeout(resolve, 400));
            
            // Should now be leader
            expect(leadershipEvents).toContain(true);
        });

        it('should handle rapid leadership changes gracefully', async () => {
            scheduler.setChannels(testChannels);
            
            const events: Array<{timestamp: number, isLeader: boolean}> = [];
            scheduler.on('coordinationChanged', (isLeader) => {
                events.push({ timestamp: Date.now(), isLeader });
            });

            await scheduler.startWithCoordination();
            
            // Wait for initial leadership
            await new Promise(resolve => setTimeout(resolve, 150));
            
            const lockFile = path.join(tempDir, 'leader.lock');
            
            // Simulate rapid leadership changes
            for (let i = 0; i < 3; i++) {
                // Another process takes over
                const competitorLock = {
                    pid: 88888 + i,
                    windowId: `competitor-${i}`,
                    timestamp: Date.now()
                };
                await fs.writeFile(lockFile, JSON.stringify(competitorLock));
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // Remove competitor (simulate crash)
                await fs.unlink(lockFile).catch(() => {});
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            // Final state should be stable
            await new Promise(resolve => setTimeout(resolve, 200));
            
            expect(events.length).toBeGreaterThan(2);
            expect(events[events.length - 1].isLeader).toBe(true);
        });
    });

    describe('Resource Efficiency', () => {
        it('should reduce probe frequency when coordination is active', async () => {
            const probeEvents: Array<{channelId: string, timestamp: number}> = [];
            
            // Mock the probe execution to track frequency
            const originalRunProbe = scheduler['runProbeForChannel'].bind(scheduler);
            scheduler['runProbeForChannel'] = async (channelId: string) => {
                probeEvents.push({ channelId, timestamp: Date.now() });
                return originalRunProbe(channelId);
            };

            scheduler.setChannels([{
                ...testChannels[0],
                intervalSec: 2 // Short interval for testing
            }]);
            
            await scheduler.startWithCoordination();
            await new Promise(resolve => setTimeout(resolve, 150));
            
            // Run for several intervals
            await new Promise(resolve => setTimeout(resolve, 6000));
            
            const httpsProbes = probeEvents.filter(e => e.channelId === 'test-https');
            
            // Should have probed, but coordination may have optimized frequency
            expect(httpsProbes.length).toBeGreaterThan(0);
            expect(httpsProbes.length).toBeLessThan(4); // Less than expected without coordination
        });
    });

    describe('Error Recovery', () => {
        it('should recover from corrupted shared state', async () => {
            scheduler.setChannels(testChannels);
            await scheduler.startWithCoordination();
            
            // Wait for leadership
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Corrupt the shared state file
            const sharedStateFile = path.join(tempDir, 'shared-state.json');
            await fs.writeFile(sharedStateFile, 'corrupted json content');
            
            // Should handle gracefully and recover
            const stateAfterCorruption = await scheduler['coordinationManager']?.getSharedState();
            expect(stateAfterCorruption).toBeDefined();
            expect(stateAfterCorruption?.channels).toBeDefined();
        });

        it('should continue operation when coordination fails', async () => {
            // Start with invalid coordination paths to simulate failure
            const invalidScheduler = new CoordinatedScheduler(storageManager, {
                enabled: true,
                lockFilePath: '/invalid/path/leader.lock',
                sharedStateFilePath: '/invalid/path/state.json',
                heartbeatIntervalMs: 100,
                leaderTimeoutMs: 300
            });

            invalidScheduler.setChannels(testChannels);
            
            // Should not throw and should fall back to regular scheduling
            await expect(invalidScheduler.startWithCoordination()).resolves.toBeUndefined();
            
            // Should still be running in fallback mode
            expect(invalidScheduler.isRunning()).toBe(true);
            
            await invalidScheduler.stop();
        });
    });
});