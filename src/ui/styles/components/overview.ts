/**
 * Overview Dashboard CSS Styles
 * 
 * Contains styles for:
 * - Dashboard content layout and containers
 * - Metrics summary cards and statistics
 * - Watch status banners
 * - Empty states and placeholders
 * 
 * @author Health Watch Team
 * @version 1.0.0
 * @date 2025-08-20
 */

export const OVERVIEW_CSS = `
/* Overview Dashboard Styles */
.dashboard-content {
    max-width: 1200px;
    margin: 0 auto;
}
.metrics-summary {
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    gap: 20px;
    margin-bottom: 30px;
}
.metric-card {
    background: var(--vscode-textBlockQuote-background);
    border-radius: 8px;
    padding: 20px;
    border: 1px solid var(--vscode-panel-border);
    text-align: center;
    flex: 1;
    max-width: 280px;
}
.metric-card.metric-good {
    border-color: var(--vscode-charts-green);
}
.metric-card.metric-warning {
    border-color: var(--vscode-charts-orange);
}
.metric-card.metric-critical {
    border-color: var(--vscode-charts-red);
}
.metric-label {
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
    margin-bottom: 8px;
    text-transform: uppercase;
    font-weight: bold;
}
.metric-value {
    font-size: 28px;
    font-weight: bold;
    margin: 8px 0;
}
.metric-detail {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
}

/* Watch Status Banner */
.watch-banner {
    background: var(--vscode-textCodeBlock-background);
    border: 1px solid var(--vscode-charts-blue);
    border-radius: 8px;
    padding: 15px;
    margin-bottom: 30px;
    display: flex;
    align-items: center;
    gap: 15px;
}
.watch-icon {
    font-size: 20px;
}
.watch-info {
    flex: 1;
}
.watch-title {
    font-weight: bold;
    margin-bottom: 4px;
}
.watch-details {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
}
.watch-stop-btn {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
}
.watch-stop-btn:hover {
    background: var(--vscode-button-hoverBackground);
}

/* Empty States */
.empty-state {
    text-align: center;
    padding: 60px 20px;
    color: var(--vscode-descriptionForeground);
}
.empty-icon {
    font-size: 48px;
    margin-bottom: 15px;
}
.empty-title {
    font-size: 18px;
    font-weight: bold;
    margin-bottom: 10px;
    color: var(--vscode-foreground);
}
.empty-description {
    font-size: 14px;
    max-width: 400px;
    margin: 0 auto;
    margin-left: auto;
    margin-right: auto;
}

/* Specific empty states */
.empty-incidents {
    text-align: center;
    padding: 60px 20px;
    color: var(--vscode-descriptionForeground);
}
`;