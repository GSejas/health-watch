import React from 'react';

export interface TimelineNavigationProps {
    activeView: 'swimlanes' | 'heatmap' | 'incidents';
    timeRange: string;
    refreshInterval?: string;
    onViewChange?: (view: 'swimlanes' | 'heatmap' | 'incidents') => void;
    onTimeRangeChange?: (range: string) => void;
    onRefreshIntervalChange?: (interval: string) => void;
    onRefresh?: () => void;
}

interface DropdownProps {
    label: string;
    value: string;
    options: Array<{ value: string; label: string; icon?: string }>;
    onChange: (value: string) => void;
    width?: string;
}

const Dropdown: React.FC<DropdownProps> = ({ label, value, options, onChange, width = "140px" }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = options.find(opt => opt.value === value);

    return (
        <div className="dropdown-container" ref={dropdownRef} style={{ position: 'relative', minWidth: width }}>
            <button
                className="dropdown-button"
                onClick={() => setIsOpen(!isOpen)}
                style={{ width: '100%' }}
            >
                <span className="dropdown-label">{label}:</span>
                <span className="dropdown-value">
                    {selectedOption?.icon && <span className="dropdown-icon">{selectedOption.icon}</span>}
                    {selectedOption?.label || value}
                </span>
                <span className="dropdown-arrow">{isOpen ? '▲' : '▼'}</span>
            </button>
            
            {isOpen && (
                <div className="dropdown-menu">
                    {options.map(option => (
                        <button
                            key={option.value}
                            className={`dropdown-option ${option.value === value ? 'selected' : ''}`}
                            onClick={() => {
                                onChange(option.value);
                                setIsOpen(false);
                            }}
                        >
                            {option.icon && <span className="dropdown-icon">{option.icon}</span>}
                            {option.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export const TimelineNavigation: React.FC<TimelineNavigationProps> = ({
    activeView,
    timeRange,
    refreshInterval = 'off',
    onViewChange,
    onTimeRangeChange,
    onRefreshIntervalChange,
    onRefresh
}) => {
    const viewOptions = [
        { value: 'swimlanes', label: 'Swimlanes', icon: '🏊' },
        { value: 'heatmap', label: 'Heatmap', icon: '🔥' },
        { value: 'incidents', label: 'Incidents', icon: '⚠️' }
    ];

    const timeRangeOptions = [
        { value: '1h', label: 'Last hour', icon: '⏰' },
        { value: '6h', label: 'Last 6 hours', icon: '⏰' },
        { value: '12h', label: 'Last 12 hours', icon: '⏰' },
        { value: '1d', label: 'Last day', icon: '📅' },
        { value: '3d', label: 'Last 3 days', icon: '📅' },
        { value: '7d', label: 'Last 7 days', icon: '📅' },
        { value: '30d', label: 'Last 30 days', icon: '📅' },
        { value: '90d', label: 'Last 90 days', icon: '📅' }
    ];

    const refreshOptions = [
        { value: 'off', label: 'Off', icon: '⏸️' },
        { value: '5s', label: '5s', icon: '🔄' },
        { value: '10s', label: '10s', icon: '🔄' },
        { value: '30s', label: '30s', icon: '🔄' },
        { value: '1m', label: '1m', icon: '🔄' },
        { value: '5m', label: '5m', icon: '🔄' },
        { value: '15m', label: '15m', icon: '🔄' }
    ];

    return (
        <div className="timeline-navigation">
            <div className="nav-section nav-left">
                <h1 className="nav-title">Health Watch Timeline</h1>
                
                <div className="nav-tabs">
                    {viewOptions.map(option => (
                        <button
                            key={option.value}
                            className={`nav-tab ${activeView === option.value ? 'active' : ''}`}
                            onClick={() => onViewChange?.(option.value as any)}
                        >
                            <span className="tab-icon">{option.icon}</span>
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="nav-section nav-right">
                <div className="nav-controls">
                    {onTimeRangeChange && (
                        <Dropdown
                            label="Time range"
                            value={timeRange}
                            options={timeRangeOptions}
                            onChange={onTimeRangeChange}
                            width="160px"
                        />
                    )}

                    {onRefreshIntervalChange && (
                        <Dropdown
                            label="Refresh"
                            value={refreshInterval}
                            options={refreshOptions}
                            onChange={onRefreshIntervalChange}
                            width="120px"
                        />
                    )}

                    {onRefresh && (
                        <button className="refresh-button" onClick={onRefresh} title="Refresh now">
                            🔄
                        </button>
                    )}
                </div>
            </div>

            <style>{navigationStyles}</style>
        </div>
    );
};

const navigationStyles = `
    .timeline-navigation {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 20px;
        background: var(--vscode-editor-background);
        border-bottom: 1px solid var(--vscode-widget-border);
        min-height: 60px;
        gap: 20px;
        flex-wrap: wrap;
    }

    .nav-section {
        display: flex;
        align-items: center;
        gap: 16px;
    }

    .nav-left {
        flex: 1;
        min-width: 0;
    }

    .nav-right {
        flex-shrink: 0;
    }

    .nav-title {
        font-size: 18px;
        font-weight: 600;
        color: var(--vscode-foreground);
        margin: 0;
        white-space: nowrap;
    }

    .nav-tabs {
        display: flex;
        gap: 4px;
    }

    .nav-tab {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 16px;
        background: transparent;
        border: 1px solid transparent;
        border-radius: 6px;
        color: var(--vscode-foreground);
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .nav-tab:hover {
        background: var(--vscode-list-hoverBackground);
        border-color: var(--vscode-widget-border);
    }

    .nav-tab.active {
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border-color: var(--vscode-button-border);
    }

    .tab-icon {
        font-size: 16px;
    }

    .nav-controls {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    /* Dropdown Styles */
    .dropdown-container {
        position: relative;
    }

    .dropdown-button {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        background: var(--vscode-dropdown-background);
        color: var(--vscode-dropdown-foreground);
        border: 1px solid var(--vscode-dropdown-border);
        border-radius: 4px;
        font-size: 13px;
        cursor: pointer;
        gap: 8px;
        min-height: 32px;
        transition: border-color 0.2s ease;
    }

    .dropdown-button:hover {
        border-color: var(--vscode-inputOption-activeBorder);
    }

    .dropdown-button:focus {
        outline: 1px solid var(--vscode-focusBorder);
        outline-offset: -1px;
    }

    .dropdown-label {
        font-size: 11px;
        color: var(--vscode-descriptionForeground);
        white-space: nowrap;
    }

    .dropdown-value {
        display: flex;
        align-items: center;
        gap: 4px;
        font-weight: 500;
        white-space: nowrap;
    }

    .dropdown-icon {
        font-size: 12px;
    }

    .dropdown-arrow {
        font-size: 10px;
        color: var(--vscode-descriptionForeground);
        margin-left: auto;
    }

    .dropdown-menu {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: var(--vscode-dropdown-background);
        border: 1px solid var(--vscode-dropdown-border);
        border-radius: 4px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 1000;
        max-height: 300px;
        overflow-y: auto;
        margin-top: 2px;
    }

    .dropdown-option {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 8px 12px;
        background: transparent;
        border: none;
        color: var(--vscode-dropdown-foreground);
        font-size: 13px;
        cursor: pointer;
        text-align: left;
        transition: background-color 0.2s ease;
    }

    .dropdown-option:hover {
        background: var(--vscode-list-hoverBackground);
    }

    .dropdown-option.selected {
        background: var(--vscode-list-activeSelectionBackground);
        color: var(--vscode-list-activeSelectionForeground);
    }

    .refresh-button {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: 1px solid var(--vscode-button-border);
        border-radius: 4px;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .refresh-button:hover {
        background: var(--vscode-button-hoverBackground);
        transform: rotate(90deg);
    }

    .refresh-button:active {
        transform: rotate(180deg);
    }

    /* Responsive */
    @media (max-width: 768px) {
        .timeline-navigation {
            flex-direction: column;
            align-items: stretch;
            gap: 12px;
        }

        .nav-section {
            justify-content: center;
        }

        .nav-tabs {
            justify-content: center;
        }

        .nav-controls {
            justify-content: center;
            flex-wrap: wrap;
        }
    }
`;