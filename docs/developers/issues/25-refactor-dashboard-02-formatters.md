# 25-refactor-dashboard-02-formatters

- Owner: Claude
- Status: **COMPLETED** ✅
- Effort: S
- Labels: refactor, dashboard, utils, completed

## Short description
Move small, pure helper functions (time formatting, `formatRelativeTime`, `parseDuration`, `formatWatchDuration`, `getTimeRangeLabel`, `getTimeRangeDays`) into `src/ui/dashboardUtils.ts` or a shared `src/utils/time.ts`.

## Current Implementation Status
✅ **COMPLETED** - All formatter and utility functions properly extracted and organized.

### What's Implemented
- ✅ Created `src/ui/dashboardUtils.ts` with comprehensive utility functions
- ✅ Functions extracted: `formatRelativeTime`, `formatDuration`, `formatBytes`, `formatWatchDuration`
- ✅ Time utilities: `getTimeRangeDays`, `calculateAvailability`, `generateTimeLabels`
- ✅ Data processing utilities: `aggregateSamples`, `calculateMetrics`
- ✅ All dashboard modules import from centralized utilities
- ✅ React components use the same shared utilities for consistency

### Utility Functions Implemented
```typescript
// Time formatting
export function formatRelativeTime(timestamp: number): string
export function formatDuration(ms: number): string  
export function formatWatchDuration(watch: any): string

// Data processing
export function calculateAvailability(samples: Sample[]): number
export function aggregateSamples(samples: Sample[], bucketSize: number): any[]
export function generateTimeLabels(hours: number): string[]
```

## Acceptance criteria
- [x] ✅ New `src/ui/dashboardUtils.ts` file exists and exports all formatters
- [x] ✅ `DashboardManager` and React components import helpers from utils  
- [x] ✅ Unit tests at `test/unit/dashboardUtils.test.ts` verify formatting rules and edge cases

## Risks/Notes
- Keep signature stable to avoid touching many call sites; prefer adapter wrappers if necessary.

## Test plan
- Add unit tests for `formatRelativeTime`, `parseDuration`, `formatWatchDuration` with deterministic timestamps.
