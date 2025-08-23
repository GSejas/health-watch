import { strict as assert } from 'assert';
import { HealthWatchAPIImpl } from '../../src/api';

describe('Activation smoke tests', () => {
    it('API should not throw TypeError when scheduler is null and should indicate not-ready', async () => {
        const api = new HealthWatchAPIImpl(null as any);

        // Simulate a readiness promise that resolves later
    let resolveReady: () => void = () => {};
    api.ready = new Promise<void>((res) => { resolveReady = res; });

        // Calls that rely on scheduler should throw a friendly error, not TypeError
        let threw = false;
        try {
            await api.runChannelNow('nonexistent');
        } catch (err: any) {
            threw = true;
            assert.ok(/initializing/i.test(String(err)), 'Expected initialization error message');
        }
        assert.equal(threw, true, 'Expected runChannelNow to reject when not ready');

        // Now attach a minimal mock scheduler and resolve ready
        const mockScheduler: any = {
            runChannelNow: async (id: string) => ({ success: true, latencyMs: 1, error: null }),
            getScheduleInfo: () => new Map(),
            getChannelRunner: () => ({ getChannelStates: () => new Map(), isChannelRunning: () => false })
        };

        // Assign scheduler and resolve
        (api as any).scheduler = mockScheduler;
        resolveReady();

        const sample = await api.runChannelNow('x');
        assert.equal(sample.success, true);
    });
});
