import { JSDOM } from 'jsdom';
import { mountLiveMonitorView, unmountLiveMonitorView, updateLiveMonitorView } from '../../../src/ui/react/monitor/index';
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';

const props: any = { channels: [], states: {}, recentSamples: [] };

describe('monitor index exports', () => {
    beforeEach(() => {
        const dom = new JSDOM('<!doctype html><html><body><div id="monitor-root"></div></body></html>');
        // @ts-ignore
        global.document = dom.window.document;
        // @ts-ignore
        global.window = dom.window;
    });

    it('mounts, updates and unmounts monitor view without error', () => {
        expect(() => mountLiveMonitorView('monitor-root', props)).not.toThrow();
        expect(() => updateLiveMonitorView('monitor-root', props)).not.toThrow();
        expect(() => unmountLiveMonitorView()).not.toThrow();
    });
});
