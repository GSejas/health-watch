/**
 * @fileoverview Script Probe Implementation
 * 
 * This module executes shell commands as probes to validate system-level checks
 * and custom health scripts. It is intended for trusted workspaces and includes
 * user confirmation to reduce accidental execution.
 * 
 * @module probes/script
 * @version 1.0.0
 * @author Health Watch Extension
 * 
 * @description
 * The Script probe:
 * - Executes configured shell commands using the host shell
 * - Captures stdout/stderr and exit code
 * - Measures execution latency
 * - Presents a one-time user security warning before first execution
 * 
 * @interfaces
 * - Uses ProbeResult interface for standardized output
 * - Integrates with ChannelDefinition for configuration
 * 
 * @classes
 * - ScriptProbe: Executes configured commands and returns structured results
 * 
 * @dependencies
 * - child_process: Node.js child process API for spawning commands
 * - vscode: VS Code API for user prompts and configuration updates
 * - ../types: ProbeResult interface definition
 * - ../config: ChannelDefinition structure
 * 
 * @error_handling
 * - Spawn errors: Reported as probe failures with error details
 * - Non-zero exit codes: Returned as failures with captured output
 * - Timeouts: Resolved as failures when the child does not complete in allotted time
 * 
 * @securityRiskAnalysis
 * Security & Risk Analysis:
 * - Execution Risk: Running arbitrary commands can modify system state — scripts must be trusted.
 * - User Consent: A one-time warning is shown; users can disable script probes globally.
 * - Least Privilege: Probes run with the extension user's privileges; do not require elevation.
 * - Audit & Logging: Capture of stdout/stderr and command details should be protected and not exported unintentionally.
 * - Rate-Limiting: High-frequency or long-running scripts may overload a system — use conservative intervals and timeouts.
 * - Injection: Inputs are passed to the shell; avoid constructing commands from untrusted data.
 * - Platform Differences: Shell selection varies per OS; ensure cross-platform scripts are tested appropriately.
 */

import * as cp from 'child_process';
import * as vscode from 'vscode';
import { ProbeResult } from '../types';
import { ChannelDefinition } from '../config';

/**
 * Executes configured shell commands as probes. Shows a one-time user warning
 * before allowing execution to reduce accidental or malicious runs.
 */
export class ScriptProbe {
    private hasShownWarning = false;

    /**
     * Run the configured command for the channel and return a ProbeResult.
     *
     * @param channel - ChannelDefinition containing 'command' and optional 'shell' and 'timeoutMs'
     * @returns ProbeResult with success, latency and captured output/error details
     */
    async probe(channel: ChannelDefinition): Promise<ProbeResult> {
        if (!channel.command) {
            return {
                success: false,
                latencyMs: 0,
                error: 'No command specified'
            };
        }

        if (!this.hasShownWarning) {
            const result = await vscode.window.showWarningMessage(
                'Script probes execute shell commands on your system. Only use trusted scripts.',
                'Continue',
                'Disable Script Probes'
            );
            
            if (result === 'Disable Script Probes') {
                await vscode.workspace.getConfiguration('healthWatch.script').update('enabled', false, true);
                return {
                    success: false,
                    latencyMs: 0,
                    error: 'Script probes disabled by user'
                };
            }
            
            this.hasShownWarning = true;
        }

        const startTime = Date.now();
        const timeout = channel.timeoutMs || 3000;
        const shell = this.getShell(channel.shell);

        try {
            const result = await new Promise<ProbeResult>((resolve) => {
                const child = cp.spawn(shell.command, shell.args.concat([channel.command!]), {
                    timeout,
                    stdio: ['ignore', 'pipe', 'pipe'],
                    windowsHide: true
                });

                let stdout = '';
                let stderr = '';

                child.stdout?.on('data', (data) => {
                    stdout += data.toString();
                });

                child.stderr?.on('data', (data) => {
                    stderr += data.toString();
                });

                child.on('close', (code, signal) => {
                    const latencyMs = Date.now() - startTime;
                    
                    if (signal) {
                        resolve({
                            success: false,
                            latencyMs,
                            error: `Process killed by signal: ${signal}`,
                            details: {
                                command: channel.command,
                                shell: shell.name,
                                signal,
                                stdout: stdout.trim(),
                                stderr: stderr.trim()
                            }
                        });
                    } else {
                        resolve({
                            success: code === 0,
                            latencyMs,
                            error: code !== 0 ? `Process exited with code ${code}` : undefined,
                            details: {
                                command: channel.command,
                                shell: shell.name,
                                exitCode: code,
                                stdout: stdout.trim(),
                                stderr: stderr.trim()
                            }
                        });
                    }
                });

                child.on('error', (error) => {
                    const latencyMs = Date.now() - startTime;
                    resolve({
                        success: false,
                        latencyMs,
                        error: error.message,
                        details: {
                            command: channel.command,
                            shell: shell.name,
                            errorType: 'spawn_error'
                        }
                    });
                });
            });

            return result;
        } catch (error) {
            return {
                success: false,
                latencyMs: Date.now() - startTime,
                error: error instanceof Error ? error.message : 'Unknown error',
                details: {
                    command: channel.command,
                    shell: channel.shell || 'auto'
                }
            };
        }
    }

    private getShell(shellType?: 'cmd' | 'powershell' | 'bash') {
        const platform = process.platform;
        
        if (shellType) {
            switch (shellType) {
                case 'cmd':
                    return { name: 'cmd', command: 'cmd', args: ['/c'] };
                case 'powershell':
                    return { name: 'powershell', command: 'powershell', args: ['-Command'] };
                case 'bash':
                    return { name: 'bash', command: 'bash', args: ['-c'] };
            }
        }

        switch (platform) {
            case 'win32':
                return { name: 'cmd', command: 'cmd', args: ['/c'] };
            case 'darwin':
            case 'linux':
                return { name: 'bash', command: '/bin/bash', args: ['-c'] };
            default:
                return { name: 'sh', command: 'sh', args: ['-c'] };
        }
    }
}