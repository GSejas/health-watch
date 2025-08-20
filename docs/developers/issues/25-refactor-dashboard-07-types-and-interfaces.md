# 25-refactor-dashboard-07-types-and-interfaces

- Owner: TBA
- Status: Todo
- Effort: M
- Labels: refactor, types, typings

## Short description
Define clear TypeScript interfaces for data shapes used across the dashboard. Create `src/ui/dashboardTypes.ts` and replace `any` return types in extracted modules.

## Acceptance criteria
- [ ] `dashboardTypes.ts` defines typed interfaces for TimelineData, HeatmapData, Incident, ChannelMetrics, MetricSummary, and DashboardState.
- [ ] Extracted modules import these types and export typed functions.
- [ ] `DashboardManager` updated to use the new types in signatures.

## Original lines/functions to move / re-type
Focus on functions that now return `any` or build raw objects:
- `generateDashboardData` (src/ui/dashboard.ts, ~line 176)
- `generateTimelineData` (src/ui/dashboard.ts, ~line 2257)
- `generateMetricsData` (src/ui/dashboard.ts, ~line 2371)
- `getRecentSamples` (src/ui/dashboard.ts, ~line 2128)
- `generateHourlyHeatmapData` (src/ui/dashboard.ts, ~line 2287)

## Dependencies & other changes
- New file: `src/ui/dashboardTypes.ts` exporting interfaces.
- Update imports in `src/ui/dashboard.ts` and new modules to reference these types.
- Add small type-change PRs incrementally to avoid large diffs.
- Optionally add `tsd` or type-only unit checks if desired.

## Risks/Notes
- Careful typing required for legacy `StorageManager` sample shapes; may require minor adapters.
- Avoid breaking public APIs; keep types backward-compatible where possible.

## Test plan
- Add compile-time-only tests (TypeScript checks) and run `npm run build` during CI to ensure no type regressions.
