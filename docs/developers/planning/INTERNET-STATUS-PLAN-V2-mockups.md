# 🎨 ASCII Art UI Mockups — Internet Status Feature

## 📊 Status Bar States

### 🟢 Online State
```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ File Edit View ... │ 🔧 Basic │ $(check) 15ms │ Ln 42, Col 8 │ UTF-8 │ ...  │
└─────────────────────────────────────────────────────────────────────────────┘
                      ↑           ↑
                   Debug Mode   Internet Status
                               (Green checkmark)
```

### 🔴 Offline State
```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ File Edit View ... │ 🔧 Basic │ $(error) Offline │ Ln 42, Col 8 │ UTF-8 │... │
└─────────────────────────────────────────────────────────────────────────────┘
                                 ↑
                            (Red X icon)
```

### 🟡 Captive Portal State
```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ File Edit View ... │ 🔧 Basic │ $(shield) Sign-in │ Ln 42, Col 8 │ UTF-8 │..│
└─────────────────────────────────────────────────────────────────────────────┘
                                 ↑
                           (Yellow shield)
```

### ⚪ Unknown / Loading State
```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ File Edit View ... │ 🔧 Basic │ $(question) ... │ Ln 42, Col 8 │ UTF-8 │... │
└─────────────────────────────────────────────────────────────────────────────┘
                                ↑
                          (Gray question mark)
```

---

## 🖱️ Click Interactions

###
                                                    │
          ┌─────────────────────────────────────────┴─────────────────────────────┐
          │ ✅ Internet: Connected (15ms)                                        │
          │ Last check: 2 seconds ago                                           │
          │ Target: https://clients3.google.com/generate_204                    │
          │                                                                     │
          │ Click to run check now                                              │
          └─────────────────────────────────────────────────────────────────────┘

  📋 Quick Status Popup (Click)

                              ┌─────────────────────────────────────────┐
                              │ 🌐 Internet Connectivity Status         │
                              ├─────────────────────────────────────────┤
                              │                                         │
                              │ Current:  $(check) Online (15ms)       │
                              │ Target:   clients3.google.com           │
                              │ Checks:   47 total, 0 failed           │
                              │                                         │
                              │ Recent History:                         │
                              │ • 14:32:15  $(check)  12ms             │
                              │ • 14:32:00  $(check)  18ms             │
                              │ • 14:31:45  $(check)  15ms             │
                              │                                         │
                              │ ┌─────────────────┐ ┌─────────────────┐ │
                              │ │ 🔄 Check Now    │ │ ⚙️ Settings     │ │
                              │ └─────────────────┘ └─────────────────┘ │
                              └─────────────────────────────────────────┘

  ---
  🎭 Multi-Window Coordination Scenarios

  👑 Leader Window (Active Checking)

  ┌─────────────────────────────────────────────────────────────────────────────┐
  │ File Edit View ... │ 👑🔒 │ $(check) 15ms │ Ln 42, Col 8 │ UTF-8 │ ...     │
  └─────────────────────────────────────────────────────────────────────────────┘
                       ↑
                 Leader + Lock
              (Actively running checks)

  👥 Follower Windows (Passive Display)

  ┌─────────────────────────────────────────────────────────────────────────────┐
  │ File Edit View ... │ 👥🔓 │ $(check) 15ms │ Ln 42, Col 8 │ UTF-8 │ ...     │
  └─────────────────────────────────────────────────────────────────────────────┘
                       ↑
               Follower + No Lock
             (Reading shared state only)

  ┌─────────────────────────────────────────────────────────────────────────────┐
  │ File Edit View ... │ 👥🔓 │ $(check) 15ms │ Ln 42, Col 8 │ UTF-8 │ ...     │
  └─────────────────────────────────────────────────────────────────────────────┘

  🔄 Leadership Transition

  Window 1 (Leader dies):
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │ File Edit View ... │ ❌ CLOSED                                              │
  └─────────────────────────────────────────────────────────────────────────────┘

  Window 2 (Becomes new leader):
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │ File Edit View ... │ 👑🔒 │ $(check) 15ms │ Ln 42, Col 8 │ UTF-8 │ ...     │
  └─────────────────────────────────────────────────────────────────────────────┘
                       ↑
              Promoted to leader!

  ---
  🎛️ Settings Configuration UI

  ⚙️ VS Code Settings Panel

  ╭─────────────────────────────────────────────────────────────────────────────╮
  │ Settings                                                                 [×]│
  ├─────────────────────────────────────────────────────────────────────────────┤
  │                                                                             │
  │ Search settings  [healthWatch.internet                            ] [🔍]   │
  │                                                                             │
  │ ┌─ Health Watch: Internet ─────────────────────────────────────────────────┐│
  │ │                                                                         ││
  │ │ ☑️ Enabled                                                              ││
  │ │ Enable automatic internet connectivity monitoring                       ││
  │ │                                                                         ││
  │ │ Interval Sec: [15        ] seconds                                      ││
  │ │ Check interval in seconds (fast feedback)                               ││
  │ │                                                                         ││
  │ │ Timeout Ms: [3000      ] milliseconds                                   ││
  │ │ Request timeout in milliseconds                                         ││
  │ │                                                                         ││
  │ │ Failure Threshold: [2   ]                                               ││
  │ │ Failures needed before marking offline                                  ││
  │ │                                                                         ││
  │ │ Targets: ┌─────────────────────────────────────────────────────────────┐││
  │ │          │ https://clients3.google.com/generate_204               [×] │││
  │ │          │ https://cloudflare.com/cdn-cgi/trace                   [×] │││
  │ │          └─────────────────────────────────────────────────────────────┘││
  │ │          [+ Add target]                                                 ││
  │ └─────────────────────────────────────────────────────────────────────────┘│
  ╰─────────────────────────────────────────────────────────────────────────────╯

  ---
  📱 Different Status Bar Modes

  🔹 Minimal Mode (Default)

  ┌─────────────────────────────────────────────────────────────────────────────┐
  │ ... │ $(check) 15ms │ Ln 42, Col 8 │ UTF-8 │ ...                           │
  └─────────────────────────────────────────────────────────────────────────────┘
        ↑
    Single internet indicator

  🔸 Mini-Multi-Channel Mode

  ┌─────────────────────────────────────────────────────────────────────────────┐
  │ ... │ $(server):$(check) $(globe):$(check) $(shield):$(error) │ Ln 42 │ ... │
  └─────────────────────────────────────────────────────────────────────────────┘
        ↑                     ↑                    ↑
     Internet            DNS Check             VPN Gateway
     (Online)            (Online)              (Offline)

  🔺 Compact Mode

  ┌─────────────────────────────────────────────────────────────────────────────┐
  │ ... │ $(server)$(check)15ms $(globe)$(check) $(shield)$(error) ... │ Ln │..│
  └─────────────────────────────────────────────────────────────────────────────┘
        ↑
    Dense channel display with latency

  ---
  🚨 Error & Edge Case States

  🏢 Corporate Network Detection

  ┌─────────────────────────────────────────────────────────────────────────────┐
  │ File Edit View ... │ $(shield) Corporate │ Ln 42, Col 8 │ UTF-8 │ ...     │
  └─────────────────────────────────────────────────────────────────────────────┘

  Tooltip:
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │ 🏢 Corporate Network Detected                                              │
  │ Using internal targets: internal-gateway.company.local                     │
  │ Status: Online (45ms)                                                      │
  │ Click to open settings                                                     │
  └─────────────────────────────────────────────────────────────────────────────┘

  🌊 Flapping Network Warning

  ┌─────────────────────────────────────────────────────────────────────────────┐
  │ File Edit View ... │ $(pulse) Unstable │ Ln 42, Col 8 │ UTF-8 │ ...      │
  └─────────────────────────────────────────────────────────────────────────────┘

  Tooltip:
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │ ⚠️ Network appears unstable                                                │
  │ Frequent online/offline changes detected                                   │
  │ Consider checking WiFi signal or ethernet connection                       │
  └─────────────────────────────────────────────────────────────────────────────┘

  🚧 First-Run Setup Prompt

                        ┌─────────────────────────────────────────────┐
                        │ 🌐 Welcome to Health Watch!                │
                        ├─────────────────────────────────────────────┤
                        │                                             │
                        │ Enable automatic internet status in the     │
                        │ status bar?                                 │
                        │                                             │
                        │ ✅ Shows connection status instantly        │
                        │ ⚡ Updates every 15 seconds                 │
                        │ 🔒 No data sent externally                  │
                        │                                             │
                        │ ┌─────────────┐ ┌─────────────┐ ┌─────────┐ │
                        │ │ ✅ Enable   │ │ ❌ No Thanks │ │ ⚙️ Setup │ │
                        │ └─────────────┘ └─────────────┘ └─────────┘ │
                        └─────────────────────────────────────────────┘

  ---
  🎯 Network Check Workflow Visualization

  🔄 Check Sequence Display

  Debug Mode - Network Check Flow:
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │ 14:32:45 → Checking https://clients3.google.com/generate_204               │
  │ 14:32:45 → Leader window 👑 running check                                  │
  │ 14:32:45 → HTTP GET request sent...                                        │
  │ 14:32:45 → Response: 204 No Content (15ms) ✅                             │
  │ 14:32:45 → Status: ONLINE → Shared storage updated                        │
  │ 14:32:45 → Followers 👥👥 reading new state...                             │
  │ 14:32:45 → All status bars updated ✨                                     │
  │ 14:32:45 → Next check scheduled: 14:33:00 (15s)                           │
  └─────────────────────────────────────────────────────────────────────────────┘

  📊 Multi-Window State Dashboard

  Health Watch - Multi-Window Debug View
```
  ╭─────────────────────────────────────────────────────────────────────────────╮
  │ Windows Active: 3                    Last Check: 14:32:45                  │
  ├─────────────────────────────────────────────────────────────────────────────┤
  │                                                                             │
  │ Window 1 (PID: 12345) 👑 LEADER                                           │
  │ ├─ Role: Network checker                                                   │
  │ ├─ Status: Running checks every 15s                                        │
  │ └─ Next: 14:33:00                                                          │
  │                                                                             │
  │ Window 2 (PID: 12346) 👥 FOLLOWER                                         │
  │ ├─ Role: State reader                                                      │
  │ ├─ Status: Watching shared storage                                         │
  │ └─ Last sync: 14:32:45                                                     │
  │                                                                             │
  │ Window 3 (PID: 12347) 👥 FOLLOWER                                         │
  │ ├─ Role: State reader                                                      │
  │ ├─ Status: Watching shared storage                                         │
  │ └─ Last sync: 14:32:45                                                     │
  │                                                                             │
  │ Internet Status: $(check) ONLINE (15ms)                                    │
  │ Target: https://clients3.google.com/generate_204                           │
  │ Consecutive successes: 47                                                  │
  │                                                                             │
  ╰─────────────────────────────────────────────────────────────────────────────╯
```
  ---
  🎪 Zero-Config Experience Flow

  Step 1: Fresh Install

  VS Code Status Bar (Before):
```
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │ File Edit View ... │                    │ Ln 42, Col 8 │ UTF-8 │ ...      │
  └─────────────────────────────────────────────────────────────────────────────┘
                       ↑
                  No internet status
```
│                                                                             │
│ Internet Status: $(check) ONLINE (15ms)                                    │
│ Target: https://clients3.google.com/generate_204                           │
│ Consecutive successes: 47                                                  │
│                                                                             │
╰─────────────────────────────────────────────────────────────────────────────╯
```

---

## 🎪 Zero-Config Experience Flow

### Step 1: Fresh Install
VS Code Status Bar (Before):
```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ File Edit View ... │                    │ Ln 42, Col 8 │ UTF-8 │ ...      │
└─────────────────────────────────────────────────────────────────────────────┘
                     ↑
                No internet status
```

### Step 2: Extension Activates
VS Code Status Bar (2 seconds later):
```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ File Edit View ... │ $(question) ... │ Ln 42, Col 8 │ UTF-8 │ ...        │
└─────────────────────────────────────────────────────────────────────────────┘
                     ↑
                  Checking...
```

### Step 3: First Check Complete
VS Code Status Bar (5 seconds later):
```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ File Edit View ... │ $(check) 15ms │ Ln 42, Col 8 │ UTF-8 │ ...          │
└─────────────────────────────────────────────────────────────────────────────┘
                     ↑
              ✨ Magic! It just works!
```

These ASCII mockups illustrate the Internet Status feature behavior and interactions for the VS Code status bar, tooltips, popups, multi-window coordination, settings, and edge cases.│ └─ Last sync: 14:32:45                                                     │

---



# 🎭 Complex Multi-Window & Channel Permutations - ASCII Overview

## 🎭 Complex Multi-Window & Channel Permutations — Quick Reference

### At-a-glance recommendations
- Global Internet checks: elect one user-level leader (single leader across all windows).
- Channels: keep coordination per-workspace (workspace-local leaders + storage).
- Shared storage: separate user-level globalState (internet) and workspace disk storage (channels).
- Leadership transitions: target < 5s gap — run an immediate validation check on promotion.
- Config resolution: enforce policy hierarchy (Corporate → Workspace → User → Default).

### Short scenario map (problem → recommended action)
| Scenario | Problem | Recommended action |
|---|---:|---|
| Pure Internet | No channels, multi-window display | Single user-level leader; followers read shared state |
| Hybrid Mode | Internet + workspace channels | Dual-layer coordination: global internet leader + per-workspace channel leaders |
| Corporate Override | Corporate targets / guards | Detect corporate context → apply corporate targets + guard checks; show policy in tooltip |
| Workspace Split | Multiple workspaces, independent configs | Global internet leader; per-workspace channel leaders and storage; avoid cross-workspace leader conflicts |
| Leader Death | Leader closes mid-check | Fast election (lowest PID or deterministic key); new leader runs immediate validation check |
| Config Conflicts | User/workspace/corp disagree | Policy engine resolves: Corporate > Workspace > User > Default; reflect decision in UI |

### Decision checklist for implementers
- Leader scope
    - Internet: user-level (global)
    - Channels: workspace-level
- Storage layout
    - globalState.json (user-level): internet results, leader heartbeat
    - workspace/.healthwatch (workspace-level): channel configs/results
- Election rules
    - Deterministic (PID, timestamp, or lock-file); timeouts ≈ 3–5s
    - On promotion: run immediate check before resuming schedule
- Failure handling
    - Record firstFailureTime + confirmed outage start
    - Backoff when offline; recover on first success
- UI signals
    - Expose current leader, last-check age, and config source (corporate/workspace/user) in tooltip

### Minimal protocol sketch
1. All windows read globalState on start.
2. Each window posts a heartbeat with windowId + timestamp.
3. If leader heartbeat absent for > heartbeatTimeout → start election.
4. Winner takes leader lock, writes leader identity to globalState, runs immediate checks.
5. Followers poll globalState for results and update UI.

Use this reference to fill the coordination gap between the Internet service (global) and the channel subsystem (workspace-local). Keep checks deterministic, storage separated by scope, and UI transparent about which policy/config was applied.
