import { JSDOM } from 'jsdom';
import { mountOverviewView, unmountOverviewView, updateOverviewView } from '../../../src/ui/react/overview/index';
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';

const props: any = { channels: [], states: {}, metricsData: {} };

describe('overview index exports', () => {
    beforeEach(() => {
        const dom = new JSDOM('<!doctype html><html><body><div id="overview-root"></div></body></html>');
        // @ts-ignore
        global.document = dom.window.document;
        // @ts-ignore
        global.window = dom.window;
    });

    it('mounts, updates and unmounts overview view without error', () => {
        expect(() => mountOverviewView('overview-root', props)).not.toThrow();
        expect(() => updateOverviewView('overview-root', props)).not.toThrow();
        expect(() => unmountOverviewView()).not.toThrow();
    });
});
