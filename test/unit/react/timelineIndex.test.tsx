import { JSDOM } from 'jsdom';
import {
    mountTimelineSwimlanesView,
    unmountTimelineSwimlanesView,
    updateTimelineSwimlanesView,
    mountTimelineHeatmapView,
    updateTimelineHeatmapView,
    unmountTimelineHeatmapView,
    mountTimelineIncidentsView,
    updateTimelineIncidentsView,
    unmountTimelineIncidentsView
} from '../../../src/ui/react/timeline/index';
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';

const props: any = { channels: [], states: {}, timelineData: {}, timeRange: '7D' };

describe('timeline index exports', () => {
    beforeEach(() => {
        const dom = new JSDOM('<!doctype html><html><body><div id="timeline-root"></div></body></html>');
        // @ts-ignore
        global.document = dom.window.document;
        // @ts-ignore
        global.window = dom.window;
    });

    it('mounts, updates and unmounts swimlanes view without error', () => {
        expect(() => mountTimelineSwimlanesView('timeline-root', props)).not.toThrow();
        expect(() => updateTimelineSwimlanesView('timeline-root', props)).not.toThrow();
        expect(() => unmountTimelineSwimlanesView()).not.toThrow();
    });

    it('mounts heatmap and incidents views without error', () => {
        const heatmapProps: any = { channels: [], heatmapData: {}, timeRange: '7D' };
        const incidentsProps: any = { channels: [], incidents: [], states: {}, timeRange: '7D' };
        const rootId = 'timeline-root';
        expect(() => mountTimelineHeatmapView(rootId, heatmapProps)).not.toThrow();
        expect(() => updateTimelineHeatmapView(rootId, heatmapProps)).not.toThrow();
        expect(() => unmountTimelineHeatmapView()).not.toThrow();

        expect(() => mountTimelineIncidentsView(rootId, incidentsProps)).not.toThrow();
        expect(() => updateTimelineIncidentsView(rootId, incidentsProps)).not.toThrow();
        expect(() => unmountTimelineIncidentsView()).not.toThrow();
    });
});
