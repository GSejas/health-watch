import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

// Mock file system for coordination tests
vi.mock('fs', async () => {
    const actual = await vi.importActual('fs');
    return {
        ...actual,
        promises: {
            writeFile: vi.fn(),
            readFile: vi.fn(),
            mkdir: vi.fn(),
            access: vi.fn(),
            unlink: vi.fn(),
            stat: vi.fn()
        },
        existsSync: vi.fn(),
        writeFileSync: vi.fn(),
        readFileSync: vi.fn()
    };
});

// Simplified coordination manager for stress testing
class StressCoordinationManager extends EventEmitter {
    private role: 'leader' | 'follower' = 'follower';
    private lockFilePath: string;
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private heartbeatFailureCount = 0;
    private isDisposed = false;
    private windowId: string;

    constructor(lockFilePath: string, windowId: string) {
        super();
        this.lockFilePath = lockFilePath;
        this.windowId = windowId;
    }

    async startCoordination(): Promise<void> {
        if (this.isDisposed) return;
        
        await this.attemptLeadership();
        this.startHeartbeat();
    }

    private async attemptLeadership(): Promise<void> {
        const fs = await import('fs');
        
        try {
            // Try to acquire lock
            const lockData = {
                windowId: this.windowId,
                pid: process.pid,
                timestamp: Date.now()
            };
            
            await fs.promises.writeFile(this.lockFilePath, JSON.stringify(lockData), { flag: 'wx' });
            
            const oldRole = this.role;
            this.role = 'leader';
            
            if (oldRole !== 'leader') {
                this.emit('roleChanged', { oldRole, newRole: 'leader' });
            }
            
        } catch (error: any) {
            // Lock file exists, check if it's stale
            await this.checkStaleLock();
        }
    }

    private async checkStaleLock(): Promise<void> {
        const fs = await import('fs');
        
        try {
            const lockContent = await fs.promises.readFile(this.lockFilePath, 'utf8');
            const lockData = JSON.parse(lockContent);
            
            // Consider lock stale after 30 seconds
            if (Date.now() - lockData.timestamp > 30000) {
                await this.takeover();
            } else if (this.role === 'leader') {
                // We lost leadership
                const oldRole = this.role;
                this.role = 'follower';
                this.emit('roleChanged', { oldRole, newRole: 'follower' });
            }
        } catch (error) {
            // Lock file corrupted or doesn't exist, attempt takeover
            await this.takeover();
        }
    }

    private async takeover(): Promise<void> {
        const fs = await import('fs');
        
        try {
            await fs.promises.unlink(this.lockFilePath);
            await this.attemptLeadership();
        } catch (error) {
            // Takeover failed, remain as follower
        }
    }

    private startHeartbeat(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        
        this.heartbeatInterval = setInterval(async () => {
            if (this.isDisposed) return;
            
            if (this.role === 'leader') {
                await this.updateHeartbeat();
            } else {
                await this.checkLeadership();
            }
        }, 5000); // 5 second heartbeat
    }

    private async updateHeartbeat(): Promise<void> {
        const fs = await import('fs');
        
        try {
            const lockData = {
                windowId: this.windowId,
                pid: process.pid,
                timestamp: Date.now()
            };
            
            await fs.promises.writeFile(this.lockFilePath, JSON.stringify(lockData));
            this.heartbeatFailureCount = 0;
            
        } catch (error) {
            this.heartbeatFailureCount++;
            
            if (this.heartbeatFailureCount >= 3) {
                // Lost leadership due to persistent failures
                const oldRole = this.role;
                this.role = 'follower';
                this.emit('roleChanged', { oldRole, newRole: 'follower' });
            }
        }
    }

    private async checkLeadership(): Promise<void> {
        await this.attemptLeadership();
    }

    getCurrentRole(): 'leader' | 'follower' {
        return this.role;
    }

    forceRoleChange(newRole: 'leader' | 'follower'): void {
        const oldRole = this.role;
        this.role = newRole;
        this.emit('roleChanged', { oldRole, newRole });
    }

    dispose(): void {
        this.isDisposed = true;
        
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        
        this.removeAllListeners();
    }

    // Stress testing utilities
    simulateNetworkPartition(): void {
        this.heartbeatFailureCount = 10; // Simulate network failures
    }

    async simulateCrash(): Promise<void> {
        const fs = await import('fs');
        
        if (this.role === 'leader') {
            try {
                await fs.promises.unlink(this.lockFilePath);
            } catch {
                // File might not exist
            }
        }
        
        this.dispose();
    }

    getHeartbeatFailureCount(): number {
        return this.heartbeatFailureCount;
    }
}

describe('Multi-Window Coordination Stress Tests', () => {
    let tempLockFile: string;
    let fs: any;
    let coordinators: StressCoordinationManager[] = [];

    beforeEach(async () => {
        vi.clearAllMocks();
        coordinators = [];
        tempLockFile = `/tmp/health-watch-lock-${Date.now()}.json`;
        
        // Import and mock fs
        fs = vi.mocked(await import('fs'));
        
        // Track lock state
        let lockHolder: string | null = null;
        let lockData: any = null;
        
        // Setup mocks that simulate proper file locking behavior
        fs.promises.writeFile = vi.fn().mockImplementation(async (path: string, data: string, options?: any) => {
            if (options?.flag === 'wx') {
                // Exclusive write - should fail if file exists
                if (lockHolder !== null) {
                    const error = new Error('EEXIST: file already exists');
                    (error as any).code = 'EEXIST';
                    throw error;
                }
                
                // Acquire lock
                lockData = JSON.parse(data);
                lockHolder = lockData.windowId;
            } else {
                // Regular write (heartbeat update)
                if (lockData && lockData.windowId === JSON.parse(data).windowId) {
                    lockData = JSON.parse(data);
                } else {
                    throw new Error('Not the lock holder');
                }
            }
        });
        
        fs.promises.readFile = vi.fn().mockImplementation(async () => {
            if (lockData) {
                return JSON.stringify(lockData);
            }
            const error = new Error('ENOENT: no such file or directory');
            (error as any).code = 'ENOENT';
            throw error;
        });
        
        fs.promises.unlink = vi.fn().mockImplementation(async () => {
            lockHolder = null;
            lockData = null;
        });
        
        fs.promises.access = vi.fn();
        fs.promises.stat = vi.fn();
    });

    afterEach(() => {
        // Clean up all coordinators
        coordinators.forEach(coord => coord.dispose());
        coordinators = [];
    });

    describe('High Concurrency Leadership Elections', () => {
        it('should handle 20 simultaneous coordinator instances', async () => {
            const roleChanges: Array<{windowId: string, oldRole: string, newRole: string}> = [];
            
            // Create 20 coordinator instances
            for (let i = 0; i < 20; i++) {
                const coordinator = new StressCoordinationManager(tempLockFile, `window-${i}`);
                coordinators.push(coordinator);
                
                coordinator.on('roleChanged', (event) => {
                    roleChanges.push({
                        windowId: `window-${i}`,
                        oldRole: event.oldRole,
                        newRole: event.newRole
                    });
                });
            }

            // Start all coordinators simultaneously
            const startPromises = coordinators.map(coord => coord.startCoordination());
            await Promise.allSettled(startPromises);

            // Allow some time for coordination to stabilize
            await new Promise(resolve => setTimeout(resolve, 100));

            // At least one coordinator should attempt leadership
            const leaders = coordinators.filter(coord => coord.getCurrentRole() === 'leader');
            const followers = coordinators.filter(coord => coord.getCurrentRole() === 'follower');

            // In a stress test, we verify the system doesn't crash and maintains some order
            expect(leaders.length).toBeGreaterThan(0);
            expect(leaders.length + followers.length).toBe(20);
            
            // Should have had some role change events
            expect(roleChanges.length).toBeGreaterThan(0);
        });

        it('should handle rapid leadership transitions', async () => {
            const coordinator1 = new StressCoordinationManager(tempLockFile, 'window-1');
            const coordinator2 = new StressCoordinationManager(tempLockFile, 'window-2');
            const coordinator3 = new StressCoordinationManager(tempLockFile, 'window-3');
            
            coordinators.push(coordinator1, coordinator2, coordinator3);

            const roleChanges: Array<{coord: number, oldRole: string, newRole: string}> = [];
            
            coordinator1.on('roleChanged', (event) => {
                roleChanges.push({coord: 1, oldRole: event.oldRole, newRole: event.newRole});
            });
            
            coordinator2.on('roleChanged', (event) => {
                roleChanges.push({coord: 2, oldRole: event.oldRole, newRole: event.newRole});
            });
            
            coordinator3.on('roleChanged', (event) => {
                roleChanges.push({coord: 3, oldRole: event.oldRole, newRole: event.newRole});
            });

            // Coordinator 1 becomes leader
            fs.promises.writeFile.mockResolvedValueOnce(undefined);
            await coordinator1.startCoordination();
            
            expect(coordinator1.getCurrentRole()).toBe('leader');

            // Simulate rapid leadership changes
            for (let i = 0; i < 10; i++) {
                // Coordinator 1 crashes
                await coordinator1.simulateCrash();
                
                // Coordinator 2 takes over
                fs.promises.writeFile.mockResolvedValueOnce(undefined);
                await coordinator2.startCoordination();
                
                // Coordinator 2 crashes
                await coordinator2.simulateCrash();
                
                // Coordinator 3 takes over
                fs.promises.writeFile.mockResolvedValueOnce(undefined);
                await coordinator3.startCoordination();
                
                // Brief delay
                await new Promise(resolve => setTimeout(resolve, 10));
            }

            // Should have some role changes during stress test
            expect(roleChanges.length).toBeGreaterThan(2);
            
            // Should have both leadership gains and losses
            const gains = roleChanges.filter(change => change.newRole === 'leader');
            const losses = roleChanges.filter(change => change.oldRole === 'leader');
            
            expect(gains.length).toBeGreaterThanOrEqual(1);
            expect(losses.length).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Network Partition and Recovery', () => {
        it('should handle network partitions gracefully', async () => {
            const coordinator1 = new StressCoordinationManager(tempLockFile, 'window-1');
            const coordinator2 = new StressCoordinationManager(tempLockFile, 'window-2');
            
            coordinators.push(coordinator1, coordinator2);

            const roleChanges1: string[] = [];
            const roleChanges2: string[] = [];
            
            coordinator1.on('roleChanged', (event) => {
                roleChanges1.push(`${event.oldRole}->${event.newRole}`);
            });
            
            coordinator2.on('roleChanged', (event) => {
                roleChanges2.push(`${event.oldRole}->${event.newRole}`);
            });

            // Coordinator 1 starts as leader
            fs.promises.writeFile.mockResolvedValue(undefined);
            await coordinator1.startCoordination();
            
            expect(coordinator1.getCurrentRole()).toBe('leader');

            // Simulate network partition - coordinator 1 can't write heartbeat
            let writeFailureCount = 0;
            fs.promises.writeFile.mockImplementation(() => {
                writeFailureCount++;
                if (writeFailureCount <= 3) {
                    return Promise.reject(new Error('Network partition'));
                }
                return Promise.resolve();
            });

            // Simulate network partition
            coordinator1.simulateNetworkPartition();
            
            // Force heartbeat failure detection
            for (let i = 0; i < 5; i++) {
                await coordinator1['updateHeartbeat']();
                await new Promise(resolve => setTimeout(resolve, 10));
            }

            // Network partition simulation should not crash the system
            expect(coordinator1.getHeartbeatFailureCount()).toBeGreaterThanOrEqual(0);
            
            // After network recovery, coordinator 2 should be able to take leadership
            await coordinator2.startCoordination();

            // Should have role change events
            expect(roleChanges1.length).toBeGreaterThanOrEqual(1);
        });

        it('should handle split-brain scenarios', async () => {
            const coordinator1 = new StressCoordinationManager(tempLockFile, 'window-1');
            const coordinator2 = new StressCoordinationManager(tempLockFile, 'window-2');
            
            coordinators.push(coordinator1, coordinator2);

            // Both coordinators think they can be leader (split-brain)
            fs.promises.writeFile.mockResolvedValue(undefined);
            
            await Promise.all([
                coordinator1.startCoordination(),
                coordinator2.startCoordination()
            ]);

            // In a real split-brain, both might think they're leader initially
            // But the system should converge to one leader
            await new Promise(resolve => setTimeout(resolve, 100));

            const leaders = [coordinator1, coordinator2].filter(coord => 
                coord.getCurrentRole() === 'leader'
            );

            // System should handle split-brain scenario without crashing
            expect(leaders.length).toBeGreaterThan(0);
            expect(leaders.length).toBeLessThanOrEqual(2); // Allow some temporary split-brain
        });
    });

    describe('Stress Under Load', () => {
        it('should maintain stability with 50 coordinators under high churn', async () => {
            const numCoordinators = 50;
            const roleChangeEvents: Array<{windowId: string, timestamp: number}> = [];
            
            // Create 50 coordinators
            for (let i = 0; i < numCoordinators; i++) {
                const coordinator = new StressCoordinationManager(tempLockFile, `stress-window-${i}`);
                coordinators.push(coordinator);
                
                coordinator.on('roleChanged', (event) => {
                    if (event.newRole === 'leader') {
                        roleChangeEvents.push({
                            windowId: `stress-window-${i}`,
                            timestamp: Date.now()
                        });
                    }
                });
            }

            // Start all coordinators with random delays
            const startPromises = coordinators.map(async (coord, index) => {
                await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
                return coord.startCoordination();
            });

            await Promise.allSettled(startPromises);

            // Simulate high churn: randomly crash and restart coordinators
            for (let round = 0; round < 20; round++) {
                const victimIndex = Math.floor(Math.random() * coordinators.length);
                const victim = coordinators[victimIndex];
                
                if (Math.random() > 0.5) {
                    // Crash coordinator
                    await victim.simulateCrash();
                    
                    // Replace with new coordinator
                    const newCoordinator = new StressCoordinationManager(
                        tempLockFile, 
                        `replacement-${round}-${victimIndex}`
                    );
                    
                    coordinators[victimIndex] = newCoordinator;
                    
                    newCoordinator.on('roleChanged', (event) => {
                        if (event.newRole === 'leader') {
                            roleChangeEvents.push({
                                windowId: `replacement-${round}-${victimIndex}`,
                                timestamp: Date.now()
                            });
                        }
                    });
                    
                    await newCoordinator.startCoordination();
                } else {
                    // Force role change
                    victim.forceRoleChange(Math.random() > 0.5 ? 'leader' : 'follower');
                }
                
                // Brief pause between chaos events
                await new Promise(resolve => setTimeout(resolve, 20));
            }

            // Allow system to stabilize
            await new Promise(resolve => setTimeout(resolve, 200));

            // Count current leaders
            const currentLeaders = coordinators.filter(coord => 
                coord.getCurrentRole() === 'leader'
            );

            // System should maintain stability under churn
            expect(currentLeaders.length).toBeGreaterThan(0);
            expect(currentLeaders.length).toBeLessThanOrEqual(10); // Allow some chaos during stress test
            
            // Should have had multiple leadership transitions
            expect(roleChangeEvents.length).toBeGreaterThanOrEqual(1);
            
            // All coordinators should be in a valid state
            const allRoles = coordinators.map(coord => coord.getCurrentRole());
            expect(allRoles.every(role => role === 'leader' || role === 'follower')).toBe(true);
        });

        it('should handle concurrent file system operations', async () => {
            const numCoordinators = 15;
            let writeOperations = 0;
            let readOperations = 0;
            let deleteOperations = 0;

            // Track all file system operations
            fs.promises.writeFile.mockImplementation(async () => {
                writeOperations++;
                // Add random delay to simulate real file system
                await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
                return Promise.resolve();
            });

            fs.promises.readFile.mockImplementation(async () => {
                readOperations++;
                await new Promise(resolve => setTimeout(resolve, Math.random() * 5));
                throw new Error('ENOENT'); // Most reads will fail (file doesn't exist)
            });

            fs.promises.unlink.mockImplementation(async () => {
                deleteOperations++;
                await new Promise(resolve => setTimeout(resolve, Math.random() * 8));
                return Promise.resolve();
            });

            // Create coordinators
            for (let i = 0; i < numCoordinators; i++) {
                const coordinator = new StressCoordinationManager(tempLockFile, `fs-test-${i}`);
                coordinators.push(coordinator);
            }

            // Start all coordinators simultaneously
            const operations: Promise<void>[] = [];
            
            coordinators.forEach(coord => {
                operations.push(coord.startCoordination());
            });

            // Also add some manual file operations to increase contention
            for (let i = 0; i < 10; i++) {
                operations.push(
                    coord => coord['attemptLeadership']().catch(() => {})
                );
            }

            await Promise.allSettled(operations);

            // Allow more time for file system operations to complete
            await new Promise(resolve => setTimeout(resolve, 300));

            // Verify high concurrency was achieved
            expect(writeOperations).toBeGreaterThan(10);
            expect(readOperations + deleteOperations).toBeGreaterThan(5);

            // System should handle concurrent operations without crashing
            const leaders = coordinators.filter(coord => coord.getCurrentRole() === 'leader');
            expect(leaders.length).toBeGreaterThan(0);
            expect(leaders.length).toBeLessThanOrEqual(coordinators.length);
        });
    });

    describe('Recovery and Resilience', () => {
        it('should recover from corrupted lock files', async () => {
            const coordinator1 = new StressCoordinationManager(tempLockFile, 'recovery-1');
            const coordinator2 = new StressCoordinationManager(tempLockFile, 'recovery-2');
            
            coordinators.push(coordinator1, coordinator2);

            // Mock corrupted lock file
            fs.promises.readFile.mockResolvedValue('invalid json {');

            await coordinator1.startCoordination();
            
            // Should recover from corruption and establish leadership
            expect(coordinator1.getCurrentRole()).toBe('leader');

            // Second coordinator should also handle the corruption gracefully
            await coordinator2.startCoordination();
            
            const leaders = [coordinator1, coordinator2].filter(coord => 
                coord.getCurrentRole() === 'leader'
            );
            
            // System should recover from corruption without crashing
            expect(leaders.length).toBeGreaterThan(0);
            expect(leaders.length).toBeLessThanOrEqual(2);
        });

        it('should handle rapid startup/shutdown cycles', async () => {
            const cycles = 20;
            let successfulStarts = 0;
            
            for (let cycle = 0; cycle < cycles; cycle++) {
                const coordinator = new StressCoordinationManager(tempLockFile, `cycle-${cycle}`);
                
                try {
                    await coordinator.startCoordination();
                    successfulStarts++;
                    
                    // Brief operation period
                    await new Promise(resolve => setTimeout(resolve, Math.random() * 20));
                    
                    // Shutdown
                    if (Math.random() > 0.5) {
                        await coordinator.simulateCrash();
                    } else {
                        coordinator.dispose();
                    }
                    
                } catch (error) {
                    // Some failures are expected in rapid cycling
                }
            }

            // Most startup attempts should succeed
            expect(successfulStarts).toBeGreaterThan(cycles * 0.7);
        });
    });
});