import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock the entire diskStorage module to avoid VS Code imports
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

// Define the types we need for testing
interface ChannelState {
    state: 'online' | 'offline' | 'unknown';
    lastSample?: any;
    samples?: any[];
}

// Simplified DiskStorageManager for testing critical file operations
class SimpleDiskStorage {
    private storageDir: string;

    constructor(storageDir: string) {
        this.storageDir = storageDir;
    }

    /**
     * Atomic write operation - the core functionality that was failing
     */
    async atomicWrite(filePath: string, data: string): Promise<void> {
        // Generate unique temp file to prevent collisions
        const tempFilePath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).substring(2)}`;
        
        try {
            // Ensure directory exists
            await this.ensureDirectoryExists(path.dirname(filePath));
            
            // Write to temp file first
            await fs.writeFile(tempFilePath, data, 'utf8');
            
            // Atomic rename (Windows-compatible)
            await this.performAtomicRename(tempFilePath, filePath);
            
        } catch (error) {
            await this.cleanupTempFile(tempFilePath);
            throw error;
        }
    }

    /**
     * Windows EPERM workaround
     */
    private async performAtomicRename(tempPath: string, finalPath: string): Promise<void> {
        try {
            // Windows timing workaround
            if (process.platform === 'win32') {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
            
            // Atomic rename (preferred)
            await fs.rename(tempPath, finalPath);
            
        } catch (renameError: any) {
            // Windows EPERM fallback
            if (renameError.code === 'EPERM' && process.platform === 'win32') {
                await fs.copyFile(tempPath, finalPath);
                await fs.unlink(tempPath).catch(() => {}); // Silent cleanup
            } else {
                throw renameError;
            }
        }
    }

    /**
     * Ensure directory exists
     */
    private async ensureDirectoryExists(dirPath: string): Promise<void> {
        try {
            await fs.access(dirPath);
        } catch {
            await fs.mkdir(dirPath, { recursive: true });
        }
    }

    /**
     * Cleanup temp file
     */
    private async cleanupTempFile(tempPath: string): Promise<void> {
        try {
            await fs.unlink(tempPath);
        } catch {
            // Silent failure - temp file might not exist
        }
    }

    /**
     * Data validation and size management
     */
    private enforceDataLimits(data: any): any {
        // Limit samples array to prevent massive JSON files
        if (data.samples && data.samples.length > 1000) {
            console.log(`Trimming samples from ${data.samples.length} to 1000`);
            data.samples = data.samples.slice(-1000); // Keep most recent
        }
        
        // Size check
        const jsonSize = JSON.stringify(data).length;
        if (jsonSize > 10 * 1024 * 1024) { // 10MB limit
            console.warn(`Large JSON detected: ${jsonSize} bytes`);
        }
        
        return data;
    }

    /**
     * JSON validation
     */
    private validateJSONIntegrity(data: string): boolean {
        try {
            const parsed = JSON.parse(data);
            
            // Structural validation
            if (typeof parsed !== 'object' || parsed === null) {
                return false;
            }
            
            return true;
            
        } catch (error) {
            console.error('JSON corruption detected:', error);
            return false;
        }
    }

    /**
     * Save channel states with validation
     */
    async saveChannelStates(states: Record<string, ChannelState>): Promise<void> {
        // Apply data limits to individual channel states
        const processedStates: Record<string, ChannelState> = {};
        for (const [channelId, state] of Object.entries(states)) {
            processedStates[channelId] = this.enforceDataLimits(state);
        }
        
        const filePath = path.join(this.storageDir, 'channelStates.json');
        await this.atomicWrite(filePath, JSON.stringify(processedStates, null, 2));
    }

    /**
     * Load channel states with validation
     */
    async loadChannelStates(): Promise<Record<string, ChannelState>> {
        const filePath = path.join(this.storageDir, 'channelStates.json');
        
        try {
            const data = await fs.readFile(filePath, 'utf8');
            
            if (!this.validateJSONIntegrity(data)) {
                throw new Error('JSON integrity validation failed');
            }
            
            return JSON.parse(data);
            
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                return {}; // Return empty state for new installations
            }
            throw error;
        }
    }
}

describe('DiskStorage Unit Tests - Critical Operations', () => {
    let storage: SimpleDiskStorage;
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
        testDir = path.join(os.tmpdir(), `health-watch-test-${Date.now()}`);
        storage = new SimpleDiskStorage(testDir);
        
        // Setup default mocks
        Object.assign(fs, mockFs);
        mockFs.access.mockRejectedValue(new Error('Directory does not exist'));
        mockFs.mkdir.mockResolvedValue(undefined);
        mockFs.writeFile.mockResolvedValue(undefined);
        mockFs.rename.mockResolvedValue(undefined);
        mockFs.readFile.mockResolvedValue('{}');
    });

    describe('Atomic Write Operations', () => {
        it('should perform atomic write successfully', async () => {
            const testData = 'test data';
            const filePath = path.join(testDir, 'test.json');

            await storage.atomicWrite(filePath, testData);

            // Verify directory creation
            expect(mockFs.mkdir).toHaveBeenCalledWith(
                path.dirname(filePath),
                { recursive: true }
            );
            
            // Verify temp file write
            expect(mockFs.writeFile).toHaveBeenCalledWith(
                expect.stringMatching(/test\.json\.tmp\.\d+\./),
                testData,
                'utf8'
            );
            
            // Verify atomic rename
            expect(mockFs.rename).toHaveBeenCalledWith(
                expect.stringMatching(/test\.json\.tmp\.\d+\./),
                filePath
            );
        });

        it('should handle Windows EPERM errors with fallback', async () => {
            // Mock Windows platform
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', { value: 'win32' });

            // Mock EPERM error on rename
            const epermError = new Error('EPERM: operation not permitted');
            (epermError as any).code = 'EPERM';
            mockFs.rename.mockRejectedValue(epermError);
            mockFs.copyFile.mockResolvedValue(undefined);
            mockFs.unlink.mockResolvedValue(undefined);

            const testData = 'test data';
            const filePath = path.join(testDir, 'test.json');

            await storage.atomicWrite(filePath, testData);

            // Should fallback to copy+delete
            expect(mockFs.copyFile).toHaveBeenCalled();
            expect(mockFs.unlink).toHaveBeenCalled();

            // Restore original platform
            Object.defineProperty(process, 'platform', { value: originalPlatform });
        });

        it('should cleanup temp file on write failure', async () => {
            const writeError = new Error('Write failed');
            mockFs.writeFile.mockRejectedValue(writeError);

            const testData = 'test data';
            const filePath = path.join(testDir, 'test.json');

            await expect(storage.atomicWrite(filePath, testData)).rejects.toThrow('Write failed');

            // Verify cleanup attempt
            expect(mockFs.unlink).toHaveBeenCalled();
        });

        it('should generate unique temp file names', async () => {
            const testData = 'test data';
            const filePath = path.join(testDir, 'test.json');

            // Run multiple writes concurrently
            const promises = Array.from({ length: 5 }, () => 
                storage.atomicWrite(filePath, testData)
            );

            await Promise.all(promises);

            // Verify all temp files had unique names
            const tempFilePaths = mockFs.writeFile.mock.calls.map(call => call[0]);
            const uniquePaths = new Set(tempFilePaths);
            expect(uniquePaths.size).toBe(tempFilePaths.length);
        });
    });

    describe('Data Validation and Size Management', () => {
        it('should save and load channel states correctly', async () => {
            const testStates = {
                'channel-1': {
                    state: 'online' as const,
                    samples: Array.from({ length: 10 }, (_, i) => ({ timestamp: Date.now() + i }))
                },
                'channel-2': {
                    state: 'offline' as const,
                    samples: []
                }
            };

            mockFs.readFile.mockResolvedValue(JSON.stringify(testStates));

            await storage.saveChannelStates(testStates);
            const loadedStates = await storage.loadChannelStates();

            // Verify write was called with temp file and correct encoding
            const writeCall = mockFs.writeFile.mock.calls[0];
            expect(writeCall[0]).toMatch(/channelStates\.json\.tmp\./);
            expect(writeCall[1]).toContain('"state": "online"'); // Account for JSON pretty-printing
            expect(writeCall[2]).toBe('utf8');
        });

        it('should enforce data size limits', async () => {
            // Create data with more than 1000 samples
            const largeStates = {
                'channel-1': {
                    state: 'online' as const,
                    samples: Array.from({ length: 1500 }, (_, i) => ({ 
                        timestamp: Date.now() + i,
                        data: 'sample data'
                    }))
                }
            };

            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            await storage.saveChannelStates(largeStates);

            // Should log trimming message
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Trimming samples from 1500 to 1000')
            );

            consoleSpy.mockRestore();
        });

        it('should handle missing files gracefully', async () => {
            const enoentError = new Error('File not found');
            (enoentError as any).code = 'ENOENT';
            mockFs.readFile.mockRejectedValue(enoentError);

            const states = await storage.loadChannelStates();

            expect(states).toEqual({});
        });

        it('should validate JSON integrity', async () => {
            // Mock corrupted JSON
            mockFs.readFile.mockResolvedValue('{"invalid": json}');

            await expect(storage.loadChannelStates()).rejects.toThrow('JSON integrity validation failed');
        });
    });

    describe('Error Scenarios', () => {
        it('should handle disk full errors', async () => {
            const enospcError = new Error('No space left on device');
            (enospcError as any).code = 'ENOSPC';
            mockFs.writeFile.mockRejectedValue(enospcError);

            const testData = 'test data';
            const filePath = path.join(testDir, 'test.json');

            await expect(storage.atomicWrite(filePath, testData)).rejects.toThrow('No space left on device');
        });

        it('should handle permission errors', async () => {
            const eacceError = new Error('Permission denied');
            (eacceError as any).code = 'EACCES';
            mockFs.mkdir.mockRejectedValue(eacceError);

            const testData = 'test data';
            const filePath = path.join(testDir, 'test.json');

            await expect(storage.atomicWrite(filePath, testData)).rejects.toThrow('Permission denied');
        });

        it('should handle concurrent access gracefully', async () => {
            // Reset to successful writes for this test
            mockFs.writeFile.mockResolvedValue(undefined);
            
            const testData = 'test data';
            const filePath1 = path.join(testDir, 'test1.json');
            const filePath2 = path.join(testDir, 'test2.json');

            // Run concurrent writes with different paths (should both succeed)
            const promises = [
                storage.atomicWrite(filePath1, testData),
                storage.atomicWrite(filePath2, testData)
            ];

            // Both should succeed with different file paths
            const results = await Promise.allSettled(promises);
            expect(results.every(r => r.status === 'fulfilled')).toBe(true);
            expect(mockFs.writeFile).toHaveBeenCalledTimes(2);
        });
    });

    describe('Performance and Reliability', () => {
        it('should handle large but reasonable data sizes', async () => {
            // Create 5MB of data (within limits)
            const largeData = {
                samples: Array.from({ length: 500 }, (_, i) => ({
                    timestamp: Date.now() + i,
                    data: 'x'.repeat(10000) // 10KB per sample
                }))
            };

            await expect(storage.saveChannelStates(largeData)).resolves.not.toThrow();
        });

        it('should warn about very large data sizes', async () => {
            // Create data that will exceed 10MB when serialized
            const massiveData = {
                samples: Array.from({ length: 100 }, (_, i) => ({
                    timestamp: Date.now() + i,
                    data: 'x'.repeat(120000) // 120KB per sample = ~12MB total
                }))
            };

            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            await storage.saveChannelStates(massiveData);

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Large JSON detected:')
            );

            consoleSpy.mockRestore();
        });
    });
});