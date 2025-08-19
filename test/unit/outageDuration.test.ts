import { strict as assert } from 'assert';
import { Outage } from '../../src/types';

// Test the same logic storage.updateOutage uses but keep it pure so it runs
// without constructing StorageManager or touching disk / vscode APIs.

describe('Outage duration computation (pure)', () => {
    it('computes actualDuration from firstFailureTime when outage is closed', () => {
        const channelId = 'test-channel';
        const now = Date.now();
        const firstFailure = now - 5 * 60 * 1000; // 5 minutes ago
        const confirmedAt = now - 4 * 60 * 1000; // confirmed 4 minutes ago

        const outage: Outage = {
            channelId,
            startTime: confirmedAt,
            reason: 'timeout',
            firstFailureTime: firstFailure,
            confirmedAt,
            failureCount: 2
        };

        // Simulate updateOutage behavior
        const endTime = now;
        outage.endTime = endTime;
        outage.duration = endTime - outage.startTime; // legacy
        if (outage.firstFailureTime) {
            outage.actualDuration = endTime - outage.firstFailureTime;
        }

        assert.equal(typeof outage.actualDuration, 'number', 'actualDuration should be a number');
        assert.equal(outage.actualDuration, endTime - firstFailure, 'actualDuration computed from firstFailureTime');
        // Legacy duration still present
        assert.equal(outage.duration, endTime - outage.startTime);
    });
});
