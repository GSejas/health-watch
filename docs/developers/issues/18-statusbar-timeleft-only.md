# Status Bar: Show Only Time Remaining (Remove Latency/"Watch")

- Owner: Claude
- Status: **NEEDS UPDATE** 🔄
- Effort: S
- Labels: statusbar, UX

## Short Description
Simplify the status bar to show only remaining watch time; remove latency and the "Watch" caption.

## Current Implementation Status
🔄 **PARTIALLY IMPLEMENTED** - Status bar exists but needs cleanup for better UX.

### What's Implemented
- ✅ StatusBarManager class in `src/ui/statusBar.ts`
- ✅ Shows aggregate channel status (online/offline counts)
- ✅ Displays watch status with time remaining
- ✅ Dynamic updates based on channel states
- ✅ Integration with new schema fields: `showInStatusBar` for individual channels

### What Needs Update
- 🔄 Clean up status bar display formatting
- 🔄 Implement individual channel status bar items for channels with `showInStatusBar: true`
- 🔄 Simplify watch time display format
- 🔄 Add support for custom channel icons in status bar

## Acceptance Criteria
- [x] ✅ Status bar shows aggregate health status
- [x] ✅ Time remaining displayed during active watch
- [ ] 🔄 **NEEDS WORK** - Individual channel status items for `showInStatusBar` channels
- [ ] 🔄 **NEEDS WORK** - Clean up display format and remove unnecessary information

## Estimated Effort
- Size: S

## Test Plan
- Manual: Start/stop watches; verify label content.
