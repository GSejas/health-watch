/**
 * 🏆 Multi-Workspace Coordination Manager
 * 
 * **Purpose**: Implement global leader election across ALL VS Code workspaces on the PC
 * **Philosophy**: Only one Health Watch instance should actively monitor across all workspaces
 * 
 * **Risk Analysis**:
 * - ✅ Zero Risk: File-based coordination with atomic operations
 * - ✅ Reliability: Automatic failover when leader workspace closes
 * - ✅ Performance: Massive resource reduction across multiple workspaces
 * 
 * **Inputs**: All VS Code workspace instances, any workspace context
 * **Outputs**: Single global leader monitoring all workspaces, followers consume minimal resources
 * 
 * **Business Value**:
 * - Eliminates duplicate resource usage across ALL workspaces (5x workspace = 5x savings)
 * - Provides consistent monitoring state across all VS Code instances
 * - Single point of control for monitoring across entire development environment
 * 
 * @author Health Watch Team
 * @version 2.1.0 - Multi-Workspace Global Coordination
 * @since 2025-08-21
 */

import * as fs from 'fs/promises';
import * as fssync from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import { EventEmitter } from 'events';

/**
 * 🔒 **COORDINATION LOCK STRUCTURE**
 * 
 * File-based locking mechanism for cross-process coordination
 */
export interface CoordinationLock {
    /** Unique identifier for the current leader window */
    leaderId: string;
    /** Process ID for additional validation */
    processId: number;
    /** Timestamp when lock was acquired (epoch milliseconds) */
    acquiredAt: number;
    /** Workspace folder path being coordinated */
    workspacePath: string;
    /** Extension version for compatibility checks */
    version: string;
    /** Heartbeat timestamp for liveness detection */
    lastHeartbeat: number;
}

/**
 * 🌐 **SHARED STATE STRUCTURE**
 * 
 * Cross-process state synchronization format
 */
export interface SharedMonitoringState {
    /** Current channel states across all monitoring */
    channelStates: Record<string, {
        state: 'online' | 'offline' | 'unknown';
        lastSample?: {
            timestamp: number;
            success: boolean;
            latencyMs?: number;
            error?: string;
        };
        consecutiveFailures: number;
        lastStateChange: number;
    }>;
    /** Active watch session information */
    activeWatch?: {
        startTime: number;
        duration: string | number;
        channels: string[];
        isActive: boolean;
    };
    /** Last update timestamp for staleness detection */
    lastUpdate: number;
    /** Leader information for coordination */
    leader: {
        id: string;
        processId: number;
        version: string;
    };
}

export type CoordinationRole = 'leader' | 'follower' | 'initializing';

export interface CoordinationEvents {
    'roleChanged': { oldRole: CoordinationRole; newRole: CoordinationRole };
    'leadershipAcquired': { leaderId: string };
    'leadershipLost': { reason: string };
    'stateUpdated': { sharedState: SharedMonitoringState };
    'coordinationError': { error: Error; context: string };
}

/**
 * 🏗️ **MULTI-WORKSPACE COORDINATION MANAGER**
 * 
 * Implements global leader election across ALL workspaces for maximum resource efficiency
 */
export class MultiWorkspaceCoordinationManager extends EventEmitter {
    private role: CoordinationRole = 'initializing';
    private leaderId: string;
    private lockFilePath!: string;
    private stateFilePath!: string;
    private heartbeatInterval?: NodeJS.Timeout;
    private stateWatcher?: vscode.FileSystemWatcher;
    private readonly HEARTBEAT_INTERVAL = 5000; // 5 seconds
    private readonly LEADER_TIMEOUT = 15000; // 15 seconds
    private readonly LOCK_RETRY_INTERVAL = 2000; // 2 seconds
    private lockRetryTimer?: NodeJS.Timeout;
    private consecutiveFailures = 0;
    private lastFailureTime?: number;
    private readonly MAX_CONSECUTIVE_FAILURES = 5;

    constructor(
        private context: vscode.ExtensionContext,
        private workspacePath?: string
    ) {
        super();
        this.leaderId = this.generateUniqueId();
        this.setupPaths();
    }

    /**
     * 🔧 **INITIALIZATION & PATH SETUP**
     */
    private setupPaths(): void {
        // Use single global coordination directory for ALL VS Code workspaces
        // This enables one leader to monitor across ALL workspaces efficiently
        const coordinationDir = path.join(os.tmpdir(), 'healthwatch-coordination');
        console.log(`[Coordination] Using global workspace coordination directory: ${coordinationDir}`);

        // Ensure coordination directory exists
        try {
            fssync.mkdirSync(coordinationDir, { recursive: true });
            console.log(`[Coordination] Created coordination directory: ${coordinationDir}`);
        } catch (error) {
            console.warn('Failed to create coordination directory:', error);
            // Fallback to simpler temp directory  
            const fallbackDir = path.join(os.tmpdir(), 'healthwatch-fallback');
            fssync.mkdirSync(fallbackDir, { recursive: true });
            this.lockFilePath = path.join(fallbackDir, 'healthwatch.lock');
            this.stateFilePath = path.join(fallbackDir, 'shared-state.json');
            console.log(`[Coordination] Using fallback paths: ${this.lockFilePath}`);
            return;
        }

        this.lockFilePath = path.join(coordinationDir, 'healthwatch.lock');
        this.stateFilePath = path.join(coordinationDir, 'shared-state.json');
        console.log(`[Coordination] Lock file path: ${this.lockFilePath}`);
        console.log(`[Coordination] State file path: ${this.stateFilePath}`);
    }

    /**
     * 🚀 **START COORDINATION**
     * 
     * Attempt to become leader or fall back to follower role
     */
    async startCoordination(): Promise<void> {
        try {
            console.log(`[Coordination] Starting coordination for leader: ${this.leaderId}`);
            
            // Try to acquire leadership
            const acquired = await this.tryAcquireLeadership();
            
            if (acquired) {
                await this.becomeLeader();
            } else {
                await this.becomeFollower();
            }

            // Start monitoring for leadership changes
            this.startLeadershipMonitoring();
            
            // Setup cleanup on extension deactivation
            this.context.subscriptions.push(
                new vscode.Disposable(() => this.cleanup())
            );

        } catch (error) {
            console.error('[Coordination] Failed to start coordination:', error);
            this.emit('coordinationError', { 
                error: error as Error, 
                context: 'startCoordination' 
            });
            
            // Fallback to leader if coordination fails
            await this.becomeLeader();
        }
    }

    /**
     * 🏆 **LEADERSHIP ACQUISITION**
     * 
     * Atomic file-based leader election
     */
    private async tryAcquireLeadership(): Promise<boolean> {
        try {
            console.log(`[Coordination] ${this.leaderId} attempting to acquire leadership`);
            console.log(`[Coordination] Lock file path: ${this.lockFilePath}`);
            
            // Ensure directory exists before attempting operations
            const lockDir = path.dirname(this.lockFilePath);
            if (!fssync.existsSync(lockDir)) {
                try {
                    fssync.mkdirSync(lockDir, { recursive: true });
                    console.log(`[Coordination] Created lock directory: ${lockDir}`);
                } catch (dirError) {
                    console.warn('[Coordination] Failed to create lock directory, using fallback:', dirError);
                    return false;
                }
            }

            // Check if lock file exists
            if (fssync.existsSync(this.lockFilePath)) {
                console.log(`[Coordination] Lock file exists, checking current leader`);
                const lockData = await this.readLockFile();
                
                if (lockData) {
                    console.log(`[Coordination] Current lock data:`, {
                        leaderId: lockData.leaderId,
                        processId: lockData.processId,
                        acquiredAt: new Date(lockData.acquiredAt).toISOString(),
                        lastHeartbeat: new Date(lockData.lastHeartbeat).toISOString(),
                        heartbeatAge: Date.now() - lockData.lastHeartbeat
                    });
                    
                    if (this.isLeaderAlive(lockData)) {
                        // Active leader exists
                        console.log(`[Coordination] Active leader found: ${lockData.leaderId}, staying as follower`);
                        return false;
                    } else {
                        console.log('[Coordination] Stale leader detected, cleaning up and acquiring leadership');
                        await this.cleanupStaleLock();
                    }
                } else {
                    console.log('[Coordination] Lock file exists but is unreadable, cleaning up');
                    await this.cleanupStaleLock();
                }
            } else {
                console.log(`[Coordination] No lock file exists, proceeding to acquire leadership`);
            }

            // Attempt to acquire lock atomically
            const lockData: CoordinationLock = {
                leaderId: this.leaderId,
                processId: process.pid,
                acquiredAt: Date.now(),
                workspacePath: this.workspacePath || '',
                version: this.context.extension.packageJSON.version,
                lastHeartbeat: Date.now()
            };

            console.log(`[Coordination] Writing lock data for ${this.leaderId}`);

            // Use exclusive file creation to prevent race conditions
            try {
                // Try to create lock file exclusively - will fail if it already exists
                const lockFd = fssync.openSync(this.lockFilePath, 'wx');
                fssync.writeSync(lockFd, JSON.stringify(lockData, null, 2));
                fssync.closeSync(lockFd);
                
                console.log(`[Coordination] ✅ Leadership acquired exclusively: ${this.leaderId}`);
                return true;
                
            } catch (error: any) {
                if (error.code === 'EEXIST') {
                    // File already exists, someone else has the lock
                    console.log(`[Coordination] ❌ Leadership acquisition failed - lock already exists`);
                    return false;
                } else {
                    // Other error, rethrow
                    throw error;
                }
            }

        } catch (error) {
            console.warn('[Coordination] Failed to acquire leadership:', error);
            return false;
        }
    }

    /**
     * 👑 **BECOME LEADER**
     * 
     * Initialize as the active monitoring coordinator
     */
    private async becomeLeader(): Promise<void> {
        const oldRole = this.role;
        this.role = 'leader';
        
        console.log(`[Coordination] 🏆 Became LEADER: ${this.leaderId}`);
        
        // Initialize shared state
        await this.initializeSharedState();
        
        // Start heartbeat to maintain leadership
        this.startHeartbeat();
        
        // Emit role change event
        this.emit('roleChanged', { oldRole, newRole: 'leader' });
        this.emit('leadershipAcquired', { leaderId: this.leaderId });
    }

    /**
     * 👥 **BECOME FOLLOWER**
     * 
     * Initialize as passive observer
     */
    private async becomeFollower(): Promise<void> {
        const oldRole = this.role;
        this.role = 'follower';
        
        console.log(`[Coordination] 👥 Became FOLLOWER: ${this.leaderId}`);
        
        // Start watching for shared state updates
        this.startStateWatching();
        
        // Start monitoring leader liveness
        this.startLeadershipMonitoring();
        
        // Emit role change event
        this.emit('roleChanged', { oldRole, newRole: 'follower' });
    }

    /**
     * 💓 **HEARTBEAT MANAGEMENT**
     * 
     * Maintain leadership through periodic heartbeats
     */
    private startHeartbeat(): void {
        this.heartbeatInterval = setInterval(async () => {
            try {
                await this.updateHeartbeat();
            } catch (error) {
                console.error('[Coordination] Heartbeat failed:', error);
                // Leadership may be lost, try to reacquire
                this.attemptLeadershipReacquisition();
            }
        }, this.HEARTBEAT_INTERVAL);
    }

    private async updateHeartbeat(): Promise<void> {
        if (this.role !== 'leader') return;

        try {
            const lockData = await this.readLockFile();
            if (!lockData || lockData.leaderId !== this.leaderId) {
                // Lost leadership
                console.log('[Coordination] ❌ Leadership lost during heartbeat');
                this.emit('leadershipLost', { reason: 'Lock file changed' });
                await this.becomeFollower();
                return;
            }

            // Update heartbeat timestamp
            lockData.lastHeartbeat = Date.now();
            fssync.writeFileSync(this.lockFilePath, JSON.stringify(lockData, null, 2));
            
            // Reset consecutive failures on successful heartbeat
            this.consecutiveFailures = 0;
            
        } catch (error) {
            console.error('[Coordination] Heartbeat update failed:', error);
            this.consecutiveFailures++;
            
            // If heartbeat fails repeatedly, step down to allow failover
            if (this.consecutiveFailures >= 3) {
                console.warn('[Coordination] Too many heartbeat failures, stepping down as leader');
                this.emit('leadershipLost', { reason: 'Heartbeat failures' });
                await this.cleanupStaleLock();
                await this.becomeFollower();
            }
        }
    }

    /**
     * 👀 **LEADERSHIP MONITORING**
     * 
     * Watch for leadership changes and failover opportunities
     */
    private startLeadershipMonitoring(): void {
        this.lockRetryTimer = setInterval(async () => {
            try {
                if (this.role === 'follower') {
                    // Circuit breaker with exponential backoff and recovery
                    if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
                        // Use exponential backoff: wait longer between attempts
                        const backoffTime = Math.min(30000, 2000 * Math.pow(2, this.consecutiveFailures - this.MAX_CONSECUTIVE_FAILURES));
                        const now = Date.now();
                        
                        if (!this.lastFailureTime) {
                            this.lastFailureTime = now;
                        }
                        
                        if (now - this.lastFailureTime < backoffTime) {
                            console.warn(`[Coordination] Circuit breaker active, waiting ${backoffTime}ms before retry`);
                            return;
                        }
                        
                        console.log('[Coordination] Circuit breaker recovery attempt');
                        this.lastFailureTime = now;
                    }

                    // Check if leader is still alive
                    const lockData = await this.readLockFile();
                    
                    if (!lockData || !this.isLeaderAlive(lockData)) {
                        console.log('[Coordination] 🔄 Leader appears dead, attempting promotion');
                        const acquired = await this.tryAcquireLeadership();
                        if (acquired) {
                            this.consecutiveFailures = 0; // Reset on success
                            this.lastFailureTime = undefined;
                            await this.becomeLeader();
                        } else {
                            this.consecutiveFailures++;
                        }
                    } else if (this.consecutiveFailures > 0) {
                        // Leader is alive, reset failure count
                        this.consecutiveFailures = 0;
                        this.lastFailureTime = undefined;
                    }
                }
            } catch (error) {
                console.warn('[Coordination] Leadership monitoring error:', error);
                this.consecutiveFailures++;
            }
        }, this.LOCK_RETRY_INTERVAL);
    }

    /**
     * 📊 **SHARED STATE MANAGEMENT**
     */
    private async initializeSharedState(): Promise<void> {
        const initialState: SharedMonitoringState = {
            channelStates: {},
            lastUpdate: Date.now(),
            leader: {
                id: this.leaderId,
                processId: process.pid,
                version: this.context.extension.packageJSON.version
            }
        };

        try {
            fssync.writeFileSync(this.stateFilePath, JSON.stringify(initialState, null, 2));
            console.log('[Coordination] ✅ Initialized shared state');
        } catch (error) {
            console.error('[Coordination] Failed to initialize shared state:', error);
        }
    }

    /**
     * 📡 **STATE SYNCHRONIZATION**
     */
    async updateSharedState(updates: Partial<SharedMonitoringState>): Promise<void> {
        if (this.role !== 'leader') {
            console.warn('[Coordination] Attempted to update state as follower');
            return;
        }

        try {
            const currentState = await this.readSharedState();
            const newState: SharedMonitoringState = {
                channelStates: {},
                ...currentState,
                ...updates,
                lastUpdate: Date.now(),
                leader: {
                    id: this.leaderId,
                    processId: process.pid,
                    version: this.context.extension.packageJSON.version
                }
            };

            fssync.writeFileSync(this.stateFilePath, JSON.stringify(newState, null, 2));
            this.emit('stateUpdated', { sharedState: newState });
            
        } catch (error) {
            console.error('[Coordination] Failed to update shared state:', error);
            this.emit('coordinationError', { 
                error: error as Error, 
                context: 'updateSharedState' 
            });
        }
    }

    async getSharedState(): Promise<SharedMonitoringState | null> {
        return await this.readSharedState();
    }

    /**
     * 👁️ **STATE WATCHING (FOLLOWERS)**
     */
    private startStateWatching(): void {
        if (!fssync.existsSync(this.stateFilePath)) {
            console.warn('[Coordination] Shared state file does not exist');
            return;
        }

        try {
            // Watch for file changes
            this.stateWatcher = vscode.workspace.createFileSystemWatcher(this.stateFilePath);
            
            this.stateWatcher.onDidChange(async () => {
                if (this.role === 'follower') {
                    const sharedState = await this.readSharedState();
                    if (sharedState) {
                        this.emit('stateUpdated', { sharedState });
                    }
                }
            });

            this.context.subscriptions.push(this.stateWatcher);
            console.log('[Coordination] ✅ Started state watching as follower');
            
        } catch (error) {
            console.error('[Coordination] Failed to start state watching:', error);
        }
    }

    /**
     * 🔧 **UTILITY METHODS**
     */
    private generateUniqueId(): string {
        return `hw-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${process.pid}`;
    }

    private async readLockFile(): Promise<CoordinationLock | null> {
        try {
            if (!fssync.existsSync(this.lockFilePath)) return null;
            
            const data = fssync.readFileSync(this.lockFilePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.warn('[Coordination] Failed to read lock file:', error);
            return null;
        }
    }

    private async readSharedState(): Promise<SharedMonitoringState | null> {
        try {
            if (!fssync.existsSync(this.stateFilePath)) return null;
            
            const data = fssync.readFileSync(this.stateFilePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.warn('[Coordination] Failed to read shared state:', error);
            return null;
        }
    }

    private isLeaderAlive(lockData: CoordinationLock): boolean {
        const now = Date.now();
        const heartbeatAge = now - lockData.lastHeartbeat;
        
        // Leader is considered dead if heartbeat is stale
        if (heartbeatAge > this.LEADER_TIMEOUT) {
            console.log(`[Coordination] Leader heartbeat stale: ${heartbeatAge}ms > ${this.LEADER_TIMEOUT}ms`);
            return false;
        }

        return true;
    }

    private async cleanupStaleLock(): Promise<void> {
        try {
            if (fssync.existsSync(this.lockFilePath)) {
                fssync.unlinkSync(this.lockFilePath);
                console.log('[Coordination] ✅ Cleaned up stale lock file');
            }
        } catch (error) {
            console.warn('[Coordination] Failed to cleanup stale lock:', error);
        }
    }

    private attemptLeadershipReacquisition(): void {
        if (this.role === 'leader') {
            console.log('[Coordination] 🔄 Attempting leadership reacquisition');
            // Try to reacquire leadership
            setTimeout(async () => {
                const acquired = await this.tryAcquireLeadership();
                if (!acquired) {
                    console.log('[Coordination] ❌ Failed to reacquire leadership, becoming follower');
                    await this.becomeFollower();
                }
            }, 1000);
        }
    }

    /**
     * 🧹 **CLEANUP & DISPOSAL**
     */
    private async cleanup(): Promise<void> {
        console.log(`[Coordination] 🧹 Cleaning up coordination manager: ${this.leaderId}`);
        
        // Clear timers
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = undefined;
        }
        
        if (this.lockRetryTimer) {
            clearInterval(this.lockRetryTimer);
            this.lockRetryTimer = undefined;
        }
        
        // Dispose state watcher
        if (this.stateWatcher) {
            this.stateWatcher.dispose();
            this.stateWatcher = undefined;
        }
        
        // Release leadership if we're the leader
        if (this.role === 'leader') {
            try {
                const lockData = await this.readLockFile();
                if (lockData?.leaderId === this.leaderId) {
                    fssync.unlinkSync(this.lockFilePath);
                    console.log('[Coordination] ✅ Released leadership lock');
                }
            } catch (error) {
                console.warn('[Coordination] Failed to release lock during cleanup:', error);
            }
        }
        
        this.role = 'initializing';
    }

    /**
     * 📊 **PUBLIC API**
     */
    isLeader(): boolean {
        return this.role === 'leader';
    }

    isFollower(): boolean {
        return this.role === 'follower';
    }

    getCurrentRole(): CoordinationRole {
        return this.role;
    }

    getLeaderId(): string {
        return this.leaderId;
    }

    async forceLeadershipTransition(): Promise<boolean> {
        console.log('[Coordination] 🔄 Forcing leadership transition');
        return await this.tryAcquireLeadership();
    }
}

// Backwards compatibility alias
export const MultiWindowCoordinationManager = MultiWorkspaceCoordinationManager;