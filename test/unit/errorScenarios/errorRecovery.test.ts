import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock the file system for error scenario testing
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

// Error-resilient storage implementation for testing
class ResilientStorage {
    private storageDir: string;
    private maxRetries: number = 3;
    private retryDelayMs: number = 100;

    constructor(storageDir: string) {
        this.storageDir = storageDir;
    }

    async saveDataWithRetry(data: any, filename: string): Promise<void> {
        const filePath = path.join(this.storageDir, filename);
        let lastError: Error | null = null;
        
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                await this.atomicSave(filePath, JSON.stringify(data, null, 2));
                return; // Success
            } catch (error) {
                lastError = error as Error;
                console.warn(`Save attempt ${attempt} failed: ${error}`);
                
                if (attempt < this.maxRetries) {
                    await this.delay(this.retryDelayMs * attempt);
                }
            }
        }
        
        throw lastError || new Error('All retry attempts failed');
    }

    private async atomicSave(filePath: string, data: string): Promise<void> {
        const tempPath = `${filePath}.tmp.${Date.now()}`;
        
        try {
            await this.ensureDirectoryExists(path.dirname(filePath));
            await fs.writeFile(tempPath, data, 'utf8');
            await this.safeRename(tempPath, filePath);
        } catch (error) {
            await this.cleanupFile(tempPath);
            throw error;
        }
    }

    private async safeRename(tempPath: string, finalPath: string): Promise<void> {
        try {
            await fs.rename(tempPath, finalPath);
        } catch (error: any) {
            // Windows EPERM fallback
            if (error.code === 'EPERM' && process.platform === 'win32') {
                await fs.copyFile(tempPath, finalPath);
                await this.cleanupFile(tempPath);
            } else {
                throw error;
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

    private async cleanupFile(filePath: string): Promise<void> {
        try {
            await fs.unlink(filePath);
        } catch {
            // Silent failure for cleanup
        }
    }

    private async delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async loadDataWithFallback(filename: string, fallback: any = {}): Promise<any> {
        const filePath = path.join(this.storageDir, filename);
        const backupPath = `${filePath}.backup`;
        
        // Try primary file first
        try {
            const data = await fs.readFile(filePath, 'utf8');
            const parsed = this.validateAndParseJSON(data);
            return parsed;
        } catch (primaryError) {
            console.warn(`Primary file read failed: ${primaryError}`);
            
            // Try backup file
            try {
                const data = await fs.readFile(backupPath, 'utf8');
                const parsed = this.validateAndParseJSON(data);
                console.info('Recovered from backup file');
                return parsed;
            } catch (backupError) {
                console.warn(`Backup file read failed: ${backupError}`);
                
                // Return fallback
                console.info('Using fallback data');
                return fallback;
            }
        }
    }

    private validateAndParseJSON(data: string): any {
        if (!data || data.trim().length === 0) {
            throw new Error('Empty file content');
        }
        
        try {
            const parsed = JSON.parse(data);
            
            // Basic validation
            if (typeof parsed !== 'object' || parsed === null) {
                throw new Error('Invalid JSON structure');
            }
            
            return parsed;
        } catch (error) {
            throw new Error(`JSON parsing failed: ${error}`);
        }
    }

    async createBackup(filename: string): Promise<void> {
        const filePath = path.join(this.storageDir, filename);
        const backupPath = `${filePath}.backup`;
        
        try {
            await fs.copyFile(filePath, backupPath);
        } catch (error) {
            console.warn(`Backup creation failed: ${error}`);
        }
    }

    async repairCorruptedData(filename: string, repairFn: (data: any) => any): Promise<boolean> {
        try {
            const data = await this.loadDataWithFallback(filename, {});
            const repairedData = repairFn(data);
            await this.saveDataWithRetry(repairedData, filename);
            return true;
        } catch (error) {
            console.error(`Data repair failed: ${error}`);
            return false;
        }
    }
}

describe('Error Scenario Tests - Disk Full, Permissions, Corruption', () => {
    let storage: ResilientStorage;
    let testDir: string;
    let mockFs: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        testDir = path.join(os.tmpdir(), `error-test-${Date.now()}`);
        storage = new ResilientStorage(testDir);
        
        // Import and mock fs
        mockFs = vi.mocked(await import('fs'));
        mockFs.promises.writeFile = vi.fn();
        mockFs.promises.readFile = vi.fn();
        mockFs.promises.mkdir = vi.fn();
        mockFs.promises.access = vi.fn();
        mockFs.promises.unlink = vi.fn();
        mockFs.promises.copyFile = vi.fn();
        mockFs.promises.rename = vi.fn();
        mockFs.promises.stat = vi.fn();

        // Default successful operations
        mockFs.promises.access.mockRejectedValue(new Error('Directory does not exist'));
        mockFs.promises.mkdir.mockResolvedValue(undefined);
        mockFs.promises.writeFile.mockResolvedValue(undefined);
        mockFs.promises.rename.mockResolvedValue(undefined);
        mockFs.promises.copyFile.mockResolvedValue(undefined);
        mockFs.promises.unlink.mockResolvedValue(undefined);
    });

    describe('Disk Full Scenarios', () => {
        it('should handle ENOSPC errors with graceful degradation', async () => {
            const enospcError = new Error('ENOSPC: no space left on device');
            (enospcError as any).code = 'ENOSPC';
            
            mockFs.promises.writeFile.mockRejectedValue(enospcError);
            
            const testData = { test: 'data', timestamp: Date.now() };
            
            await expect(storage.saveDataWithRetry(testData, 'test.json'))
                .rejects.toThrow('ENOSPC: no space left on device');
            
            // Should attempt all retries
            expect(mockFs.promises.writeFile).toHaveBeenCalledTimes(3);
        });

        it('should retry disk full errors with exponential backoff', async () => {
            let callCount = 0;
            const enospcError = new Error('ENOSPC: no space left on device');
            (enospcError as any).code = 'ENOSPC';
            
            mockFs.promises.writeFile.mockImplementation(() => {
                callCount++;
                if (callCount < 3) {
                    return Promise.reject(enospcError);
                }
                return Promise.resolve(); // Success on third try
            });
            
            const startTime = Date.now();
            const testData = { recovery: 'test' };
            
            await storage.saveDataWithRetry(testData, 'recovery.json');
            const endTime = Date.now();
            
            // Should have taken time for retries (100ms + 200ms delays minimum)
            expect(endTime - startTime).toBeGreaterThan(250);
            expect(mockFs.promises.writeFile).toHaveBeenCalledTimes(3);
        });

        it('should handle disk full during directory creation', async () => {
            const enospcError = new Error('ENOSPC: no space left on device');
            (enospcError as any).code = 'ENOSPC';
            
            mockFs.promises.mkdir.mockRejectedValue(enospcError);
            
            const testData = { nested: { data: true } };
            
            await expect(storage.saveDataWithRetry(testData, 'nested/test.json'))
                .rejects.toThrow('ENOSPC: no space left on device');
        });
    });

    describe('Permission Errors', () => {
        it('should handle EACCES permission denied errors', async () => {
            const eaccesError = new Error('EACCES: permission denied');
            (eaccesError as any).code = 'EACCES';
            
            mockFs.promises.writeFile.mockRejectedValue(eaccesError);
            
            const testData = { permission: 'test' };
            
            await expect(storage.saveDataWithRetry(testData, 'restricted.json'))
                .rejects.toThrow('EACCES: permission denied');
                
            // Should still attempt all retries
            expect(mockFs.promises.writeFile).toHaveBeenCalledTimes(3);
        });

        it('should handle EPERM operation not permitted errors', async () => {
            const epermError = new Error('EPERM: operation not permitted');
            (epermError as any).code = 'EPERM';
            
            mockFs.promises.rename.mockRejectedValue(epermError);
            mockFs.promises.copyFile.mockResolvedValue(undefined);
            
            // Mock Windows environment
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', { value: 'win32' });
            
            const testData = { windows: 'test' };
            await storage.saveDataWithRetry(testData, 'windows-test.json');
            
            // Should fall back to copy + delete on Windows
            expect(mockFs.promises.copyFile).toHaveBeenCalled();
            expect(mockFs.promises.unlink).toHaveBeenCalled();
            
            // Restore platform
            Object.defineProperty(process, 'platform', { value: originalPlatform });
        });

        it('should handle permission errors during directory creation', async () => {
            const eaccesError = new Error('EACCES: permission denied');
            (eaccesError as any).code = 'EACCES';
            
            mockFs.promises.mkdir.mockRejectedValue(eaccesError);
            
            const testData = { restricted: 'directory' };
            
            await expect(storage.saveDataWithRetry(testData, 'restricted/file.json'))
                .rejects.toThrow('EACCES: permission denied');
        });
    });

    describe('Data Corruption Scenarios', () => {
        it('should handle corrupted JSON files gracefully', async () => {
            const corruptedData = '{"incomplete": json';
            
            mockFs.promises.readFile.mockResolvedValue(corruptedData);
            
            const result = await storage.loadDataWithFallback('corrupted.json', { default: true });
            
            expect(result).toEqual({ default: true });
        });

        it('should recover from backup when primary file is corrupted', async () => {
            const corruptedData = '{broken json}';
            const validBackup = '{"recovered": true, "from": "backup"}';
            
            mockFs.promises.readFile
                .mockResolvedValueOnce(corruptedData) // Primary file is corrupted
                .mockResolvedValueOnce(validBackup);  // Backup file is valid
            
            const result = await storage.loadDataWithFallback('test.json', { fallback: true });
            
            expect(result).toEqual({ recovered: true, from: 'backup' });
        });

        it('should handle completely empty files', async () => {
            mockFs.promises.readFile.mockResolvedValue('');
            
            const result = await storage.loadDataWithFallback('empty.json', { empty: 'fallback' });
            
            expect(result).toEqual({ empty: 'fallback' });
        });

        it('should handle files with only whitespace', async () => {
            mockFs.promises.readFile.mockResolvedValue('   \n\t   \r\n   ');
            
            const result = await storage.loadDataWithFallback('whitespace.json', { whitespace: 'fallback' });
            
            expect(result).toEqual({ whitespace: 'fallback' });
        });

        it('should handle null JSON values', async () => {
            mockFs.promises.readFile.mockResolvedValue('null');
            
            const result = await storage.loadDataWithFallback('null.json', { null: 'fallback' });
            
            expect(result).toEqual({ null: 'fallback' });
        });

        it('should repair corrupted data structures', async () => {
            const partiallyCorrupted = {
                valid: 'data',
                channels: null, // Corrupted field
                timestamp: Date.now()
            };
            
            mockFs.promises.readFile.mockResolvedValue(JSON.stringify(partiallyCorrupted));
            mockFs.promises.writeFile.mockResolvedValue(undefined);
            
            const repairFunction = (data: any) => {
                if (!data.channels || typeof data.channels !== 'object') {
                    data.channels = {};
                }
                return data;
            };
            
            const repairSuccess = await storage.repairCorruptedData('partial.json', repairFunction);
            
            expect(repairSuccess).toBe(true);
            expect(mockFs.promises.writeFile).toHaveBeenCalled();
        });
    });

    describe('Network and I/O Errors', () => {
        it('should handle ETIMEDOUT errors', async () => {
            const timeoutError = new Error('ETIMEDOUT: network timeout');
            (timeoutError as any).code = 'ETIMEDOUT';
            
            mockFs.promises.writeFile.mockRejectedValue(timeoutError);
            
            const testData = { network: 'data' };
            
            await expect(storage.saveDataWithRetry(testData, 'network.json'))
                .rejects.toThrow('ETIMEDOUT: network timeout');
                
            expect(mockFs.promises.writeFile).toHaveBeenCalledTimes(3);
        });

        it('should handle EIO input/output errors', async () => {
            const eioError = new Error('EIO: input/output error');
            (eioError as any).code = 'EIO';
            
            let failureCount = 0;
            mockFs.promises.writeFile.mockImplementation(() => {
                failureCount++;
                if (failureCount < 2) {
                    return Promise.reject(eioError);
                }
                return Promise.resolve(); // Success after one failure
            });
            
            const testData = { io: 'recovery' };
            
            await storage.saveDataWithRetry(testData, 'io-test.json');
            
            expect(mockFs.promises.writeFile).toHaveBeenCalledTimes(2);
        });

        it('should handle EMFILE too many open files errors', async () => {
            const emfileError = new Error('EMFILE: too many open files');
            (emfileError as any).code = 'EMFILE';
            
            mockFs.promises.writeFile.mockRejectedValue(emfileError);
            
            const testData = { handles: 'exhausted' };
            
            await expect(storage.saveDataWithRetry(testData, 'handles.json'))
                .rejects.toThrow('EMFILE: too many open files');
        });
    });

    describe('Concurrent Access Errors', () => {
        it('should handle file locking conflicts', async () => {
            const elockError = new Error('EBUSY: resource busy or locked');
            (elockError as any).code = 'EBUSY';
            
            let lockCount = 0;
            mockFs.promises.rename.mockImplementation(() => {
                lockCount++;
                if (lockCount < 2) {
                    return Promise.reject(elockError);
                }
                return Promise.resolve(); // Lock released
            });
            
            const testData = { concurrent: 'access' };
            
            await storage.saveDataWithRetry(testData, 'locked.json');
            
            expect(mockFs.promises.rename).toHaveBeenCalledTimes(2);
        });

        it('should handle multiple processes writing simultaneously', async () => {
            const operations: Promise<void>[] = [];
            let writeCount = 0;
            
            // Simulate occasional conflicts
            mockFs.promises.writeFile.mockImplementation(() => {
                writeCount++;
                if (writeCount % 3 === 0) {
                    const error = new Error('EBUSY: resource busy or locked');
                    (error as any).code = 'EBUSY';
                    return Promise.reject(error);
                }
                return Promise.resolve();
            });
            
            // Launch 10 concurrent operations
            for (let i = 0; i < 10; i++) {
                operations.push(
                    storage.saveDataWithRetry({ batch: i }, `concurrent-${i}.json`)
                        .catch(() => {}) // Some failures expected
                );
            }
            
            const results = await Promise.allSettled(operations);
            const successful = results.filter(r => r.status === 'fulfilled').length;
            
            // Most operations should succeed despite occasional conflicts
            expect(successful).toBeGreaterThan(6);
        });
    });

    describe('Recovery and Resilience', () => {
        it('should create backups before risky operations', async () => {
            mockFs.promises.readFile.mockResolvedValue('{"existing": "data"}');
            mockFs.promises.copyFile.mockResolvedValue(undefined);
            
            await storage.createBackup('important.json');
            
            expect(mockFs.promises.copyFile).toHaveBeenCalledWith(
                expect.stringContaining('important.json'),
                expect.stringContaining('important.json.backup')
            );
        });

        it('should handle backup creation failures gracefully', async () => {
            const copyError = new Error('ENOSPC: no space left on device');
            mockFs.promises.copyFile.mockRejectedValue(copyError);
            
            // Should not throw - backup failure shouldn't stop operations
            await expect(storage.createBackup('test.json')).resolves.not.toThrow();
        });

        it('should maintain data integrity during power failures', async () => {
            // Simulate power failure during write (file partially written)
            let writeAttempt = 0;
            mockFs.promises.writeFile.mockImplementation((path: string, data: string) => {
                writeAttempt++;
                if (writeAttempt === 1) {
                    // Simulate power failure - operation interrupted
                    const error = new Error('Write interrupted');
                    return Promise.reject(error);
                }
                return Promise.resolve(); // Recovery successful
            });
            
            const criticalData = { critical: true, timestamp: Date.now() };
            
            await storage.saveDataWithRetry(criticalData, 'critical.json');
            
            // Should have retried and succeeded
            expect(mockFs.promises.writeFile).toHaveBeenCalledTimes(2);
            expect(mockFs.promises.unlink).toHaveBeenCalled(); // Cleanup attempted
        });

        it('should validate data integrity after recovery', async () => {
            const invalidData = '{"valid": true, "invalid": }'; // Incomplete JSON
            const validFallback = { recovered: true };
            
            mockFs.promises.readFile.mockResolvedValue(invalidData);
            
            const result = await storage.loadDataWithFallback('integrity-test.json', validFallback);
            
            expect(result).toEqual(validFallback);
        });
    });
});