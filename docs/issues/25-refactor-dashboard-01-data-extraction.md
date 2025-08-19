# 25-refactor-dashboard-01-data-extraction

- Owner: Claude  
- Status: **COMPLETED** ✅
- Effort: M
- Labels: refactor, dashboard, data, completed

## Short description
Extract all pure data-generation logic out of `src/ui/dashboard.ts` into a new module `src/ui/dashboardData.ts` (or similar). Functions to extract include: `generateTimelineData`, `generateHourlyHeatmapData`, `generateIncidentsData`, `generateMetricsData`, and supporting helpers that operate purely on samples/history.

## Current Implementation Status
✅ **COMPLETED** - Data extraction successfully implemented with comprehensive type safety.

### What's Implemented
- ✅ Created `src/ui/dashboardData.ts` with all pure data-generation functions
- ✅ Comprehensive TypeScript interfaces for all data structures
- ✅ Functions extracted: `generateTimelineData`, `generateHeatmapData`, `generateIncidentsData`, `generateMetricsData`
- ✅ Supporting utilities: sample aggregation, availability calculations, time-range helpers
- ✅ Full type safety with interfaces: `TimelineData`, `HeatmapData`, `DashboardIncident`, `DashboardMetrics`

### Data Architecture
```typescript
// Pure data generation functions
export function generateTimelineData(channels: any[], days: number, storage: StorageManager): TimelineData
export function generateHeatmapData(channels: any[], storage: StorageManager): HeatmapData  
export function generateIncidentsData(channels: any[], storage: StorageManager): DashboardIncident[]
export function generateMetricsData(channels: any[], states: Map<string, any>): DashboardMetrics
```

## Acceptance criteria
- [x] ✅ New file `src/ui/dashboardData.ts` with pure functions and explicit typed inputs/outputs
- [x] ✅ Unit tests created at `test/unit/dashboardUtils.test.ts` 
- [x] ✅ `DashboardManager` imports and delegates to new module with unchanged behavior
- [x] ✅ No runtime behavior changes or UI regressions - all dashboard views working

## Risks/Notes
- Data shape must be typed carefully to avoid coupling to UI templates.
- Ensure timezone and time-range calculations remain consistent.

## Test plan
- Add unit tests that feed synthetic sample sets and verify availability, counts, and derived metrics.
- Run existing integration/e2e tests to ensure dashboard renders identically.
