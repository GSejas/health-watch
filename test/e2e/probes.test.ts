/**
 * End-to-End Tests for Probe Execution and State Management
 * 
 * Tests actual probe execution, state transitions, and channel monitoring.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { HttpsProbe } from '../../src/probes/https';
import { TcpProbe } from '../../src/probes/tcp';
import { DnsProbe } from '../../src/probes/dns';
import { GuardManager } from '../../src/guards';
import { ChannelDefinition } from '../../src/config';

describe('Probes E2E Tests', function() {
    this.timeout(15000); // 15 second timeout for network operations

    let extension: vscode.Extension<any> | undefined;
    let api: any;

    before(async function() {
        extension = vscode.extensions.getExtension('GSejas.health-watch');
        assert.ok(extension, 'Extension should be found');
        
        if (!extension.isActive) {
            await extension.activate();
        }
        
        api = extension.exports;
        assert.ok(api, 'Extension should export API');
    });

    describe('HTTPS Probe Integration', () => {
        it('should probe a working HTTPS endpoint', async () => {
            const httpsProbe = new HttpsProbe();
            const channel: ChannelDefinition = {
                id: 'test-https-success',
                type: 'https',
                url: 'https://httpbin.org/status/200',
                timeoutMs: 5000
            };

            const result = await httpsProbe.probe(channel, 'HealthWatch/1.0 Test', true);
            
            assert.ok(result.success, 'HTTPS probe should succeed for valid endpoint');
            assert.ok(typeof result.latencyMs === 'number', 'Should measure latency');
            assert.ok(result.latencyMs >= 0, 'Latency should be non-negative');
            assert.ok(result.details?.statusCode === 200, 'Should return correct status code');
        });

        it('should handle HTTPS probe failures gracefully', async () => {
            const httpsProbe = new HttpsProbe();
            const channel: ChannelDefinition = {
                id: 'test-https-fail',
                type: 'https',
                url: 'https://httpbin.org/status/500',
                timeoutMs: 5000
            };

            const result = await httpsProbe.probe(channel, 'HealthWatch/1.0 Test', true);
            
            assert.ok(!result.success, 'HTTPS probe should fail for 500 status');
            assert.ok(typeof result.latencyMs === 'number', 'Should measure latency even on failure');
            assert.ok(result.details?.statusCode === 500, 'Should return correct error status code');
        });

        it('should respect expectation rules', async () => {
            const httpsProbe = new HttpsProbe();
            const channel: ChannelDefinition = {
                id: 'test-https-expect',
                type: 'https',
                url: 'https://httpbin.org/status/401',
                timeoutMs: 5000,
                expect: {
                    treatAuthAsReachable: true
                }
            };

            const result = await httpsProbe.probe(channel, 'HealthWatch/1.0 Test', true);
            
            assert.ok(result.success, 'Should treat 401 as success when treatAuthAsReachable is true');
            assert.ok(result.details?.statusCode === 401, 'Should return 401 status code');
        });
    });

    describe('TCP Probe Integration', () => {
        it('should probe a working TCP endpoint', async () => {
            const tcpProbe = new TcpProbe();
            const channel: ChannelDefinition = {
                id: 'test-tcp-success',
                type: 'tcp',
                target: 'httpbin.org:80',
                timeoutMs: 5000
            };

            const result = await tcpProbe.probe(channel);
            
            assert.ok(result.success, 'TCP probe should succeed for open port');
            assert.ok(typeof result.latencyMs === 'number', 'Should measure latency');
            assert.ok(result.latencyMs >= 0, 'Latency should be non-negative');
            assert.ok(result.details?.host === 'httpbin.org', 'Should include connection details');
            assert.ok(result.details?.port === 80, 'Should include port details');
        });

        it('should handle TCP probe failures gracefully', async () => {
            const tcpProbe = new TcpProbe();
            const channel: ChannelDefinition = {
                id: 'test-tcp-fail',
                type: 'tcp',
                target: 'httpbin.org:12345', // Likely closed port
                timeoutMs: 3000
            };

            const result = await tcpProbe.probe(channel);
            
            assert.ok(!result.success, 'TCP probe should fail for closed port');
            assert.ok(typeof result.latencyMs === 'number', 'Should measure latency even on failure');
            assert.ok(result.error, 'Should provide error message');
        });

        it('should validate target format', async () => {
            const tcpProbe = new TcpProbe();
            const channel: ChannelDefinition = {
                id: 'test-tcp-invalid',
                type: 'tcp',
                target: 'invalid-target',
                timeoutMs: 3000
            };

            const result = await tcpProbe.probe(channel);
            
            assert.ok(!result.success, 'TCP probe should fail for invalid target format');
            assert.ok(result.error?.includes('Invalid target format'), 'Should provide validation error');
        });
    });

    describe('DNS Probe Integration', () => {
        it('should resolve a valid hostname', async () => {
            const dnsProbe = new DnsProbe();
            const channel: ChannelDefinition = {
                id: 'test-dns-success',
                type: 'dns',
                hostname: 'google.com',
                timeoutMs: 5000
            };

            const result = await dnsProbe.probe(channel);
            
            assert.ok(result.success, 'DNS probe should succeed for valid hostname');
            assert.ok(typeof result.latencyMs === 'number', 'Should measure latency');
            assert.ok(result.latencyMs >= 0, 'Latency should be non-negative');
            assert.ok(result.details?.addresses?.length > 0, 'Should return IP addresses');
        });

        it('should handle DNS resolution failures', async () => {
            const dnsProbe = new DnsProbe();
            const channel: ChannelDefinition = {
                id: 'test-dns-fail',
                type: 'dns',
                hostname: 'nonexistent-domain-12345.invalid',
                timeoutMs: 5000
            };

            const result = await dnsProbe.probe(channel);
            
            assert.ok(!result.success, 'DNS probe should fail for invalid hostname');
            assert.ok(result.error, 'Should provide error message');
            assert.ok(typeof result.latencyMs === 'number', 'Should measure latency even on failure');
        });
    });

    describe('Guard System Integration', () => {
        it('should evaluate network interface guards', async () => {
            const guardManager = GuardManager.getInstance();
            
            // Create a test guard for loopback interface (should exist on all systems)
            guardManager.updateGuards({
                'loopback': {
                    type: 'netIfUp',
                    name: 'lo' // Unix systems use 'lo', Windows might use different name
                }
            });

            const result = await guardManager.checkGuard('loopback');
            
            // This might fail on Windows, but should work on Unix systems
            // We test the structure rather than the specific result
            assert.ok(typeof result.passed === 'boolean', 'Guard should return boolean result');
            assert.ok(result.details, 'Guard should provide details');
        });

        it('should evaluate DNS guards', async () => {
            const guardManager = GuardManager.getInstance();
            
            guardManager.updateGuards({
                'google-dns': {
                    type: 'dns',
                    hostname: 'google.com'
                }
            });

            const result = await guardManager.checkGuard('google-dns');
            
            assert.ok(result.passed === true, 'DNS guard should pass for google.com');
            assert.ok(result.details?.addresses?.length > 0, 'Should resolve to IP addresses');
            assert.ok(typeof result.details?.latencyMs === 'number', 'Should measure latency');
        });

        it('should handle multiple guards', async () => {
            const guardManager = GuardManager.getInstance();
            
            guardManager.updateGuards({
                'dns-test': {
                    type: 'dns',
                    hostname: 'cloudflare.com'
                },
                'dns-fail': {
                    type: 'dns',
                    hostname: 'nonexistent-domain-99999.invalid'
                }
            });

            const result = await guardManager.checkGuards(['dns-test', 'dns-fail']);
            
            assert.ok(!result.passed, 'Should fail when any guard fails');
            assert.ok(result.results.size === 2, 'Should check both guards');
            assert.ok(result.results.get('dns-test')?.passed === true, 'First guard should pass');
            assert.ok(result.results.get('dns-fail')?.passed === false, 'Second guard should fail');
        });
    });

    describe('Channel State Management', () => {
        it('should register and manage dynamic channels', async () => {
            const testChannel: ChannelDefinition = {
                id: 'dynamic-test-channel',
                name: 'Dynamic Test Channel',
                type: 'https',
                url: 'https://httpbin.org/status/200',
                intervalSec: 30,
                timeoutMs: 5000
            };

            const disposable = api.registerChannel(testChannel);
            
            // Verify channel is registered
            const channels = api.listChannels();
            const registeredChannel = channels.find((ch: any) => ch.id === 'dynamic-test-channel');
            assert.ok(registeredChannel, 'Channel should be registered');
            assert.ok(registeredChannel.name === 'Dynamic Test Channel', 'Channel name should match');
            assert.ok(registeredChannel.type === 'https', 'Channel type should match');

            // Test running the channel
            const result = await api.runChannelNow('dynamic-test-channel');
            assert.ok(typeof result.success === 'boolean', 'Should return probe result');
            assert.ok(typeof result.latencyMs === 'number', 'Should include latency');

            // Cleanup
            disposable.dispose();
            
            const channelsAfterDispose = api.listChannels();
            const channelAfterDispose = channelsAfterDispose.find((ch: any) => ch.id === 'dynamic-test-channel');
            assert.ok(!channelAfterDispose, 'Channel should be removed after dispose');
        });

        it('should handle channel state transitions', (done) => {
            const testChannel: ChannelDefinition = {
                id: 'state-test-channel',
                name: 'State Test Channel',
                type: 'https',
                url: 'https://httpbin.org/status/200',
                timeoutMs: 5000
            };

            let stateChangeReceived = false;
            const channelDisposable = api.registerChannel(testChannel);
            
            const eventDisposable = api.onStateChange((event: any) => {
                if (event.id === 'state-test-channel') {
                    stateChangeReceived = true;
                    assert.ok(event.state, 'State change event should include state');
                    
                    // Cleanup
                    channelDisposable.dispose();
                    eventDisposable.dispose();
                    done();
                }
            });

            // Trigger state change by running the channel
            api.runChannelNow('state-test-channel').catch(() => {
                // Ignore probe errors, we're testing state changes
                if (!stateChangeReceived) {
                    channelDisposable.dispose();
                    eventDisposable.dispose();
                    done(new Error('No state change event received'));
                }
            });

            // Timeout protection
            setTimeout(() => {
                if (!stateChangeReceived) {
                    channelDisposable.dispose();
                    eventDisposable.dispose();
                    done(new Error('Timeout waiting for state change event'));
                }
            }, 10000);
        });
    });

    after(async function() {
        // Cleanup any remaining test channels
        try {
            await vscode.commands.executeCommand('healthWatch.refreshChannels');
        } catch (error) {
            // Ignore cleanup errors
        }
    });
});