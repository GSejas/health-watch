# 25-refactor-dashboard-05-lifecycle-and-events

- Owner: TBA
- Status: Todo
- Effort: M
- Labels: refactor, dashboard, lifecycle

## Short description
Refactor lifecycle, event listeners, and refresh scheduling so `DashboardManager` focuses on wiring only. Move scheduling logic and auto-refresh helpers into a `dashboardLifecycle.ts` or keep inside `DashboardManager` but slimmed down.

## Acceptance criteria
- [ ] Auto-refresh start/stop logic is clearly separated and testable.
- [ ] Panel message/event handlers are organized and isolated (e.g., `handlePanelMessage`).
- [ ] Disposal and resource cleanup are unit-tested where feasible.

## Risks/Notes
- Event naming and message payloads are integration points with webview script; verify compatibility.

## Test plan
- Verify starting/stopping auto-refresh does not leak timers on repeated open/close cycles.
- Add a small automated test that simulates messages from webview if possible.
