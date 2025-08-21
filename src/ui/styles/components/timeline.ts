/**
 * Timeline Views CSS Styles
 * 
 * Contains styles for:
 * - Timeline containers and layouts
 * - Timeline controls and legends
 * - Timeline swimlanes view
 * - Timeline heatmap view
 * - Timeline incidents view
 * - Timeline bars and grid components
 * 
 * @author Health Watch Team
 * @version 1.0.0
 * @date 2025-08-20
 */

export const TIMELINE_CSS = `
/* Timeline Styles */
.timeline-container {
    margin-top: 20px;
}
.timeline-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}
.timeline-controls select {
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    border-radius: 4px;
    padding: 6px 10px;
    font-size: 12px;
}
.timeline-legend {
    display: flex;
    gap: 20px;
    margin-bottom: 20px;
    flex-wrap: wrap;
}
.legend-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
}
.legend-color {
    width: 16px;
    height: 16px;
    border-radius: 3px;
}

.timeline-grid {
    display: grid;
    gap: 2px;
    font-size: 11px;
}
.timeline-labels {
    display: grid;
    grid-template-columns: 120px repeat(24, 1fr);
    gap: 2px;
    margin-bottom: 5px;
}
.channel-label-header {
    font-weight: bold;
    padding: 8px;
    background: var(--vscode-textBlockQuote-background);
}
.date-label {
    text-align: center;
    padding: 4px;
    background: var(--vscode-textBlockQuote-background);
    font-weight: bold;
}
.timeline-row {
    display: grid;
    grid-template-columns: 120px repeat(24, 1fr);
    gap: 2px;
    margin-bottom: 2px;
}
.channel-label {
    padding: 8px;
    background: var(--vscode-textBlockQuote-background);
    display: flex;
    flex-direction: column;
    justify-content: center;
}
.channel-type {
    font-size: 9px;
    color: var(--vscode-descriptionForeground);
    margin-top: 2px;
}
.timeline-bar {
    position: relative;
    height: 30px;
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
}
.bar-fill {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: inherit;
    opacity: 0.3;
}
.sample-count {
    position: relative;
    z-index: 1;
    font-size: 10px;
    color: var(--vscode-foreground);
    font-weight: bold;
}

/* Timeline Swimlanes Styles */
.timeline-swimlanes-container {
    background: var(--vscode-editor-background);
    border-radius: 8px;
    padding: 20px;
    border: 1px solid var(--vscode-panel-border);
}
.timeline-subtitle {
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
}
.timeline-swimlanes {
    display: flex;
    flex-direction: column;
    gap: 15px;
}
.timeline-lane {
    background: var(--vscode-editor-background);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 6px;
    padding: 15px;
}
.lane-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
}
.lane-title {
    font-weight: bold;
    font-size: 14px;
}
.lane-status {
    font-size: 11px;
    padding: 4px 8px;
    border-radius: 4px;
    background: var(--vscode-button-secondaryBackground);
}
.timeline-bars {
    display: flex;
    gap: 2px;
    height: 20px;
    margin-bottom: 8px;
}
.lane-stats {
    display: flex;
    justify-content: space-between;
    align-items: center;
}
.stats-text {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
}

/* Heatmap View Styles */
.timeline-heatmap-container {
    background: var(--vscode-editor-background);
    border-radius: 8px;
    padding: 20px;
    border: 1px solid var(--vscode-panel-border);
}
.heatmap-header {
    margin-bottom: 20px;
}
.heatmap-header h2 {
    margin: 0 0 8px 0;
    font-size: 20px;
    color: var(--vscode-foreground);
}
.heatmap-subtitle {
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
}
.heatmap-legend {
    display: flex;
    align-items: center;
    gap: 15px;
    margin-bottom: 20px;
}
.legend-label {
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
}
.legend-scale {
    display: flex;
    gap: 2px;
    margin-left: 10px;
}
.heatmap-grid {
    display: grid;
    grid-template-columns: 150px repeat(24, 1fr);
    gap: 2px;
    font-size: 11px;
}
.heatmap-row-header {
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 8px;
    background: var(--vscode-textBlockQuote-background);
    border-radius: 4px;
}
.heatmap-cell {
    height: 30px;
    border-radius: 3px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    font-weight: bold;
}

/* Incidents View Styles */
.timeline-incidents-container {
    background: var(--vscode-editor-background);
    border-radius: 8px;
    padding: 20px;
    border: 1px solid var(--vscode-panel-border);
}
.incidents-header {
    margin-bottom: 20px;
}
.incidents-header h2 {
    margin: 0 0 8px 0;
    font-size: 20px;
    color: var(--vscode-foreground);
}
.incidents-subtitle {
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
}
.incidents-list {
    display: flex;
    flex-direction: column;
    gap: 15px;
}
.incident-card {
    background: var(--vscode-textBlockQuote-background);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 6px;
    padding: 15px;
}
.incident-card.incident-critical {
    border-left: 4px solid var(--vscode-charts-red);
}
.incident-card.incident-warning {
    border-left: 4px solid var(--vscode-charts-orange);
}
.incident-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 10px;
}
.incident-title {
    font-weight: bold;
    font-size: 14px;
    color: var(--vscode-foreground);
}
.incident-severity {
    font-size: 11px;
    padding: 4px 8px;
    border-radius: 4px;
    font-weight: bold;
}
.severity-critical {
    background: var(--vscode-charts-red);
    color: white;
}
.severity-warning {
    background: var(--vscode-charts-orange);
    color: white;
}
.incident-details {
    margin-bottom: 10px;
}
.incident-time {
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
    margin-bottom: 5px;
}
.incident-duration {
    font-size: 12px;
    font-weight: bold;
}
.incident-channels {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}
`;