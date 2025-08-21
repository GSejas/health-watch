/**
 * Navigation and Header CSS Styles
 * 
 * Contains styles for:
 * - Dashboard header and title
 * - Primary and secondary navigation
 * - Live monitor controls
 * - Refresh buttons and controls
 * 
 * @author Health Watch Team
 * @version 1.0.0
 * @date 2025-08-20
 */

export const NAVIGATION_CSS = `
/* Dashboard Header & Navigation */
.dashboard-header {
    margin-bottom: 30px;
    border-bottom: 1px solid var(--vscode-panel-border);
    padding-bottom: 15px;
}
.header-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
}
.dashboard-title {
    font-size: 24px;
    font-weight: bold;
    margin: 0;
    color: var(--vscode-foreground);
}
.dashboard-controls {
    display: flex;
    align-items: center;
    gap: 15px;
}
.live-monitor-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
}
.live-monitor-toggle input[type="checkbox"] {
    margin: 0;
}
.refresh-btn {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border: none;
    padding: 8px;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
}
.refresh-btn:hover {
    background: var(--vscode-button-secondaryHoverBackground);
}

.primary-navigation {
    display: flex;
    gap: 8px;
    margin-bottom: 10px;
}
.nav-item {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    text-decoration: none;
}
.nav-item:hover {
    background: var(--vscode-button-secondaryHoverBackground);
}
.nav-item.active {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
}

.sub-navigation {
    display: flex;
    gap: 4px;
    margin-top: 8px;
}
.sub-nav-item {
    background: transparent;
    color: var(--vscode-descriptionForeground);
    border: 1px solid var(--vscode-panel-border);
    padding: 6px 12px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 11px;
    text-decoration: none;
}
.sub-nav-item:hover {
    background: var(--vscode-list-hoverBackground);
}
.sub-nav-item.active {
    background: var(--vscode-list-activeSelectionBackground);
    color: var(--vscode-list-activeSelectionForeground);
}
`;