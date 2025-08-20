import { JSDOM } from 'jsdom';
import { mountMetricsView, unmountMetricsView, updateMetricsView } from '../../../src/ui/react/metrics/index';
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';

// Minimal props object matching MetricsViewProps shape (partial)
const props: any = { metrics: [], title: 'Test' };

describe('metrics index exports', () => {
    let container: HTMLElement;

    beforeEach(() => {
        const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>');
        // @ts-ignore
        global.document = dom.window.document;
        // @ts-ignore
        global.window = dom.window;
        container = document.getElementById('root') as HTMLElement;
    });

    it('exposes mount, update and unmount functions', () => {
        expect(typeof mountMetricsView).toBe('function');
        expect(typeof updateMetricsView).toBe('function');
        expect(typeof unmountMetricsView).toBe('function');
    });

    it('mounts and unmounts without throwing', () => {
        expect(() => mountMetricsView('root', props)).not.toThrow();
        expect(() => updateMetricsView(props)).not.toThrow();
        expect(() => unmountMetricsView()).not.toThrow();
    });
});
