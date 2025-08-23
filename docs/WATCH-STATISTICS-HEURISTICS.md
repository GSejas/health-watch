# Watch Statistics — Heuristics & Visuals

Purpose
-------
This document explains the enriched `watchStats` payload we push from the extension host to the dashboard webview, the reasoning behind selected fields, and suggested UI visuals. It also records the design decision for 'pause watch' semantics.

Design decision (pause semantics)
--------------------------------
Comment: We treat "Pause Watch" as a clear user intent to stop monitoring activity for the current watch. Implementation:
- Scheduler clears timers and stops scheduling new probe runs.
- ChannelRunner aborts all in-flight probes immediately.
- StorageManager records `paused`, `pauseTimestamp`, and accumulates paused time on resume. This preserves elapsed and endTime semantics.

Rationale: Users expect "pause" to mean "don't monitor right now". Suspending probes avoids false positives and reduces resource usage during maintenance windows. A follow-up feature can provide a "reduced cadence" option for advanced users.

watchStats payload (recommended shape)
-------------------------------------
Top-level:
- command: 'watchStats'
- payload:
  - probesRun: number  // total probes recorded in current watch
  - successRatePct: number  // overall success rate across all channels in the watch (0-100)
  - perChannel: Record<string, ChannelMetrics>
  - isPaused?: boolean

ChannelMetrics (per channel):
- availability: number (0-100) — percentage of successful samples during the watch
- totalSamples: number — number of probes collected in the watch for the channel
- successfulSamples: number — successes
- p95: number — p95 latency in ms
- lastSampleAgeMs?: number — ms since last probe
- lastStatus?: 'OK'|'FAIL'|'UNKNOWN' — convenience display

Why these fields?
- availability: Primary SLO indicator. Compact and actionable.
- p95 latency: Captures high-latency tail behavior, important for user experience and SLOs.
- totals & lastSampleAge: Allow UI to show volume and recency.
- lastStatus: Quick badge for last probe outcome.

Size and frequency
------------------
- Keep payload compact: avoid sending full sample arrays (send aggregates only).
- Frequency: push every auto-refresh cycle (default 5–10s) to the webview.

Suggested UI visuals
--------------------
- Banner summary (left): `🔍 Active Watch — 15 probes • 94% success • Paused` (if paused)
- Progress bar (center): elapsed vs total; indeterminate pattern for forever watches
- Per-channel mini-list (collapsible): show for each channel —
  - Channel name
  - Availability badge (color: green/yellow/red)
  - p95 latency (ms)
  - Tiny sparkline (last N samples) or recent status dot
  - Last sample age (e.g., `2s ago`)

Mini wireframe (ASCII)
----------------------
[🔍 Active Watch]  15 probes • 94% success • Last: 2s ago  [Paused]
[■■■■■■■■■■■■■■----] progress

Channels:
- example.com  | 98% | p95 120ms | ◷ 2s ago
- db.internal  | 85% | p95 420ms | ◷ 4s ago

Heuristics and thresholds
-------------------------
- Color rules for availability: >=95% green, >=85% yellow, else red.
- p95 rules: <=200ms green, <=500ms yellow, >500ms red.
- Trend detection: compute small-window delta (last 5m vs previous 5m) and show up/down arrow when change > 10%.

Privacy & performance
---------------------
- Avoid shipping raw logs or error messages in frequent updates; send aggregated counts and allow drill-down to a separate report or view for full details.
- Cap perChannel payload size; for many channels only send the top N problematic channels plus overall summary.

Implementation notes
--------------------
- Use `StatsCalculator.getWatchSessionStats(session)` to compute per-channel aggregates server-side.
- Post message shape example (JS):

```js
webview.postMessage({
  command: 'watchStats',
  payload: {
    probesRun: 42,
    successRatePct: 92,
    isPaused: false,
    perChannel: {
      'api': { availability: 98, totalSamples: 12, successfulSamples: 12, p95: 120, lastSampleAgeMs: 2000 },
      'db': { availability: 85, totalSamples: 12, successfulSamples: 10, p95: 420, lastSampleAgeMs: 4000 }
    }
  }
});
```

Follow-ups
----------
- Add an opt-in reduced-cadence mode for watchers that want some visibility but lower cost.
- Provide a live sparklines mini-component for per-channel recent sample trends (render in React)

---
Decision comment: Pause semantics implemented as "stop all probes and abort in-flight runs" (clear, least surprising). If you prefer "reduced cadence" instead, we can add a config flag and implement it in `calculateNextRun`.
