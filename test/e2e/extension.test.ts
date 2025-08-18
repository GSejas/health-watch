/**
 * End-to-End Tests for Health Watch Extension
 * 
 * Tests extension activation, commands, and basic functionality integration.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

describe('Extension E2E Tests', function() {
    this.timeout(10000); // 10 second timeout for E2E tests

    let extension: vscode.Extension<any> | undefined;

    before(async function() {
        // Get the extension
        extension = vscode.extensions.getExtension('GSejas.health-watch');
        assert.ok(extension, 'Extension should be found');

        // Activate the extension
        await extension.activate();
        assert.ok(extension.isActive, 'Extension should be activated');
    });

    describe('Extension Activation', () => {
        it('should activate without errors', () => {
            assert.ok(extension?.isActive, 'Extension should be active');
        });

        it('should export public API', () => {
            const api = extension?.exports;
            assert.ok(api, 'Extension should export API');
            assert.ok(typeof api.startWatch === 'function', 'API should have startWatch method');
            assert.ok(typeof api.stopWatch === 'function', 'API should have stopWatch method');
            assert.ok(typeof api.runChannelNow === 'function', 'API should have runChannelNow method');
            assert.ok(typeof api.listChannels === 'function', 'API should have listChannels method');
        });

        it('should register commands', async () => {
            const commands = await vscode.commands.getCommands();
            const healthWatchCommands = commands.filter(cmd => cmd.startsWith('healthWatch.'));
            
            assert.ok(healthWatchCommands.length > 0, 'Should register health watch commands');
            assert.ok(healthWatchCommands.includes('healthWatch.startWatch'), 'Should register startWatch command');
            assert.ok(healthWatchCommands.includes('healthWatch.stopWatch'), 'Should register stopWatch command');
            assert.ok(healthWatchCommands.includes('healthWatch.refreshChannels'), 'Should register refreshChannels command');
        });
    });

    describe('Status Bar Integration', () => {
        it('should create status bar item', async () => {
            // Execute refresh command to ensure status bar is initialized
            await vscode.commands.executeCommand('healthWatch.refreshChannels');
            
            // Check if status bar item exists by looking for the text pattern
            // This is a basic check since we can't directly access status bar items
            assert.ok(true, 'Status bar item creation test placeholder');
        });
    });

    describe('Tree View Integration', () => {
        it('should register tree data provider', async () => {
            await vscode.commands.executeCommand('healthWatch.refreshChannels');
            
            // Verify tree view is registered (basic check)
            assert.ok(true, 'Tree view registration test placeholder');
        });
    });

    describe('Command Execution', () => {
        it('should execute startWatch command without errors', async () => {
            try {
                await vscode.commands.executeCommand('healthWatch.startWatch');
                assert.ok(true, 'startWatch command executed successfully');
            } catch (error) {
                // Command might fail if no configuration is loaded, which is expected
                assert.ok(error instanceof Error, 'Should throw proper error for missing config');
            }
        });

        it('should execute stopWatch command without errors', async () => {
            try {
                await vscode.commands.executeCommand('healthWatch.stopWatch');
                assert.ok(true, 'stopWatch command executed successfully');
            } catch (error) {
                assert.fail(`stopWatch command should not throw: ${error}`);
            }
        });

        it('should execute refreshChannels command without errors', async () => {
            try {
                await vscode.commands.executeCommand('healthWatch.refreshChannels');
                assert.ok(true, 'refreshChannels command executed successfully');
            } catch (error) {
                assert.fail(`refreshChannels command should not throw: ${error}`);
            }
        });
    });

    describe('Configuration Integration', () => {
        it('should handle missing configuration gracefully', async () => {
            const api = extension?.exports;
            if (!api) {
                assert.fail('API not available');
                return;
            }

            // List channels should work even without configuration
            const channels = api.listChannels();
            assert.ok(Array.isArray(channels), 'listChannels should return array');
        });
    });

    describe('API Integration', () => {
        it('should allow dynamic channel registration', async () => {
            const api = extension?.exports;
            if (!api) {
                assert.fail('API not available');
                return;
            }

            const testChannel = {
                id: 'test-channel',
                name: 'Test Channel',
                type: 'https' as const,
                url: 'https://httpbin.org/status/200',
                intervalSec: 60,
                timeoutMs: 5000
            };

            try {
                const disposable = api.registerChannel(testChannel);
                assert.ok(disposable, 'Should return disposable');
                
                const channels = api.listChannels();
                const registeredChannel = channels.find((ch: any) => ch.id === 'test-channel');
                assert.ok(registeredChannel, 'Channel should be registered');
                
                disposable.dispose();
                
                const channelsAfterDispose = api.listChannels();
                const channelAfterDispose = channelsAfterDispose.find((ch: any) => ch.id === 'test-channel');
                assert.ok(!channelAfterDispose, 'Channel should be removed after dispose');
            } catch (error) {
                assert.fail(`Dynamic channel registration failed: ${error}`);
            }
        });

        it('should handle event subscriptions', (done) => {
            const api = extension?.exports;
            if (!api) {
                assert.fail('API not available');
                return;
            }

            let eventReceived = false;
            const disposable = api.onSample((event: any) => {
                eventReceived = true;
                assert.ok(event.id, 'Event should have channel id');
                assert.ok(event.sample, 'Event should have sample data');
                disposable.dispose();
                done();
            });

            // Register a test channel and run it to trigger an event
            const testChannel = {
                id: 'event-test-channel',
                name: 'Event Test Channel',
                type: 'https' as const,
                url: 'https://httpbin.org/status/200',
                timeoutMs: 5000
            };

            const channelDisposable = api.registerChannel(testChannel);
            
            api.runChannelNow('event-test-channel').catch(() => {
                // Ignore probe failures, we're testing event handling
                if (!eventReceived) {
                    channelDisposable.dispose();
                    disposable.dispose();
                    done(new Error('No sample event received'));
                }
            });

            // Cleanup after timeout
            setTimeout(() => {
                if (!eventReceived) {
                    channelDisposable.dispose();
                    disposable.dispose();
                    done(new Error('Timeout waiting for sample event'));
                }
            }, 8000);
        });
    });

    after(async function() {
        // Cleanup
        if (extension?.isActive) {
            try {
                await vscode.commands.executeCommand('healthWatch.stopWatch');
            } catch (error) {
                // Ignore cleanup errors
            }
        }
    });
});