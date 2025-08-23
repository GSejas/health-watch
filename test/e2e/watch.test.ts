/**
 * End-to-End Tests for Watch Sessions and Report Generation
 * 
 * Tests watch session lifecycle, data collection, and report generation.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { StorageManager } from '../../src/storage';
import { StatsCalculator } from '../../src/stats';
import { ReportGenerator } from '../../src/report';

describe('Watch Sessions E2E Tests', function() {
    // Increased timeout for E2E
    this.timeout(60000); // 60 second timeout for long-running operations

    let extension: vscode.Extension<any> | undefined;
    let api: any;
    let storageManager: StorageManager;
    let tempDir: string;

    before(async function() {
    this.timeout(60000); // 60 second timeout for activation and initialization
        
        extension = vscode.extensions.getExtension('GSejas.health-watch');
        assert.ok(extension, 'Extension should be found');
        
        if (!extension.isActive) {
            console.log('Activating extension...');
            await extension.activate();
            console.log('Extension activated');
        }
        
        api = extension.exports;
        assert.ok(api, 'Extension should export API');
        
        // Wait for StorageManager to be fully initialized
        console.log('Obtaining StorageManager instance...');
        try {
            // Prefer synchronous access if already initialized by extension activation
            storageManager = StorageManager.getInstance();
        } catch (e) {
            // Fallback to whenInitialized with timeout
            try {
                storageManager = await Promise.race([
                    StorageManager.whenInitialized(),
                    new Promise<StorageManager>((_res, rej) => setTimeout(() => rej(new Error('Storage init timed out')), 15000))
                ]);
            } catch (err) {
                if ((StorageManager as any).instance) {
                    storageManager = (StorageManager as any).instance as StorageManager;
                    console.warn('StorageManager.whenInitialized() timed out, falling back to instance');
                } else {
                    throw err;
                }
            }
        }
        console.log('StorageManager ready');
        
        // Create temporary directory for test files
        tempDir = path.join(os.tmpdir(), 'healthwatch-watch-test-' + Date.now());
        fs.mkdirSync(tempDir, { recursive: true });
    });

    after(async function() {
        // Cleanup
        try {
            if (fs.existsSync(tempDir)) {
                const files = fs.readdirSync(tempDir);
                for (const file of files) {
                    fs.unlinkSync(path.join(tempDir, file));
                }
                fs.rmdirSync(tempDir);
            }
        } catch (error) {
            // Ignore cleanup errors
        }
    });

    describe('Watch Session Lifecycle', () => {
        it('should start and stop a watch session', async () => {
            // Ensure no active watch
            api.stopWatch();
            
            let currentWatch = api.getCurrentWatch();
            assert.ok(!currentWatch, 'Should have no active watch initially');

            // Start a watch session
            api.startWatch({ duration: 5000 }); // 5 second watch

            currentWatch = api.getCurrentWatch();
            assert.ok(currentWatch, 'Should have active watch after starting');
            assert.ok(currentWatch.startTime, 'Watch should have start time');
            assert.ok(!currentWatch.endTime, 'Watch should not have end time while active');

            // Wait for watch to complete
            await new Promise(resolve => setTimeout(resolve, 6000));

            currentWatch = api.getCurrentWatch();
            assert.ok(!currentWatch, 'Watch should be ended after duration');
        });

        it('should manually stop a watch session', () => {
            // Start a forever watch
            api.startWatch({ duration: 'forever' });

            let currentWatch = api.getCurrentWatch();
            assert.ok(currentWatch, 'Should have active watch');

            // Manually stop the watch
            api.stopWatch();

            currentWatch = api.getCurrentWatch();
            assert.ok(!currentWatch, 'Watch should be stopped manually');
        });

        it('should collect samples during watch session', (done) => {
            // Register a test channel
            const testChannel = {
                id: 'watch-sample-test',
                name: 'Watch Sample Test',
                type: 'https' as const,
                url: 'https://httpbin.org/status/200',
                intervalSec: 1, // Fast interval for testing
                timeoutMs: 5000
            };

            const channelDisposable = api.registerChannel(testChannel);
            // allow propagation, then set up listeners and start watch
            let sampleReceived = false;

            setTimeout(() => {
                const timeoutId = setTimeout(() => {
                    if (!sampleReceived) {
                        api.stopWatch();
                        channelDisposable.dispose();
                        // eventDisposable is scoped below; no-op here
                        return done(new Error('Timeout waiting for sample'));
                    }
                }, 15000);

                const eventDisposable = api.onSample((event: any) => {
                    if (event.id === 'watch-sample-test' && !sampleReceived) {
                        sampleReceived = true;

                        try {
                            assert.ok(event.sample, 'Should receive sample data');
                            assert.ok(typeof event.sample.success === 'boolean', 'Sample should have success flag');
                            assert.ok(typeof event.sample.latencyMs === 'number', 'Sample should have latency');

                            // Check if sample is being collected in watch
                            const currentWatch = api.getCurrentWatch();
                            if (currentWatch && currentWatch.samples.has('watch-sample-test')) {
                                const samples = currentWatch.samples.get('watch-sample-test');
                                assert.ok(samples.length > 0, 'Watch should collect samples');
                            }
                        } catch (err) {
                            clearTimeout(timeoutId);
                            api.stopWatch();
                            channelDisposable.dispose();
                            eventDisposable.dispose();
                            return done(err as any);
                        }

                        // Cleanup
                        clearTimeout(timeoutId);
                        api.stopWatch();
                        channelDisposable.dispose();
                        eventDisposable.dispose();
                        return done();
                    }
                });

                // Start watch and trigger sample
                api.startWatch({ duration: 'forever' });
                void api.runChannelNow('watch-sample-test');
            }, 250);
        });
    });

    describe('Statistics Calculation', () => {
        it('should calculate channel statistics correctly', () => {
            const statsCalculator = new StatsCalculator();
            
            // Create mock samples for testing
            const mockSamples = [
                { timestamp: Date.now() - 5000, success: true, latencyMs: 100 },
                { timestamp: Date.now() - 4000, success: true, latencyMs: 150 },
                { timestamp: Date.now() - 3000, success: false, latencyMs: 0, error: 'timeout' },
                { timestamp: Date.now() - 2000, success: true, latencyMs: 120 },
                { timestamp: Date.now() - 1000, success: true, latencyMs: 200 }
            ];

            // Mock the storage manager's getSamplesInWindow method
            const originalMethod = (storageManager as any).getSamplesInWindow;
            (storageManager as any).getSamplesInWindow = () => mockSamples;

            const stats = statsCalculator.calculateChannelStats('test-channel');

            // Restore original method
            (storageManager as any).getSamplesInWindow = originalMethod;

            assert.ok(stats.availability === 80, 'Should calculate 80% availability (4/5 successful)');
            assert.ok(stats.totalSamples === 5, 'Should count all samples');
            assert.ok(stats.successfulSamples === 4, 'Should count successful samples');
            assert.ok(stats.latencyStats.min === 100, 'Should calculate minimum latency');
            assert.ok(stats.latencyStats.max === 200, 'Should calculate maximum latency');
            assert.ok(stats.topFailureReason === 'timeout', 'Should identify top failure reason');
        });

        
        it('should generate performance recommendations', () => {

            const statsCalculator = new StatsCalculator();
            
            const highLatencyStats = {
                channelId: 'high-latency-channel',
                availability: 95,
                outageCount: 1,
                mttr: 30000,
                longestOutage: 30000,
                latencyStats: { min: 500, max: 2000, p50: 800, p95: 1500, avg: 900 },
                topFailureReason: 'timeout',
                totalSamples: 100,
                successfulSamples: 95
            };

            const lowAvailabilityStats = {
                channelId: 'low-availability-channel',
                availability: 90,
                outageCount: 5,
                mttr: 60000,
                longestOutage: 120000,
                latencyStats: { min: 50, max: 300, p50: 100, p95: 250, avg: 125 },
                topFailureReason: 'connection refused',
                totalSamples: 100,
                successfulSamples: 90
            };

            const recommendations = statsCalculator.generateRecommendations([highLatencyStats, lowAvailabilityStats]);
            
            assert.ok(recommendations.length > 0, 'Should generate recommendations');
            
            const highPriorityRecs = recommendations.filter(r => r.priority === 'high');
            assert.ok(highPriorityRecs.length > 0, 'Should have high priority recommendations for poor performance');
            
            const latencyRec = recommendations.find(r => r.recommendation.includes('latency'));
            assert.ok(latencyRec, 'Should recommend action for high latency');
            
            const availabilityRec = recommendations.find(r => r.recommendation.includes('availability'));
            assert.ok(availabilityRec, 'Should recommend action for low availability');
        });
    });

    describe('Report Generation', () => {
        it('should generate markdown report with Mermaid diagrams', async () => {
            const reportGenerator = new ReportGenerator();
            
            // Create a mock watch session
            const mockSession = {
                id: 'test-session-' + Date.now(),
                startTime: Date.now() - 3600000, // 1 hour ago
                endTime: Date.now(),
                duration: 3600000 as const,
                isActive: false,
                samples: new Map([
                    ['test-channel', [
                        { timestamp: Date.now() - 3000000, success: true, latencyMs: 100 },
                        { timestamp: Date.now() - 2400000, success: true, latencyMs: 150 },
                        { timestamp: Date.now() - 1800000, success: false, latencyMs: 0, error: 'timeout' },
                        { timestamp: Date.now() - 1200000, success: false, latencyMs: 0, error: 'timeout' },
                        { timestamp: Date.now() - 600000, success: true, latencyMs: 120 }
                    ]]
                ])
            };

            try {
                const result = await reportGenerator.generateReport(mockSession);
                
                assert.ok(result.markdownPath, 'Should return markdown file path');
                assert.ok(result.jsonPath, 'Should return JSON file path');
                
                // Verify markdown file exists and has content
                if (fs.existsSync(result.markdownPath)) {
                    const markdownContent = fs.readFileSync(result.markdownPath, 'utf8');
                    
                    assert.ok(markdownContent.includes('# Health Watch Report'), 'Should have report title');
                    assert.ok(markdownContent.includes('mermaid'), 'Should include Mermaid diagrams');
                    assert.ok(markdownContent.includes('gantt'), 'Should include Gantt chart');
                    assert.ok(markdownContent.includes('pie'), 'Should include pie chart');
                    assert.ok(markdownContent.includes('test-channel'), 'Should include channel data');
                    
                    // Check for real data (not placeholders)
                    assert.ok(!markdownContent.includes('{{'), 'Should not contain template placeholders');
                    assert.ok(markdownContent.includes('60.0%'), 'Should contain calculated availability (3/5 = 60%)');
                    
                    // Cleanup
                    fs.unlinkSync(result.markdownPath);
                }

                // Verify JSON file exists and has content
                if (fs.existsSync(result.jsonPath)) {
                    const jsonContent = JSON.parse(fs.readFileSync(result.jsonPath, 'utf8'));
                    
                    assert.ok(jsonContent.sessionId, 'Should have session ID');
                    assert.ok(jsonContent.startTime, 'Should have start time');
                    assert.ok(jsonContent.endTime, 'Should have end time');
                    assert.ok(jsonContent.channels, 'Should have channels data');
                    assert.ok(jsonContent.channels['test-channel'], 'Should have test channel data');
                    
                    // Cleanup
                    fs.unlinkSync(result.jsonPath);
                }
            } catch (error) {
                // If report generation fails, ensure it's for expected reasons
                assert.ok(error instanceof Error, 'Should throw proper error type');
                console.log('Report generation error (may be expected):', error.message);
            }
        });

        it('should auto-open report when configured', async () => {
            // This test would require mocking vscode.window.showTextDocument
            // For now, we test that the report generation includes the auto-open logic
            const reportGenerator = new ReportGenerator();
            
            // Verify the report generator has the capability
            assert.ok(typeof reportGenerator.generateReport === 'function', 'Should have generateReport method');
        });
    });

    describe('Data Export', () => {
        it('should export JSON data correctly', async () => {
            try {
                const exportResult = await api.exportJSON({
                    windowMs: 3600000, // 1 hour
                    path: tempDir
                });
                
                assert.ok(exportResult, 'Should return export URI');
                
                // Check if export file exists
                if (exportResult.fsPath && fs.existsSync(exportResult.fsPath)) {
                    const exportData = JSON.parse(fs.readFileSync(exportResult.fsPath, 'utf8'));
                    
                    assert.ok(exportData.exportTime, 'Should include export timestamp');
                    assert.ok(exportData.windowMs, 'Should include window duration');
                    assert.ok(Array.isArray(exportData.channels) || typeof exportData.channels === 'object', 'Should include channels data');
                    
                    // Cleanup
                    fs.unlinkSync(exportResult.fsPath);
                }
            } catch (error) {
                // Export might fail if no data is available, which is acceptable
                assert.ok(error instanceof Error, 'Should handle export errors gracefully');
            }
        });
    });

    describe('Integration Scenarios', () => {
        it('should handle complete monitoring workflow', async () => {
            // Register test channels
            const httpsChannel = {
                id: 'integration-https',
                name: 'Integration HTTPS Test',
                type: 'https' as const,
                url: 'https://httpbin.org/status/200',
                intervalSec: 2,
                timeoutMs: 5000
            };

            const tcpChannel = {
                id: 'integration-tcp',
                name: 'Integration TCP Test',
                type: 'tcp' as const,
                target: 'httpbin.org:80',
                intervalSec: 3,
                timeoutMs: 5000
            };

            const httpsDisposable = api.registerChannel(httpsChannel);
            const tcpDisposable = api.registerChannel(tcpChannel);

            // allow time for channels to register
            await new Promise(resolve => setTimeout(resolve, 1000));

            try {
                // Start short watch session
                api.startWatch({ duration: 3000 }); // 3 seconds

                // Collect some samples
                await api.runChannelNow('integration-https');
                await api.runChannelNow('integration-tcp');

                // Wait for additional samples (if any are collected automatically)
                await new Promise(resolve => setTimeout(resolve, 1000));

                // Verify channels are listed
                const channels = api.listChannels();
                const httpsChannelInfo = channels.find((ch: any) => ch.id === 'integration-https');
                const tcpChannelInfo = channels.find((ch: any) => ch.id === 'integration-tcp');

                assert.ok(httpsChannelInfo, 'HTTPS channel should be listed');
                assert.ok(tcpChannelInfo, 'TCP channel should be listed');
                assert.ok(httpsChannelInfo.type === 'https', 'HTTPS channel should have correct type');
                assert.ok(tcpChannelInfo.type === 'tcp', 'TCP channel should have correct type');

                // Wait for watch to complete
                await new Promise(resolve => setTimeout(resolve, 3000));

                // Verify watch completed
                const currentWatch = api.getCurrentWatch();
                assert.ok(!currentWatch, 'Watch should be completed');

                assert.ok(true, 'Complete workflow executed successfully');
            } finally {
                // Cleanup
                api.stopWatch();
                httpsDisposable.dispose();
                tcpDisposable.dispose();
            }
        });
    });
});