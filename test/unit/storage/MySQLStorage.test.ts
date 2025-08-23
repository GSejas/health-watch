import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MySQLStorage } from '../../../src/storage/MySQLStorage';

// Mock mysql2/promise
const mockConnection = {
    execute: vi.fn(),
    end: vi.fn()
};

const mockMysql = {
    createConnection: vi.fn().mockResolvedValue(mockConnection)
};

vi.mock('mysql2/promise', () => mockMysql);

describe('MySQLStorage', () => {
    let storage: MySQLStorage;
    const mockConfig = {
        host: 'localhost',
        port: 3306,
        database: 'test_healthwatch',
        username: 'test_user',
        password: 'test_pass'
    };

    beforeEach(async () => {
        vi.clearAllMocks();
        storage = new MySQLStorage(mockConfig);
        
        // Mock table creation
        mockConnection.execute.mockResolvedValue([[], {}]);
        await storage.initialize();
    });

    afterEach(async () => {
        await storage.close();
    });

    describe('initialization', () => {
        it('should connect to MySQL and create tables', async () => {
            expect(mockMysql.createConnection).toHaveBeenCalledWith({
                host: 'localhost',
                port: 3306,
                user: 'test_user',
                password: 'test_pass',
                database: 'test_healthwatch',
                ssl: false,
                timezone: 'Z'
            });
            
            // Should have called execute for each table creation
            expect(mockConnection.execute).toHaveBeenCalledTimes(4);
        });

        it('should provide correct backend info', () => {
            const info = storage.getInfo();
            expect(info).toEqual({
                name: 'MySQL Storage',
                type: 'mysql',
                version: '1.0.0',
                isSecure: false,
                supportsTransactions: true,
                connectionString: 'mysql://localhost:3306/test_healthwatch'
            });
        });
    });

    describe('health check', () => {
        it('should return true when connection is healthy', async () => {
            mockConnection.execute.mockResolvedValue([[{ healthy: 1 }], {}]);
            
            const isHealthy = await storage.healthCheck();
            expect(isHealthy).toBe(true);
            expect(mockConnection.execute).toHaveBeenCalledWith('SELECT 1 as healthy');
        });

        it('should return false when connection fails', async () => {
            mockConnection.execute.mockRejectedValue(new Error('Connection failed'));
            
            const isHealthy = await storage.healthCheck();
            expect(isHealthy).toBe(false);
        });
    });

    describe('sample storage', () => {
        it('should store a single sample', async () => {
            const sample: any = {
                t: Date.now(),
                ok: true,
                latencyMs: 100,
                code: 200
            };

            mockConnection.execute.mockResolvedValue([{ insertId: 1 }, {}]);
            
            await storage.storeSample('test-channel', sample);
            
            expect(mockConnection.execute).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO health_samples'),
                ['test-channel', sample.t, sample.ok, 100, 200, null, null]
            );
        });

        it('should store multiple samples in batch', async () => {
            const samples: any = [
                { channelId: 'ch1', sample: { t: 1000, ok: true } },
                { channelId: 'ch2', sample: { t: 2000, ok: false, reason: 'timeout' as const } }
            ];

            mockConnection.execute.mockResolvedValue([{ affectedRows: 2 }, {}]);
            
            await storage.storeSamples(samples);
            
            expect(mockConnection.execute).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO health_samples'),
                expect.arrayContaining(['ch1', 1000, true, null, null, null, null])
            );
        });

        it('should retrieve samples for time range', async () => {
            const mockRows = [
                { timestamp: 1000, is_success: true, latency_ms: 50 },
                { timestamp: 2000, is_success: false, reason: 'timeout' }
            ];
            mockConnection.execute.mockResolvedValue([mockRows, {}]);
            
            const samples = await storage.getSamples('test-channel', 1000, 3000);
            
            expect(samples).toHaveLength(2);
            expect(samples[0]).toEqual({
                t: 1000,
                ok: true,
                latencyMs: 50,
                code: null,
                reason: null,
                note: null
            });
        });
    });

    describe('channel state management', () => {
        it('should set and get channel state', async () => {
            const state: any = {
                state: 'online' as const,
                consecutiveFailures: 0,
                totalChecks: 10,
                totalFailures: 2
            };

            // Mock set
            mockConnection.execute.mockResolvedValue([{ affectedRows: 1 }, {}]);
            await storage.setChannelState('test-channel', state as any);

            // Mock get
            const mockRow = {
                channel_id: 'test-channel',
                state: 'online',
                consecutive_failures: 0,
                total_checks: 10,
                total_failures: 2
            };
            mockConnection.execute.mockResolvedValue([[mockRow], {}]);
            
            const retrieved = await storage.getChannelState('test-channel');
            
            expect(retrieved).toEqual({
                state: 'online',
                lastSample: undefined,
                consecutiveFailures: 0,
                lastSuccessTime: null,
                lastFailureTime: null,
                totalChecks: 10,
                totalFailures: 2
            });
        });
    });

    describe('watch sessions', () => {
        it('should manage watch sessions', async () => {
            const session = {
                id: 'watch-123',
                startTime: Date.now(),
                isActive: true,
                durationSetting: '1h'
            };

            mockConnection.execute.mockResolvedValue([{ affectedRows: 1 }, {}]);
            
            await storage.startWatchSession(session);
            
            expect(mockConnection.execute).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO watch_sessions'),
                [session.id, session.startTime, '1h', true]
            );
        });
    });

    describe('outage tracking', () => {
        it('should record and retrieve outages', async () => {
            const outage = {
                id: 'outage-123',
                channelId: 'test-channel',
                startTime: Date.now(),
                isResolved: false
            };

            mockConnection.execute.mockResolvedValue([{ affectedRows: 1 }, {}]);
            
            await storage.recordOutage(outage);
            
            expect(mockConnection.execute).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO outages'),
                [outage.id, outage.channelId, outage.startTime, null, null, null, null, false]
            );
        });
    });

    describe('data cleanup', () => {
        it('should cleanup old samples', async () => {
            mockConnection.execute.mockResolvedValue([{ affectedRows: 50 }, {}]);
            
            const deleted = await storage.cleanupSamples(7 * 24 * 60 * 60 * 1000); // 7 days
            
            expect(deleted).toBe(50);
            expect(mockConnection.execute).toHaveBeenCalledWith(
                'DELETE FROM health_samples WHERE timestamp < ?',
                [expect.any(Number)]
            );
        });
    });
});