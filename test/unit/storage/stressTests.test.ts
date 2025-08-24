import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock the entire fs module for stress testing
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
            copyFile: vi.fn(),
            rename: vi.fn(),
            stat: vi.fn()
        },
        existsSync: vi.fn(),
        mkdirSync: vi.fn()
    };
});

// Define the types we need for stress testing
interface ChannelState {
    state: 'online' | 'offline' | 'unknown';
    lastSample?: any;
    samples?: any[];
    totalChecks?: number;
    consecutiveFailures?: number;
}

// Simplified DiskStorage for stress testing
class StressDiskStorage {
    private storageDir: string;

    constructor(storageDir: string) {
        this.storageDir = storageDir;
    }

    async atomicWrite(filePath: string, data: string): Promise<void> {
        const tempFilePath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).substring(2)}`;
        
        try {
            await this.ensureDirectoryExists(path.dirname(filePath));
            await fs.writeFile(tempFilePath, data, 'utf8');
            await this.performAtomicRename(tempFilePath, filePath);
        } catch (error) {
            await this.cleanupTempFile(tempFilePath);
            throw error;
        }
    }

    private async performAtomicRename(tempPath: string, finalPath: string): Promise<void> {
        try {
            if (process.platform === 'win32') {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
            await fs.rename(tempPath, finalPath);
        } catch (renameError: any) {
            if (renameError.code === 'EPERM' && process.platform === 'win32') {
                await fs.copyFile(tempPath, finalPath);
                await fs.unlink(tempPath).catch(() => {});
            } else {
                throw renameError;
            }
        }
    }

    private async ensureDirectoryExists(dirPath: string): Promise<void> {
        try {
            await fs.access(dirPath);
        } catch {
            await fs.mkdir(dirPath, { recursive: true });
        }
    }

    private async cleanupTempFile(tempPath: string): Promise<void> {
        try {
            await fs.unlink(tempPath);
        } catch {
            // Silent failure - temp file might not exist
        }
    }

    private enforceDataLimits(data: any): any {
        // Limit samples array to prevent massive JSON files
        if (data.samples && data.samples.length > 1000) {
            console.log(`Trimming samples from ${data.samples.length} to 1000`);
            data.samples = data.samples.slice(-1000);
        }
        
        // For stress testing, actually check JSON size in all scenarios
        try {
            const jsonSize = JSON.stringify(data).length;
            if (jsonSize > 10 * 1024 * 1024) { // 10MB limit
                console.warn(`Large JSON detected: ${jsonSize} bytes`);
            }
        } catch (error) {
            // If JSON.stringify fails due to circular refs or other issues
            console.warn('Large JSON detected: unable to calculate size due to complexity');
        }
        
        return data;
    }

    async saveChannelStates(states: Record<string, ChannelState>): Promise<void> {
        const processedStates: Record<string, ChannelState> = {};
        for (const [channelId, state] of Object.entries(states)) {
            processedStates[channelId] = this.enforceDataLimits(state);
        }
        
        // Also check overall JSON size for stress testing
        const jsonData = JSON.stringify(processedStates, null, 2);
        const jsonSize = jsonData.length;
        if (jsonSize > 10 * 1024 * 1024) { // 10MB limit
            console.warn(`Large JSON detected: ${jsonSize} bytes`);
        }
        
        const filePath = path.join(this.storageDir, 'channelStates.json');
        await this.atomicWrite(filePath, jsonData);
    }

    async loadChannelStates(): Promise<Record<string, ChannelState>> {
        const filePath = path.join(this.storageDir, 'channelStates.json');
        
        try {
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                return {};
            }
            throw error;
        }
    }
}

describe('DiskStorage Stress Tests - Large Data Volumes', () => {
    let storage: StressDiskStorage;
    let testDir: string;
    
    const mockFs = {
        writeFile: vi.fn(),
        readFile: vi.fn(),
        mkdir: vi.fn(),
        access: vi.fn(),
        unlink: vi.fn(),
        copyFile: vi.fn(),
        rename: vi.fn(),
        stat: vi.fn()
    };

    beforeEach(() => {
        vi.clearAllMocks();
        testDir = path.join(os.tmpdir(), `stress-test-${Date.now()}`);
        storage = new StressDiskStorage(testDir);
        
        // Setup default mocks
        Object.assign(fs, mockFs);
        mockFs.access.mockRejectedValue(new Error('Directory does not exist'));
        mockFs.mkdir.mockResolvedValue(undefined);
        mockFs.writeFile.mockResolvedValue(undefined);
        mockFs.rename.mockResolvedValue(undefined);
        mockFs.readFile.mockResolvedValue('{}');
    });

    describe('High Volume Channel Data', () => {
        it('should handle 100 channels with massive sample histories', async () => {
            const channelStates: Record<string, ChannelState> = {};
            
            // Create 100 channels with 2000 samples each (should trigger trimming)
            for (let i = 0; i < 100; i++) {
                channelStates[`channel-${i}`] = {
                    state: i % 3 === 0 ? 'online' : i % 3 === 1 ? 'offline' : 'unknown',
                    totalChecks: 5000 + i,
                    consecutiveFailures: i % 10,
                    samples: Array.from({ length: 2000 }, (_, j) => ({
                        timestamp: Date.now() - (2000 - j) * 60000, // Past 2000 minutes
                        ok: Math.random() > 0.1, // 90% success rate
                        latencyMs: Math.floor(Math.random() * 500) + 50,
                        reason: Math.random() > 0.9 ? 'timeout' : undefined,
                        note: `Large sample note with lots of text to increase JSON size: ${j} ${'x'.repeat(100)}` // Make each sample larger
                    }))
                };
            }

            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            await storage.saveChannelStates(channelStates);

            // Should trigger sample trimming for all channels
            expect(consoleSpy).toHaveBeenCalledTimes(100);
            expect(consoleSpy).toHaveBeenCalledWith('Trimming samples from 2000 to 1000');
            
            // Should warn about large JSON size (100 channels * 1000 samples * ~150 bytes = ~15MB)
            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('Large JSON detected:')
            );

            consoleSpy.mockRestore();
            warnSpy.mockRestore();
        });

        it('should handle extremely long individual sample histories', async () => {
            // Create a single channel with 10,000 samples (extreme case)
            const megaChannel = {
                'mega-channel': {
                    state: 'online' as const,
                    totalChecks: 10000,
                    consecutiveFailures: 0,
                    samples: Array.from({ length: 10000 }, (_, i) => ({
                        timestamp: Date.now() - (10000 - i) * 30000, // Past 5 days at 30s intervals
                        ok: Math.random() > 0.05, // 95% success rate
                        latencyMs: Math.floor(Math.random() * 1000) + 20,
                        code: Math.random() > 0.1 ? 200 : 500,
                        reason: Math.random() > 0.95 ? ['timeout', 'dns', 'tcp', 'http'][Math.floor(Math.random() * 4)] : undefined,
                        note: Math.random() > 0.8 ? `Debug info ${i}` : undefined
                    }))
                }
            };

            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            await storage.saveChannelStates(megaChannel);

            // Should trim from 10,000 to 1,000 samples
            expect(consoleSpy).toHaveBeenCalledWith('Trimming samples from 10000 to 1000');

            consoleSpy.mockRestore();
        });

        it('should handle concurrent high-volume operations', async () => {
            // Simulate 50 concurrent write operations with large datasets
            const operations: Promise<void>[] = [];
            
            for (let op = 0; op < 50; op++) {
                const operationData: Record<string, ChannelState> = {};
                
                // Each operation writes 10 channels with 500 samples
                for (let ch = 0; ch < 10; ch++) {
                    operationData[`op${op}-ch${ch}`] = {
                        state: 'online',
                        samples: Array.from({ length: 500 }, (_, i) => ({
                            timestamp: Date.now() - i * 60000,
                            ok: Math.random() > 0.2,
                            latencyMs: Math.floor(Math.random() * 300) + 10
                        }))
                    };
                }
                
                operations.push(storage.saveChannelStates(operationData));
            }

            // All operations should complete successfully
            const results = await Promise.allSettled(operations);
            const successful = results.filter(r => r.status === 'fulfilled').length;
            
            expect(successful).toBe(50);
            expect(mockFs.writeFile).toHaveBeenCalledTimes(50);
        });
    });

    describe('Memory and Performance Stress', () => {
        it('should handle massive JSON serialization/deserialization', async () => {
            // Create data structure that will be ~50MB when serialized
            const massiveStates: Record<string, ChannelState> = {};
            
            // 500 channels with 1000 samples each, plus large metadata
            for (let i = 0; i < 500; i++) {
                massiveStates[`performance-channel-${i}`] = {
                    state: 'online',
                    totalChecks: 100000 + i,
                    consecutiveFailures: 0,
                    samples: Array.from({ length: 1000 }, (_, j) => ({
                        timestamp: Date.now() - j * 30000,
                        ok: Math.random() > 0.1,
                        latencyMs: Math.floor(Math.random() * 2000) + 5,
                        code: [200, 301, 404, 500][Math.floor(Math.random() * 4)],
                        reason: Math.random() > 0.7 ? 'timeout' : undefined,
                        note: `Detailed performance data for sample ${j} on channel ${i} with extended metadata to increase payload size`
                    }))
                };
            }

            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            // This should complete without crashing but warn about size
            await expect(storage.saveChannelStates(massiveStates)).resolves.not.toThrow();
            
            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('Large JSON detected:')
            );

            warnSpy.mockRestore();
        });

        it('should handle rapid successive large writes', async () => {
            const rapidWrites: Promise<void>[] = [];
            
            // 20 rapid successive writes, each with substantial data
            for (let batch = 0; batch < 20; batch++) {
                const batchData: Record<string, ChannelState> = {};
                
                // Each batch has 25 channels with 800 samples
                for (let ch = 0; ch < 25; ch++) {
                    batchData[`rapid-batch${batch}-ch${ch}`] = {
                        state: batch % 2 === 0 ? 'online' : 'offline',
                        totalChecks: 1000 * batch + ch,
                        consecutiveFailures: batch % 5,
                        samples: Array.from({ length: 800 }, (_, s) => ({
                            timestamp: Date.now() - s * 45000, // 45-second intervals
                            ok: Math.random() > 0.15,
                            latencyMs: Math.floor(Math.random() * 800) + 25,
                            code: Math.random() > 0.2 ? 200 : 503,
                            reason: Math.random() > 0.85 ? 'dns' : undefined
                        }))
                    };
                }
                
                rapidWrites.push(storage.saveChannelStates(batchData));
            }

            // Measure performance by checking completion time
            const startTime = Date.now();
            const results = await Promise.allSettled(rapidWrites);
            const duration = Date.now() - startTime;

            const successful = results.filter(r => r.status === 'fulfilled').length;
            
            expect(successful).toBe(20);
            expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
            expect(mockFs.writeFile).toHaveBeenCalledTimes(20);
        });
    });

    describe('Data Integrity Under Stress', () => {
        it('should maintain unique temp files under high concurrency', async () => {
            // Launch 100 concurrent operations to test temp file name collisions
            const concurrentOps: Promise<void>[] = [];
            
            for (let i = 0; i < 100; i++) {
                const data = {
                    [`concurrent-${i}`]: {
                        state: 'online' as const,
                        samples: Array.from({ length: 50 }, (_, j) => ({
                            timestamp: Date.now() - j * 1000,
                            ok: true,
                            latencyMs: 100
                        }))
                    }
                };
                
                concurrentOps.push(storage.saveChannelStates(data));
            }

            await Promise.all(concurrentOps);

            // Verify all temp file names were unique
            const writeFileCalls = mockFs.writeFile.mock.calls;
            const tempFilePaths = writeFileCalls.map(call => call[0]);
            const uniquePaths = new Set(tempFilePaths);
            
            expect(uniquePaths.size).toBe(tempFilePaths.length);
            expect(writeFileCalls.length).toBe(100);
        });

        it('should handle stress with mixed success/failure scenarios', async () => {
            let writeCallCount = 0;
            
            // Simulate random failures during high-volume operations
            mockFs.writeFile.mockImplementation(() => {
                writeCallCount++;
                // Fail every 7th write operation
                if (writeCallCount % 7 === 0) {
                    return Promise.reject(new Error('Simulated write failure'));
                }
                return Promise.resolve(undefined);
            });

            const operations: Promise<void>[] = [];
            const successes: boolean[] = [];
            
            // Try 30 operations with potential failures
            for (let i = 0; i < 30; i++) {
                const data = {
                    [`stress-test-${i}`]: {
                        state: 'online' as const,
                        samples: Array.from({ length: 200 }, (_, j) => ({
                            timestamp: Date.now() - j * 5000,
                            ok: Math.random() > 0.2,
                            latencyMs: Math.floor(Math.random() * 400) + 50
                        }))
                    }
                };
                
                operations.push(
                    storage.saveChannelStates(data)
                        .then(() => { successes.push(true); })
                        .catch(() => { successes.push(false); })
                );
            }

            await Promise.all(operations);

            const successCount = successes.filter(s => s).length;
            const failureCount = successes.filter(s => !s).length;

            // Should have some successes and some failures
            expect(successCount).toBeGreaterThan(0);
            expect(failureCount).toBeGreaterThan(0);
            expect(successCount + failureCount).toBe(30);
            
            // Verify cleanup was attempted for failures
            expect(mockFs.unlink).toHaveBeenCalledTimes(failureCount);
        });
    });

    describe('Edge Cases and Limits', () => {
        it('should handle channels with extremely diverse sample structures', async () => {
            // Create channels with varied sample structures to test serialization robustness
            const diverseChannels: Record<string, ChannelState> = {
                'minimal-samples': {
                    state: 'online',
                    samples: [{ timestamp: Date.now(), ok: true }]
                },
                'maximal-samples': {
                    state: 'offline',
                    samples: Array.from({ length: 500 }, (_, i) => ({
                        timestamp: Date.now() - i * 10000,
                        ok: Math.random() > 0.3,
                        latencyMs: Math.floor(Math.random() * 5000) + 1,
                        code: [200, 201, 301, 400, 401, 403, 404, 500, 502, 503, 504][Math.floor(Math.random() * 11)],
                        reason: ['timeout', 'dns', 'tcp', 'tls', 'http', 'script'][Math.floor(Math.random() * 6)],
                        note: `Complex note with special chars: <>?:"{}|~!@#$%^&*()_+äöü${i}`,
                        metadata: {
                            retryCount: Math.floor(Math.random() * 5),
                            sourceIP: `192.168.1.${i % 255}`,
                            headers: { 'x-test': `value-${i}` }
                        }
                    }))
                },
                'unicode-heavy': {
                    state: 'unknown',
                    samples: Array.from({ length: 100 }, (_, i) => ({
                        timestamp: Date.now() - i * 60000,
                        ok: i % 2 === 0,
                        note: `测试数据 ${i} 🚀 ñoñó español русский 日本語 العربية`
                    }))
                }
            };

            await expect(storage.saveChannelStates(diverseChannels)).resolves.not.toThrow();
        });

        it('should handle pathological data patterns', async () => {
            // Test with deeply nested objects and circular-reference-like patterns
            const pathologicalData: Record<string, ChannelState> = {};
            
            for (let i = 0; i < 50; i++) {
                pathologicalData[`pathological-${i}`] = {
                    state: 'online',
                    samples: Array.from({ length: 300 }, (_, j) => {
                        const sample: any = {
                            timestamp: Date.now() - j * 15000,
                            ok: true,
                            latencyMs: 150
                        };
                        
                        // Add nested complexity
                        sample.nested = {
                            level1: {
                                level2: {
                                    level3: {
                                        data: `Deep data ${i}-${j}`,
                                        array: Array.from({ length: 10 }, (_, k) => ({ id: k, value: k * j }))
                                    }
                                }
                            }
                        };
                        
                        return sample;
                    })
                };
            }

            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            await expect(storage.saveChannelStates(pathologicalData)).resolves.not.toThrow();
            
            // Should warn about large size due to nested complexity
            expect(warnSpy).toHaveBeenCalled();

            warnSpy.mockRestore();
        });
    });
});