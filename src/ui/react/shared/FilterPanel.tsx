/**
 * Reusable Filter Panel Component for Timeline Views
 * 
 * Provides time range, channel selection, and view options filtering
 */

import React, { useState } from 'react';

export interface FilterOptions {
    timeRange: '5m' | '1h' | '6h' | '12h' | '1d' | '7d' | '30d';
    selectedChannels: string[];
    showOnlyProblems: boolean;
    refreshRate?: number;
}

interface FilterPanelProps {
    channels: any[];
    filters: FilterOptions;
    onFiltersChange: (filters: FilterOptions) => void;
    showRefreshRate?: boolean;
    showProblemFilter?: boolean;
    className?: string;
}

const timeRangeOptions = [
    { value: '5m', label: '5 Minutes' },
    { value: '1h', label: '1 Hour' },
    { value: '6h', label: '6 Hours' },
    { value: '12h', label: '12 Hours' },
    { value: '1d', label: '1 Day' },
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' }
];

const refreshRateOptions = [
    { value: 5000, label: '5s' },
    { value: 15000, label: '15s' },
    { value: 30000, label: '30s' },
    { value: 60000, label: '1m' },
    { value: 300000, label: '5m' }
];

export const FilterPanel: React.FC<FilterPanelProps> = ({
    channels,
    filters,
    onFiltersChange,
    showRefreshRate = false,
    showProblemFilter = false,
    className = ''
}) => {
    const [expanded, setExpanded] = useState(false);

    const updateFilters = (updates: Partial<FilterOptions>) => {
        onFiltersChange({ ...filters, ...updates });
    };

    const toggleChannel = (channelId: string) => {
        const newSelection = filters.selectedChannels.includes(channelId)
            ? filters.selectedChannels.filter(id => id !== channelId)
            : [...filters.selectedChannels, channelId];
        updateFilters({ selectedChannels: newSelection });
    };

    const selectAllChannels = () => {
        updateFilters({ selectedChannels: channels.map(ch => ch.id) });
    };

    const clearChannelSelection = () => {
        updateFilters({ selectedChannels: [] });
    };

    return (
        <div className={`filter-panel ${className}`} style={{ 
            background: 'var(--vscode-sideBar-background)',
            border: '1px solid var(--vscode-sideBar-border)',
            borderRadius: '4px',
            marginBottom: '16px'
        }}>
            <style>{`
                .filter-panel {
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-foreground);
                }
                .filter-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px 16px;
                    cursor: pointer;
                    border-bottom: 1px solid var(--vscode-panel-border);
                }
                .filter-content {
                    padding: 16px;
                }
                .filter-row {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    margin-bottom: 12px;
                    flex-wrap: wrap;
                }
                .filter-group {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .filter-select {
                    background: var(--vscode-dropdown-background);
                    color: var(--vscode-dropdown-foreground);
                    border: 1px solid var(--vscode-dropdown-border);
                    padding: 4px 8px;
                    border-radius: 3px;
                    font-size: 12px;
                    min-width: 80px;
                }
                .filter-button {
                    background: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                    border: none;
                    padding: 6px 12px;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 12px;
                    transition: background-color 0.2s;
                }
                .filter-button:hover {
                    background: var(--vscode-button-secondaryHoverBackground);
                }
                .channel-pills {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                    margin-top: 8px;
                }
                .channel-pill {
                    background: var(--vscode-badge-background);
                    color: var(--vscode-badge-foreground);
                    padding: 4px 8px;
                    border-radius: 12px;
                    font-size: 11px;
                    cursor: pointer;
                    border: 1px solid transparent;
                    transition: all 0.2s;
                }
                .channel-pill.selected {
                    background: var(--vscode-progressBar-background);
                    color: white;
                    border-color: var(--vscode-progressBar-background);
                }
                .channel-pill:hover {
                    opacity: 0.8;
                }
                .expand-button {
                    background: none;
                    border: none;
                    color: var(--vscode-foreground);
                    cursor: pointer;
                    padding: 4px;
                    display: flex;
                    align-items: center;
                    font-size: 12px;
                }
                .checkbox-input {
                    margin-right: 6px;
                }
                .label-text {
                    font-size: 12px;
                    font-weight: 500;
                }
                .compact-row {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 8px 16px;
                }
            `}</style>

            {/* Compact header - always visible */}
            <div 
                className="filter-header"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="compact-row" style={{ margin: 0, padding: 0 }}>
                    <div className="filter-group">
                        <span className="label-text">Time:</span>
                        <select 
                            className="filter-select"
                            value={filters.timeRange}
                            onChange={(e) => updateFilters({ timeRange: e.target.value as any })}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {timeRangeOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    
                    <div className="filter-group">
                        <span className="label-text">
                            Channels: {filters.selectedChannels.length || 'All'}/{channels.length}
                        </span>
                    </div>

                    {showProblemFilter && (
                        <div className="filter-group">
                            <label style={{ display: 'flex', alignItems: 'center', fontSize: '12px' }}>
                                <input 
                                    type="checkbox" 
                                    className="checkbox-input"
                                    checked={filters.showOnlyProblems}
                                    onChange={(e) => updateFilters({ showOnlyProblems: e.target.checked })}
                                    onClick={(e) => e.stopPropagation()}
                                />
                                Problems Only
                            </label>
                        </div>
                    )}
                </div>

                <button className="expand-button">
                    {expanded ? '▼' : '▶'} {expanded ? 'Less' : 'More'}
                </button>
            </div>

            {/* Expanded content */}
            {expanded && (
                <div className="filter-content">
                    <div className="filter-row">
                        <div className="filter-group">
                            <span className="label-text">Channel Selection:</span>
                            <button className="filter-button" onClick={selectAllChannels}>
                                All ({channels.length})
                            </button>
                            <button className="filter-button" onClick={clearChannelSelection}>
                                None
                            </button>
                        </div>

                        {showRefreshRate && (
                            <div className="filter-group">
                                <span className="label-text">Refresh:</span>
                                <select 
                                    className="filter-select"
                                    value={filters.refreshRate || 30000}
                                    onChange={(e) => updateFilters({ refreshRate: parseInt(e.target.value) })}
                                >
                                    {refreshRateOptions.map(option => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Channel Pills */}
                    <div className="channel-pills">
                        {channels.map(channel => (
                            <span
                                key={channel.id}
                                className={`channel-pill ${
                                    filters.selectedChannels.length === 0 || 
                                    filters.selectedChannels.includes(channel.id) ? 'selected' : ''
                                }`}
                                onClick={() => toggleChannel(channel.id)}
                                title={`${channel.type?.toUpperCase()}: ${channel.url || channel.target}`}
                            >
                                {channel.name || channel.id}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};