# Per-Channel Enable/Disable Flag

- Owner: Claude
- Status: **COMPLETED** ✅
- Effort: M
- Labels: schema, scheduler, ui

## Short Description
Add an explicit per-channel `enabled` boolean so users can disable a channel without deleting it; disabled channels do not run or affect metrics.

## Current Implementation Status
✅ **IMPLEMENTED** - Channel enable/disable functionality is fully working.

### What's Implemented
- ✅ `enabled?: boolean` field in ChannelDefinition interface (defaults to true)
- ✅ Scheduler respects enabled flag in `shouldRunChannel()` method
- ✅ Tree view shows disabled channels with grayed-out styling
- ✅ Tree view context menu includes "Enable/Disable Channel" action
- ✅ Disabled channels excluded from dashboard metrics calculations
- ✅ State persistence through configuration file updates

## Acceptance Criteria
- [x] ✅ Schema supports `enabled` (default true) for channels
- [x] ✅ Scheduler skips disabled channels via `shouldRunChannel()` check
- [x] ✅ Disabled channels excluded from availability calculations in dashboard
- [x] ✅ Toggle exists in Channels tree with persistent state
- [x] ✅ Visual indication in tree view (grayed-out disabled channels)

## Risk Notes
- Data consistency if toggled mid-outage.
- Persistence choice (in-file vs extension state) documented.

## Estimated Effort
- Size: M

## Test Plan
- Unit: config defaulting; scheduler respects enabled=false.
- E2E: toggle via tree; verify no probes run; SLO unaffected.
