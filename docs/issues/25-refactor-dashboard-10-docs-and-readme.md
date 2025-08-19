# 25-refactor-dashboard-10-docs-and-readme

- Owner: TBA
- Status: Todo
- Effort: S
- Labels: docs, refactor

## Short description
Document the refactor, new modules, and developer workflow in `docs/` and update `README.md` with instructions for running tests, building, and adding dashboard views.

## Acceptance criteria
- [ ] `docs/architecture-dashboard.md` added describing new module boundaries (data, views, utils, lifecycle).
- [ ] `README.md` updated with developer steps for running and testing the dashboard locally.
- [ ] Each new module includes a short README header explaining its purpose.

## Original lines/functions to move / docs
Document the original large methods that were split so reviewers can trace prior behavior:
- `getBaseCSS` (src/ui/dashboard.ts, ~line 1865)
- `getBaseScripts` (src/ui/dashboard.ts, ~line 1920)
- `generateDashboardHTML` (src/ui/dashboard.ts, ~line 284)
- `generateOverviewDashboard` (src/ui/dashboard.ts, ~line 310)

## Dependencies & other changes
- Add `docs/architecture-dashboard.md` and link it from `README.md`.
- Update developer contributing guide with the incremental PR plan and checklist.

## Risks/Notes
- Keep docs concise and up-to-date with PR changes to avoid bitrot.

## Test plan
- Validate README commands locally: `npm run compile`, `npm test`, and running the extension in the debugger to open the dashboard.
