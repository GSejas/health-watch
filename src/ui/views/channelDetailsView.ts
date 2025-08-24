/**
 * Channel Details View Generator
 * 
 * Generates React-based channel details view with proper client-side hydration
 * following the existing architecture pattern used by dashboard views.
 */

export interface ChannelDetailsViewData {
    channel: any;
    state?: any;
    schedule?: any;
    globalDefaults: any;
    baseCSS: string;
    baseScripts: string;
    reactBundleUri?: string; // Converted webview URI for React bundle
    nonce?: string; // CSP nonce for scripts
    cspSource?: string; // VS Code webview CSP source
}

/**
 * Generates the channel details HTML with React component mount point
 * following the same architecture as other dashboard views
 */
export function generateChannelDetailsView(data: ChannelDetailsViewData): string {
    const { channel, state, schedule, globalDefaults, baseCSS, baseScripts } = data;
    
    // Prepare props for React component
    const reactProps = {
        channel,
        state,
        schedule,
        globalDefaults
    };

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${data.cspSource || ''} https:; script-src ${data.cspSource || ''} 'nonce-${data.nonce || ''}'; style-src ${data.cspSource || ''} https: 'unsafe-inline';">
            <title>Health Watch - Channel Details: ${channel.name || channel.id}</title>
            ${baseCSS}
        </head>
        <body>
            <!-- Channel Details React Mount Point -->
            <div id="channel-details-root" class="dashboard-container" data-view="channelDetails">
                <!-- Loading placeholder until React hydrates -->
                <div class="loading-container">
                    <div class="loading-spinner"></div>
                    <p>Loading channel details...</p>
                </div>
            </div>

            <!-- Base Dashboard Scripts -->
            ${baseScripts}
            
            <!-- Channel Details Component Script -->
            <script nonce="${data.nonce || ''}">
                // Initialize VS Code API
                const vscode = acquireVsCodeApi();
                
                // Channel Details Props
                window.channelDetailsProps = ${JSON.stringify(reactProps)};
                
                // Message handling for React component actions
                window.postMessage = function(message) {
                    vscode.postMessage(message);
                };
                
                // Initialize React component when available
                function initializeChannelDetails() {
                    if (window.React && window.ChannelDetailsView) {
                        const container = document.getElementById('channel-details-root');
                        if (container) {
                            window.ReactDOM.render(
                                window.React.createElement(window.ChannelDetailsView, window.channelDetailsProps),
                                container
                            );
                        }
                    } else {
                        // Retry in 100ms if React isn't loaded yet
                        setTimeout(initializeChannelDetails, 100);
                    }
                }
                
                // Start initialization
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', initializeChannelDetails);
                } else {
                    initializeChannelDetails();
                }
            </script>
            
            ${data.reactBundleUri ? `
                <script nonce="${data.nonce || ''}" src="${data.reactBundleUri}"></script>
            ` : ''}
        </body>
        </html>
    `;
}