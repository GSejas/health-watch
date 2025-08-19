# Dashboard: Live Monitor Entries Click → Details View

- Owner: Claude
- Status: Planned
- Effort: M
- Labels: dashboard, UX, details

## Short Description
Allow clicking individual live monitor requests/samples to open a detailed view of that sample (headers, body length, status, timings).

## Acceptance Criteria
- [ ] Click opens a details pane/modal with full sample info.
- [ ] Navigable via keyboard; escape to close.

## Risk Notes
- PII leakage if detailed payloads included; ensure safe data exposure.

## Estimated Effort
- Size: M

## Test Plan
- Manual: Click entries; verify details correctness and accessibility.
