/**
 * Base CSS Styles
 * 
 * Contains foundational styles including:
 * - Body/HTML base styling with VS Code theme integration
 * - General utility classes for colors, states, and common UI patterns
 * - CSS animations and transitions
 * 
 * SECURITY: All styles use VS Code theme variables (var(--vscode-*))
 * to comply with CSP restrictions (Risk R15)
 * 
 * @author Health Watch Team
 * @version 1.0.0
 * @date 2025-08-20
 */

export const BASE_CSS = `
/* Base Styling */
body {
    font-family: var(--vscode-font-family);
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    margin: 0;
    padding: 20px;
    line-height: 1.4;
}

/* General Utility Classes */
.section-title {
    margin-top: 0;
    color: var(--vscode-foreground);
}
.value-good { color: var(--vscode-charts-green); }
.value-warning { color: var(--vscode-charts-orange); }
.value-critical { color: var(--vscode-charts-red); }
.text-muted { color: var(--vscode-descriptionForeground); }

/* Status Colors */
.metric-online { color: var(--vscode-charts-green); }
.metric-offline { color: var(--vscode-charts-red); }
.metric-unknown { color: var(--vscode-charts-orange); }

.latency-good { color: var(--vscode-charts-green); }
.latency-warning { color: var(--vscode-charts-orange); }
.latency-critical { color: var(--vscode-charts-red); }

.status-online .status-indicator { background: var(--vscode-charts-green); }
.status-offline .status-indicator { background: var(--vscode-charts-red); }
.status-unknown .status-indicator { background: var(--vscode-charts-orange); }

.bar-online { background: var(--vscode-charts-green); }
.bar-degraded { background: var(--vscode-charts-orange); }
.bar-offline { background: var(--vscode-charts-red); }
.bar-unknown { background: var(--vscode-charts-gray); }

/* Heat Map Intensity Colors */
.heat-0 { background: var(--vscode-editor-background); }
.heat-1 { background: var(--vscode-charts-green); opacity: 0.3; }
.heat-2 { background: var(--vscode-charts-green); opacity: 0.5; }
.heat-3 { background: var(--vscode-charts-green); opacity: 0.7; }
.heat-4 { background: var(--vscode-charts-green); opacity: 0.9; }
.heat-5 { background: var(--vscode-charts-green); }

/* Status Indicators */
.status-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
}

.status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
}
.status-dot.success { background: var(--vscode-charts-green); }
.status-dot.failure { background: var(--vscode-charts-red); }

/* Channel Status Indicators */
.channel-status-indicator {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
}
.channel-status-indicator.online { background: var(--vscode-charts-green); }
.channel-status-indicator.offline { background: var(--vscode-charts-red); }
.channel-status-indicator.unknown { background: var(--vscode-charts-orange); }

/* Pulse Animation for Live Indicators */
.pulse-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--vscode-charts-green);
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0.3; }
    100% { opacity: 1; }
}

/* Toast Animation Keyframes */
@keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
}
@keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
}

/* Status Class Helpers */
.status-healthy { color: var(--vscode-charts-green); }
.status-degraded { color: var(--vscode-charts-orange); }
.status-critical { color: var(--vscode-charts-red); }
`;