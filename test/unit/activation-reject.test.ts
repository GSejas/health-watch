import { strict as assert } from 'assert';
import { HealthWatchAPIImpl } from '../../src/api';

describe('Activation rejection smoke', () => {
    it('API ready rejection should propagate and methods should reject', async () => {
        const api = new HealthWatchAPIImpl(null as any);

        // Create readiness promise that rejects
    let rejectReady: (err: any) => void = () => { /* noop until assigned */ };
    api.ready = new Promise<void>((_res, rej) => { rejectReady = rej; });

    // Reject readiness
    rejectReady(new Error('init failed'));

        // Awaiting api.ready should reject
        let caught = false;
        try {
            await api.ready;
        } catch (err: any) {
            caught = true;
            assert.equal(String(err.message), 'init failed');
        }
        assert.equal(caught, true, 'expected ready to reject');

        // API methods should still throw friendly errors when scheduler absent
        try {
            await api.runChannelNow('x');
            assert.fail('Expected runChannelNow to throw');
        } catch (err: any) {
            assert.ok(/initializing/i.test(String(err)) || /still initializing/i.test(String(err)), 'Expected initialization message');
        }
    });
});
