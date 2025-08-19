/**
 * React Metrics View Entry Point
 * 
 * Provides a mount function to render the MetricsView component into a DOM element.
 * Used by the webview to hydrate the React component with data from the extension.
 */

import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import MetricsView, { MetricsViewProps } from './MetricsView';

// Global variable to store the React root
let reactRoot: Root | null = null;

/**
 * Mount the MetricsView React component to the specified container
 */
export function mountMetricsView(containerId: string, props: MetricsViewProps): void {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container with id "${containerId}" not found`);
        return;
    }

    // Create root if it doesn't exist
    if (!reactRoot) {
        reactRoot = createRoot(container);
    }

    // Render the MetricsView component
    reactRoot.render(
        <React.StrictMode>
            <MetricsView {...props} />
        </React.StrictMode>
    );
}

/**
 * Unmount the React component (for cleanup)
 */
export function unmountMetricsView(): void {
    if (reactRoot) {
        reactRoot.unmount();
        reactRoot = null;
    }
}

/**
 * Update the MetricsView with new data (for live updates)
 */
export function updateMetricsView(props: MetricsViewProps): void {
    if (reactRoot) {
        reactRoot.render(
            <React.StrictMode>
                <MetricsView {...props} />
            </React.StrictMode>
        );
    }
}

// Export for global access in webview
declare global {
    interface Window {
        HealthWatch?: {
            mountMetricsView: typeof mountMetricsView;
            updateMetricsView: typeof updateMetricsView;
            unmountMetricsView: typeof unmountMetricsView;
        };
    }
}

// Expose functions globally for webview access
if (typeof window !== 'undefined') {
    window.HealthWatch = {
        mountMetricsView,
        updateMetricsView,
        unmountMetricsView
    };
}