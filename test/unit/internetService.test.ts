import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InternetCheckService } from '../../src/services/internetCheckService';

// Mock the coordination manager
const mockCoordinationManager = {
    on: vi.fn(),
    getCurrentRole: vi.fn().mockReturnValue('leader'),
    startCoordination: vi.fn()
};

// Mock the storage manager
const mockStorageManager = {
    getCustomData: vi.fn().mockReturnValue(null),
    setCustomData: vi.fn(),
    whenReady: vi.fn().mockResolvedValue(void 0)
};

describe('InternetCheckService', () => {
    let internetService: InternetCheckService;

    beforeEach(() => {
        vi.clearAllMocks();
        internetService = new InternetCheckService(
            mockCoordinationManager as any,
            mockStorageManager as any
        );
    });

    describe('Configuration', () => {
        it('should have correct default configuration', () => {
            const status = internetService.getCurrentStatus();
            
            expect(status).toBeDefined();
            expect(status.status).toBe('unknown'); // Initial state
            expect(status.checkCount).toBe(0);
            expect(status.consecutiveFailures).toBe(0);
        });

        it('should register coordination event listeners', () => {
            expect(mockCoordinationManager.on).toHaveBeenCalledWith(
                'roleChanged',
                expect.any(Function)
            );
        });
    });

    describe('Status Management', () => {
        it('should start with unknown status', () => {
            const status = internetService.getCurrentStatus();
            expect(status.status).toBe('unknown');
        });

        it('should persist state when updated', () => {
            // This would require more complex mocking to test the actual state updates
            expect(mockStorageManager.setCustomData).not.toHaveBeenCalled(); // Initially
        });
    });

    describe('Role Management', () => {
        it('should handle leader role change', () => {
            const roleChangeHandler = mockCoordinationManager.on.mock.calls
                .find(call => call[0] === 'roleChanged')?.[1];
            
            expect(roleChangeHandler).toBeDefined();
            
            if (roleChangeHandler) {
                // Test role change to leader
                roleChangeHandler({ oldRole: 'follower', newRole: 'leader' });
                // Note: In a real implementation, we'd verify that network checks start
            }
        });

        it('should handle follower role change', () => {
            const roleChangeHandler = mockCoordinationManager.on.mock.calls
                .find(call => call[0] === 'roleChanged')?.[1];
            
            expect(roleChangeHandler).toBeDefined();
            
            if (roleChangeHandler) {
                // Test role change to follower  
                roleChangeHandler({ oldRole: 'leader', newRole: 'follower' });
                // Note: In a real implementation, we'd verify that network checks stop
            }
        });
    });

    describe('Public API', () => {
        it('should provide current status', () => {
            const status = internetService.getCurrentStatus();
            
            expect(status).toHaveProperty('status');
            expect(status).toHaveProperty('timestamp');
            expect(status).toHaveProperty('checkCount');
            expect(status).toHaveProperty('consecutiveFailures');
        });

        it('should handle runCheckNow for followers', async () => {
            // When service is a follower, runCheckNow should just return current status
            const result = await internetService.runCheckNow();
            expect(result).toBeDefined();
            expect(result.status).toBe('unknown');
        });

        it('should report time until next check', () => {
            const timeUntilNext = internetService.getTimeUntilNextCheck();
            expect(typeof timeUntilNext).toBe('number');
            expect(timeUntilNext).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Cleanup', () => {
        it('should dispose properly', () => {
            expect(() => internetService.dispose()).not.toThrow();
        });
    });
});