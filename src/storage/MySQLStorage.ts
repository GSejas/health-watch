/**
 * MySQL storage backend for Health Watch
 * 
 * Provides robust, scalable storage for health monitoring data.
 * Supports transactions, proper indexing, and data retention policies.
 */

import * as mysql from 'mysql2/promise';
import { Sample, ChannelState, WatchSession, Outage } from '../types';
import {
    SampleStorage,
    StateStorage,
    SessionStorage,
    OutageStorage,
    StorageBackendInfo,
    StorageConfig
} from './StorageInterface';

export class MySQLStorage implements SampleStorage, StateStorage, SessionStorage, OutageStorage {
    private connection: mysql.Connection | null = null;
    private config: StorageConfig['mysql'];
    private isInitialized = false;

    constructor(config: StorageConfig['mysql']) {
        this.config = {
            host: 'localhost',
            port: 3306,
            database: 'healthwatch',
            username: 'healthwatch',
            ssl: false,
            maxConnections: 10,
            retryAttempts: 3,
            ...config
        };
    }

    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        try {
                const sslOption: any = this.config && this.config.ssl ? { rejectUnauthorized: false } : undefined;
                this.connection = await mysql.createConnection({
                    host: this.config?.host ?? 'localhost',
                    port: this.config?.port ?? 3306,
                    user: this.config?.username ?? undefined,
                    password: this.config?.password ?? undefined,
                    database: this.config?.database ?? 'healthwatch',
                    ssl: sslOption,
                    timezone: 'Z' // Use UTC
                } as any);

            // Create tables if they don't exist
            await this.createTables();
            
            this.isInitialized = true;
        } catch (error) {
            throw new Error(`Failed to initialize MySQL storage: ${error}`);
        }
    }

    async close(): Promise<void> {
        if (this.connection) {
            await this.connection.end();
            this.connection = null;
        }
        this.isInitialized = false;
    }

    async healthCheck(): Promise<boolean> {
        try {
            if (!this.connection) return false;
            
            const [rows] = await this.connection.execute('SELECT 1 as healthy');
            return Array.isArray(rows) && rows.length > 0;
        } catch (error) {
            console.error('MySQL health check failed:', error);
            return false;
        }
    }

    getInfo(): StorageBackendInfo {
        return {
            name: 'MySQL Storage',
            type: 'mysql',
            version: '1.0.0',
            isSecure: !!this.config?.ssl,
            supportsTransactions: true,
            connectionString: `mysql://${this.config?.host ?? 'localhost'}:${this.config?.port ?? 3306}/${this.config?.database ?? 'healthwatch'}`
        };
    }

    private async createTables(): Promise<void> {
        if (!this.connection) throw new Error('No MySQL connection');

        // Health samples table
        await this.connection.execute(`
            CREATE TABLE IF NOT EXISTS health_samples (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                channel_id VARCHAR(255) NOT NULL,
                timestamp BIGINT NOT NULL,
                is_success BOOLEAN NOT NULL,
                latency_ms INT NULL,
                status_code INT NULL,
                reason ENUM('timeout', 'dns', 'tcp', 'tls', 'http', 'script') NULL,
                note TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_channel_timestamp (channel_id, timestamp),
                INDEX idx_timestamp (timestamp),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Channel states table
        await this.connection.execute(`
            CREATE TABLE IF NOT EXISTS channel_states (
                channel_id VARCHAR(255) PRIMARY KEY,
                state ENUM('online', 'offline', 'unknown') NOT NULL,
                last_sample_timestamp BIGINT NULL,
                consecutive_failures INT DEFAULT 0,
                last_success_timestamp BIGINT NULL,
                last_failure_timestamp BIGINT NULL,
                total_checks INT DEFAULT 0,
                total_failures INT DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Watch sessions table
        await this.connection.execute(`
            CREATE TABLE IF NOT EXISTS watch_sessions (
                id VARCHAR(255) PRIMARY KEY,
                start_time BIGINT NOT NULL,
                end_time BIGINT NULL,
                duration_setting VARCHAR(50) NULL,
                is_active BOOLEAN DEFAULT true,
                sample_count INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_start_time (start_time),
                INDEX idx_is_active (is_active)
            ) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Outages table
        await this.connection.execute(`
            CREATE TABLE IF NOT EXISTS outages (
                id VARCHAR(255) PRIMARY KEY,
                channel_id VARCHAR(255) NOT NULL,
                start_time BIGINT NOT NULL,
                end_time BIGINT NULL,
                duration_ms BIGINT NULL,
                reason VARCHAR(255) NULL,
                impact VARCHAR(50) NULL,
                is_resolved BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_channel_id (channel_id),
                INDEX idx_start_time (start_time),
                INDEX idx_is_resolved (is_resolved)
            ) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
    }

    // === Sample Storage Methods ===

    async storeSample(channelId: string, sample: Sample): Promise<void> {
        if (!this.connection) throw new Error('MySQL not initialized');

        // Reason enum guard: only allow known reason keywords
        const allowedReasons = new Set(['timeout', 'dns', 'tcp', 'tls', 'http', 'script']);
        const rawReason = sample.error || undefined;
        const reason = rawReason && allowedReasons.has(rawReason as any) ? rawReason : null;
        const note = (sample.details && sample.details.note) || (!reason && rawReason) || null;

        await this.connection.execute(`
            INSERT INTO health_samples (
                channel_id, timestamp, is_success, latency_ms, status_code, reason, note
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            channelId,
            sample.timestamp,
            sample.success,
            sample.latencyMs ?? null,
            (sample.details && (sample.details.statusCode ?? sample.details.code)) || null,
            reason,
            note
        ]);
    }

    async storeSamples(samples: Array<{ channelId: string; sample: Sample }>): Promise<void> {
        if (!this.connection) throw new Error('MySQL not initialized');
        if (samples.length === 0) return;

        const values = samples.map(({ channelId, sample }) => {
            const allowedReasons = new Set(['timeout', 'dns', 'tcp', 'tls', 'http', 'script']);
            const rawReason = sample.error || undefined;
            const reason = rawReason && allowedReasons.has(rawReason as any) ? rawReason : null;
            const note = (sample.details && sample.details.note) || (!reason && rawReason) || null;
            return [
            channelId,
            sample.timestamp,
            sample.success,
            sample.latencyMs ?? null,
            (sample.details && (sample.details.statusCode ?? sample.details.code)) || null,
            reason,
            note
        ];
        });

        await this.connection.execute(`
            INSERT INTO health_samples (
                channel_id, timestamp, is_success, latency_ms, status_code, reason, note
            ) VALUES ${values.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ')}
        `, values.flat());
    }

    async getSamples(channelId: string, startTime: number, endTime: number): Promise<Sample[]> {
        if (!this.connection) throw new Error('MySQL not initialized');

        const [rows] = await this.connection.execute(`
            SELECT timestamp, is_success, latency_ms, status_code, reason, note
            FROM health_samples
            WHERE channel_id = ? AND timestamp BETWEEN ? AND ?
            ORDER BY timestamp ASC
        `, [channelId, startTime, endTime]);

        return (rows as any[]).map(row => ({
            timestamp: row.timestamp,
            success: !!row.is_success,
            latencyMs: row.latency_ms ?? undefined,
            error: row.reason ?? undefined,
            details: {
                statusCode: row.status_code ?? undefined,
                note: row.note ?? undefined
            }
        }));
    }

    async getRecentSamples(channelId: string, count: number): Promise<Sample[]> {
        if (!this.connection) throw new Error('MySQL not initialized');

        const [rows] = await this.connection.execute(`
            SELECT timestamp, is_success, latency_ms, status_code, reason, note
            FROM health_samples
            WHERE channel_id = ?
            ORDER BY timestamp DESC
            LIMIT ?
        `, [channelId, count]);

        return (rows as any[]).map(row => ({
            timestamp: row.timestamp,
            success: !!row.is_success,
            latencyMs: row.latency_ms ?? undefined,
            error: row.reason ?? undefined,
            details: {
                statusCode: row.status_code ?? undefined,
                note: row.note ?? undefined
            }
        })).reverse(); // Return in chronological order
    }

    async cleanupSamples(olderThanMs: number): Promise<number> {
        if (!this.connection) throw new Error('MySQL not initialized');

        const cutoffTime = Date.now() - olderThanMs;
        const [result] = await this.connection.execute(`
            DELETE FROM health_samples WHERE timestamp < ?
        `, [cutoffTime]);

        return (result as any).affectedRows || 0;
    }

    // === State Storage Methods ===

    async getChannelState(channelId: string): Promise<ChannelState | undefined> {
        if (!this.connection) throw new Error('MySQL not initialized');

        const [rows] = await this.connection.execute(`
            SELECT * FROM channel_states WHERE channel_id = ?
        `, [channelId]);

        const row = (rows as any[])[0];
        if (!row) return undefined;

        return {
            id: row.channel_id,
            state: row.state,
            lastSample: row.last_sample_timestamp ? {
                timestamp: row.last_sample_timestamp,
                success: true
            } : undefined,
            consecutiveFailures: row.consecutive_failures || 0,
            lastStateChange: Date.now(),
            backoffMultiplier: 1,
            samples: []
        } as ChannelState;
    }

    async setChannelState(channelId: string, state: ChannelState): Promise<void> {
        if (!this.connection) throw new Error('MySQL not initialized');

        await this.connection.execute(`
            INSERT INTO channel_states (
                channel_id, state, last_sample_timestamp, consecutive_failures,
                last_success_timestamp, last_failure_timestamp, total_checks, total_failures
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                state = VALUES(state),
                last_sample_timestamp = VALUES(last_sample_timestamp),
                consecutive_failures = VALUES(consecutive_failures),
                last_success_timestamp = VALUES(last_success_timestamp),
                last_failure_timestamp = VALUES(last_failure_timestamp),
                total_checks = VALUES(total_checks),
                total_failures = VALUES(total_failures)
        `, [
            channelId,
            state.state,
            state.lastSample?.timestamp || null,
            state.consecutiveFailures || 0,
            state.lastSuccessTime || null,
            state.lastFailureTime || null,
            state.totalChecks || 0,
            state.totalFailures || 0
        ]);
    }

    async getAllChannelStates(): Promise<Map<string, ChannelState>> {
        if (!this.connection) throw new Error('MySQL not initialized');

        const [rows] = await this.connection.execute(`
            SELECT * FROM channel_states
        `);

        const states = new Map<string, ChannelState>();
        
        for (const row of rows as any[]) {
            states.set(row.channel_id, {
                id: row.channel_id,
                state: row.state,
                lastSample: row.last_sample_timestamp ? {
                    timestamp: row.last_sample_timestamp,
                    success: true
                } : undefined,
                consecutiveFailures: row.consecutive_failures || 0,
                lastStateChange: Date.now(),
                backoffMultiplier: 1,
                samples: []
            } as ChannelState);
        }

        return states;
    }

    async removeChannelState(channelId: string): Promise<void> {
        if (!this.connection) throw new Error('MySQL not initialized');

        await this.connection.execute(`
            DELETE FROM channel_states WHERE channel_id = ?
        `, [channelId]);
    }

    // === Session Storage Methods ===

    async startWatchSession(session: WatchSession): Promise<void> {
        if (!this.connection) throw new Error('MySQL not initialized');

        await this.connection.execute(`
            INSERT INTO watch_sessions (id, start_time, duration_setting, is_active)
            VALUES (?, ?, ?, ?)
        `, [session.id, session.startTime, session.durationSetting || null, session.isActive]);
    }

    async updateWatchSession(session: WatchSession): Promise<void> {
        if (!this.connection) throw new Error('MySQL not initialized');

        await this.connection.execute(`
            UPDATE watch_sessions 
            SET end_time = ?, is_active = ?, sample_count = ?
            WHERE id = ?
        `, [session.endTime || null, session.isActive, session.sampleCount || 0, session.id]);
    }

    async endWatchSession(): Promise<void> {
        if (!this.connection) throw new Error('MySQL not initialized');

        await this.connection.execute(`
            UPDATE watch_sessions SET is_active = false WHERE is_active = true
        `);
    }

    async getCurrentWatchSession(): Promise<WatchSession | undefined> {
        if (!this.connection) throw new Error('MySQL not initialized');

        const [rows] = await this.connection.execute(`
            SELECT * FROM watch_sessions WHERE is_active = true LIMIT 1
        `);

        const row = (rows as any[])[0];
        if (!row) return undefined;

        return {
            id: row.id,
            startTime: row.start_time,
            endTime: row.end_time,
            duration: row.duration_setting ?? 'forever',
            samples: new Map<string, any[]>(),
            isActive: !!row.is_active,
            durationSetting: row.duration_setting,
            sampleCount: row.sample_count
        } as WatchSession;
    }

    async getWatchHistory(limit: number = 50): Promise<WatchSession[]> {
        if (!this.connection) throw new Error('MySQL not initialized');

        const [rows] = await this.connection.execute(`
            SELECT * FROM watch_sessions 
            ORDER BY start_time DESC 
            LIMIT ?
        `, [limit]);

        return (rows as any[]).map(row => ({
            id: row.id,
            startTime: row.start_time,
            endTime: row.end_time,
            duration: row.duration_setting ?? 'forever',
            samples: new Map<string, any[]>(),
            isActive: !!row.is_active,
            durationSetting: row.duration_setting,
            sampleCount: row.sample_count
        } as WatchSession));
    }

    // === Outage Storage Methods ===

    async recordOutage(outage: Outage): Promise<void> {
        if (!this.connection) throw new Error('MySQL not initialized');

        await this.connection.execute(`
            INSERT INTO outages (id, channel_id, start_time, end_time, duration_ms, reason, impact, is_resolved)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            outage.id,
            outage.channelId,
            outage.startTime,
            outage.endTime || null,
            outage.durationMs || null,
            outage.reason || null,
            outage.impact || null,
            outage.isResolved || false
        ]);
    }

    async getOutages(channelId?: string, startTime?: number, endTime?: number): Promise<Outage[]> {
        if (!this.connection) throw new Error('MySQL not initialized');

        let query = 'SELECT * FROM outages WHERE 1=1';
        const params: any[] = [];

        if (channelId) {
            query += ' AND channel_id = ?';
            params.push(channelId);
        }

        if (startTime) {
            query += ' AND start_time >= ?';
            params.push(startTime);
        }

        if (endTime) {
            query += ' AND start_time <= ?';
            params.push(endTime);
        }

        query += ' ORDER BY start_time DESC';

        const [rows] = await this.connection.execute(query, params);

        return (rows as any[]).map(row => ({
            id: row.id,
            channelId: row.channel_id,
            startTime: row.start_time,
            endTime: row.end_time,
            durationMs: row.duration_ms,
            reason: row.reason,
            impact: row.impact,
            isResolved: row.is_resolved
        }));
    }

    async updateOutage(outageId: string, updates: Partial<Outage>): Promise<void> {
        if (!this.connection) throw new Error('MySQL not initialized');

        const fields: string[] = [];
        const values: any[] = [];

        if (updates.endTime !== undefined) {
            fields.push('end_time = ?');
            values.push(updates.endTime);
        }

        if (updates.durationMs !== undefined) {
            fields.push('duration_ms = ?');
            values.push(updates.durationMs);
        }

        if (updates.isResolved !== undefined) {
            fields.push('is_resolved = ?');
            values.push(updates.isResolved);
        }

        if (fields.length === 0) return;

        values.push(outageId);

        await this.connection.execute(`
            UPDATE outages SET ${fields.join(', ')} WHERE id = ?
        `, values);
    }
}