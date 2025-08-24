/**
 * @fileoverview Internet Connectivity Check Service
 * 
 * This service provides zero-config internet connectivity monitoring with multi-window coordination.
 * Only the leader window performs actual network checks, followers read shared state.
 * 
 * @module InternetCheckService
 * @version 1.0.0
 * @author Health Watch Extension
 * 
 * @description
 * Features:
 * - Zero-configuration internet monitoring with 15-second intervals
 * - Multi-window coordination (leader/follower pattern)
 * - Captive portal detection
 * - Exponential backoff on failures
 * - State persistence across VS Code restarts
 * - Configurable via VS Code settings
 * 
 * @example
 * ```typescript
 * const internetService = new InternetCheckService(coordinationManager, storageManager);
 * 
 * // Listen for status changes
 * internetService.on('statusChanged', (status) => {
 *   console.log('Internet status:', status);
 * });
 * 
 * // Start monitoring
 * await internetService.start();
 * 
 * // Get current status
 * const status = internetService.getCurrentStatus();
 * ```
 */

import { EventEmitter } from 'events';
import * as vscode from 'vscode';
import * as https from 'https';
import * as http from 'http';
import { MultiWindowCoordinationManager, CoordinationRole } from '../coordination/multiWindowCoordination';
import { StorageManager } from '../storage';

export type InternetState = 'unknown' | 'online' | 'offline' | 'captive';

export interface InternetStatus {
    status: InternetState;
    timestamp: number;
    latencyMs?: number;
    target: string;
    checkCount: number;
    consecutiveFailures: number;
    error?: string;
}

export interface InternetCheckConfig {
    enabled: boolean;
    targets: string[];
    intervalSec: number;
    timeoutMs: number;
    failureThreshold: number;
}

/**
 * Internet connectivity monitoring service with multi-window coordination
 * 
 * Only the leader window performs actual network checks to avoid redundant calls.
 * Followers read the shared state and update their UI accordingly.
 */
export class InternetCheckService extends EventEmitter {
    private role: CoordinationRole = 'follower';
    private currentStatus: InternetStatus;
    private checkTimer?: NodeJS.Timeout;
    private backoffMultiplier: number = 1;
    private readonly maxBackoffMultiplier = 8;
    private lastCheckTime: number = 0;
    private config: InternetCheckConfig;

    // Shared storage key for internet status
    private static readonly INTERNET_STATE_KEY = 'healthWatch.internet.currentStatus';

    constructor(
        private coordinationManager: MultiWindowCoordinationManager,
        private storageManager: StorageManager
    ) {
        super();

        console.log('🌐 InternetCheckService: Constructor called');

        // Initialize with unknown status
        this.currentStatus = {
            status: 'unknown',
            timestamp: Date.now(),
            target: '',
            checkCount: 0,
            consecutiveFailures: 0
        };

        this.config = this.loadConfiguration();
        console.log('🌐 InternetCheckService: Configuration loaded:', {
            enabled: this.config.enabled,
            targets: this.config.targets,
            intervalSec: this.config.intervalSec,
            timeoutMs: this.config.timeoutMs
        });
        
        this.setupCoordinationListeners();
        this.loadPersistedState();
        
        console.log('🌐 InternetCheckService: Initial status after constructor:', this.currentStatus);
    }

    /**
     * Load configuration from VS Code settings
     */
    private loadConfiguration(): InternetCheckConfig {
        const config = vscode.workspace.getConfiguration('healthWatch.internet');
        
        return {
            enabled: config.get('enabled', true),
            targets: config.get('targets', [
                'https://clients3.google.com/generate_204',
                'https://cloudflare.com/cdn-cgi/trace'
            ]),
            intervalSec: config.get('intervalSec', 15),
            timeoutMs: config.get('timeoutMs', 3000),
            failureThreshold: config.get('failureThreshold', 2)
        };
    }

    /**
     * Set up coordination event listeners
     */
    private setupCoordinationListeners(): void {
        console.log('🌐 InternetCheckService: Setting up coordination listeners');
        
        this.coordinationManager.on('roleChanged', ({ oldRole, newRole }: { oldRole: CoordinationRole; newRole: CoordinationRole }) => {
            console.log(`🌐 InternetCheckService: Coordination roleChanged event received - from ${oldRole} to ${newRole}`);
            const prevRole = this.role;
            this.role = newRole;
            
            console.log(`🌐 InternetCheckService: Internal role updated from ${prevRole} to ${newRole}`);
            
            if (newRole === 'leader') {
                this.becomeNetworkLeader();
            } else {
                this.becomeStateFollower();
            }
        });

        // Add listeners for all coordination events to debug
        this.coordinationManager.on('leadershipAcquired', (data) => {
            console.log('🌐 InternetCheckService: Received leadershipAcquired event:', data);
        });
        
        this.coordinationManager.on('leadershipLost', (data) => {
            console.log('🌐 InternetCheckService: Received leadershipLost event:', data);
        });
        
        this.coordinationManager.on('coordinationError', (data) => {
            console.log('🌐 InternetCheckService: Received coordinationError event:', data);
        });

        console.log('🌐 InternetCheckService: Coordination listeners set up complete');
    }

    /**
     * Become the network leader - start performing actual checks
     */
    private becomeNetworkLeader(): void {
        console.log('🌐 InternetCheckService: Became network leader - starting checks');
        console.log('🌐 InternetCheckService: Current status before leader transition:', this.currentStatus);
        
        // Load any previous state
        console.log('🌐 InternetCheckService: Loading shared state as leader...');
        this.loadSharedState();
        
        // Start network checks
        console.log('🌐 InternetCheckService: Starting network checks timer...');
        this.startNetworkChecks();
        
        console.log('🌐 InternetCheckService: Leader transition complete');
    }

    /**
     * Become a state follower - stop checks and watch shared state
     */
    private becomeStateFollower(): void {
        console.log('👥 InternetCheckService: Became follower - watching shared state');
        
        // Stop our own checks
        this.stopNetworkChecks();
        
        // Load current shared state
        this.loadSharedState();
    }

    /**
     * Start the service
     */
    async start(): Promise<void> {
        if (!this.config.enabled) {
            console.log('🌐 InternetCheckService: Disabled in configuration');
            return;
        }

        console.log('🌐 InternetCheckService: Starting...');
        
        // Check if coordination manager already has a role assigned
        const currentRole = this.coordinationManager.getCurrentRole();
        console.log(`🌐 InternetCheckService: Current coordination role: ${currentRole}`);
        
        if (currentRole === 'leader') {
            console.log('🌐 InternetCheckService: Already a leader, starting checks immediately');
            this.role = 'leader';
            this.becomeNetworkLeader();
        } else if (currentRole === 'follower') {
            console.log('🌐 InternetCheckService: Already a follower, watching shared state');
            this.role = 'follower';
            this.becomeStateFollower();
        } else if (currentRole === 'initializing') {
            console.log('🌐 InternetCheckService: Coordination still initializing, will wait for roleChanged event');
            
            // Check if coordination is enabled in settings
            const config = vscode.workspace.getConfiguration('healthWatch.coordination');
            const coordinationEnabled = config.get('enabled', true);
            console.log(`🌐 InternetCheckService: Coordination enabled in settings: ${coordinationEnabled}`);
            
            if (!coordinationEnabled) {
                // If coordination is disabled, assume leader role immediately
                console.log('🌐 InternetCheckService: Coordination disabled - assuming leader role');
                this.role = 'leader';
                this.becomeNetworkLeader();
            } else {
                // Load any persisted state while waiting
                this.loadPersistedState();
                
                // Fallback: if no role is assigned within 10 seconds, assume leader role
                setTimeout(() => {
                    if (this.role === 'follower' && this.currentStatus.status === 'unknown') {
                        console.log('🌐 InternetCheckService: Fallback - assuming leader role after timeout');
                        this.role = 'leader';
                        this.becomeNetworkLeader();
                    }
                }, 10000);
            }
        }
        
        // Future role changes will still be handled by roleChanged events
    }

    /**
     * Stop the service
     */
    stop(): void {
        console.log('🌐 InternetCheckService: Stopping...');
        this.stopNetworkChecks();
    }

    /**
     * Start performing network checks (leader only)
     */
    private startNetworkChecks(): void {
        console.log('🌐 InternetCheckService: startNetworkChecks() called');
        
        if (this.checkTimer) {
            console.log('🌐 InternetCheckService: Clearing existing check timer');
            clearInterval(this.checkTimer);
        }

        // Run first check immediately
        console.log('🌐 InternetCheckService: Running immediate check...');
        this.performCheck();

        // Schedule regular checks
        const intervalMs = this.config.intervalSec * 1000;
        console.log(`🌐 InternetCheckService: Scheduling regular checks every ${intervalMs}ms`);
        this.checkTimer = setInterval(() => {
            console.log('🌐 InternetCheckService: Timer triggered, performing check...');
            this.performCheck();
        }, intervalMs);
        
        console.log('🌐 InternetCheckService: Network checks started successfully');
    }

    /**
     * Stop network checks
     */
    private stopNetworkChecks(): void {
        if (this.checkTimer) {
            clearInterval(this.checkTimer);
            this.checkTimer = undefined;
        }
    }

    /**
     * Perform a single connectivity check
     */
    private async performCheck(): Promise<void> {
        console.log(`🌐 InternetCheckService: performCheck() called - enabled: ${this.config.enabled}, role: ${this.role}`);
        
        if (!this.config.enabled) {
            console.log('🌐 InternetCheckService: Check skipped - service disabled in config');
            return;
        }
        
        if (this.role !== 'leader') {
            console.log('🌐 InternetCheckService: Check skipped - not leader role');
            return;
        }

        console.log('🌐 InternetCheckService: Starting connectivity check...');
        const startTime = Date.now();
        this.lastCheckTime = startTime;

        try {
            console.log('🌐 InternetCheckService: Calling checkConnectivity()...');
            const result = await this.checkConnectivity();
            console.log('🌐 InternetCheckService: checkConnectivity() result:', result);
            
            // Calculate latency
            const latencyMs = Date.now() - startTime;
            
            // Update status
            const newStatus: InternetStatus = {
                status: result.isOnline ? 'online' : (result.isCaptive ? 'captive' : 'offline'),
                timestamp: Date.now(),
                latencyMs: result.isOnline ? latencyMs : undefined,
                target: result.target,
                checkCount: this.currentStatus.checkCount + 1,
                consecutiveFailures: result.isOnline ? 0 : this.currentStatus.consecutiveFailures + 1,
                error: result.error
            };

            // Only transition to offline after threshold failures
            if (!result.isOnline && newStatus.consecutiveFailures < this.config.failureThreshold) {
                newStatus.status = this.currentStatus.status === 'online' ? 'online' : 'unknown';
            }

            this.updateStatus(newStatus);
            
        } catch (error) {
            console.error('🌐 InternetCheckService: Check failed:', error);
            
            const newStatus: InternetStatus = {
                ...this.currentStatus,
                timestamp: Date.now(),
                checkCount: this.currentStatus.checkCount + 1,
                consecutiveFailures: this.currentStatus.consecutiveFailures + 1,
                error: error instanceof Error ? error.message : 'Unknown error'
            };

            // Transition to offline after threshold
            if (newStatus.consecutiveFailures >= this.config.failureThreshold) {
                newStatus.status = 'offline';
            }

            this.updateStatus(newStatus);
        }
    }

    /**
     * Check internet connectivity using configured targets
     */
    private async checkConnectivity(): Promise<{ isOnline: boolean; isCaptive: boolean; target: string; error?: string }> {
        const errors: string[] = [];

        // Try each target until one succeeds
        for (const target of this.config.targets) {
            try {
                const result = await this.checkSingleTarget(target);
                return { ...result, target };
            } catch (error) {
                errors.push(`${target}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }

        // All targets failed
        return {
            isOnline: false,
            isCaptive: false,
            target: this.config.targets[0] || 'unknown',
            error: errors.join('; ')
        };
    }

    /**
     * Check a single connectivity target
     */
    private checkSingleTarget(target: string): Promise<{ isOnline: boolean; isCaptive: boolean }> {
        return new Promise((resolve, reject) => {
            const url = new URL(target);
            const isHttps = url.protocol === 'https:';
            const client = isHttps ? https : http;

            const request = client.get({
                hostname: url.hostname,
                port: url.port,
                path: url.pathname + url.search,
                timeout: this.config.timeoutMs,
                headers: {
                    'User-Agent': 'Health-Watch-VSCode-Extension/1.0'
                }
            }, (response) => {
                let body = '';

                response.on('data', (chunk) => {
                    body += chunk;
                });

                response.on('end', () => {
                    // Handle response
                    const statusCode = response.statusCode || 0;
                    
                    if (statusCode === 204 || (statusCode >= 200 && statusCode < 300)) {
                        // Success - we're online
                        resolve({ isOnline: true, isCaptive: false });
                    } else if (statusCode >= 300 && statusCode < 400) {
                        // Redirect - might be captive portal
                        resolve({ isOnline: false, isCaptive: true });
                    } else if (statusCode === 200 && body.length > 0 && body.includes('html')) {
                        // Got HTML when expecting 204 - likely captive portal
                        resolve({ isOnline: false, isCaptive: true });
                    } else {
                        // Other error
                        reject(new Error(`HTTP ${statusCode}`));
                    }
                });
            });

            request.on('timeout', () => {
                request.destroy();
                reject(new Error('Timeout'));
            });

            request.on('error', (error) => {
                reject(error);
            });

            request.end();
        });
    }

    /**
     * Update the current status and notify listeners
     */
    private updateStatus(newStatus: InternetStatus): void {
        const oldStatus = this.currentStatus.status;
        console.log(`🌐 InternetCheckService: Updating status from ${oldStatus} to ${newStatus.status}`, {
            target: newStatus.target,
            latencyMs: newStatus.latencyMs,
            error: newStatus.error,
            consecutiveFailures: newStatus.consecutiveFailures
        });
        
        this.currentStatus = newStatus;

        // Apply backoff logic for offline state
        if (newStatus.status === 'offline' && oldStatus !== 'offline') {
            // Just went offline - start backoff
            console.log('🌐 InternetCheckService: Entering offline state, starting backoff');
            this.backoffMultiplier = 2;
            this.adjustCheckInterval();
        } else if (newStatus.status === 'online' && oldStatus === 'offline') {
            // Recovered from offline - reset backoff
            console.log('🌐 InternetCheckService: Recovered from offline, resetting backoff');
            this.backoffMultiplier = 1;
            this.adjustCheckInterval();
        } else if (newStatus.status === 'offline') {
            // Still offline - increase backoff
            console.log('🌐 InternetCheckService: Still offline, increasing backoff');
            this.backoffMultiplier = Math.min(this.backoffMultiplier * 1.5, this.maxBackoffMultiplier);
            this.adjustCheckInterval();
        }

        // Persist state for other windows
        console.log('🌐 InternetCheckService: Persisting state to storage');
        this.persistState();

        // Emit status change if state actually changed
        if (oldStatus !== newStatus.status) {
            console.log(`🌐 InternetCheckService: Status changed from ${oldStatus} to ${newStatus.status} - emitting events`);
            this.emit('statusChanged', newStatus);
        }

        // Always emit sample for latency updates
        console.log('🌐 InternetCheckService: Emitting sample event');
        this.emit('sample', newStatus);
    }

    /**
     * Adjust check interval based on backoff multiplier
     */
    private adjustCheckInterval(): void {
        if (!this.checkTimer || this.role !== 'leader') {
            return;
        }

        // Restart timer with new interval
        clearInterval(this.checkTimer);
        
        const baseInterval = this.config.intervalSec * 1000;
        const adjustedInterval = baseInterval * this.backoffMultiplier;
        
        console.log(`🌐 InternetCheckService: Adjusting interval to ${adjustedInterval/1000}s (backoff: ${this.backoffMultiplier}x)`);
        
        this.checkTimer = setInterval(() => {
            this.performCheck();
        }, adjustedInterval);
    }

    /**
     * Persist current state to shared storage
     */
    private persistState(): void {
        try {
            this.storageManager.setCustomData('internet.currentStatus', this.currentStatus);
        } catch (error) {
            console.error('🌐 InternetCheckService: Failed to persist state:', error);
        }
    }

    /**
     * Load persisted state from storage
     */
    private loadPersistedState(): void {
        try {
            const stored = this.storageManager.getCustomData('internet.currentStatus');
            if (stored && typeof stored === 'object') {
                this.currentStatus = { ...this.currentStatus, ...stored };
                console.log('🌐 InternetCheckService: Loaded persisted state:', this.currentStatus.status);
            }
        } catch (error) {
            console.error('🌐 InternetCheckService: Failed to load persisted state:', error);
        }
    }

    /**
     * Load shared state (for followers)
     */
    private loadSharedState(): void {
        try {
            const sharedStatus = this.storageManager.getCustomData('internet.currentStatus');
            if (sharedStatus && typeof sharedStatus === 'object') {
                const oldStatus = this.currentStatus.status;
                this.currentStatus = sharedStatus as InternetStatus;
                
                // Emit events if status changed
                if (oldStatus !== this.currentStatus.status) {
                    console.log(`🌐 InternetCheckService: Follower received status change: ${this.currentStatus.status}`);
                    this.emit('statusChanged', this.currentStatus);
                }
                
                this.emit('sample', this.currentStatus);
            }
        } catch (error) {
            console.error('🌐 InternetCheckService: Failed to load shared state:', error);
        }
    }

    /**
     * Run an immediate connectivity check (public API)
     */
    async runCheckNow(): Promise<InternetStatus> {
        if (this.role === 'leader') {
            await this.performCheck();
        } else {
            // Followers can't run checks, just return current status
            console.log('🌐 InternetCheckService: Follower cannot run checks, returning current status');
        }
        
        return this.currentStatus;
    }

    /**
     * Get current internet status
     */
    getCurrentStatus(): InternetStatus {
        console.log('🌐 InternetCheckService: getCurrentStatus() called, returning:', this.currentStatus);
        return { ...this.currentStatus };
    }

    /**
     * Get time until next check (for UI display)
     */
    getTimeUntilNextCheck(): number {
        if (this.role !== 'leader' || !this.checkTimer) {
            return 0;
        }

        const intervalMs = this.config.intervalSec * 1000 * this.backoffMultiplier;
        const elapsed = Date.now() - this.lastCheckTime;
        return Math.max(0, intervalMs - elapsed);
    }

    /**
     * Dispose of resources
     */
    dispose(): void {
        this.stop();
        this.removeAllListeners();
    }
}