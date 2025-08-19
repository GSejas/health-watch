# Fix Status Bar Stuck on "Ending..."

- Owner: Claude
- Status: Planned
- Effort: S
- Labels: bug, statusbar, scheduler

## Short Description
When a watch ends, the status bar sometimes remains “Ending...”. Ensure finalization and UI reset.

## Acceptance Criteria
- [ ] Repro added to tests.
- [ ] Watch stop reliably clears and shows idle/next steps.
- [ ] No regressions to start/stop/auto-complete flows.

## Risk Notes
- Racy events between scheduler and UI; sleep/resume edge cases.

## Estimated Effort
- Size: S

## Test Plan
- Unit/E2E: simulate watch end; assert status label transitions.
