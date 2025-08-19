import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { OverviewView, OverviewViewProps } from './OverviewView';

// Global React root for overview view
let reactRoot: Root | null = null;

/**
 * Mount the OverviewView React component
 */
export function mountOverviewView(containerId: string, props: OverviewViewProps): void {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container element with id "${containerId}" not found`);
        return;
    }
    
    if (!reactRoot) {
        reactRoot = createRoot(container);
    }
    
    reactRoot.render(
        <React.StrictMode>
            <OverviewView {...props} />
        </React.StrictMode>
    );
}

/**
 * Update the OverviewView React component with new props
 */
export function updateOverviewView(containerId: string, props: OverviewViewProps): void {
    mountOverviewView(containerId, props);
}

/**
 * Unmount the OverviewView React component
 */
export function unmountOverviewView(): void {
    if (reactRoot) {
        reactRoot.unmount();
        reactRoot = null;
    }
}

// Export for module usage
export { OverviewView, type OverviewViewProps };

// Expose functions globally for webview usage
if (typeof window !== 'undefined') {
    (window as any).HealthWatch = {
        ...(window as any).HealthWatch,
        mountOverviewView,
        updateOverviewView,
        unmountOverviewView
    };
}