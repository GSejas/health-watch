# 25-refactor-dashboard-03-view-components

- Owner: Claude
- Status: **COMPLETED + ENHANCED** ✅🚀  
- Effort: L → XL (significantly expanded scope)
- Labels: refactor, dashboard, view, react, completed

## Short description
Split large HTML-producing methods into focused view components. Create files under `src/ui/views/` such as `overviewView.ts`, `timelineView.ts`, `metricsView.ts`, and `liveMonitorView.ts` that accept typed data and return HTML strings.

## Current Implementation Status
✅🚀 **COMPLETED + ENHANCED** - Not only split into view components, but completely migrated to React!

### What's Implemented - Phase 1: HTML View Components
- ✅ Created `src/ui/views/overviewView.ts` - Overview dashboard HTML generation
- ✅ Created `src/ui/views/timelineView.ts` - Timeline views (swimlanes, heatmap, incidents)  
- ✅ Created `src/ui/views/metricsView.ts` - Metrics dashboard with React integration
- ✅ Created `src/ui/views/monitorView.ts` - Live monitoring view
- ✅ Clean APIs with typed data interfaces
- ✅ CSP-compliant with proper nonce handling and webview URI conversion

### What's Implemented - Phase 2: React Migration 🚀
- ✅ **React Overview Component** - `src/ui/react/overview/OverviewView.tsx`
- ✅ **React Timeline Components** - `src/ui/react/timeline/` (swimlanes, heatmap, incidents)
- ✅ **React Monitor Component** - `src/ui/react/monitor/LiveMonitorView.tsx`  
- ✅ **React Metrics Component** - `src/ui/react/metrics/MetricsView.tsx`
- ✅ **Build System Integration** - esbuild compiles all React bundles
- ✅ **Type-Safe Props** - Comprehensive TypeScript interfaces
- ✅ **VS Code Theming** - Full CSS variable integration

### Architecture Evolution
```typescript
// Phase 1: HTML View Components
export function generateOverviewDashboard(data: OverviewViewData): string

// Phase 2: React Components  
export const OverviewView: React.FC<OverviewViewProps> = ({ channels, states, currentWatch }) => {
    // Interactive React components with hooks and state management
}
```

## Acceptance criteria
- [x] ✅ Each major view has dedicated modules with clean APIs
- [x] ✅ `DashboardManager.generateDashboardHTML` delegates to view modules
- [x] ✅ Views are pure with injected dependencies
- [x] ✅ Visual output enhanced (React provides better UX than HTML)
- [x] ✅🚀 **BONUS**: Complete React migration for modern UI architecture

## Risks/Notes
- HTML templates may contain small inline scripts/styles that need careful extraction.
- Keep webview resource URIs and nonce logic centralized to avoid duplication.

## Test plan
- Snapshot tests for HTML output for representative data sets.
- Manual smoke tests loading the dashboard in VS Code after refactor.
