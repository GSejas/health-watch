/**
 * React-based overview dashboard view component.
 * 
 * Provides a placeholder HTML structure and hydrates with React component.
 * The actual overview rendering is handled by the React OverviewView component.
 */

export interface OverviewViewData {
    channels: any[];
    states: Map<string, any>;
    currentWatch?: any;
    navigation: string;
    baseCSS: string;
    baseScripts: string;
    reactBundleUri?: string; // Converted webview URI for React bundle
    nonce?: string; // CSP nonce for scripts
    cspSource?: string; // VS Code webview CSP source
}

/**
 * Generates the overview dashboard HTML with React component mount point
 */
export function generateOverviewDashboard(data: OverviewViewData): string {
    const { channels, states, currentWatch, navigation, baseCSS, baseScripts } = data;
    
    // Convert Map to plain object for JSON serialization
    const statesObj: Record<string, any> = {};
    states.forEach((value, key) => {
        statesObj[key] = value;
    });
    
    // Prepare props for React component
    const reactProps = {
        channels,
        states: statesObj, // Pass as plain object
        currentWatch
    };

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${data.cspSource || ''} https:; script-src ${data.cspSource || ''} 'nonce-${data.nonce || ''}'; style-src ${data.cspSource || ''} 'unsafe-inline';">
        <title>Health Watch - Overview</title>
        ${baseCSS}
    </head>
    <body>
        ${navigation}
        
        <!-- React component mount point -->
        <div id="overview-root">
            <div style="text-align: center; padding: 40px; color: var(--vscode-descriptionForeground);">
                <div>Loading overview dashboard...</div>
                <div style="margin-top: 10px; font-size: 12px;">Initializing React component</div>
            </div>
        </div>
        
        ${baseScripts}
        
        <!-- React bundle -->
        ${data.reactBundleUri ? `<script nonce="${data.nonce || ''}" src="${data.reactBundleUri}"></script>` : ''}
        
        <!-- Mount React component -->
        <script nonce="${data.nonce || ''}">
            // Mount the React component
            if (window.HealthWatch && window.HealthWatch.mountOverviewView) {
                window.HealthWatch.mountOverviewView('overview-root', ${JSON.stringify(reactProps)});
            } else {
                console.error('HealthWatch React components not loaded');
            }
        </script>
    </body>
    </html>
    `;
}