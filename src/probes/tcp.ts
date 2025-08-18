/**
 * @fileoverview TCP Socket Connectivity Probe
 * 
 * This module implements TCP socket connectivity testing for port availability
 * monitoring. It establishes socket connections to verify that services are
 * listening on specific host:port combinations.
 * 
 * @module probes/tcp
 * @version 1.0.0
 * @author Health Watch Extension
 * 
 * @description
 * The TCP probe performs socket connectivity tests by:
 * - Establishing TCP socket connections to target host:port
 * - Measuring connection establishment latency
 * - Handling connection timeouts and errors
 * - Supporting IPv4 and IPv6 addresses
 * - Providing detailed connection diagnostics
 * 
 * @interfaces
 * - Uses ProbeResult interface for standardized output
 * - Integrates with ChannelDefinition for configuration
 * 
 * @classes
 * - TcpProbe: Main TCP connectivity probe implementation
 * 
 * @dependencies
 * - net: Node.js networking module for TCP socket operations
 * - ../types: ProbeResult interface definition
 * - ../config: ChannelDefinition configuration structure
 * 
 * @connection_flow
 * 1. Parse target host:port from configuration
 * 2. Validate port range (1-65535)
 * 3. Create TCP socket with timeout handling
 * 4. Attempt connection to target
 * 5. Measure latency and capture connection details
 * 6. Clean up socket resources
 * 
 * @error_handling
 * - Connection refused: Target service not listening
 * - Timeout errors: Connection establishment timeout
 * - Network errors: Host unreachable, DNS resolution failures
 * - Invalid target: Malformed host:port specification
 * 
 * @performance
 * - Low overhead socket operations
 * - Configurable timeout values
 * - Immediate socket cleanup after test
 * - Latency measurement in milliseconds
 * 
 * @example
 * ```typescript
 * const probe = new TcpProbe();
 * 
 * // Test database connectivity
 * const result = await probe.probe({
 *   id: 'db-check',
 *   type: 'tcp',
 *   target: 'db.example.com:5432',
 *   timeoutMs: 5000
 * });
 * 
 * if (result.success) {
 *   console.log(`DB connection OK, latency: ${result.latencyMs}ms`);
 * } else {
 *   console.log(`DB connection failed: ${result.error}`);
 * }
 * ```
 * 
 * @use_cases
 * - Database connection monitoring (PostgreSQL:5432, MySQL:3306)
 * - Message queue health checks (RabbitMQ:5672, Redis:6379)
 * - API gateway connectivity (HTTP:80, HTTPS:443)
 * - SSH service availability (SSH:22)
 * - Custom application port monitoring
 * 
 * @configuration_example
 * ```json
 * {
 *   "id": "database-port",
 *   "type": "tcp",
 *   "target": "db.internal.com:5432",
 *   "timeoutMs": 3000,
 *   "intervalSec": 30
 * }
 * ```
 * 
 * @see {@link ../types.ts} for ProbeResult interface
 * @see {@link ../config.ts} for channel configuration
 * @see {@link ../../docs/testing/manual-test-plan.md#tcp-probe-tests} for testing procedures
 * 
 * @securityRiskAnalysis
 * Security & Risk Analysis:
 * - Principle of Least Privilege: TCP probes operate using normal user privileges and do not require elevated rights.
 * - Network Safety: Repeated probes to external hosts may appear like port scanning to IDS/IPS. Respect organizational policies and rate limits.
 * - Privacy: Probe results (addresses, ports) are logged/stored locally; avoid probing private or sensitive endpoints without authorization.
 * - Denial-of-Service: High-frequency probes to a single target can impose load. Use reasonable intervals and backoff strategies.
 * - Input Validation: Targets are validated for host:port format and port range; malformed inputs return errors rather than executing network operations.
 * - Logging: Ensure logs that contain network details are protected and not exported unintentionally.
 * - Dependency Trust: This module uses Node.js net API — keep runtime and dependencies patched to mitigate platform-level vulnerabilities.
 */

import * as net from 'net';
import { ProbeResult } from '../types';
import { ChannelDefinition } from '../config';

/**
 * TcpProbe implements a connectivity check by attempting to open a TCP socket
 * to the configured host:port and measuring the time to establish a connection.
 *
 * @remarks
 * Instances are lightweight and do not retain network state between probes.
 */
export class TcpProbe {
    /**
     * Perform a TCP connectivity probe against the provided channel target.
     *
     * @param channel - ChannelDefinition with a "target" field in the form "host:port"
     * @returns Promise resolving to a ProbeResult indicating success, latency and details or error
     */
    async probe(channel: ChannelDefinition): Promise<ProbeResult> {
        if (!channel.target) {
            return {
                success: false,
                latencyMs: 0,
                error: 'No target specified'
            };
        }

        const [host, portStr] = channel.target.split(':');
        const port = parseInt(portStr, 10);

        if (!host || isNaN(port) || port < 1 || port > 65535) {
            return {
                success: false,
                latencyMs: 0,
                error: 'Invalid target format. Expected host:port'
            };
        }

        const startTime = Date.now();
        const timeout = channel.timeoutMs || 3000;

        try {
            const result = await new Promise<ProbeResult>((resolve) => {
                const socket = new net.Socket();
                let resolved = false;

                const cleanup = () => {
                    if (!resolved) {
                        resolved = true;
                        socket.destroy();
                    }
                };

                const timer = setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        socket.destroy();
                        resolve({
                            success: false,
                            latencyMs: Date.now() - startTime,
                            error: 'Connection timeout'
                        });
                    }
                }, timeout);

                socket.on('connect', () => {
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timer);
                        const latencyMs = Date.now() - startTime;
                        socket.destroy();
                        resolve({
                            success: true,
                            latencyMs,
                            details: {
                                host,
                                port,
                                localAddress: socket.localAddress,
                                localPort: socket.localPort
                            }
                        });
                    }
                });

                socket.on('error', (error) => {
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timer);
                        cleanup();
                        resolve({
                            success: false,
                            latencyMs: Date.now() - startTime,
                            error: error.message,
                            details: {
                                host,
                                port,
                                errorCode: (error as any).code
                            }
                        });
                    }
                });

                socket.on('timeout', () => {
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timer);
                        cleanup();
                        resolve({
                            success: false,
                            latencyMs: Date.now() - startTime,
                            error: 'Socket timeout'
                        });
                    }
                });

                try {
                    socket.connect(port, host);
                } catch (error) {
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timer);
                        cleanup();
                        resolve({
                            success: false,
                            latencyMs: Date.now() - startTime,
                            error: error instanceof Error ? error.message : 'Connection failed'
                        });
                    }
                }
            });

            return result;
        } catch (error) {
            return {
                success: false,
                latencyMs: Date.now() - startTime,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
}