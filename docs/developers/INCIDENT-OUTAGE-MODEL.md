# Health Watch Incident & Outage Model Analysis

## Current Model: Lightweight by Design

Health Watch implements a **simplified incident/outage model** designed for quick developer feedback rather than enterprise incident management. Here's how it compares to industry standards:

### Current Data Model (Lightweight)

```typescript
// Current Outage (src/types.ts)
interface Outage {
    channelId: string;
    startTime: number;        // When threshold was crossed
    endTime?: number;         // When recovery detected
    duration?: number;        // Computed: endTime - startTime
    reason: string;           // Error message from failed probe
    recoveryTime?: number;    // Optional recovery metadata
}

// Current Incident (UI-level, from incidentsTreeView.ts)
interface Incident {
    id: string;
    timestamp: number;
    title: string;
    description: string;
    severity: 'critical' | 'warning' | 'info';
    type: 'outage' | 'degraded' | 'recovery' | 'maintenance';
    channel?: string;
    duration?: number;
    impact?: string;
    resolved: boolean;
    resolvedAt?: number;
}
```

### Detection Logic (Simple Threshold-Based)

**Current Rule:** Outage = N consecutive failures where N = `threshold` (default: 3)
- Default probe interval: 60 seconds
- Default timeout: 3000ms
- **Result:** 1-minute outage minimum (3 failures × 60s interval = ~3 minutes to detect, but recorded duration starts from threshold crossing)

**Code Location:** `src/runner/channelRunner.ts`
```typescript
const threshold = channel?.threshold ?? defaults.threshold; // Default: 3
if (newFailureCount >= threshold && state.state !== 'offline') {
    // Record outage at threshold crossing
    this.storageManager.addOutage({
        channelId,
        startTime: sample.timestamp,  // This moment, not first failure
        reason: sample.error || 'Unknown failure'
    });
}
```

## Industry Standard vs Health Watch

| Aspect | Industry Standard | Health Watch | Gap Analysis |
|--------|------------------|--------------|-------------|
| **Detection** | MTTD (Mean Time to Detect) with escalation paths | Simple consecutive failure threshold | ✅ Good for dev, ❌ Missing detection delay tracking |
| **Lifecycle** | investigating → identified → monitoring → resolved | created → resolved (boolean) | ✅ Simpler, ❌ No workflow states |
| **Severity** | SEV1/SEV2/SEV3/SEV4 with SLA mapping | critical/warning/info | ✅ Adequate, ❌ No SLA integration |
| **Impact** | Affected users, business impact, revenue | Free-text impact field | ❌ No quantified impact |
| **People** | On-call, assignees, escalation | None | ❌ No ownership model |
| **Root Cause** | RCA, postmortem links, action items | Reason (error message only) | ❌ No structured RCA |
| **Relationships** | Parent/child incidents, dependencies | None | ❌ No incident correlation |
| **Metrics** | MTTR, MTTD, MTBF with percentiles | Basic MTTR from duration | ✅ Basic coverage |

## The "1-Minute Outage" Problem

**Root Cause:** Default configuration creates very short outages due to fast detection with simple recording.

### Current Math
- `intervalSec: 60` (probe every 60s)
- `threshold: 3` (3 consecutive failures)
- `timeoutMs: 3000` (3s timeout)

**Timeline:**
1. T+0: First failure (probe times out after 3s)
2. T+60: Second failure 
3. T+120: Third failure → **OUTAGE RECORDED** (startTime = T+120)
4. T+180: Success → **OUTAGE ENDS** (endTime = T+180, duration = 60s)

**Observed:** 1-minute outages even for 3-minute actual downtime!

### Configuration Issues Found

**File:** `src/config.ts` lines 249-251
```typescript
intervalSec: workspaceDefaults?.intervalSec ?? vsConfig.get('intervalSec', 60),
timeoutMs: workspaceDefaults?.timeoutMs ?? vsConfig.get('timeoutMs', 3000),
threshold: workspaceDefaults?.threshold ?? vsConfig.get('threshold', 3),
```

## Surgical Improvements (Easy Wins)

### 1. Fix Outage Duration Recording ⭐ **HIGH IMPACT**

**Problem:** `startTime` is set when threshold is crossed, not when problems began.

**Solution:** Track first failure time separately.

```typescript
// Enhanced Outage model
interface Outage {
    channelId: string;
    firstFailureTime: number;    // When problems started
    confirmedAt: number;         // When threshold crossed (current startTime)
    endTime?: number;
    actualDuration?: number;     // endTime - firstFailureTime  
    detectedDuration?: number;   // endTime - confirmedAt (current duration)
    reason: string;
    failureCount?: number;       // How many failures before confirm
}
```

**Files to Change:**
- `src/types.ts` - Add new fields
- `src/runner/channelRunner.ts` - Track first failure in streak
- `src/ui/dashboardData.ts` - Display both durations

### 2. Better Default Configuration ⭐ **USER EXPERIENCE**

**Current Issues:**
- 60s interval too slow for dev feedback
- 3s timeout too short for real networks  
- 3 failures good but duration recording is wrong

**Suggested Defaults:**
```typescript
// For development/local monitoring
intervalSec: 30,     // Faster feedback (was 60)
timeoutMs: 5000,     // More realistic (was 3000)
threshold: 2,        // Quicker detection (was 3)

// Add new configs:
minOutageDurationMs: 120000,  // Don't record outages < 2 minutes
gracePeriodSec: 30,          // Ignore first failure if recovered quickly
```

### 3. Smart Duration Display ⭐ **CLARITY**

**Current:** Shows `detectedDuration` only (confusing 1-minute outages)

**Enhanced:** Show both impact and detection windows
```
Outage: API Gateway - 4m 30s impact (detected after 2m 15s)
```

### 4. Configurable Detection Profiles ⭐ **FLEXIBILITY**

**Add preset profiles in VS Code settings:**

```json
{
  "healthWatch.profiles": {
    "development": {
      "intervalSec": 15,
      "threshold": 2,
      "timeoutMs": 3000,
      "description": "Fast feedback for local dev"
    },
    "production": {
      "intervalSec": 60, 
      "threshold": 3,
      "timeoutMs": 8000,
      "description": "Stable monitoring for prod services"
    },
    "network": {
      "intervalSec": 30,
      "threshold": 5,
      "timeoutMs": 10000,
      "description": "For flaky network connections"
    }
  }
}
```

## Implementation Priority

### Phase 1: Fix Duration Recording (1-2 hours)
1. ✅ Add `firstFailureTime` to Outage type
2. ✅ Update channelRunner to track failure streaks
3. ✅ Update UI to show "actual impact duration"
4. ✅ Test with deliberate service outage

### Phase 2: Better Defaults (30 minutes)  
1. ✅ Change default `intervalSec` from 60 → 30
2. ✅ Change default `timeoutMs` from 3000 → 5000  
3. ✅ Add `minOutageDurationMs` config option
4. ✅ Update documentation

### Phase 3: Smart Profiles (1 hour)
1. ✅ Add profile system to config
2. ✅ Add VS Code setting for active profile
3. ✅ Add profile switching command
4. ✅ Preset profiles for common scenarios

## Files Requiring Changes

**Core Logic:**
- `src/types.ts` - Extend Outage interface
- `src/config.ts` - Update defaults, add profiles
- `src/runner/channelRunner.ts` - Track failure streaks properly

**UI/Display:**
- `src/ui/dashboardData.ts` - Use actual duration  
- `src/ui/notifications.ts` - Show better outage descriptions
- `src/stats.ts` - Compute MTTR from actual impact

**Documentation:**
- `README.md` - Update configuration examples
- `docs/CONFIGURATION.md` - Document new fields and profiles

## Current Strengths to Preserve

✅ **Simple to understand** - threshold-based detection is intuitive
✅ **Fast to implement** - no complex workflow states
✅ **Good for development** - immediate feedback on service issues  
✅ **Lightweight storage** - minimal disk/memory footprint
✅ **VS Code integrated** - uses workspace settings naturally

## When to Consider Industry-Standard Models

**Upgrade triggers:**
- Team size > 5 developers
- Production incident management needed
- SLA tracking required
- On-call rotation management
- Compliance requirements (SOC2, etc.)

**Migration path:** 
- Keep current model for development monitoring
- Add enterprise adapter for PagerDuty/OpsGenie integration
- Export incidents to external ITSM tools when needed

---

**Next Action:** Should I implement Phase 1 (fix duration recording) or Phase 2 (better defaults) first?
