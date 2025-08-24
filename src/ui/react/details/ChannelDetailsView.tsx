import React, { useEffect, useState } from 'react';
import { formatRelativeTime } from '../../dashboardUtils';

export interface ChannelDetailsViewProps {
    channel: any;
    state?: any;
    schedule?: any;
    globalDefaults: any;
}

interface EffectiveValue {
    value: any;
    display: string;
    isOverridden: boolean;
    source: string;
}

const getEffectiveValue = (channelValue: any, defaultValue: any, suffix = ''): EffectiveValue => {
    const effective = channelValue !== undefined ? channelValue : defaultValue;
    const isOverridden = channelValue !== undefined;
    return {
        value: effective,
        display: `${effective}${suffix}`,
        isOverridden,
        source: isOverridden ? 'channel' : 'default'
    };
};

const getStatusColor = (status: string): string => {
    switch (status) {
        case 'online': return 'emerald';
        case 'offline': return 'red';
        case 'unknown': return 'yellow';
        default: return 'gray';
    }
};

const CollapsibleSection: React.FC<{
    title: string;
    emoji: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
}> = ({ title, emoji, children, defaultOpen = true }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="details-section">
            <h3 
                className={`details-section-header ${isOpen ? 'open' : 'collapsed'}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className="collapse-indicator">{isOpen ? '▼' : '▶'}</span>
                <span className="section-emoji">{emoji}</span>
                {title}
            </h3>
            <div className={`details-section-content ${isOpen ? 'open' : 'collapsed'}`}>
                {children}
            </div>
        </div>
    );
};

const PropertyRow: React.FC<{
    label: string;
    value: string | React.ReactNode;
    className?: string;
}> = ({ label, value, className = '' }) => (
    <div className={`property-row ${className}`}>
        <span className="property-label">{label}:</span>
        <span className="property-value">{value}</span>
    </div>
);

const EffectivePropertyRow: React.FC<{
    label: string;
    effectiveValue: EffectiveValue;
}> = ({ label, effectiveValue }) => (
    <PropertyRow
        label={label}
        value={
            <div className={`effective-value ${effectiveValue.isOverridden ? 'override' : 'default'}`}>
                <span className="value-display">{effectiveValue.display}</span>
                <span className="source-indicator">({effectiveValue.source})</span>
            </div>
        }
    />
);

export const ChannelDetailsView: React.FC<ChannelDetailsViewProps> = ({ 
    channel, 
    state, 
    schedule, 
    globalDefaults 
}) => {
    const status = state?.state || 'unknown';
    const stateIcon = status === 'online' ? '🟢' : status === 'offline' ? '🔴' : '🟡';
    const isPaused = schedule?.isPaused || false;
    const isRunning = state?.isRunning || false;

    const handleAction = (command: string) => {
        if (typeof window !== 'undefined' && (window as any).vscode) {
            (window as any).vscode.postMessage({ command, channelId: channel.id });
        }
    };

    const intervalConfig = getEffectiveValue(channel.intervalSec, globalDefaults.intervalSec, 's');
    const timeoutConfig = getEffectiveValue(channel.timeoutMs, globalDefaults.timeoutMs, 'ms');
    const thresholdConfig = getEffectiveValue(channel.threshold, globalDefaults.threshold, '');
    const jitterConfig = getEffectiveValue(channel.jitterPct, globalDefaults.jitterPct, '%');

    return (
        <div className="channel-details">
            <div className="details-header">
                <div className="channel-title">
                    {stateIcon} {channel.name || channel.id}
                </div>
                <div className={`channel-status status-${status}`}>
                    Status: {status.toUpperCase()}
                </div>
                
                <div className="details-actions">
                    <button 
                        className="btn btn-primary" 
                        onClick={() => handleAction('runChannel')}
                    >
                        ⚡ Run Now
                    </button>
                    {isPaused ? (
                        <button 
                            className="btn btn-primary" 
                            onClick={() => handleAction('resumeChannel')}
                        >
                            ▶️ Resume
                        </button>
                    ) : (
                        <button 
                            className="btn btn-primary" 
                            onClick={() => handleAction('pauseChannel')}
                        >
                            ⏸️ Pause
                        </button>
                    )}
                    <button 
                        className="btn btn-secondary" 
                        onClick={() => handleAction('viewLogs')}
                    >
                        📊 View Logs
                    </button>
                    <button 
                        className="btn btn-secondary" 
                        onClick={() => handleAction('exportData')}
                    >
                        💾 Export Data
                    </button>
                    <button 
                        className="btn btn-secondary" 
                        onClick={() => handleAction('openConfig')}
                    >
                        ⚙️ Edit Config
                    </button>
                </div>
            </div>

            <CollapsibleSection title="Target Configuration" emoji="🎯">
                <PropertyRow label="Type" value={channel.type} />
                <PropertyRow 
                    label="Target" 
                    value={<code>{channel.url || channel.hostname || channel.target || 'N/A'}</code>} 
                />
                
                {channel.expect && Object.keys(channel.expect).length > 0 && (
                    <div className="subsection">
                        <h4>📋 Expectations</h4>
                        {Object.entries(channel.expect).map(([key, value]) => (
                            <PropertyRow 
                                key={key}
                                label={key}
                                value={<code>{JSON.stringify(value)}</code>}
                            />
                        ))}
                    </div>
                )}
                
                {channel.guards && channel.guards.length > 0 && (
                    <div className="subsection">
                        <h4>🛡️ Guards</h4>
                        {channel.guards.map((guard: string, index: number) => (
                            <PropertyRow 
                                key={index}
                                label="Guard"
                                value={<code>{guard}</code>}
                            />
                        ))}
                    </div>
                )}
            </CollapsibleSection>

            <CollapsibleSection title="Timing Configuration" emoji="⚙️">
                <EffectivePropertyRow label="Interval" effectiveValue={intervalConfig} />
                <EffectivePropertyRow label="Timeout" effectiveValue={timeoutConfig} />
                <EffectivePropertyRow label="Threshold" effectiveValue={thresholdConfig} />
                <EffectivePropertyRow label="Jitter" effectiveValue={jitterConfig} />
                
                <div className="subsection">
                    <h4>📅 Schedule Status</h4>
                    <PropertyRow 
                        label="State" 
                        value={isPaused ? '⏸️ Paused' : '▶️ Active'} 
                    />
                    {schedule?.nextRun && (
                        <PropertyRow 
                            label="Next Probe" 
                            value={new Date(schedule.nextRun).toLocaleString()} 
                        />
                    )}
                </div>
            </CollapsibleSection>

            <CollapsibleSection title="Runtime Status" emoji="📈">
                <PropertyRow 
                    label="Current State" 
                    value={<span className={`status-${status}`}>{status.toUpperCase()}</span>}
                />
                <PropertyRow 
                    label="Enabled" 
                    value={channel.enabled !== false ? '✅ Yes' : '❌ No'} 
                />
                
                {state?.lastSample && (
                    <div className="subsection">
                        <h4>🔍 Last Sample</h4>
                        <PropertyRow 
                            label="Success" 
                            value={state.lastSample.success ? '✅ Yes' : '❌ No'} 
                        />
                        <PropertyRow 
                            label="Latency" 
                            value={`${state.lastSample.latencyMs || 'N/A'}ms`} 
                        />
                        <PropertyRow 
                            label="Timestamp" 
                            value={new Date(state.lastSample.timestamp).toLocaleString()} 
                        />
                        {state.lastSample.error && (
                            <PropertyRow 
                                label="Error" 
                                value={<code className="error-text">{state.lastSample.error}</code>} 
                            />
                        )}
                    </div>
                )}
                
                {state?.stats && (
                    <div className="subsection">
                        <h4>📊 Statistics</h4>
                        <PropertyRow 
                            label="Success Rate" 
                            value={`${((state.stats.successRate || 0) * 100).toFixed(1)}%`} 
                        />
                        <PropertyRow 
                            label="Avg Latency" 
                            value={`${state.stats.avgLatency?.toFixed(1) || 'N/A'}ms`} 
                        />
                    </div>
                )}
            </CollapsibleSection>
        </div>
    );
};