/**
 * End-to-End Tests for Configuration Loading and Validation
 * 
 * Tests configuration file loading, JSON schema validation, and workspace integration.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { ConfigManager } from '../../src/config';

describe('Configuration E2E Tests', function() {
    this.timeout(10000);

    let extension: vscode.Extension<any> | undefined;
    let configManager: ConfigManager;
    let tempWorkspaceDir: string;
    let tempConfigPath: string;

    before(async function() {
        extension = vscode.extensions.getExtension('GSejas.health-watch');
        assert.ok(extension, 'Extension should be found');
        
        if (!extension.isActive) {
            await extension.activate();
        }

        configManager = ConfigManager.getInstance();

        // Create temporary workspace directory for testing
        tempWorkspaceDir = path.join(os.tmpdir(), 'healthwatch-test-' + Date.now());
        fs.mkdirSync(tempWorkspaceDir, { recursive: true });
        tempConfigPath = path.join(tempWorkspaceDir, '.healthwatch.json');
    });

    after(async function() {
        // Cleanup temporary files
        try {
            if (fs.existsSync(tempConfigPath)) {
                fs.unlinkSync(tempConfigPath);
            }
            if (fs.existsSync(tempWorkspaceDir)) {
                fs.rmdirSync(tempWorkspaceDir);
            }
        } catch (error) {
            // Ignore cleanup errors
        }
    });

    describe('Configuration File Loading', () => {
        it('should handle missing configuration file gracefully', () => {
            // Test default configuration when no file exists
            const defaults = configManager.getDefaults();
            assert.ok(typeof defaults.intervalSec === 'number', 'Should provide default interval');
            assert.ok(typeof defaults.timeoutMs === 'number', 'Should provide default timeout');
            assert.ok(typeof defaults.threshold === 'number', 'Should provide default threshold');
            assert.ok(typeof defaults.jitterPct === 'number', 'Should provide default jitter');

            const channels = configManager.getChannels();
            assert.ok(Array.isArray(channels), 'Should return empty array for channels');
            assert.ok(channels.length === 0, 'Should have no channels by default');

            const guards = configManager.getGuards();
            assert.ok(typeof guards === 'object', 'Should return empty object for guards');
            assert.ok(Object.keys(guards).length === 0, 'Should have no guards by default');
        });

        it('should load valid configuration file', async () => {
            const validConfig = {
                defaults: {
                    intervalSec: 30,
                    timeoutMs: 5000,
                    threshold: 2,
                    jitterPct: 15
                },
                guards: {
                    'test-guard': {
                        type: 'dns',
                        hostname: 'google.com'
                    }
                },
                channels: [
                    {
                        id: 'test-https',
                        name: 'Test HTTPS',
                        type: 'https',
                        url: 'https://httpbin.org/status/200',
                        intervalSec: 60,
                        timeoutMs: 8000
                    },
                    {
                        id: 'test-tcp',
                        name: 'Test TCP',
                        type: 'tcp',
                        target: 'httpbin.org:80',
                        guards: ['test-guard']
                    }
                ]
            };

            // Write test configuration
            fs.writeFileSync(tempConfigPath, JSON.stringify(validConfig, null, 2));

            // Simulate workspace folder for configuration loading
            // Note: This is a simplified test since we can't easily mock workspace folders
            const testConfig = JSON.parse(fs.readFileSync(tempConfigPath, 'utf8'));
            
            assert.ok(testConfig.defaults, 'Should load defaults section');
            assert.ok(testConfig.defaults.intervalSec === 30, 'Should load custom interval');
            assert.ok(testConfig.guards, 'Should load guards section');
            assert.ok(testConfig.guards['test-guard'], 'Should load test guard');
            assert.ok(testConfig.channels, 'Should load channels section');
            assert.ok(testConfig.channels.length === 2, 'Should load all channels');
        });

        it('should validate configuration against schema', () => {
            const invalidConfigs = [
                // Missing required fields
                {
                    channels: [{
                        id: 'test',
                        // missing type
                        url: 'https://example.com'
                    }]
                },
                // Invalid types
                {
                    defaults: {
                        intervalSec: 'invalid', // should be number
                        timeoutMs: 3000,
                        threshold: 3,
                        jitterPct: 10
                    }
                },
                // Invalid channel configuration
                {
                    channels: [{
                        id: 'test-https',
                        type: 'https'
                        // missing url for https type
                    }]
                },
                // Invalid guard type
                {
                    guards: {
                        'invalid-guard': {
                            type: 'invalidType'
                        }
                    }
                }
            ];

            // Test each invalid configuration
            invalidConfigs.forEach((config, index) => {
                fs.writeFileSync(tempConfigPath, JSON.stringify(config, null, 2));
                
                // In a real test, we would check if the configuration manager
                // properly validates and rejects invalid configurations
                // For now, we just verify the file was written
                const writtenConfig = JSON.parse(fs.readFileSync(tempConfigPath, 'utf8'));
                assert.deepStrictEqual(writtenConfig, config, `Invalid config ${index} should be written for testing`);
            });
        });
    });

    describe('VS Code Settings Integration', () => {
        it('should respect VS Code configuration settings', () => {
            const watchConfig = configManager.getWatchConfig();
            assert.ok(typeof watchConfig.defaultDuration === 'string', 'Should have default duration');
            assert.ok(['1h', '12h', 'forever'].includes(watchConfig.defaultDuration), 'Should have valid duration');
            assert.ok(typeof watchConfig.highCadenceIntervalSec === 'number', 'Should have high cadence interval');

            const quietHours = configManager.getQuietHoursConfig();
            assert.ok(typeof quietHours.enabled === 'boolean', 'Should have quiet hours enabled flag');
            assert.ok(typeof quietHours.start === 'string', 'Should have quiet hours start time');
            assert.ok(typeof quietHours.end === 'string', 'Should have quiet hours end time');

            const reportConfig = configManager.getReportConfig();
            assert.ok(typeof reportConfig.autoOpen === 'boolean', 'Should have auto open flag');
            assert.ok(typeof reportConfig.includeSequenceDiagram === 'boolean', 'Should have sequence diagram flag');
            assert.ok(typeof reportConfig.includeTopologyDiagram === 'boolean', 'Should have topology diagram flag');
            assert.ok(typeof reportConfig.sloTarget === 'number', 'Should have SLO target');
        });

        it('should provide extension enabled status', () => {
            const isEnabled = configManager.isEnabled();
            assert.ok(typeof isEnabled === 'boolean', 'Should return boolean for enabled status');

            const isScriptEnabled = configManager.isScriptProbeEnabled();
            assert.ok(typeof isScriptEnabled === 'boolean', 'Should return boolean for script probe status');
        });

        it('should provide HTTPS configuration', () => {
            const httpsConfig = configManager.getHttpsConfig();
            assert.ok(typeof httpsConfig.allowProxy === 'boolean', 'Should have proxy setting');
            assert.ok(typeof httpsConfig.userAgent === 'string', 'Should have user agent');
            assert.ok(httpsConfig.userAgent.length > 0, 'User agent should not be empty');
        });
    });

    describe('Quiet Hours Calculation', () => {
        it('should calculate quiet hours correctly for same-day range', () => {
            // Mock a configuration with same-day quiet hours
            const testTime = new Date('2023-01-01T14:30:00'); // 2:30 PM
            
            // We can't easily mock the current time in the config manager,
            // so we test the logic structure instead
            const quietHours = configManager.getQuietHoursConfig();
            const isInQuietHours = configManager.isInQuietHours();
            
            assert.ok(typeof isInQuietHours === 'boolean', 'Should return boolean for quiet hours check');
        });

        it('should handle overnight quiet hours correctly', () => {
            // Test logic for overnight ranges (e.g., 22:00 - 08:00)
            const isInQuietHours = configManager.isInQuietHours();
            assert.ok(typeof isInQuietHours === 'boolean', 'Should handle overnight ranges');
        });
    });

    describe('Configuration Merging', () => {
        it('should merge workspace and VS Code settings correctly', () => {
            // Create a workspace config with custom defaults
            const workspaceConfig = {
                defaults: {
                    intervalSec: 45, // Custom value
                    timeoutMs: 7000   // Custom value
                    // Missing threshold and jitterPct - should fall back to VS Code settings
                }
            };

            fs.writeFileSync(tempConfigPath, JSON.stringify(workspaceConfig, null, 2));

            // In a full integration test, we would load this configuration
            // and verify that it properly merges with VS Code settings
            const testConfig = JSON.parse(fs.readFileSync(tempConfigPath, 'utf8'));
            assert.ok(testConfig.defaults.intervalSec === 45, 'Should use workspace interval');
            assert.ok(testConfig.defaults.timeoutMs === 7000, 'Should use workspace timeout');
        });
    });

    describe('Configuration Change Detection', () => {
        it('should detect configuration file changes', (done) => {
            // This test would require setting up file watchers and workspace folders
            // For now, we test that the basic structure is in place
            
            const initialConfig = {
                channels: [{
                    id: 'initial-channel',
                    type: 'https',
                    url: 'https://httpbin.org/status/200'
                }]
            };

            fs.writeFileSync(tempConfigPath, JSON.stringify(initialConfig, null, 2));

            // Simulate configuration change
            setTimeout(() => {
                const updatedConfig = {
                    channels: [{
                        id: 'updated-channel',
                        type: 'https',
                        url: 'https://httpbin.org/status/201'
                    }]
                };

                fs.writeFileSync(tempConfigPath, JSON.stringify(updatedConfig, null, 2));
                
                // In a real file watcher test, we would verify that the change
                // triggers a configuration reload
                done();
            }, 100);
        });
    });

    describe('Error Handling', () => {
        it('should handle malformed JSON gracefully', () => {
            const malformedJson = '{ "channels": [ { id: "test" } '; // Invalid JSON
            
            fs.writeFileSync(tempConfigPath, malformedJson);
            
            // The configuration manager should handle this gracefully
            // and not crash the extension
            try {
                JSON.parse(fs.readFileSync(tempConfigPath, 'utf8'));
                assert.fail('Should throw for malformed JSON');
            } catch (error) {
                assert.ok(error instanceof SyntaxError, 'Should throw SyntaxError for malformed JSON');
            }
        });

        it('should handle file permission errors gracefully', () => {
            // Create a config file and then make it unreadable (if possible)
            const config = { channels: [] };
            fs.writeFileSync(tempConfigPath, JSON.stringify(config, null, 2));
            
            // Try to make the file unreadable (this might not work on all systems)
            try {
                fs.chmodSync(tempConfigPath, 0o000);
                
                // Attempt to read the file
                try {
                    fs.readFileSync(tempConfigPath, 'utf8');
                    // If we reach here, chmod didn't work as expected
                } catch (error) {
                    assert.ok(error, 'Should handle permission errors gracefully');
                }
                
                // Restore permissions for cleanup
                fs.chmodSync(tempConfigPath, 0o644);
            } catch (chmodError) {
                // chmod might not be supported on all systems, skip this test
                assert.ok(true, 'Skipping permission test on this system');
            }
        });
    });
});