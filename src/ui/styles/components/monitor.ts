/**
 * Monitor View CSS Styles
 * 
 * Contains styles for:
 * - Live monitoring interface
 * - Real-time activity feeds
 * - Live indicators and pulse animations
 * - Activity lists and logs
 * 
 * @author Health Watch Team
 * @version 1.0.0
 * @date 2025-08-20
 */

export const MONITOR_CSS = `
/* Monitor View Styles */
.monitor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 30px;
}
.monitor-title {
    display: flex;
    align-items: center;
    gap: 15px;
}
.live-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--vscode-charts-green);
    font-weight: bold;
}
.watch-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--vscode-charts-blue);
}

.live-channels h3 {
    margin-bottom: 15px;
    color: var(--vscode-foreground);
}

.activity-feed h3 {
    margin-bottom: 15px;
    color: var(--vscode-foreground);
}
.activity-list {
    max-height: 400px;
    overflow-y: auto;
    border: 1px solid var(--vscode-panel-border);
    border-radius: 4px;
    background: var(--vscode-textBlockQuote-background);
}
.activity-item {
    display: grid;
    grid-template-columns: 80px 12px 1fr;
    gap: 12px;
    padding: 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
    align-items: center;
}
.activity-item:last-child {
    border-bottom: none;
}
.activity-time {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
}
.activity-details {
    font-size: 11px;
}
.activity-channel {
    font-weight: bold;
    margin-bottom: 2px;
}
.activity-info {
    color: var(--vscode-descriptionForeground);
}

.no-activity {
    text-align: center;
    padding: 40px;
    color: var(--vscode-descriptionForeground);
}
.no-activity-icon {
    font-size: 24px;
    margin-bottom: 10px;
}
`;