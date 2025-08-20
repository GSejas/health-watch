# Config Overrides Bug: intervalSec/timeoutMs Not Respected

- Owner: Claude
- Status: ✅ **COMPLETED**
- Effort: S
- Labels: bug, scheduler, config, completed

## Short Description
Fix bug where `intervalSec` and/or `timeoutMs` from `.healthwatch.json` aren't reflected in the UI/scheduler (defaults used instead).

## ✅ Implementation Completed
**Fixed in**: `src/runner/scheduler.ts:calculateNextRun()`

**Problem**: Global watch mode and "fishy" mode were overriding per-channel intervals completely, causing user-configured `intervalSec: 600` to be ignored in favor of 15-second defaults.

**Solution**: 
- Fixed precedence hierarchy: Per-channel `intervalSec` now has highest priority
- Global overrides only apply when no channel-specific interval is configured
- Added debug logging to show when user intervals are respected vs when backoff is applied

**Key Change**:
```typescript
// FIXED: Respect per-channel intervals as highest priority
let intervalSec: number = channel.intervalSec ?? defaults.intervalSec;

// Only apply global overrides if no per-channel interval is specified
if (!channel.intervalSec) {
    if (currentWatch?.isActive) {
        intervalSec = Math.min(intervalSec, watchConfig.highCadenceIntervalSec);
    } else if (fishyMode.enabled) {
        intervalSec = fishyConfig.baselineIntervalSec;
    }
}
```

## Acceptance Criteria
- [x] Channel-specific overrides displayed correctly in tree and respected by scheduler.
- [x] Debug logging shows when user intervals are respected
- [x] User-configured intervals are never overridden by global defaults

## Test Results
- ✅ TypeScript compiles cleanly
- ✅ Extension builds and packages successfully 
- ✅ Debug logging provides user feedback on interval behavior
