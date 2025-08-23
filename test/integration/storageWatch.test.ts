import { describe, it, before, after } from 'mocha';
import { strict as assert } from 'assert';
import { StorageManager } from '../../src/storage';

// Minimal fake ExtensionContext with in-memory globalState
class FakeGlobalState {
    private store: Record<string, any> = {};
    get(key: string) { return this.store[key]; }
    update(key: string, value: any) { this.store[key] = value; return Promise.resolve(); }
}

const fakeContext: any = {
    globalState: new FakeGlobalState(),
    extensionPath: '/tmp',
    asAbsolutePath: (p: string) => p
};

describe('StorageManager watch controls (integration)', function() {
    this.timeout(10000);

    before(() => {
        // Initialize storage manager singleton with fake context
        try {
            (StorageManager as any).instance = undefined; // reset singleton if present
        } catch {}
        StorageManager.initialize(fakeContext as any);
    });

    after(() => {
        // cleanup singleton
        try { (StorageManager as any).instance = undefined; } catch {}
    });

    it('startWatch creates an active watch and pause/resume/extend work', async () => {
        const storage = await StorageManager.whenInitialized();
        await storage.whenReady();

        const s = storage.startWatch('1h');
        assert.ok(s);
        assert.equal((s as any).isActive, true);

        // Pause
        const paused = storage.pauseWatch();
        assert.ok(paused);
        assert.equal((paused as any).paused, true);
        assert.ok((paused as any).pauseTimestamp);

        // Resume
        const resumed = storage.resumeWatch();
        assert.ok(resumed);
        assert.equal((resumed as any).paused, false);
        assert.ok((resumed as any).pausedAccumMs >= 0);

        // Extend by 30 minutes
        const beforeEnd = (resumed as any).endTime || ((resumed as any).startTime + (resumed as any).duration);
        const extended = storage.extendWatch(30 * 60 * 1000);
        assert.ok(extended);
        const afterEnd = (extended as any).endTime || ((extended as any).startTime + (extended as any).duration);
        assert.ok(afterEnd >= beforeEnd);

        // Extend to forever
        const forever = storage.extendWatch('forever');
        assert.equal((forever as any).duration, 'forever');
        assert.equal((forever as any).endTime, undefined);
    });
});
