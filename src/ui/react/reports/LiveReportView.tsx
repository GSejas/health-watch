/**
 * Live Report View with Real-time Markdown Generation
 * 
 * Interactive dashboard for generating filtered connectivity reports
 */

import React, { useState, useEffect, useMemo } from 'react';
import { LiveMarkdownGenerator, ReportFilter } from '../../reports/LiveMarkdownGenerator';

/**
 * Simple markdown to HTML converter with Mermaid support
 */
function renderMarkdownToHTML(markdown: string): string {
    return markdown
        // Headers
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        
        // Bold text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        
        // Links (VS Code commands)
        .replace(/\[([^\]]+)\]\(command:([^)]+)\)/g, '<a href="#" onclick="window.vscode?.postMessage({command: \'$2\'}); return false;">$1</a>')
        
        // Regular links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
        
        // Tables
        .replace(/^\|(.+)\|$/gim, (match) => {
            const cells = match.slice(1, -1).split('|').map(cell => cell.trim());
            return `<tr>${cells.map(cell => `<td>${cell}</td>`).join('')}</tr>`;
        })
        .replace(/(<tr>.*<\/tr>)/s, '<table style="border-collapse: collapse; width: 100%; margin: 10px 0;"><tbody>$1</tbody></table>')
        
        // Mermaid diagrams 
        .replace(/```mermaid\n([\s\S]*?)\n```/g, (match, diagram) => {
            const diagramId = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
            return `
                <div class="mermaid-container" style="background: var(--vscode-textBlockQuote-background); padding: 16px; border-radius: 4px; margin: 16px 0; border-left: 4px solid var(--vscode-progressBar-background);">
                    <div style="font-size: 12px; color: var(--vscode-descriptionForeground); margin-bottom: 8px;">📊 Mermaid Chart</div>
                    <pre style="background: var(--vscode-textCodeBlock-background); padding: 12px; border-radius: 3px; overflow-x: auto; font-size: 11px; line-height: 1.4;">${diagram.trim()}</pre>
                    <div style="font-size: 10px; color: var(--vscode-descriptionForeground); margin-top: 8px;">
                        💡 Copy this Mermaid code to render charts in VS Code Markdown Preview or external tools
                    </div>
                </div>
            `;
        })
        
        // Code blocks
        .replace(/```(\w+)?\n([\s\S]*?)\n```/g, '<pre style="background: var(--vscode-textCodeBlock-background); padding: 12px; border-radius: 3px; overflow-x: auto;"><code>$2</code></pre>')
        
        // Inline code
        .replace(/`([^`]+)`/g, '<code style="background: var(--vscode-textCodeBlock-background); padding: 2px 4px; border-radius: 2px;">$1</code>')
        
        // Lists
        .replace(/^\- (.+)$/gim, '<li>$1</li>')
        .replace(/(<li>.*<\/li>)/s, '<ul style="margin: 8px 0; padding-left: 20px;">$1</ul>')
        
        // Horizontal rules
        .replace(/^---$/gim, '<hr style="border: none; border-top: 1px solid var(--vscode-panel-border); margin: 20px 0;">')
        
        // Line breaks
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n/g, '<br>');
}

interface LiveReportViewProps {
    channels: any[];
    states: any;
    samples: Map<string, any[]>;
    generator?: LiveMarkdownGenerator;
}

interface FilterState extends ReportFilter {
    autoRefresh: boolean;
    refreshInterval: number;
}

export const LiveReportView: React.FC<LiveReportViewProps> = ({ 
    channels, 
    states, 
    samples,
    generator = new LiveMarkdownGenerator() 
}) => {
    const [filter, setFilter] = useState<FilterState>({
        timeRange: '6h',
        includeCharts: true,
        includeStats: true,
        includeTrends: true,
        autoRefresh: false,
        refreshInterval: 30000
    });

    const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
    const [generatedReport, setGeneratedReport] = useState<string>('');
    const [lastGenerated, setLastGenerated] = useState<Date | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    // Convert states object/Map to Map for consistency
    const statesMap = useMemo(() => {
        if (states instanceof Map) return states;
        const map = new Map();
        Object.entries(states || {}).forEach(([id, state]) => map.set(id, state));
        return map;
    }, [states]);

    // Generate report
    const generateReport = async () => {
        setIsGenerating(true);
        try {
            const reportFilter: ReportFilter = {
                ...filter,
                channels: selectedChannels.length > 0 ? selectedChannels : undefined
            };
            
            const markdown = generator.generateConnectivityReport(
                channels,
                statesMap,
                samples,
                reportFilter
            );
            
            setGeneratedReport(markdown);
            setLastGenerated(new Date());
        } catch (error) {
            console.error('Failed to generate report:', error);
            setGeneratedReport(`# Error Generating Report\n\n${error.message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    // Auto-refresh effect
    useEffect(() => {
        if (!filter.autoRefresh) return;
        
        const interval = setInterval(generateReport, filter.refreshInterval);
        return () => clearInterval(interval);
    }, [filter.autoRefresh, filter.refreshInterval, selectedChannels, filter]);

    // Channel selection handlers
    const toggleChannel = (channelId: string) => {
        setSelectedChannels(prev => 
            prev.includes(channelId) 
                ? prev.filter(id => id !== channelId)
                : [...prev, channelId]
        );
    };

    const selectAllChannels = () => {
        setSelectedChannels(channels.map(ch => ch.id));
    };

    const clearChannelSelection = () => {
        setSelectedChannels([]);
    };

    // Copy to clipboard
    const copyReport = async () => {
        try {
            await navigator.clipboard.writeText(generatedReport);
            // Could show toast notification here
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
        }
    };

    // Export as file
    const exportReport = () => {
        const blob = new Blob([generatedReport], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `health-watch-report-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const timeRangeOptions = [
        { value: '1h', label: '1 Hour' },
        { value: '6h', label: '6 Hours' },
        { value: '12h', label: '12 Hours' },
        { value: '1d', label: '1 Day' },
        { value: '7d', label: '7 Days' },
        { value: '30d', label: '30 Days' }
    ];

    return (
        <div style={{ fontFamily: 'var(--vscode-font-family)', height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <style>{`
                .live-report-container {
                    padding: 16px;
                    background: var(--vscode-editor-background);
                    color: var(--vscode-foreground);
                    height: 100%;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                }
                .filter-panel {
                    background: var(--vscode-sideBar-background);
                    border: 1px solid var(--vscode-sideBar-border);
                    border-radius: 4px;
                    padding: 16px;
                    margin-bottom: 16px;
                    flex-shrink: 0;
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
                .filter-button {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 6px 12px;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 12px;
                    transition: background-color 0.2s;
                }
                .filter-button:hover {
                    background: var(--vscode-button-hoverBackground);
                }
                .filter-button.active {
                    background: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                }
                .filter-button.primary {
                    background: var(--vscode-progressBar-background);
                    color: white;
                    font-weight: 500;
                }
                .filter-button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
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
                .report-container {
                    flex: 1;
                    background: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 4px;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                }
                .report-header {
                    background: var(--vscode-editorGroupHeader-tabsBackground);
                    padding: 8px 16px;
                    border-bottom: 1px solid var(--vscode-panel-border);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-shrink: 0;
                }
                .report-content {
                    flex: 1;
                    padding: 16px;
                    overflow-y: auto;
                    font-family: var(--vscode-editor-font-family);
                    white-space: pre-wrap;
                    line-height: 1.4;
                }
                .loading-overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-weight: 500;
                }
                select {
                    background: var(--vscode-dropdown-background);
                    color: var(--vscode-dropdown-foreground);
                    border: 1px solid var(--vscode-dropdown-border);
                    padding: 4px 8px;
                    border-radius: 3px;
                    font-size: 12px;
                }
                input[type="checkbox"] {
                    margin-right: 6px;
                }
                .status-text {
                    font-size: 11px;
                    color: var(--vscode-descriptionForeground);
                }
            `}</style>

            <div className="live-report-container">
                {/* Filter Panel */}
                <div className="filter-panel">
                    <div className="filter-row">
                        <div className="filter-group">
                            <label>Time Range:</label>
                            <select 
                                value={filter.timeRange}
                                onChange={(e) => setFilter(prev => ({ ...prev, timeRange: e.target.value as any }))}
                            >
                                {timeRangeOptions.map(option => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="filter-group">
                            <label>
                                <input 
                                    type="checkbox" 
                                    checked={filter.includeCharts}
                                    onChange={(e) => setFilter(prev => ({ ...prev, includeCharts: e.target.checked }))}
                                />
                                Charts
                            </label>
                        </div>

                        <div className="filter-group">
                            <label>
                                <input 
                                    type="checkbox" 
                                    checked={filter.includeStats}
                                    onChange={(e) => setFilter(prev => ({ ...prev, includeStats: e.target.checked }))}
                                />
                                Stats
                            </label>
                        </div>

                        <div className="filter-group">
                            <label>
                                <input 
                                    type="checkbox" 
                                    checked={filter.includeTrends}
                                    onChange={(e) => setFilter(prev => ({ ...prev, includeTrends: e.target.checked }))}
                                />
                                Trends
                            </label>
                        </div>

                        <div className="filter-group">
                            <label>
                                <input 
                                    type="checkbox" 
                                    checked={filter.autoRefresh}
                                    onChange={(e) => setFilter(prev => ({ ...prev, autoRefresh: e.target.checked }))}
                                />
                                Auto-refresh
                            </label>
                        </div>
                    </div>

                    <div className="filter-row">
                        <div className="filter-group">
                            <span>Channels:</span>
                            <button className="filter-button" onClick={selectAllChannels}>
                                All ({channels.length})
                            </button>
                            <button className="filter-button" onClick={clearChannelSelection}>
                                None
                            </button>
                        </div>

                        <div className="filter-group">
                            <button 
                                className="filter-button primary" 
                                onClick={generateReport}
                                disabled={isGenerating}
                            >
                                {isGenerating ? '⏳ Generating...' : '📊 Generate Report'}
                            </button>
                        </div>
                    </div>

                    {/* Channel Selection Pills */}
                    <div className="channel-pills">
                        {channels.map(channel => (
                            <span
                                key={channel.id}
                                className={`channel-pill ${selectedChannels.includes(channel.id) ? 'selected' : ''}`}
                                onClick={() => toggleChannel(channel.id)}
                                title={`${channel.type?.toUpperCase()}: ${channel.url || channel.target}`}
                            >
                                {channel.name || channel.id}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Report Display */}
                <div className="report-container" style={{ position: 'relative' }}>
                    <div className="report-header">
                        <div>
                            <strong>Live Connectivity Report</strong>
                            {lastGenerated && (
                                <span className="status-text" style={{ marginLeft: '12px' }}>
                                    Generated: {lastGenerated.toLocaleTimeString()}
                                </span>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="filter-button" onClick={copyReport} disabled={!generatedReport}>
                                📋 Copy
                            </button>
                            <button className="filter-button" onClick={exportReport} disabled={!generatedReport}>
                                💾 Export
                            </button>
                        </div>
                    </div>
                    
                    <div className="report-content">
                        {generatedReport ? (
                            <div dangerouslySetInnerHTML={{ __html: renderMarkdownToHTML(generatedReport) }} />
                        ) : (
                            <div style={{ textAlign: 'center', color: 'var(--vscode-descriptionForeground)', padding: '40px' }}>
                                📊 Click "Generate Report" to create a real-time connectivity report with filtered data and Mermaid charts.
                                <br /><br />
                                <small>Reports include availability metrics, latency trends, outage analysis, and interactive charts.</small>
                            </div>
                        )}
                    </div>

                    {isGenerating && (
                        <div className="loading-overlay">
                            ⏳ Generating report...
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};