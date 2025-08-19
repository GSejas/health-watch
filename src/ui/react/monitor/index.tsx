import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { LiveMonitorView, LiveMonitorViewProps } from './LiveMonitorView';

// Global React root for monitor view
let monitorRoot: Root | null = null;

/**
 * Mount the LiveMonitorView React component
 */
export function mountLiveMonitorView(containerId: string, props: LiveMonitorViewProps): void {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container element with id "${containerId}" not found`);
        return;
    }
    
    if (!monitorRoot) {
        monitorRoot = createRoot(container);
    }
    
    monitorRoot.render(
        <React.StrictMode>
            <LiveMonitorView {...props} />
        </React.StrictMode>
    );
}

/**
 * Update the LiveMonitorView React component with new props
 */
export function updateLiveMonitorView(containerId: string, props: LiveMonitorViewProps): void {
    mountLiveMonitorView(containerId, props);
}

/**
 * Unmount the LiveMonitorView React component
 */
export function unmountLiveMonitorView(): void {
    if (monitorRoot) {
        monitorRoot.unmount();
        monitorRoot = null;
    }
}

// Export for module usage
export { LiveMonitorView, type LiveMonitorViewProps };

// Expose functions globally for webview usage
if (typeof window !== 'undefined') {
    (window as any).HealthWatch = {
        ...(window as any).HealthWatch,
        mountLiveMonitorView,
        updateLiveMonitorView,
        unmountLiveMonitorView
    };
}