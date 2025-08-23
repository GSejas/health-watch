/**
 * 🧪 Adaptive Backoff Strategy Tests
 * 
 * **Purpose**: Verify the surgical fix for backward backoff logic
 * **Critical Requirement**: Offline channels must probe FASTER, not slower
 * 
 * @author Health Watch Team
 * @version 2.0.0
 */

import { describe, it, expect } from 'vitest';
import { AdaptiveBackoffStrategy, BackoffInput } from '../../src/runner/adaptiveBackoff';

describe('AdaptiveBackoffStrategy - Surgical Fix Verification', () => {
    
    describe('🚨 CRITICAL FIX: Crisis Mode Acceleration', () => {
        it('should probe FASTER when service is offline (not slower)', () => {
            const input: BackoffInput = {
                state: 'offline',
                consecutiveFailures: 3,
                baseIntervalSec: 60,
                isInWatch: false,
                priority: 'medium'
            };
            
            const result = AdaptiveBackoffStrategy.calculateInterval(input);
            
            // 🔄 **SURGICAL VERIFICATION**: Must be faster than baseline
            expect(result.adjustedIntervalSec).toBeLessThan(60);
            expect(result.strategy).toBe('crisis');
            expect(result.multiplier).toBeLessThan(1.0);
            expect(result.reason).toContain('offline');
            expect(result.reason).toContain('accelerated monitoring');
        });
        
        it('should accelerate MORE as failures increase', () => {
            const baseInput: BackoffInput = {
                state: 'offline',
                consecutiveFailures: 3,
                baseIntervalSec: 60,
                isInWatch: false,
                priority: 'medium'
            };
            
            const result3failures = AdaptiveBackoffStrategy.calculateInterval(baseInput);
            const result6failures = AdaptiveBackoffStrategy.calculateInterval({
                ...baseInput,
                consecutiveFailures: 6
            });
            const result9failures = AdaptiveBackoffStrategy.calculateInterval({
                ...baseInput, 
                consecutiveFailures: 9
            });
            
            // More failures should result in faster monitoring
            expect(result6failures.adjustedIntervalSec).toBeLessThan(result3failures.adjustedIntervalSec);
            expect(result9failures.adjustedIntervalSec).toBeLessThan(result6failures.adjustedIntervalSec);
            
            // But never faster than minimum safe interval
            expect(result9failures.adjustedIntervalSec).toBeGreaterThanOrEqual(10);
        });
        
        it('should give critical services even faster crisis monitoring', () => {
            const mediumPriority = AdaptiveBackoffStrategy.calculateInterval({
                state: 'offline',
                consecutiveFailures: 3,
                baseIntervalSec: 60,
                isInWatch: false,
                priority: 'medium'
            });
            
            const criticalPriority = AdaptiveBackoffStrategy.calculateInterval({
                state: 'offline',
                consecutiveFailures: 3,
                baseIntervalSec: 60,
                isInWatch: false,
                priority: 'critical'
            });
            
            // Critical services should get faster crisis monitoring
            expect(criticalPriority.adjustedIntervalSec).toBeLessThan(mediumPriority.adjustedIntervalSec);
        });
    });
    
    describe('🟡 Recovery Mode: Gentle Acceleration', () => {
        it('should probe slightly faster for recent failures', () => {
            const result = AdaptiveBackoffStrategy.calculateInterval({
                state: 'unknown',
                consecutiveFailures: 2,
                baseIntervalSec: 60,
                isInWatch: false,
                priority: 'medium'
            });
            
            expect(result.adjustedIntervalSec).toBeLessThan(60);
            expect(result.adjustedIntervalSec).toBeGreaterThan(15); // Not as aggressive as crisis
            expect(result.strategy).toBe('recovery');
        });
    });
    
    describe('🟢 Stable Mode: Baseline Behavior', () => {
        it('should use configured interval for healthy services', () => {
            const result = AdaptiveBackoffStrategy.calculateInterval({
                state: 'online',
                consecutiveFailures: 0,
                baseIntervalSec: 120,
                isInWatch: false,
                priority: 'medium'
            });
            
            expect(result.adjustedIntervalSec).toBe(120);
            expect(result.multiplier).toBe(1.0);
            expect(result.strategy).toBe('stable');
        });
        
        it('should cap stable intervals at maximum', () => {
            const result = AdaptiveBackoffStrategy.calculateInterval({
                state: 'online',
                consecutiveFailures: 0,
                baseIntervalSec: 1200, // 20 minutes - too long
                isInWatch: false,
                priority: 'low'
            });
            
            // Should be capped at 10 minutes
            expect(result.adjustedIntervalSec).toBe(600);
        });
    });
    
    describe('🔵 Watch Mode: User Override', () => {
        it('should use intensive intervals during active watch', () => {
            const result = AdaptiveBackoffStrategy.calculateInterval({
                state: 'offline', // Even if offline...
                consecutiveFailures: 5,
                baseIntervalSec: 300,
                isInWatch: true, // ...watch mode takes precedence
                priority: 'high'
            });
            
            expect(result.strategy).toBe('watch');
            expect(result.adjustedIntervalSec).toBe(15); // High priority watch interval
            expect(result.reason).toContain('User-initiated');
        });
        
        it('should provide different watch intervals by priority', () => {
            const critical = AdaptiveBackoffStrategy.calculateInterval({
                state: 'online',
                consecutiveFailures: 0,
                baseIntervalSec: 60,
                isInWatch: true,
                priority: 'critical'
            });
            
            const low = AdaptiveBackoffStrategy.calculateInterval({
                state: 'online', 
                consecutiveFailures: 0,
                baseIntervalSec: 60,
                isInWatch: true,
                priority: 'low'
            });
            
            expect(critical.adjustedIntervalSec).toBe(10); // Critical: 10s
            expect(low.adjustedIntervalSec).toBe(60);      // Low: 60s
        });
    });
    
    describe('🔒 Safety Constraints', () => {
        it('should never probe faster than minimum safe interval', () => {
            const result = AdaptiveBackoffStrategy.calculateInterval({
                state: 'offline',
                consecutiveFailures: 20, // Extreme failure count
                baseIntervalSec: 60,
                isInWatch: false,
                priority: 'critical'
            });
            
            expect(result.adjustedIntervalSec).toBeGreaterThanOrEqual(10);
        });
        
        it('should handle edge cases gracefully', () => {
            // Zero base interval
            const result1 = AdaptiveBackoffStrategy.calculateInterval({
                state: 'offline',
                consecutiveFailures: 3,
                baseIntervalSec: 0,
                isInWatch: false
            });
            expect(result1.adjustedIntervalSec).toBeGreaterThanOrEqual(10);
            
            // Negative failures (shouldn't happen, but be safe)
            const result2 = AdaptiveBackoffStrategy.calculateInterval({
                state: 'offline',
                consecutiveFailures: -1,
                baseIntervalSec: 60,
                isInWatch: false
            });
            expect(result2.adjustedIntervalSec).toBeGreaterThan(0);
        });
    });
    
    describe('📊 Backward Compatibility', () => {
        it('should return reasonable multipliers for legacy code', () => {
            const offlineResult = AdaptiveBackoffStrategy.calculateInterval({
                state: 'offline',
                consecutiveFailures: 3,
                baseIntervalSec: 60,
                isInWatch: false
            });
            
            const onlineResult = AdaptiveBackoffStrategy.calculateInterval({
                state: 'online',
                consecutiveFailures: 0, 
                baseIntervalSec: 60,
                isInWatch: false
            });
            
            // Offline should have accelerating multiplier (< 1.0)
            expect(offlineResult.multiplier).toBeLessThan(1.0);
            
            // Online should have stable multiplier (1.0)
            expect(onlineResult.multiplier).toBe(1.0);
        });
    });
});

/**
 * 🎯 **Test Coverage Summary**:
 * 
 * ✅ **Crisis Mode**: Verifies faster probing during outages
 * ✅ **Recovery Mode**: Confirms gentle acceleration for recent failures  
 * ✅ **Stable Mode**: Validates baseline behavior for healthy services
 * ✅ **Watch Mode**: Tests user-initiated intensive monitoring
 * ✅ **Safety**: Ensures minimum intervals and graceful edge case handling
 * ✅ **Priority Handling**: Verifies differential treatment by service priority
 * ✅ **Backward Compatibility**: Confirms legacy multiplier format works
 * 
 * **Critical Success Criteria**: 
 * - Offline channels MUST probe faster than online channels
 * - No probe intervals below 10 seconds (safety limit)
 * - Watch mode ALWAYS takes precedence over other strategies
 * - Critical services get preferential treatment during crisis
 */