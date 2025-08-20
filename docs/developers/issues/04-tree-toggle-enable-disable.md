# Add Enable/Disable Toggle per Channel in Tree

- Owner: Claude
- Status: Planned
- Effort: M
- Labels: ui, scheduler, persistence

## Short Description
Expose a toggle in the Channels tree to enable/disable a channel (binds to the `enabled` flag).

## Acceptance Criteria
- [ ] Toggle shows current state; switching updates config/state.
- [ ] Disabled channels look distinct (dimmed/strike/icon).
- [ ] Persists across reloads; synchronized with file if stored there.

## Risk Notes
- Conflict resolution if file edits race with UI state.

## Estimated Effort
- Size: M

## Test Plan
- E2E: toggle; reload window; state persists; scheduler respects.
