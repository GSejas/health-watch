// path: src/ui/react/shared/baseStyles.ts

/**
 * Centralized base styles for all Health Watch React components.
 * These styles ensure consistency across all dashboard views and maintain
 * proper VS Code theme integration.
 */
export const baseStyles = `
    /* Base Styling - Common to all views */
    body {
        font-family: var(--vscode-font-family);
        color: var(--vscode-foreground);
        background: var(--vscode-editor-background);
        margin: 0;
        padding: 0;
        line-height: 1.4;
    }

    .dashboard-content {
        padding: 20px;
        background: var(--vscode-editor-background);
        color: var(--vscode-editor-foreground);
        font-family: var(--vscode-font-family);
        height: 100vh;
        overflow-y: auto;
    }

    /* Typography */
    h1, h2, h3, h4, h5, h6 {
        color: var(--vscode-foreground);
        margin: 0 0 16px 0;
        font-weight: 600;
    }

    h1 { font-size: 24px; }
    h2 { font-size: 20px; }
    h3 { font-size: 16px; }
    h4 { font-size: 14px; }

    /* Common UI Components */
    .btn {
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        transition: background-color 0.2s ease;
    }

    .btn:hover {
        background: var(--vscode-button-hoverBackground);
    }

    .btn-secondary {
        background: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
    }

    .btn-secondary:hover {
        background: var(--vscode-button-secondaryHoverBackground);
    }

    /* Status Indicators */
    .status-indicator {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        font-weight: 500;
        padding: 4px 8px;
        border-radius: 4px;
    }

    .status-online {
        background: rgba(76, 175, 80, 0.2);
        color: #4caf50;
    }

    .status-offline {
        background: rgba(244, 67, 54, 0.2);
        color: #f44336;
    }

    .status-unknown {
        background: var(--vscode-inputValidation-warningBackground);
        color: var(--vscode-inputValidation-warningForeground);
    }

    /* Cards and Containers */
    .card {
        background: var(--vscode-editor-inactiveSelectionBackground);
        border: 1px solid var(--vscode-widget-border);
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 16px;
        transition: border-color 0.2s ease;
    }

    .card:hover {
        border-color: var(--vscode-focusBorder);
    }

    .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
    }

    .card-title {
        font-size: 16px;
        font-weight: 600;
        color: var(--vscode-foreground);
    }

    .card-subtitle {
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
    }

    /* Empty States */
    .empty-state {
        text-align: center;
        padding: 60px 20px;
        color: var(--vscode-descriptionForeground);
    }

    .empty-icon {
        font-size: 48px;
        margin-bottom: 16px;
        opacity: 0.6;
    }

    .empty-title {
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 8px;
        color: var(--vscode-foreground);
    }

    .empty-description {
        font-size: 14px;
        max-width: 400px;
        margin: 0 auto;
        line-height: 1.5;
    }

    /* Loading States */
    .loading {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 40px;
        color: var(--vscode-descriptionForeground);
    }

    .loading-spinner {
        border: 2px solid var(--vscode-editor-inactiveSelectionBackground);
        border-top: 2px solid var(--vscode-focusBorder);
        border-radius: 50%;
        width: 20px;
        height: 20px;
        animation: spin 1s linear infinite;
        margin-right: 12px;
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }

    /* Form Elements */
    .form-group {
        margin-bottom: 16px;
    }

    .form-label {
        display: block;
        margin-bottom: 4px;
        font-size: 13px;
        font-weight: 500;
        color: var(--vscode-foreground);
    }

    .form-input {
        width: 100%;
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border);
        border-radius: 4px;
        padding: 6px 8px;
        font-size: 13px;
    }

    .form-input:focus {
        outline: 1px solid var(--vscode-focusBorder);
        border-color: var(--vscode-focusBorder);
    }

    .form-select {
        background: var(--vscode-dropdown-background);
        color: var(--vscode-dropdown-foreground);
        border: 1px solid var(--vscode-dropdown-border);
        border-radius: 4px;
        padding: 6px 8px;
        font-size: 13px;
    }

    .form-select:focus {
        outline: 1px solid var(--vscode-focusBorder);
    }

    /* Badges */
    .badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        padding: 4px 8px;
        border-radius: 12px;
    }

    .badge-primary {
        background: var(--vscode-badge-background);
        color: var(--vscode-badge-foreground);
    }

    .badge-success {
        background: #4caf50;
        color: white;
    }

    .badge-warning {
        background: #ff9800;
        color: white;
    }

    .badge-error {
        background: #f44336;
        color: white;
    }

    /* Metrics and Stats */
    .metric-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;
        margin-bottom: 24px;
    }

    .metric-card {
        background: var(--vscode-editor-inactiveSelectionBackground);
        border: 1px solid var(--vscode-widget-border);
        border-radius: 6px;
        padding: 16px;
        text-align: center;
    }

    .metric-value {
        font-size: 24px;
        font-weight: 700;
        color: var(--vscode-foreground);
        margin-bottom: 4px;
    }

    .metric-label {
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .metric-change {
        font-size: 11px;
        margin-top: 4px;
    }

    .metric-change.positive {
        color: #4caf50;
    }

    .metric-change.negative {
        color: #f44336;
    }

    /* Responsive Design */
    @media (max-width: 768px) {
        .dashboard-content {
            padding: 12px;
        }
        
        .metric-grid {
            grid-template-columns: 1fr;
        }
        
        .card {
            padding: 12px;
        }
        
        h1 { font-size: 20px; }
        h2 { font-size: 18px; }
        h3 { font-size: 16px; }
    }

    /* Scrollbars */
    ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
    }

    ::-webkit-scrollbar-track {
        background: var(--vscode-scrollbarSlider-background);
    }

    ::-webkit-scrollbar-thumb {
        background: var(--vscode-scrollbarSlider-hoverBackground);
        border-radius: 4px;
    }

    ::-webkit-scrollbar-thumb:hover {
        background: var(--vscode-scrollbarSlider-activeBackground);
    }
`;