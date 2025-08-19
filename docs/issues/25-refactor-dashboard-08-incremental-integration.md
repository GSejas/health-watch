# 25-refactor-dashboard-08-incremental-integration

- Owner: TBA
- Status: Todo
- Effort: M
- Labels: refactor, integration

## Short description
Perform the refactor in small, mergeable steps: extract one piece at a time (data → formatters → views → lifecycle) and verify at each step by running the extension locally and using smoke tests.

## Acceptance criteria
- [ ] A sequence of small PRs exist, each with focused changes and tests.
- [ ] Dashboard behavior remains stable after each PR.
- [ ] No single PR modifies more than two files in production code.

## Original lines/functions to move / integration points
Prioritize these for staged extraction and rewiring:
- `generateQuickStats` (src/ui/dashboard.ts, ~line 199)
- `generateOverviewDashboard` (src/ui/dashboard.ts, ~line 310)
- `generateDashboardHTML` (src/ui/dashboard.ts, ~line 284)
- `getBaseCSS` / `getBaseScripts` (src/ui/dashboard.ts, ~lines 1865, 1920)

## Dependencies & other changes
- Each PR will introduce a new module and update `src/ui/dashboard.ts` to import it.
- Ensure webview nonce/URI building functions remain available to view modules (possibly export small helper from `dashboardManager` or `uiUtils`).
- Add smoke test checklist for PR reviewers to verify (open dashboard, check nav, change view, close panel).

## Risks/Notes
- Avoid large merge conflicts by rebasing often; coordinate with teammates.
- Keep changes backward-compatible to avoid extension user breakage.

## Test plan
- For each PR, run `npm run compile`, open VS Code extension host debug, load the dashboard and walk through basic flows.
- Add PR checklist items for manual QA to validate rendering and performance.
