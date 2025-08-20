/**
 * Reports React App Entry Point
 * 
 * Renders the LiveReportView component in the webview
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { LiveReportView } from './LiveReportView';

// Extend window interface for Health Watch props
declare global {
    interface Window {
        healthWatchProps: {
            channels: any[];
            states: any;
            samples: Record<string, any[]>;
        };
        healthWatchComponent: string;
        vscode: {
            postMessage: (message: any) => void;
        };
    }
}

function renderApp() {
    const container = document.getElementById('live-reports-root');
    if (!container) {
        console.error('Could not find live-reports-root container');
        return;
    }

    const props = window.healthWatchProps;
    if (!props) {
        console.error('Health Watch props not found on window');
        return;
    }

    // Convert samples object to Map for consistency with LiveReportView
    const samplesMap = new Map();
    Object.entries(props.samples || {}).forEach(([id, samples]) => {
        samplesMap.set(id, samples);
    });

    const root = createRoot(container);
    root.render(
        <LiveReportView 
            channels={props.channels || []}
            states={props.states || {}}
            samples={samplesMap}
        />
    );
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderApp);
} else {
    renderApp();
}