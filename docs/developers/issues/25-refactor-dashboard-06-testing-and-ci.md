# 25-refactor-dashboard-06-testing-and-ci

- Owner: TBA
- Status: Todo
- Effort: S
- Labels: refactor, tests, ci

## Short description
Add unit and integration tests to cover extracted data generators, formatters, and view components. Wire tests into existing CI and add simple smoke tests that exercise the webview rendering pipeline.

## Acceptance criteria
- [ ] Unit tests for data generation functions (timeline, heatmap, incidents, metrics).
- [ ] Unit tests for core formatters (`formatRelativeTime`, `parseDuration`, `calculateAverageLatency`).
- [ ] Snapshot or DOM-like tests for view components (HTML outputs) for a few representative datasets.
- [ ] CI runs tests and fails on regressions.

## Original lines/functions to move / test
Use these functions as direct test targets after extraction:
- `generateTimelineData` (src/ui/dashboard.ts, ~line 2257)
- `generateHourlyHeatmapData` (src/ui/dashboard.ts, ~line 2287)
- `generateIncidentsData` (src/ui/dashboard.ts, ~line 2317)
- `generateMetricsData` (src/ui/dashboard.ts, ~line 2371)
- `formatRelativeTime` (src/ui/dashboard.ts, ~line 2186)
- `calculateAverageLatency` (src/ui/dashboard.ts, ~line 213)

## Dependencies & other changes
- Add unit test files under `test/unit/` (e.g., `dashboardData.test.ts`, `dashboardUtils.test.ts`, `views.test.ts`).
- Use existing test runner (Mocha) and chai/assert or add Jest if preferred — prefer to stay consistent with current repo tests (see `test/`).
- Update `package.json` test script if new runner/tooling is introduced.
- Add a lightweight HTML snapshot helper (e.g., `cheerio`) for view output assertions.

## Risks/Notes
- Tests should use deterministic timestamps and synthetic sample data to avoid flakiness.
- Webview DOM behavior can't be fully executed in unit tests; prefer static HTML snapshot comparisons.

## Test plan
- Write unit tests that run fast and cover edge cases (no samples, all offline, sparse data).
- Add a CI job step to run `npm test` and fail on snapshot mismatches.
