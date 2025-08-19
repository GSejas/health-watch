# 25-refactor-dashboard-09-performance-and-memoization

- Owner: TBA
- Status: Todo
- Effort: M
- Labels: refactor, performance

## Short description
Improve performance by memoizing expensive computations and avoiding repeated sample scans. Add a minimal caching layer for timeline/heatmap generation and invalidate cache on storage changes.

## Acceptance criteria
- [ ] Implement memoization or caching for `generateTimelineData`, `generateHourlyHeatmapData`, and `generateMetricsData`.
- [ ] Cache is invalidated when samples change or time-range options change.
- [ ] Measurable improvement in dashboard render time for large data sets.

## Original lines/functions to move / optimize
Target these CPU-heavy functions:
- `generateTimelineData` (src/ui/dashboard.ts, ~line 2257)
- `generateHourlyHeatmapData` (src/ui/dashboard.ts, ~line 2287)
- `generateMetricsData` (src/ui/dashboard.ts, ~line 2371)
- `getRecentSamples` (src/ui/dashboard.ts, ~line 2128)

## Dependencies & other changes
- Add a small in-memory cache module (e.g., `src/ui/dashboardCache.ts`) or use a lightweight dependency like `lru-cache`.
- Wire cache invalidation into `StorageManager` update events or into the scheduler so cache is cleared on writes.
- Add performance tests or microbenchmarks under `test/perf/` to measure before/after.

## Risks/Notes
- Cache invalidation bugs can lead to stale UI; prioritize correctness.
- Memory usage should be bounded; prefer LRU or TTL-based cache.

## Test plan
- Create synthetic large sample datasets and measure generation time before/after caching.
- Add unit tests for cache hit/miss and invalidation behavior.
