import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { TimelineSwimlanesView, TimelineSwimlanesViewProps } from './TimelineSwimlanesView';
import { TimelineHeatmapView, TimelineHeatmapViewProps } from './TimelineHeatmapView';
import { TimelineIncidentsView, TimelineIncidentsViewProps } from './TimelineIncidentsView';

// Global React roots for timeline views
let swimlanesRoot: Root | null = null;
let heatmapRoot: Root | null = null;
let incidentsRoot: Root | null = null;

/**
 * Mount the TimelineSwimlanesView React component
 */
export function mountTimelineSwimlanesView(containerId: string, props: TimelineSwimlanesViewProps): void {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container element with id "${containerId}" not found`);
        return;
    }
    
    if (!swimlanesRoot) {
        swimlanesRoot = createRoot(container);
    }
    
    swimlanesRoot.render(
        <React.StrictMode>
            <TimelineSwimlanesView {...props} />
        </React.StrictMode>
    );
}

/**
 * Mount the TimelineHeatmapView React component
 */
export function mountTimelineHeatmapView(containerId: string, props: TimelineHeatmapViewProps): void {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container element with id "${containerId}" not found`);
        return;
    }
    
    if (!heatmapRoot) {
        heatmapRoot = createRoot(container);
    }
    
    heatmapRoot.render(
        <React.StrictMode>
            <TimelineHeatmapView {...props} />
        </React.StrictMode>
    );
}

/**
 * Mount the TimelineIncidentsView React component
 */
export function mountTimelineIncidentsView(containerId: string, props: TimelineIncidentsViewProps): void {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container element with id "${containerId}" not found`);
        return;
    }
    
    if (!incidentsRoot) {
        incidentsRoot = createRoot(container);
    }
    
    incidentsRoot.render(
        <React.StrictMode>
            <TimelineIncidentsView {...props} />
        </React.StrictMode>
    );
}

/**
 * Update timeline views with new props
 */
export function updateTimelineSwimlanesView(containerId: string, props: TimelineSwimlanesViewProps): void {
    mountTimelineSwimlanesView(containerId, props);
}

export function updateTimelineHeatmapView(containerId: string, props: TimelineHeatmapViewProps): void {
    mountTimelineHeatmapView(containerId, props);
}

export function updateTimelineIncidentsView(containerId: string, props: TimelineIncidentsViewProps): void {
    mountTimelineIncidentsView(containerId, props);
}

/**
 * Unmount timeline views
 */
export function unmountTimelineSwimlanesView(): void {
    if (swimlanesRoot) {
        swimlanesRoot.unmount();
        swimlanesRoot = null;
    }
}

export function unmountTimelineHeatmapView(): void {
    if (heatmapRoot) {
        heatmapRoot.unmount();
        heatmapRoot = null;
    }
}

export function unmountTimelineIncidentsView(): void {
    if (incidentsRoot) {
        incidentsRoot.unmount();
        incidentsRoot = null;
    }
}

// Export components for module usage
export { 
    TimelineSwimlanesView, 
    TimelineHeatmapView, 
    TimelineIncidentsView,
    type TimelineSwimlanesViewProps,
    type TimelineHeatmapViewProps,
    type TimelineIncidentsViewProps
};

// Expose functions globally for webview usage
if (typeof window !== 'undefined') {
    (window as any).HealthWatch = {
        ...(window as any).HealthWatch,
        mountTimelineSwimlanesView,
        mountTimelineHeatmapView,
        mountTimelineIncidentsView,
        updateTimelineSwimlanesView,
        updateTimelineHeatmapView,
        updateTimelineIncidentsView,
        unmountTimelineSwimlanesView,
        unmountTimelineHeatmapView,
        unmountTimelineIncidentsView
    };
}