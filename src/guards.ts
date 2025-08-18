/**
 * @fileoverview Guard System for Conditional Monitoring
 * 
 * This module implements the guard system that provides conditional execution
 * of monitoring probes based on environmental conditions. Guards prevent false
 * negatives by checking prerequisites before running probes.
 * 
 * @module guards
 * @version 1.0.0
 * @author Health Watch Extension
 * 
 * @description
 * The guard system provides conditional monitoring by:
 * - Checking network interface availability (netIfUp guard)
 * - Validating DNS connectivity (DNS guard)
 * - Supporting custom guard implementations
 * - Providing guard result caching and timeout handling
 * - Integrating with the monitoring scheduler
 * 
 * @interfaces
 * - GuardResult: Standard result interface for all guard implementations
 * - GuardImpl: Interface that all guard implementations must follow
 * 
 * @classes
 * - NetIfUpGuard: Checks if a network interface is available and active
 * - DnsGuard: Validates DNS resolution for a specific hostname
 * - GuardManager: Singleton manager for guard registration and execution
 * 
 * @dependencies
 * - dns: Node.js DNS module for DNS resolution testing
 * - os: Node.js OS module for network interface detection
 * - util.promisify: Promise wrapper for callback-based APIs
 * - ./config: GuardDefinition type and configuration integration
 * 
 * @guard_types
 * - netIfUp: Checks if a network interface (e.g., eth0, wlan0, tun0) is up
 * - dns: Validates DNS resolution for connectivity testing
 * 
 * @usage_patterns
 * Guards are typically used for:
 * - VPN connectivity checks (netIfUp: tun0, wg0)
 * - Corporate network validation (dns: internal.corp.com)
 * - Interface-specific monitoring (netIfUp: eth0 vs wlan0)
 * - Split-tunnel VPN scenarios
 * 
 * @example
 * ```typescript
 * // Register and use a network interface guard
 * const guardManager = GuardManager.getInstance();
 * const vpnGuard = new NetIfUpGuard('tun0');
 * guardManager.registerGuard('vpn', vpnGuard);
 * 
 * // Check guard condition
 * const result = await vpnGuard.check();
 * if (result.passed) {
 *   // Proceed with monitoring
 * } else {
 *   console.log('VPN not connected:', result.error);
 * }
 * ```
 * 
 * @example
 * ```json
 * // Configuration example
 * {
 *   "guards": {
 *     "vpn": { "type": "netIfUp", "name": "tun0" },
 *     "corp": { "type": "dns", "hostname": "internal.corp.com" }
 *   },
 *   "channels": [
 *     {
 *       "id": "internal-api",
 *       "type": "https",
 *       "url": "https://api.internal.corp.com/health",
 *       "guards": ["vpn", "corp"]
 *     }
 *   ]
 * }
 * ```
 * 
 * @see {@link ./config.ts} for guard configuration definitions
 * @see {@link ../docs/testing/manual-test-plan.md#guard-condition-tests} for testing procedures
 */

import * as dns from 'dns';
import * as os from 'os';
import { promisify } from 'util';
import { GuardDefinition } from './config';

export interface GuardResult {
    passed: boolean;
    error?: string;
    details?: any;
}

export interface GuardImpl {
    check(): Promise<GuardResult>;
}

export class NetIfUpGuard implements GuardImpl {
    constructor(private interfaceName: string) {}

    async check(): Promise<GuardResult> {
        try {
            const interfaces = os.networkInterfaces();
            const iface = interfaces[this.interfaceName];
            
            if (!iface) {
                return {
                    passed: false,
                    error: `Interface '${this.interfaceName}' not found`,
                    details: { availableInterfaces: Object.keys(interfaces) }
                };
            }

            const isUp = iface.some(addr => !addr.internal);
            
            return {
                passed: isUp,
                error: isUp ? undefined : `Interface '${this.interfaceName}' is down`,
                details: {
                    interfaceName: this.interfaceName,
                    addresses: iface.map(addr => ({
                        address: addr.address,
                        family: addr.family,
                        internal: addr.internal
                    }))
                }
            };
        } catch (error) {
            return {
                passed: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                details: { interfaceName: this.interfaceName }
            };
        }
    }
}

export class DnsGuard implements GuardImpl {
    private resolve4 = promisify(dns.resolve4);
    
    constructor(private hostname: string) {}

    async check(): Promise<GuardResult> {
        try {
            const startTime = Date.now();
            const addresses = await Promise.race([
                this.resolve4(this.hostname),
                new Promise<never>((_, reject) => 
                    setTimeout(() => reject(new Error('DNS timeout')), 5000)
                )
            ]);
            
            const latencyMs = Date.now() - startTime;
            
            return {
                passed: true,
                details: {
                    hostname: this.hostname,
                    addresses,
                    latencyMs,
                    recordCount: addresses.length
                }
            };
        } catch (error) {
            const err = error as NodeJS.ErrnoException;
            return {
                passed: false,
                error: err.message,
                details: {
                    hostname: this.hostname,
                    errorCode: err.code,
                    errno: err.errno
                }
            };
        }
    }
}

export class GuardManager {
    private static instance: GuardManager;
    private guards = new Map<string, GuardImpl>();
    private cache = new Map<string, { result: GuardResult; timestamp: number }>();
    private readonly CACHE_TTL = 30000; // 30 seconds

    static getInstance(): GuardManager {
        if (!GuardManager.instance) {
            GuardManager.instance = new GuardManager();
        }
        return GuardManager.instance;
    }

    registerGuard(name: string, guard: GuardImpl): void {
        this.guards.set(name, guard);
        this.cache.delete(name); // Invalidate cache when guard is updated
    }

    createGuard(name: string, definition: GuardDefinition): GuardImpl {
        switch (definition.type) {
            case 'netIfUp':
                if (!definition.name) {
                    throw new Error(`Guard '${name}': interface name is required for netIfUp guard`);
                }
                return new NetIfUpGuard(definition.name);
            
            case 'dns':
                if (!definition.hostname) {
                    throw new Error(`Guard '${name}': hostname is required for dns guard`);
                }
                return new DnsGuard(definition.hostname);
            
            default:
                throw new Error(`Guard '${name}': unsupported guard type '${(definition as any).type}'`);
        }
    }

    async checkGuard(name: string): Promise<GuardResult> {
        const cached = this.cache.get(name);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            return cached.result;
        }

        const guard = this.guards.get(name);
        if (!guard) {
            return {
                passed: false,
                error: `Guard '${name}' not found`
            };
        }

        try {
            const result = await guard.check();
            this.cache.set(name, { result, timestamp: Date.now() });
            return result;
        } catch (error) {
            const result: GuardResult = {
                passed: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
            this.cache.set(name, { result, timestamp: Date.now() });
            return result;
        }
    }

    async checkGuards(guardNames: string[]): Promise<{ passed: boolean; results: Map<string, GuardResult> }> {
        const results = new Map<string, GuardResult>();
        let allPassed = true;

        for (const guardName of guardNames) {
            const result = await this.checkGuard(guardName);
            results.set(guardName, result);
            if (!result.passed) {
                allPassed = false;
            }
        }

        return { passed: allPassed, results };
    }

    clearCache(): void {
        this.cache.clear();
    }

    removeGuard(name: string): void {
        this.guards.delete(name);
        this.cache.delete(name);
    }

    listGuards(): string[] {
        return Array.from(this.guards.keys());
    }

    updateGuards(definitions: Record<string, GuardDefinition>): void {
        // Remove guards that are no longer defined
        const currentGuards = new Set(this.guards.keys());
        const newGuards = new Set(Object.keys(definitions));
        
        for (const guardName of currentGuards) {
            if (!newGuards.has(guardName)) {
                this.removeGuard(guardName);
            }
        }

        // Add or update guards
        for (const [name, definition] of Object.entries(definitions)) {
            try {
                const guard = this.createGuard(name, definition);
                this.registerGuard(name, guard);
            } catch (error) {
                console.error(`Failed to create guard '${name}':`, error);
            }
        }
    }
}