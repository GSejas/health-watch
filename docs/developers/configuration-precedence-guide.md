# Configuration Precedence Guide

## 🎯 SIMPLIFIED HIERARCHY (4 Clear Levels)

After simplification, Health Watch now uses a **predictable, transparent precedence hierarchy** that eliminates the "Major UX barrier - users can't predict behavior."

### **Clear Order (Highest to Lowest Priority):**

1. **🎯 Individual Watch** - Explicit per-channel watch
   - When you start an individual watch on a specific channel
   - Example: `healthWatch.startChannelWatch` → sets custom interval
   - **Overrides everything else**

2. **⚙️ Channel Config** - `.healthwatch.json` channel settings
   - Channel-specific `intervalSec` in your workspace config
   - Example: `{ "id": "api", "intervalSec": 30 }`
   - **Overrides global and defaults**

3. **🌐 Global Watch** - When active watch is running
   - High-frequency monitoring during active global watch
   - Example: `healthWatch.startWatch` → uses `highCadenceIntervalSec`
   - **Overrides defaults only**

4. **📋 Defaults** - System defaults with adaptive adjustments
   - Extension configuration or built-in defaults
   - Plus adaptive backoff adjustments (faster during outages)
   - **Fallback when nothing else applies**

## 🔍 **How to Debug Configuration**

The system now provides **full transparency** about which setting is being used:

### **Console Logging**
Every interval decision is logged with clear explanations:
```
[Scheduler] Channel 'api-gateway': 🎯 Individual Watch individual watch (15s) → BACKOFF 45s (3.00×: 3 consecutive failures)
[Scheduler] Channel 'database': ⚙️ Channel Config channel config (30s)
[Scheduler] Channel 'website': 🌐 Global Watch global watch active (10s)
[Scheduler] Channel 'backup': 📋 Defaults system defaults (60s)
```

### **Public API for UI**
Use `scheduler.explainChannelInterval(channelId)` to get detailed information:
```typescript
const explanation = scheduler.explainChannelInterval('api-gateway');
console.log(explanation.humanReadableExplanation);
// "This channel has an individual watch active, which overrides all other settings. 
//  Monitoring every 15 seconds. Adaptive backoff is slowing down monitoring (3.00x) 
//  because: 3 consecutive failures"
```

## ❌ **What Was Removed (Complexity Reduction)**

The old system had **7 confusing factors**:
1. Individual watch settings
2. Channel-specific intervalSec
3. Global watch high cadence
4. **❌ "Fishy mode" baseline** ← Removed
5. Default interval
6. **❌ Complex global overrides** ← Simplified
7. Adaptive backoff + jitter

The new system has **4 clear levels** plus adaptive adjustments.

## 🛠️ **Implementation Details**

### **Before (Complex & Unpredictable)**
```typescript
// 7 different code paths with complex interactions
if (individualWatch && watchType === 'individual') {
    intervalSec = watch.intervalSec ?? highCadence;
} else if (channel.intervalSec) {
    intervalSec = channel.intervalSec;
} else {
    intervalSec = defaults.intervalSec;
    if (currentWatch?.isActive && !paused) {
        intervalSec = Math.min(intervalSec, highCadence);
    } else if (fishyMode.enabled) {  // ← Confusing!
        intervalSec = fishyMode.baselineIntervalSec;
    }
}
// + adaptive + jitter...
```

### **After (Clean & Predictable)**
```typescript
// 4 clear levels with full transparency
const result = this.getEffectiveInterval(channelId);
console.log(`[Scheduler] ${result.explanation}`);
```

## 🎮 **User Experience Improvements**

### **Predictable Behavior**
- Users can now **predict exactly** which setting will be used
- Clear hierarchy eliminates surprises
- Transparent logging shows decision reasoning

### **Future UI Features**
The new `explainChannelInterval()` API enables:
- **Channel Details UI** showing why each interval was chosen
- **Debug status bar** showing configuration sources
- **Troubleshooting reports** for behind-the-scenes actions

### **Example User Scenarios**

**Scenario 1: Default Monitoring**
```json
// .healthwatch.json (no intervalSec specified)
{ "id": "website", "type": "https", "url": "https://example.com" }
```
**Result:** 📋 Defaults (60s) - predictable fallback

**Scenario 2: Channel-Specific Setting** 
```json
{ "id": "api", "intervalSec": 15, "url": "https://api.example.com" }
```
**Result:** ⚙️ Channel Config (15s) - overrides defaults

**Scenario 3: During Active Watch**
```bash
# User runs: healthWatch.startWatch
```
**Result:** 🌐 Global Watch (10s) - high frequency during watch

**Scenario 4: Individual Channel Focus**
```bash
# User runs: healthWatch.startChannelWatch on 'api'
```
**Result:** 🎯 Individual Watch (custom) - highest priority

## 📚 **Documentation Updates**

This change affects:
- ✅ **Configuration precedence** - Now clear and predictable
- ✅ **Debugging transparency** - Full explanation logging
- ✅ **API surface** - New `explainChannelInterval()` method
- ✅ **Future UI features** - Ready for debug modes and channel details

## 🔧 **Migration Notes**

**No Breaking Changes:** Existing configurations continue to work exactly the same way, but now with predictable behavior and clear explanations.

**Removed Complexity:** The confusing "fishy mode" baseline overrides have been eliminated, making the system much more understandable.

# MISCONFIGURED CONFIG FILE:


I’ll summarize what happens when .healthwatch.json is empty/missing/invalid and how UI/scheduler react.

Checklist:
- Missing file
- Blank/malformed JSON
- Valid but empty object
- channels: [] (no channels)
- All channels disabled

## Behavior by case

- Missing file
  - Config watcher sets workspace config to null and triggers a refresh.
  - Tree shows no channels; scheduler clears all timers and schedules none.
  - Status bar (internet check) still works; commands still available.
  - “Open Config” will offer to create a default file.

- Blank/malformed JSON (parse error)
  - Load fails with an error message (“Failed to load .healthwatch.json: …”).
  - Last-known-good config is kept in memory (no change), so monitoring continues using previous channels.
  - Once the file is fixed, it will reload.

- Valid but empty object (e.g., {}) or schema-less environment
  - If schema isn’t found, validation is skipped and the empty object is accepted.
  - Config becomes empty; getChannels() returns [].
  - Tree is empty and scheduler schedules nothing.

- channels: [] explicitly
  - Considered valid; getChannels() returns [].
  - Tree is empty; scheduler clears timers and runs nothing.

- All channels disabled (enabled === false)
  - Tree filters disabled channels out, so it appears empty.
  - Scheduler won’t schedule disabled channels.

## Notes

- Tree/location cache: with no channels, there are no clickable items and no stored config locations.
- Status bar: still shows internet status; dashboard/details views will show “No channels configured.”
- Safety: On invalid JSON, the system deliberately keeps the last good config; on valid-but-empty, it switches to “no channels.”