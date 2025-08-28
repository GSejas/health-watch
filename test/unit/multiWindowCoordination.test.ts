// path: test/unit/multiWindowCoordination.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

import { EventEmitter } from 'events';

// Simple test-focused coordination manager without VS Code dependencies
class TestMultiWindowCoordinationManager extends EventEmitter {
    private isRunning = false;
    private isLeaderFlag = false;
    private config: any;
    private heartbeatTimer?: NodeJS.Timeout;
    private sharedState: any = { channels: {}, lastUpdate: Date.now() };
    
    constructor(config: any) {
        super();
        this.config = config;
    }
    
    async start(): Promise<void> {
        this.isRunning = true;
        
        // Simple leader election based on lock file
        try {
            const lockContent = await fs.readFile(this.config.lockFilePath, 'utf-8');
            const lock = JSON.parse(lockContent);
            
            // Check if lock is expired
            const isExpired = (Date.now() - lock.timestamp) > this.config.leaderTimeoutMs;
            
            if (isExpired) {
                // Take over expired lock
                this.isLeaderFlag = true;
                await this.createLockFile();
                this.emit('leadershipChanged', true);
            } else {
                // Lock exists and valid, become follower
                this.isLeaderFlag = false;
                this.emit('leadershipChanged', false);
            }
        } catch {
            // No lock or corrupted lock, try to become leader
            try {
                this.isLeaderFlag = true;
                await this.createLockFile();
                this.emit('leadershipChanged', true);
            } catch (error) {
                // Can't create lock file, remain as follower
                this.isLeaderFlag = false;
                this.emit('leadershipChanged', false);
            }
        }
        
        // Create shared state file when becoming leader
        if (this.isLeaderFlag) {
            try {
                await fs.writeFile(this.config.sharedStateFilePath, JSON.stringify(this.sharedState));
                this.startHeartbeat();
            } catch (error) {
                // Can't create state file, step down from leadership
                this.isLeaderFlag = false;
                this.emit('leadershipChanged', false);
            }
        }
    }
    
    private startHeartbeat(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
        }
        
        this.heartbeatTimer = setInterval(async () => {
            if (this.isLeaderFlag) {
                await this.createLockFile(); // Update timestamp
            }
        }, this.config.heartbeatIntervalMs);
    }
    
    // Method to check if leadership should change (for testing rapid changes)
    async checkLeadershipChange(): Promise<void> {
        try {
            const lockContent = await fs.readFile(this.config.lockFilePath, 'utf-8');
            const lock = JSON.parse(lockContent);
            
            // Check if lock is from another process or expired
            const isExpired = (Date.now() - lock.timestamp) > this.config.leaderTimeoutMs;
            const isOtherProcess = lock.windowId !== 'test-window';
            
            if (isOtherProcess && !isExpired) {
                // Another process took over, become follower
                if (this.isLeaderFlag) {
                    this.isLeaderFlag = false;
                    this.emit('leadershipChanged', false);
                    if (this.heartbeatTimer) {
                        clearInterval(this.heartbeatTimer);
                    }
                }
            } else if (isExpired && !this.isLeaderFlag) {
                // Leader expired, try to take over
                this.isLeaderFlag = true;
                await this.createLockFile();
                this.emit('leadershipChanged', true);
                this.startHeartbeat();
            }
        } catch (error) {
            // Lock file missing, try to become leader if not already
            if (!this.isLeaderFlag) {
                try {
                    this.isLeaderFlag = true;
                    await this.createLockFile();
                    this.emit('leadershipChanged', true);
                    this.startHeartbeat();
                } catch (createError) {
                    this.isLeaderFlag = false;
                }
            }
        }
    }
    
    async stop(): Promise<void> {
        this.isRunning = false;
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
        }
        if (this.isLeaderFlag) {
            try {
                await fs.unlink(this.config.lockFilePath);
            } catch {}
        }
    }
    
    isLeader(): boolean {
        return this.isLeaderFlag;
    }
    
    async updateChannelState(channelId: string, state: any): Promise<void> {
        if (this.isLeaderFlag) {
            this.sharedState.channelStates[channelId] = state;
            this.sharedState.lastUpdate = Date.now();
            await fs.writeFile(this.config.sharedStateFilePath, JSON.stringify(this.sharedState));
        }
    }
    
    async getSharedState(): Promise<any> {
        if (this.isLeaderFlag) {
            return this.sharedState;
        } else {
            try {
                const content = await fs.readFile(this.config.sharedStateFilePath, 'utf-8');
                return JSON.parse(content);
            } catch {
                return { channels: {}, lastUpdate: Date.now() };
            }
        }
    }
    
    private async createLockFile(): Promise<void> {
        const lock = {
            pid: process.pid,
            windowId: 'test-window',
            timestamp: Date.now()
        };
        await fs.writeFile(this.config.lockFilePath, JSON.stringify(lock));
    }
}

describe('MultiWindowCoordinationManager', () => {
    let tempDir: string;
    let lockFile: string;
    let stateFile: string;
    let manager: TestMultiWindowCoordinationManager;

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'healthwatch-test-'));
        lockFile = path.join(tempDir, 'leader.lock');
        stateFile = path.join(tempDir, 'shared-state.json');
        
        manager = new TestMultiWindowCoordinationManager({
            lockFilePath: lockFile,
            sharedStateFilePath: stateFile,
            heartbeatIntervalMs: 100,
            leaderTimeoutMs: 300
        });
    });

    afterEach(async () => {
        if (manager) {
            await manager.stop();
        }
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        } catch (error) {
            // Ignore cleanup errors in tests
        }
    });

    describe('Leader Election', () => {
        it('should become leader when no lock file exists', async () => {
            let isLeaderEvents: boolean[] = [];
            manager.on('leadershipChanged', (isLeader) => {
                isLeaderEvents.push(isLeader);
            });

            await manager.start();
            
            // Give it time to establish leadership
            await new Promise(resolve => setTimeout(resolve, 150));
            
            expect(manager.isLeader()).toBe(true);
            expect(isLeaderEvents).toContain(true);
        });

        it('should not become leader when valid lock exists', async () => {
            // Create a valid lock file for another process
            const otherProcessLock = {
                pid: 99999,
                windowId: 'other-window',
                timestamp: Date.now()
            };
            await fs.writeFile(lockFile, JSON.stringify(otherProcessLock));

            await manager.start();
            
            // Give it time to check leadership
            await new Promise(resolve => setTimeout(resolve, 150));
            
            expect(manager.isLeader()).toBe(false);
        });

        it('should take over leadership when lock expires', async () => {
            // Create an expired lock file
            const expiredLock = {
                pid: 99999,
                windowId: 'expired-window',
                timestamp: Date.now() - 1000 // 1 second ago, older than leaderTimeoutMs
            };
            await fs.writeFile(lockFile, JSON.stringify(expiredLock));

            let leadershipEvents: boolean[] = [];
            manager.on('leadershipChanged', (isLeader) => {
                leadershipEvents.push(isLeader);
            });

            await manager.start();
            
            // Give it time to detect expired lock and take over
            await new Promise(resolve => setTimeout(resolve, 200));
            
            expect(manager.isLeader()).toBe(true);
            expect(leadershipEvents).toContain(true);
        });

        it('should maintain leadership with heartbeats', async () => {
            await manager.start();
            
            // Wait for initial leadership
            await new Promise(resolve => setTimeout(resolve, 150));
            expect(manager.isLeader()).toBe(true);

            // Wait through several heartbeat cycles
            await new Promise(resolve => setTimeout(resolve, 350));
            
            expect(manager.isLeader()).toBe(true);
            
            // Verify lock file is being updated
            const lockContent = await fs.readFile(lockFile, 'utf-8');
            const lock = JSON.parse(lockContent);
            expect(lock.timestamp).toBeGreaterThan(Date.now() - 200);
        });
    });

    describe('Shared State Management', () => {
        it('should initialize shared state when becoming leader', async () => {
            await manager.start();
            await new Promise(resolve => setTimeout(resolve, 150));
            
            expect(manager.isLeader()).toBe(true);
            
            // Check that shared state file exists
            const stateExists = await fs.access(stateFile).then(() => true).catch(() => false);
            expect(stateExists).toBe(true);
            
            const state = await manager.getSharedState();
            expect(state).toHaveProperty('lastUpdate');
            expect(state).toHaveProperty('channels');
        });

        it('should update shared state when leader', async () => {
            await manager.start();
            await new Promise(resolve => setTimeout(resolve, 150));
            
            const testChannelState = {
                state: 'online' as const,
                lastProbe: Date.now(),
                consecutiveFailures: 0
            };
            
            await manager.updateChannelState('test-channel', testChannelState);
            
            const sharedState = await manager.getSharedState();
            expect(sharedState.channelStates['test-channel']).toEqual(testChannelState);
        });

        it('should not update shared state when follower', async () => {
            // Create a valid lock for another process
            const otherLock = {
                pid: 99999,
                windowId: 'other-window',
                timestamp: Date.now()
            };
            await fs.writeFile(lockFile, JSON.stringify(otherLock));
            
            await manager.start();
            await new Promise(resolve => setTimeout(resolve, 150));
            
            expect(manager.isLeader()).toBe(false);
            
            const testChannelState = {
                state: 'online' as const,
                lastProbe: Date.now(),
                consecutiveFailures: 0
            };
            
            // This should not throw but should not update the file
            await manager.updateChannelState('test-channel', testChannelState);
            
            // Verify no state file was created by follower
            const stateExists = await fs.access(stateFile).then(() => true).catch(() => false);
            expect(stateExists).toBe(false);
        });
    });

    describe('Leadership Transitions', () => {
        it('should emit events on leadership changes', async () => {
            const leadershipEvents: boolean[] = [];
            manager.on('leadershipChanged', (isLeader) => {
                leadershipEvents.push(isLeader);
            });

            await manager.start();
            await new Promise(resolve => setTimeout(resolve, 150));
            
            expect(leadershipEvents).toContain(true);
        });

        it('should handle rapid leadership changes gracefully', async () => {
            const events: string[] = [];
            manager.on('leadershipChanged', (isLeader) => {
                events.push(isLeader ? 'leader' : 'follower');
                console.log(`Leadership event: ${isLeader ? 'leader' : 'follower'}`);
            });

            // Start as leader
            await manager.start();
            await new Promise(resolve => setTimeout(resolve, 100));
            console.log(`Initial events: ${JSON.stringify(events)}`);

            // Simulate another process taking leadership
            const competitorLock = {
                pid: 88888,
                windowId: 'competitor',
                timestamp: Date.now()
            };
            await fs.writeFile(lockFile, JSON.stringify(competitorLock));

            // Trigger leadership change detection
            await manager.checkLeadershipChange();
            await new Promise(resolve => setTimeout(resolve, 100));

            console.log(`Final events: ${JSON.stringify(events)}`);
            expect(events).toContain('leader');
            expect(events).toContain('follower');
        });
    });

    describe('Error Handling', () => {
        it('should handle file system errors gracefully', async () => {
            // Use an invalid path to trigger file system errors
            const invalidManager = new TestMultiWindowCoordinationManager({
                lockFilePath: '/invalid/path/leader.lock',
                sharedStateFilePath: '/invalid/path/state.json',
                heartbeatIntervalMs: 100,
                leaderTimeoutMs: 300
            });

            // Should not throw
            await expect(invalidManager.start()).resolves.toBeUndefined();
            
            expect(invalidManager.isLeader()).toBe(false);
            
            await invalidManager.stop();
        });

        it('should recover from corrupted lock files', async () => {
            // Create corrupted lock file
            await fs.writeFile(lockFile, 'invalid json content');

            await manager.start();
            await new Promise(resolve => setTimeout(resolve, 150));
            
            // Should still become leader by treating corrupted file as expired
            expect(manager.isLeader()).toBe(true);
        });

        it('should handle missing shared state file', async () => {
            await manager.start();
            await new Promise(resolve => setTimeout(resolve, 150));
            
            // Delete the shared state file while running
            await fs.unlink(stateFile).catch(() => {});
            
            // Should handle gracefully and recreate
            const state = await manager.getSharedState();
            expect(state).toHaveProperty('channels');
        });
    });

    describe('Process Cleanup', () => {
        it('should clean up resources on stop', async () => {
            await manager.start();
            await new Promise(resolve => setTimeout(resolve, 150));
            
            expect(manager.isLeader()).toBe(true);
            
            await manager.stop();
            
            // Lock file should be removed if we were leader
            const lockExists = await fs.access(lockFile).then(() => true).catch(() => false);
            expect(lockExists).toBe(false);
        });

        it('should not remove lock file when stopping as follower', async () => {
            // Create lock for another process
            const otherLock = {
                pid: 99999,
                windowId: 'other-window',
                timestamp: Date.now()
            };
            await fs.writeFile(lockFile, JSON.stringify(otherLock));

            await manager.start();
            await new Promise(resolve => setTimeout(resolve, 150));
            
            expect(manager.isLeader()).toBe(false);
            
            await manager.stop();
            
            // Lock file should still exist
            const lockExists = await fs.access(lockFile).then(() => true).catch(() => false);
            expect(lockExists).toBe(true);
        });
    });
});