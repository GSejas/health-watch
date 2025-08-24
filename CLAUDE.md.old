

## 0) Mission

Build a **local-first** VS Code extension named **Health Watch** (publisher: `GSejas`) that monitors **multi-channel connectivity** (public internet + VPN-only internal services), runs **only when needed** or on a **time-boxed Watch**, and at the end of a Watch **auto-opens a Markdown report** with **Mermaid diagrams synthesized from real data** (not placeholders). No telemetry.

---

## 1) Deliverables (all required)

1. **Full codebase** (TypeScript) with correct paths, ready to open in VS Code and run via F5 (Extension Development Host).
2. **Working features** described below (probes, guards, Watch flow, reports).
3. **Tests**: unit + integration (via `@vscode/test-electron`).
4. **Docs**: README, CHANGELOG, JSON Schema for `.healthwatch.json`.
5. **CI** workflow that builds, runs tests, and produces a `.vsix` artifact (dry-run is fine).
6. **Assets**: minimal icon (local file), no external CDNs.

---

## 2) Output format (how to print the repository)

- Start with a **manifest** tree.
- Then provide **each file** in a code block prefixed by its **path** comment, e.g.:

```text
health-watch/
  package.json
  tsconfig.json
  .vscodeignore
  README.md
  CHANGELOG.md
  resources/icon-128.png            # (base64 data or placeholder note)
  resources/schema/vscode-healthwatch.schema.json
  src/...
  test/...
  .github/workflows/release.yml
````

* For every text file, print its full contents in fenced blocks:

  * First line: `// path: <RELATIVE_PATH>`
  * Then the file content.
* For the PNG icon, either embed a tiny base64 PNG as a `.txt` with instructions to decode at build time, or provide a minimal inline SVG and name it `.svg` (preferred to stay text-only).

**Do not** skip files. **No placeholders** for core logic. Code must compile.

---

## 3) Tech stack & versions

* **Language**: TypeScript (strict mode).
* **Runtime**: VS Code Extension Host targeting Node 18+.
* **Build**: `tsc` (no heavy bundlers required). If you add a webview app, pre-bundle with esbuild/Vite and ship static assets.
* **Tests**: `vitest` (unit) + `@vscode/test-electron` (integration).
* **Lint/format**: ESLint + Prettier.
* **Packaging**: `vsce` (script in package.json).

---

## 4) Features & behavior

### 4.1 Channels (multi-probe)

Implement **all**:

* **HTTPS**: `HEAD` (fallback to `GET` if server disallows `HEAD`). Expectation rules:

  * `status?: number[]`
  * `statusRange?: [min,max]`
  * `headerHas?: string`
  * `bodyRegex?: string`
  * `treatAuthAsReachable?: boolean` (if true, 401/403 count as reachable)
* **TCP**: attempt `net.createConnection(host:port)`, success on connect, close immediately.
* **DNS**: `dns.Resolver().resolve4/resolve6(hostname)` success if resolved (any record).
* **Script**: run a **local command** (shell/PowerShell), success if exit code `0`. (Feature is **opt-in** with a one-time warning dialog.)

### 4.2 Guards (gate execution)

* `netIfUp(name)`: true if an interface with `name` (e.g., `wg0`, `tun0`) appears in `os.networkInterfaces()`.
* `dns(hostname)`: true if `hostname` resolves quickly (timeout configurable).
  If a channel’s guards fail → **skip probe** and mark state `unknown` (no alerts).

### 4.3 State model & backoff

* Per-channel state: `online | offline | unknown`.
* Enter **offline** after `threshold` consecutive failures.
* Return to **online** after the **first** success.
* While **offline**, multiply interval **×3** (cap 10×). Restore on success.
* **Notify only on state changes** (offline↔online). No “still offline” spam.

### 4.4 “Only when fishy”

Background baseline probe (low frequency) can be on:

* Defaults: every **60s**, timeout **3.5s**.
* **Fishy** triggers any of:

  * ≥ **3** consecutive failures
  * rolling **p95 > 1200 ms** for **3 min**
  * ≥ **2** DNS errors in **2 min**
    On fishy → show toast:

> “Connectivity looks unstable. Start a Watch?”
> Buttons: **1h**, **12h**, **Forever**, **Customize…**, **Ignore (45m)**

### 4.5 Watch windows

* While watching: use per-channel intervals, jitter, and backoff rules.
* Status bar shows aggregate state + **ends HH\:mm** for timed watches.
* **Stop** on duration end or manual stop.
* **End-of-watch**:

  1. Compute stats.
  2. Generate **Markdown report** + **JSON export**.
  3. **Auto-open** the Markdown in editor (not preview).

---

## 5) Stats & storage

* **Sample** format:

  ```ts
  type Reason = 'timeout'|'dns'|'tcp'|'tls'|'http'|'script';
  interface Sample {
    t: number;          // epoch ms
    ok: boolean;
    latencyMs?: number; // only for successes or measured failures
    code?: number;      // http status (if any)
    reason?: Reason;    // failure reason classification
    note?: string;      // optional details
  }
  ```
* **Ring buffer** per channel keeping **≥7 days** (prune by time).
* Compute windowed rollups:

  * **Availability %** = online\_minutes / observed\_minutes (exclude machine sleep gaps)
  * **Outages**: count, durations
  * **MTTR** (median time to recover), **longest outage**
  * **Latency** p50 / p95 / min / max (successes only)
  * Failure reasons breakdown

---

## 6) UI/UX in VS Code

* **Status bar**: worst state wins. Example: `$(pulse) Health: Online • 4 ch` or `Offline • 2 ch` with hover for quick stats.
* **Activity View (TreeView)** “Health Watch”:

  * One row per channel: colored dot, latest latency, next probe ETA.
  * Context menu: Run now / Pause / Resume / Details.
* **Details Webview (optional)**:

  * Sparkline (inline SVG), state tape (online/offline bands), recent events.
* **Markdown report**: auto-open on watch end.
* **Notifications**:

  * Fishy prompt
  * One toast on offline; one on recovery.
  * Quiet hours setting suppresses toasts (still logs).

---

## 7) Markdown report (auto-open) — **Mermaid from real data**

* Filename: `HealthWatch-Report-YYYYMMDD-HHmm.md` in storage dir. Also create JSON `…HHmm.json`.

* **TL;DR** at top (table; live values).

* **Mermaid charts** — populate timestamps and counts from actual samples:

  1. **Gantt “state tape” per channel**:

     ```mermaid
     gantt
       dateFormat  YYYY-MM-DDTHH:mm:ss
       axisFormat  HH:mm
       title State Tape — {{channelLabel}} ({{windowStart}} → {{windowEnd}})
       section Availability
       Online    :done,  st1, {{isoOnlineStart0}}, {{isoOnlineEnd0}}
       Offline   :active,st2, {{isoOfflineStart1}}, {{isoOfflineEnd1}}
       Online    :done,  st3, {{isoOnlineStart2}}, {{isoOnlineEnd2}}
     ```

     (Render segments in order. Use separate IDs as needed.)
  2. **Pie — failure reasons**:

     ```mermaid
     pie showData
       title Failure Reasons — {{channelLabel}}
       "timeout" : {{nTimeout}}
       "dns"     : {{nDns}}
       "tcp"     : {{nTcp}}
       "tls"     : {{nTls}}
       "http"    : {{nHttp}}
       "script"  : {{nScript}}
     ```
  3. **Sequence (optional)** narrative for a representative outage:

     ```mermaid
     sequenceDiagram
       participant Probe
       participant {{channelLabel}} as Channel
       Probe->>Channel: consecutive fails reach {{threshold}}
       Note over Channel: OFFLINE at {{tDownIso}}
       Probe->>Channel: success
       Note over Channel: ONLINE at {{tUpIso}} (MTTR {{mttrMin}}m)
     ```
  4. **Topology (optional)** flowchart (Dev→Guards→Service→Report).

* **Latency table**: p50, p95, min, max per channel.

* **Outage table**: start, end, duration, reason (collapsed).

* **SLO** check: compare against per-channel `targetAvailPct`/`latencyMsP95` if provided.

* **Recommendations** (deterministic):

  * High p95 on public → suggest Wi-Fi channel switch / ethernet test
  * Many DNS failures → review split-DNS/VPN resolver
  * Frequent offline with `netIfUp` flaps → update VPN client or investigate tunnel instability

* Link to **JSON export** path.

---

## 8) Configuration

### 8.1 VS Code settings (`contributes.configuration`)

* `healthWatch.enabled` (bool, default true)
* `healthWatch.defaults.intervalSec` (number, default 60)
* `healthWatch.defaults.timeoutMs` (number, default 3000)
* `healthWatch.defaults.threshold` (number, default 3)
* `healthWatch.defaults.jitterPct` (0–50, default 10)
* `healthWatch.watch.backoffMultiplier` (number, default 3)
* `healthWatch.watch.durationDefault` (`"1h"|"12h"|"forever"`)
* `healthWatch.https.allowProxy` (bool, default true)
* `healthWatch.quietHours.enabled` (bool, default false)
* `healthWatch.quietHours.range` (string, e.g., `"22:00-07:00"`)
* `healthWatch.report.addSequenceDiagram` (bool, default true)
* `healthWatch.report.addTopology` (bool, default false)

### 8.2 Workspace file **`.healthwatch.json`** (+ JSON Schema)

Example:

```json
{
  "$schema": "./resources/schema/vscode-healthwatch.schema.json",
  "defaults": { "intervalSec": 60, "timeoutMs": 3000, "threshold": 3, "jitterPct": 10 },
  "guards": {
    "vpn": { "type": "netIfUp", "name": "wg0" },
    "corpDNS": { "type": "dns", "hostname": "intranet.internal", "timeoutMs": 1000 }
  },
  "channels": [
    {
      "id": "corp-gateway",
      "label": "Corp Gateway",
      "type": "tcp",
      "target": "10.0.0.1:443",
      "guards": ["vpn"],
      "sla": { "targetAvailPct": 99.9, "latencyMsP95": 200 }
    },
    {
      "id": "sso",
      "label": "SSO Frontdoor",
      "type": "https",
      "url": "https://sso.internal/login",
      "expect": { "status": [200,401,403] },
      "guards": ["vpn","corpDNS"],
      "intervalSec": 30
    },
    {
      "id": "db-port",
      "label": "DB:5432",
      "type": "tcp",
      "target": "db.internal:5432",
      "guards": ["vpn"]
    },
    {
      "id": "public-site",
      "label": "Public Site",
      "type": "https",
      "url": "https://example.com/healthz",
      "expect": { "statusRange": [200,299], "bodyRegex": "ok|healthy" },
      "intervalSec": 120
    }
  ]
}
```

---

## 9) Public API (exported from `extension.ts`)

```ts
export interface HealthWatchAPI {
  registerChannel(def: ChannelDefinition): vscode.Disposable;
  registerGuard(name: string, impl: GuardImpl): vscode.Disposable;

  startWatch(opts?: { duration: '1h'|'12h'|'forever'|number; profile?: string }): void;
  stopWatch(): void;
  runChannelNow(id: string): Promise<Sample>;

  onSample(cb:(e:{id:string; sample:Sample})=>void): vscode.Disposable;
  onStateChange(cb:(e:{id:string; state:'online'|'offline'|'unknown'})=>void): vscode.Disposable;

  openLastReport(): Promise<void>;
  exportJSON(opts?: { windowMs?: number; path?: string }): Promise<vscode.Uri>;

  listChannels(): ChannelInfo[];
}
```

---

## 10) Project structure (required)

```
health-watch/
├─ package.json
├─ tsconfig.json
├─ .vscodeignore
├─ README.md
├─ CHANGELOG.md
├─ resources/
│  ├─ icon-128.svg
│  └─ schema/vscode-healthwatch.schema.json
├─ src/
│  ├─ extension.ts
│  ├─ api.ts
│  ├─ config.ts
│  ├─ guards.ts
│  ├─ storage.ts
│  ├─ stats.ts
│  ├─ export.ts
│  ├─ report.ts
│  ├─ ui/
│  │  ├─ statusBar.ts
│  │  ├─ treeView.ts
│  │  ├─ detailsPanel.ts
│  │  └─ notifications.ts
│  ├─ runner/
│  │  ├─ channelRunner.ts
│  │  └─ scheduler.ts
│  └─ probes/
│     ├─ https.ts
│     ├─ tcp.ts
│     ├─ dns.ts
│     └─ script.ts
├─ test/
│  ├─ unit/
│  │  ├─ stats.test.ts
│  │  ├─ report.test.ts
│  │  ├─ runner.test.ts
│  │  └─ config.test.ts
│  └─ e2e/
│     └─ smoke.test.ts
└─ .github/workflows/release.yml
```

---

## 11) Build, run, test (document in README)

* `npm i`
* `npm run build`
* Press **F5** to launch Extension Development Host.
* Run tests:

  * `npm run test:unit`
  * `npm run test:integration`

---

## 12) Acceptance criteria (must pass)

* Compiles without errors (strict TS).
* F5 shows Status bar + TreeView.
* `.healthwatch.json` loads channels; guards skip internal checks if VPN/DNS not present.
* Triggering outage → **single** offline toast; recovery → **single** online toast.
* Start a **1h Watch**; on completion:

  * Markdown **auto-opens**,
  * TL;DR table contains real computed values,
  * **Gantt** per channel shows correct Online/Offline segments with **actual ISO timestamps**,
  * **Pie** shows real failure counts,
  * Optional **Sequence**/**Topology** included when enabled,
  * Link to JSON export works.
* Unit tests include:

  * `stats.test.ts` verifying availability calc, p50/p95, outage derivation.
  * `report.test.ts` ensures Markdown includes expected numbers and Mermaid blocks.
  * `runner.test.ts` tests threshold → offline transitions and backoff logic.
  * `config.test.ts` validates schema merges and guard resolution.
* Integration smoke test launches the extension and asserts a command executes and a channel runs once.

---

## 13) Security & privacy constraints

* **No telemetry** or third-party analytics.
* **Never** store secrets; script probe is **opt-in** with a one-time warning.
* Respect proxy by default (HTTPS); allow per-channel opt-out.
* Webviews (if used) must have **strict CSP**, no remote scripts/fonts.
* Tooltips and reports must list **exact hosts/ports** probed.

---

## 14) Quality/performance

* Lightweight timers, jittered schedules.
* While offline, **backoff** to reduce battery/CPU.
* Handle **sleep/resume**: do not mark “offline during sleep”; mark a gap.
* Debounce prompts: Ignore → **45 min** cooldown.

---

## 15) Developer ergonomics

* Clear code separation (probes/runner/ui/report).
* JSDoc on public types/APIs.
* Log state changes to an **Output Channel**.
* Provide `healthWatch.dumpState` (hidden command) to print next ETAs, ring sizes.

---

## 16) Self-review checklist (Claude must verify before printing)

* [ ] All files printed with correct paths; no missing imports.
* [ ] Code compiles (`npm run build`) and tests scaffold run.
* [ ] Report builder uses **real data**; no placeholder timestamps.
* [ ] Mermaid blocks are valid (no stray backticks/indent).
* [ ] Guards skip channels cleanly (state `unknown`).
* [ ] Notifications only on **state changes**.
* [ ] README contains quickstart, config example, screenshots placeholders, troubleshooting (proxy, captive portal, sleep), and privacy stance.
* [ ] CI workflow builds and creates `.vsix` artifact (dry-run ok).

---

```
::contentReference[oaicite:0]{index=0}
```
