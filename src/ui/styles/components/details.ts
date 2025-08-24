/**
 * Channel Details CSS Component
 * 
 * Provides styling for the channel details view including:
 * - Hierarchical section layout
 * - Collapsible sections with animations  
 * - Property rows with effective value indicators
 * - Action buttons and status indicators
 * - CSP-compliant VS Code theme integration
 * 
 * @module details
 * @version 1.0.0
 * @date 2025-08-23
 */

export const DETAILS_CSS = `
/* Channel Details Container */
.channel-details {
    padding: 20px;
    font-family: var(--vscode-font-family);
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    line-height: 1.5;
}

/* Header Section */
.details-header {
    border-bottom: 2px solid var(--vscode-panel-border);
    padding-bottom: 16px;
    margin-bottom: 24px;
}

.channel-title {
    font-size: 24px;
    font-weight: 700;
    margin-bottom: 8px;
    color: var(--vscode-foreground);
}

.channel-status {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 16px;
}

.channel-status.status-online {
    color: var(--vscode-charts-green);
}

.channel-status.status-offline {
    color: var(--vscode-charts-red);
}

.channel-status.status-unknown {
    color: var(--vscode-charts-yellow);
}

/* Action Buttons */
.details-actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
}

.btn {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: 1px solid var(--vscode-button-border, transparent);
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    font-family: var(--vscode-font-family);
    display: inline-flex;
    align-items: center;
    gap: 6px;
    transition: background-color 0.2s ease;
}

.btn:hover {
    background: var(--vscode-button-hoverBackground);
}

.btn:active {
    background: var(--vscode-button-hoverBackground);
    transform: translateY(1px);
}

.btn-secondary {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
}

.btn-secondary:hover {
    background: var(--vscode-button-secondaryHoverBackground);
}

/* Collapsible Sections */
.details-section {
    background: var(--vscode-textBlockQuote-background);
    border-radius: 8px;
    margin-bottom: 16px;
    border-left: 4px solid var(--vscode-charts-blue);
    overflow: hidden;
}

.details-section-header {
    padding: 16px 20px;
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--vscode-charts-blue);
    cursor: pointer;
    user-select: none;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: background-color 0.2s ease;
}

.details-section-header:hover {
    background: var(--vscode-list-hoverBackground);
}

.collapse-indicator {
    font-size: 12px;
    transition: transform 0.2s ease;
    width: 12px;
    text-align: center;
}

.details-section-header.collapsed .collapse-indicator {
    transform: rotate(-90deg);
}

.section-emoji {
    font-size: 16px;
}

.details-section-content {
    padding: 0 20px;
    transition: all 0.3s ease-out;
    overflow: hidden;
}

.details-section-content.open {
    padding: 0 20px 16px 20px;
    max-height: 1000px;
}

.details-section-content.collapsed {
    max-height: 0;
    padding: 0 20px;
}

/* Property Rows */
.property-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 8px 0;
    border-bottom: 1px dotted var(--vscode-panel-border);
}

.property-row:last-child {
    border-bottom: none;
}

.property-label {
    font-weight: 600;
    min-width: 120px;
    color: var(--vscode-foreground);
}

.property-value {
    color: var(--vscode-descriptionForeground);
    text-align: right;
    flex: 1;
    word-break: break-word;
}

.property-value code {
    font-family: var(--vscode-editor-font-family);
    background: var(--vscode-textCodeBlock-background);
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 90%;
    color: var(--vscode-textPreformat-foreground);
}

.error-text {
    color: var(--vscode-charts-red) !important;
}

/* Effective Values */
.effective-value {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
}

.effective-value.override {
    color: var(--vscode-charts-orange);
}

.effective-value.default {
    color: var(--vscode-descriptionForeground);
}

.value-display {
    font-weight: 600;
}

.source-indicator {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    opacity: 0.7;
    font-style: italic;
}

/* Subsections */
.subsection {
    background: var(--vscode-editor-background);
    border-radius: 6px;
    padding: 12px 16px;
    margin: 12px 0;
    border: 1px solid var(--vscode-panel-border);
}

.subsection h4 {
    margin: 0 0 12px 0;
    color: var(--vscode-descriptionForeground);
    font-size: 14px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 6px;
}

/* Status Indicators */
.status-online {
    color: var(--vscode-charts-green);
}

.status-offline {
    color: var(--vscode-charts-red);
}

.status-unknown {
    color: var(--vscode-charts-yellow);
}

/* Responsive Design */
@media (max-width: 600px) {
    .details-actions {
        flex-direction: column;
    }
    
    .btn {
        width: 100%;
        justify-content: center;
    }
    
    .property-row {
        flex-direction: column;
        gap: 4px;
    }
    
    .property-label {
        min-width: auto;
    }
    
    .property-value {
        text-align: left;
    }
    
    .effective-value {
        align-items: flex-start;
    }
}`;