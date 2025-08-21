/**
 * Channel Cards CSS Styles
 * 
 * Contains styles for:
 * - Channel status cards and grids
 * - Channel details and information display
 * - Channel actions and buttons
 * - Error states and indicators
 * - Live channel monitoring cards
 * 
 * @author Health Watch Team
 * @version 1.0.0
 * @date 2025-08-20
 */

export const CHANNELS_CSS = `
/* Channel Cards */
.channels-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 20px;
    margin-bottom: 30px;
}
.channel-card {
    background: var(--vscode-textBlockQuote-background);
    border-radius: 8px;
    padding: 20px;
    border: 1px solid var(--vscode-panel-border);
}
.channel-card.channel-online {
    border-left: 4px solid var(--vscode-charts-green);
}
.channel-card.channel-offline {
    border-left: 4px solid var(--vscode-charts-red);
}
.channel-card.channel-unknown {
    border-left: 4px solid var(--vscode-charts-orange);
}
.channel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
}
.channel-name {
    font-weight: bold;
    font-size: 14px;
}
.channel-status {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: bold;
}
.channel-details {
    margin: 15px 0;
}
.detail-row {
    display: flex;
    justify-content: space-between;
    margin: 8px 0;
    font-size: 12px;
}
.detail-label {
    color: var(--vscode-descriptionForeground);
    font-weight: 500;
}
.detail-value {
    color: var(--vscode-foreground);
}
.channel-url {
    font-family: var(--vscode-editor-font-family);
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.channel-errors {
    margin: 10px 0;
    padding: 8px;
    background: var(--vscode-inputValidation-errorBackground);
    border-radius: 4px;
    border: 1px solid var(--vscode-inputValidation-errorBorder);
    display: flex;
    align-items: center;
    gap: 8px;
}
.error-message {
    font-size: 11px;
    color: var(--vscode-inputValidation-errorForeground);
}

.channel-actions {
    display: flex;
    gap: 8px;
    margin-top: 15px;
}
.action-btn {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
    display: flex;
    align-items: center;
    gap: 4px;
    text-decoration: none;
}
.action-btn:hover {
    background: var(--vscode-button-hoverBackground);
}
.action-btn.primary {
    background: var(--vscode-button-background);
}
.btn-icon {
    font-size: 10px;
}

/* Live Channel Cards for Monitor View */
.live-channels-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 15px;
    margin-bottom: 30px;
}
.live-channel-card {
    background: var(--vscode-textBlockQuote-background);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 6px;
    padding: 12px;
    display: flex;
    align-items: center;
    gap: 12px;
}
.channel-info {
    flex: 1;
}
.channel-latency {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
}

/* Channel Tags */
.channel-tag {
    font-size: 10px;
    padding: 3px 6px;
    border-radius: 3px;
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
}
`;