import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IndividualWatchManager } from '../../../src/watch/individualWatchManager';
import { ConfigManager } from '../../../src/config';

// Mock ConfigManager  
vi.mock('../../../src/config');

describe('IndividualWatchManager', () => {
    let manager: IndividualWatchManager;
    let mockConfigManager: any;

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();
        
        // Setup mock ConfigManager
        mockConfigManager = {
            getWatchConfig: vi.fn().mockReturnValue({
                highCadenceIntervalSec: 10,
                timeoutMs: 3000
            })
        };
        (ConfigManager.getInstance as any).mockReturnValue(mockConfigManager);

        // Create fresh manager instance
        manager = new IndividualWatchManager();
    });

    afterEach(() => {
        // Clean up any active watches
        manager.dispose();
    });

    describe('Watch Lifecycle', () => {
        it('should start an individual channel watch with default duration', async () => {
            const channelId = 'test-channel';
            
            const watch = await manager.startChannelWatch(channelId, {});
            
            expect(watch).toBeDefined();
            expect(watch.channelId).toBe(channelId);
            expect(watch.isActive).toBe(true);
            expect(watch.duration).toBe('1h'); // default
            expect(watch.startTime).toBeGreaterThan(0);
        });

        it('should start an individual channel watch with custom duration', async () => {
            const channelId = 'test-channel';
            const duration = '12h';
            
            const watch = await manager.startChannelWatch(channelId, { duration });
            
            expect(watch.duration).toBe(duration);
        });

        it('should start an individual channel watch with custom intervals', async () => {
            const channelId = 'test-channel';
            const intervalSec = 5;
            const timeoutMs = 2000;
            
            const watch = await manager.startChannelWatch(channelId, { 
                intervalSec, 
                timeoutMs 
            });
            
            expect(watch.intervalSec).toBe(intervalSec);
            expect(watch.timeoutMs).toBe(timeoutMs);
        });

        it('should prevent starting duplicate watches for same channel', async () => {
            const channelId = 'test-channel';
            
            await manager.startChannelWatch(channelId, {});
            
            await expect(
                manager.startChannelWatch(channelId, {})
            ).rejects.toThrow('Individual watch already active');
        });

        it('should stop an active individual watch', async () => {
            const channelId = 'test-channel';
            
            const watch = await manager.startChannelWatch(channelId, {});
            const stopped = await manager.stopChannelWatch(channelId);
            
            expect(stopped).toBe(true);
            expect(watch.isActive).toBe(false);
            expect(watch.endTime).toBeDefined();
        });

        it('should return false when stopping non-existent watch', async () => {
            const result = await manager.stopChannelWatch('non-existent');
            expect(result).toBe(false);
        });
    });

    describe('Watch Query Methods', () => {
        beforeEach(async () => {
            // Set up some test watches
            await manager.startChannelWatch('individual-channel', { duration: '1h' });
        });

        it('should correctly identify watched channels', () => {
            expect(manager.isChannelWatched('individual-channel')).toBe(true);
            expect(manager.isChannelWatched('unwatched-channel')).toBe(false);
        });

        it('should return effective watch for individual channels', () => {
            const effectiveWatch = manager.getEffectiveWatch('individual-channel');
            
            expect(effectiveWatch).toBeDefined();
            expect(effectiveWatch?.channelId).toBe('individual-channel');
        });

        it('should return null for unwatched channels', () => {
            const effectiveWatch = manager.getEffectiveWatch('unwatched-channel');
            expect(effectiveWatch).toBeNull();
        });

        it('should return correct watch type for individual channels', () => {
            expect(manager.getActiveWatchType('individual-channel')).toBe('individual');
            expect(manager.getActiveWatchType('unwatched-channel')).toBe('baseline');
        });
    });

    describe('Watch Statistics', () => {
        it('should provide watch statistics for active watch', async () => {
            const channelId = 'test-channel';
            await manager.startChannelWatch(channelId, { duration: '1h' });
            
            const stats = manager.getWatchStatistics(channelId);
            
            expect(stats).toBeDefined();
            expect(stats.isActive).toBe(true);
            expect(stats.elapsedMs).toBeGreaterThanOrEqual(0);
            expect(stats.sampleCount).toBe(0); // No samples yet
        });

        it('should return null statistics for non-existent watch', () => {
            const stats = manager.getWatchStatistics('non-existent');
            expect(stats).toBeNull();
        });

        it('should track sample count increments', async () => {
            const channelId = 'test-channel';
            const watch = await manager.startChannelWatch(channelId, {});
            
            // Simulate adding samples
            watch.sampleCount = (watch.sampleCount || 0) + 3;
            
            const stats = manager.getWatchStatistics(channelId);
            expect(stats?.sampleCount).toBe(3);
        });
    });

    describe('Event Emission', () => {
        it('should emit channelWatchStarted event when starting watch', async () => {
            const eventSpy = vi.fn();
            manager.on('channelWatchStarted', eventSpy);
            
            const channelId = 'test-channel';
            await manager.startChannelWatch(channelId, {});
            
            expect(eventSpy).toHaveBeenCalledWith({
                channelId,
                watch: expect.objectContaining({
                    channelId,
                    isActive: true
                })
            });
        });

        it('should emit channelWatchStopped event when stopping watch', async () => {
            const eventSpy = vi.fn();
            manager.on('channelWatchStopped', eventSpy);
            
            const channelId = 'test-channel';
            await manager.startChannelWatch(channelId, {});
            await manager.stopChannelWatch(channelId);
            
            expect(eventSpy).toHaveBeenCalledWith({
                channelId,
                watch: expect.objectContaining({
                    channelId,
                    isActive: false
                })
            });
        });
    });

    describe('Duration Handling', () => {
        it('should handle 1h duration correctly', async () => {
            const watch = await manager.startChannelWatch('test', { duration: '1h' });
            expect(watch.duration).toBe('1h');
        });

        it('should handle 12h duration correctly', async () => {
            const watch = await manager.startChannelWatch('test', { duration: '12h' });
            expect(watch.duration).toBe('12h');
        });

        it('should handle forever duration correctly', async () => {
            const watch = await manager.startChannelWatch('test', { duration: 'forever' });
            expect(watch.duration).toBe('forever');
        });

        it('should handle numeric duration correctly', async () => {
            const duration = 3600000; // 1 hour in ms
            const watch = await manager.startChannelWatch('test', { duration });
            expect(watch.duration).toBe(duration);
        });
    });

    describe('Timer Management', () => {
        it('should set up timer for timed duration watches', async () => {
            // Mock setTimeout to verify timer setup
            const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
            
            await manager.startChannelWatch('test', { duration: '1h' });
            
            expect(setTimeoutSpy).toHaveBeenCalled();
            
            setTimeoutSpy.mockRestore();
        });

        it('should not set up timer for forever duration', async () => {
            const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
            
            await manager.startChannelWatch('test', { duration: 'forever' });
            
            expect(setTimeoutSpy).not.toHaveBeenCalled();
            
            setTimeoutSpy.mockRestore();
        });

        it('should clean up timers when watch is stopped', async () => {
            const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
            
            await manager.startChannelWatch('test', { duration: '1h' });
            await manager.stopChannelWatch('test');
            
            expect(clearTimeoutSpy).toHaveBeenCalled();
            
            clearTimeoutSpy.mockRestore();
        });
    });

    describe('Edge Cases', () => {
        it('should handle disposal during active watches', async () => {
            await manager.startChannelWatch('test1', { duration: '1h' });
            await manager.startChannelWatch('test2', { duration: '12h' });
            
            // Should not throw
            expect(() => manager.dispose()).not.toThrow();
            
            // All watches should be inactive
            expect(manager.isChannelWatched('test1')).toBe(false);
            expect(manager.isChannelWatched('test2')).toBe(false);
        });

        it('should handle watch expiry correctly', async () => {
            const eventSpy = vi.fn();
            manager.on('channelWatchExpired', eventSpy);
            
            // Start watch with very short duration for testing
            await manager.startChannelWatch('test', { duration: 1 }); // 1ms
            
            // Wait for expiry
            await new Promise(resolve => setTimeout(resolve, 10));
            
            expect(eventSpy).toHaveBeenCalledWith({
                channelId: 'test',
                watch: expect.objectContaining({
                    channelId: 'test',
                    isActive: false
                })
            });
        });

        it('should handle empty channel ID gracefully', async () => {
            await expect(
                manager.startChannelWatch('', {})
            ).rejects.toThrow('Channel ID is required');
        });

        it('should handle null/undefined channel ID gracefully', async () => {
            await expect(
                manager.startChannelWatch(null as any, {})
            ).rejects.toThrow('Channel ID is required');
            
            await expect(
                manager.startChannelWatch(undefined as any, {})
            ).rejects.toThrow('Channel ID is required');
        });
    });
});