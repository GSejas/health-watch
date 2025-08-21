/**
 * Health Watch Dashboard CSS Index
 * 
 * Central import point for all modular CSS components.
 * This file assembles the complete dashboard styling from individual components.
 * 
 * ARCHITECTURE:
 * - base.ts: Foundation styles, utilities, animations
 * - navigation.ts: Header, navigation, controls
 * - overview.ts: Metrics cards, banners, empty states
 * - channels.ts: Channel cards, status displays, actions
 * - timeline.ts: Timeline views (swimlanes, heatmap, incidents)
 * - monitor.ts: Live monitoring interface
 * 
 * SECURITY: All modules use VS Code theme variables (var(--vscode-*))
 * to comply with CSP restrictions (Risk R15)
 * 
 * @author Health Watch Team
 * @version 1.0.0
 * @date 2025-08-20
 */

import { BASE_CSS } from './components/base';
import { NAVIGATION_CSS } from './components/navigation';
import { OVERVIEW_CSS } from './components/overview';
import { CHANNELS_CSS } from './components/channels';
import { TIMELINE_CSS } from './components/timeline';
import { MONITOR_CSS } from './components/monitor';

/**
 * Complete dashboard CSS assembled from modular components
 * Maintains exact compatibility with original inline CSS
 */
export const DASHBOARD_CSS = `
<style>
${BASE_CSS}

${NAVIGATION_CSS}

${OVERVIEW_CSS}

${CHANNELS_CSS}

${TIMELINE_CSS}

${MONITOR_CSS}
</style>
`;

// Export individual modules for potential selective use
export {
    BASE_CSS,
    NAVIGATION_CSS,
    OVERVIEW_CSS,
    CHANNELS_CSS,
    TIMELINE_CSS,
    MONITOR_CSS
};