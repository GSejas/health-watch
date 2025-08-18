# Health Watch Extension - Manual Test Plan

## Overview
This document provides a comprehensive manual testing plan for the Health Watch VS Code extension. Follow these test cases to verify core functionality, edge cases, and user flows.

## Prerequisites
- VS Code 1.74.0 or higher
- Health Watch extension installed (`health-watch-1.0.0.vsix`)
- Internet connectivity for external tests
- Administrative privileges for script tests (optional)

## Test Environment Setup

### Test Workspace Structure
```
test-workspace/
├── .healthwatch.json          # Main configuration
├── configs/
│   ├── minimal.json          # Minimal test config
│   ├── comprehensive.json    # Full feature test
│   ├── invalid.json          # Error testing
│   └── guards.json           # Guard testing
└── reports/                  # Generated reports location
```

---

## Test Case Categories

### 1. Installation and Activation Tests

#### TC-001: Extension Installation
**Objective**: Verify extension installs correctly
**Steps**:
1. Install extension from `.vsix` file
2. Restart VS Code
3. Open Extensions view (`Ctrl+Shift+X`)

**Expected Results**:
- ✅ Health Watch appears in extensions list
- ✅ Extension is enabled by default
- ✅ No error notifications during installation

#### TC-002: Extension Activation
**Objective**: Verify extension activates on startup
**Steps**:
1. Open a new workspace
2. Check status bar (bottom right)
3. Open Command Palette and search "Health Watch"

**Expected Results**:
- ✅ Status bar shows health monitoring indicator
- ✅ Health Watch commands are available
- ✅ Extension activates without errors

---

### 2. Configuration Management Tests

#### TC-003: Basic Configuration Loading
**Objective**: Test configuration file detection and loading

**Test Data** (`.healthwatch.json`):
```json
{
  "channels": [
    {
      "id": "test-https",
      "name": "Test HTTPS",
      "type": "https",
      "url": "https://httpbin.org/status/200",
      "intervalSec": 30
    }
  ]
}
```

**Steps**:
1. Create `.healthwatch.json` in workspace root
2. Reload window (`Developer: Reload Window`)
3. Check status bar and tree view

**Expected Results**:
- ✅ Configuration loads without errors
- ✅ Channel appears in Health Watch tree view
- ✅ Status bar reflects channel count

#### TC-004: Configuration Validation
**Objective**: Test JSON schema validation

**Test Data** (invalid config):
```json
{
  "channels": [
    {
      "id": "invalid-channel",
      "name": "Missing Required Fields",
      "type": "https"
      // Missing url and intervalSec
    }
  ]
}
```

**Steps**:
1. Save invalid configuration
2. Reload window
3. Check for error notifications

**Expected Results**:
- ✅ Error notification appears
- ✅ Specific validation errors mentioned
- ✅ Extension continues to function

---

### 3. Probe Type Tests

#### TC-005: HTTPS Probe Success
**Test Data**:
```json
{
  "channels": [
    {
      "id": "https-success",
      "name": "HTTPS Success Test",
      "type": "https",
      "url": "https://httpbin.org/status/200",
      "intervalSec": 10,
      "expectedContent": "status",
      "expectedStatusCode": 200
    }
  ]
}
```

**Steps**:
1. Apply configuration
2. Run single probe: Command Palette → "Health Watch: Run Channel Now"
3. Select the channel
4. Check results in output panel

**Expected Results**:
- ✅ Probe succeeds (green indicator)
- ✅ Latency measurement shown
- ✅ Status bar shows "Online"

#### TC-006: HTTPS Probe Failure
**Test Data**:
```json
{
  "channels": [
    {
      "id": "https-failure",
      "name": "HTTPS Failure Test",
      "type": "https",
      "url": "https://httpbin.org/status/404",
      "intervalSec": 10
    }
  ]
}
```

**Steps**:
1. Apply configuration
2. Run single probe
3. Check results

**Expected Results**:
- ✅ Probe fails (red indicator)
- ✅ Error message includes "404"
- ✅ Status bar shows "Offline"

#### TC-007: TCP Probe Test
**Test Data**:
```json
{
  "channels": [
    {
      "id": "tcp-test",
      "name": "TCP Port Test",
      "type": "tcp",
      "hostname": "httpbin.org",
      "port": 80,
      "intervalSec": 15
    }
  ]
}
```

**Steps**:
1. Apply configuration
2. Run single probe
3. Verify connection attempt

**Expected Results**:
- ✅ TCP connection succeeds
- ✅ Latency measured
- ✅ No timeout errors

#### TC-008: DNS Probe Test
**Test Data**:
```json
{
  "channels": [
    {
      "id": "dns-test",
      "name": "DNS Resolution Test",
      "type": "dns",
      "hostname": "google.com",
      "dnsRecordType": "A",
      "intervalSec": 20
    }
  ]
}
```

**Steps**:
1. Apply configuration
2. Run single probe
3. Check DNS resolution

**Expected Results**:
- ✅ DNS resolution succeeds
- ✅ IP addresses returned
- ✅ Resolution time measured

#### TC-009: Script Probe Test
**Test Data**:
```json
{
  "channels": [
    {
      "id": "script-test",
      "name": "Script Test",
      "type": "script",
      "script": "echo 'health check passed'",
      "intervalSec": 30,
      "expectedContent": "passed"
    }
  ]
}
```

**Steps**:
1. Apply configuration
2. Accept security warning (first time)
3. Run single probe
4. Check script execution

**Expected Results**:
- ✅ Security dialog appears (first run)
- ✅ Script executes successfully
- ✅ Output validation works

---

### 4. Watch Session Tests

#### TC-010: Short Watch Session
**Objective**: Test complete watch flow

**Test Data**: Use comprehensive config (see Appendix A)

**Steps**:
1. Start watch: Command Palette → "Health Watch: Start Watch"
2. Select "Custom" → Enter "2" (2 minutes)
3. Monitor status bar
4. Wait for completion
5. Check auto-opened report

**Expected Results**:
- ✅ Watch starts immediately
- ✅ Status bar shows countdown
- ✅ Channels probe at intervals
- ✅ Report auto-opens after 2 minutes
- ✅ Report contains real data

#### TC-011: Manual Stop Watch
**Steps**:
1. Start a "Forever" watch
2. Wait 30 seconds
3. Command Palette → "Health Watch: Stop Watch"
4. Check report generation

**Expected Results**:
- ✅ Watch stops immediately
- ✅ Report generated with partial data
- ✅ Status bar returns to baseline

---

### 5. Guard Condition Tests

#### TC-012: Network Interface Guard
**Test Data**:
```json
{
  "guards": {
    "vpn": {
      "type": "netIfUp",
      "name": "eth0"
    }
  },
  "channels": [
    {
      "id": "guarded-channel",
      "name": "VPN-Only Service",
      "type": "https",
      "url": "https://httpbin.org/status/200",
      "intervalSec": 15,
      "guards": ["vpn"]
    }
  ]
}
```

**Steps**:
1. Apply configuration (adjust interface name for your system)
2. Run probe when interface is up
3. Disable interface (if possible) and test again

**Expected Results**:
- ✅ Probe runs when interface is up
- ✅ Probe skipped when interface is down
- ✅ Status shows "Unknown" during guard failure

#### TC-013: DNS Guard Test
**Test Data**:
```json
{
  "guards": {
    "corpDNS": {
      "type": "dns",
      "hostname": "google.com"
    }
  },
  "channels": [
    {
      "id": "dns-guarded",
      "name": "DNS-Dependent Service",
      "type": "https",
      "url": "https://httpbin.org/status/200",
      "intervalSec": 20,
      "guards": ["corpDNS"]
    }
  ]
}
```

**Steps**:
1. Apply configuration
2. Run probe with normal DNS
3. Temporarily change DNS to invalid server
4. Test probe behavior

**Expected Results**:
- ✅ Probe runs when DNS works
- ✅ Probe skipped when DNS fails
- ✅ Guard failure logged appropriately

---

### 6. Report Generation Tests

#### TC-014: Report Content Validation
**Steps**:
1. Complete a 3-minute watch with mixed success/failure
2. Open generated report
3. Verify all sections present

**Expected Results**:
- ✅ TL;DR summary table with real values
- ✅ Mermaid Gantt chart with actual timestamps
- ✅ Pie chart with real failure counts
- ✅ Recommendations section
- ✅ Links to JSON export work

#### TC-015: Multiple Channel Report
**Test Data**: Use comprehensive config with 4+ channels

**Steps**:
1. Run 5-minute watch
2. Ensure mix of successes and failures
3. Review report structure

**Expected Results**:
- ✅ All channels represented
- ✅ Individual channel sections
- ✅ Comparative statistics
- ✅ Performance recommendations

---

### 7. User Interface Tests

#### TC-016: Status Bar Behavior
**Steps**:
1. Start with no configuration
2. Add configuration
3. Start watch
4. Stop watch
5. Check status bar at each step

**Expected Results**:
- ✅ Shows "No channels" initially
- ✅ Updates to channel count
- ✅ Shows watch status during monitoring
- ✅ Returns to baseline after stop

#### TC-017: Tree View Functionality
**Steps**:
1. Expand Health Watch tree view
2. Right-click on channel
3. Test context menu options
4. Check status indicators

**Expected Results**:
- ✅ All channels listed
- ✅ Context menu appears
- ✅ "Run Now" works
- ✅ Status colors correct (green/red/gray)

#### TC-018: Notification Behavior
**Steps**:
1. Configure channel that will fail
2. Start watch
3. Wait for failure notifications
4. Fix issue and wait for recovery

**Expected Results**:
- ✅ Single failure notification
- ✅ No spam notifications
- ✅ Recovery notification appears
- ✅ Notifications dismissible

---

### 8. Error Handling Tests

#### TC-019: Invalid Configuration Recovery
**Steps**:
1. Start with valid config
2. Modify to invalid JSON syntax
3. Save file
4. Fix syntax error
5. Save again

**Expected Results**:
- ✅ Error notification on invalid JSON
- ✅ Extension doesn't crash
- ✅ Recovers when fixed
- ✅ Monitoring resumes normally

#### TC-020: Network Disconnection Test
**Steps**:
1. Start watch with external channels
2. Disconnect network
3. Wait 1 minute
4. Reconnect network
5. Check behavior

**Expected Results**:
- ✅ Failures logged during disconnection
- ✅ No extension crashes
- ✅ Recovery when network returns
- ✅ Accurate timeline in report

---

### 9. Performance Tests

#### TC-021: Multiple Channel Load
**Test Data**: Configure 10+ channels with 10-second intervals

**Steps**:
1. Start watch with high-frequency monitoring
2. Monitor VS Code performance
3. Check CPU/memory usage
4. Run for 5 minutes

**Expected Results**:
- ✅ No significant VS Code slowdown
- ✅ Probes run at expected intervals
- ✅ Memory usage stays reasonable
- ✅ UI remains responsive

#### TC-022: Long-Duration Watch
**Steps**:
1. Start 30-minute watch
2. Let run in background
3. Use VS Code normally
4. Check completion

**Expected Results**:
- ✅ Watch completes successfully
- ✅ No interference with normal work
- ✅ Report generated correctly
- ✅ All timeline data accurate

---

## Test Data Configurations

### Appendix A: Comprehensive Test Config
```json
{
  "defaults": {
    "intervalSec": 30,
    "timeoutMs": 5000,
    "threshold": 3
  },
  "guards": {
    "internet": {
      "type": "dns",
      "hostname": "8.8.8.8"
    }
  },
  "channels": [
    {
      "id": "public-success",
      "name": "Public Success",
      "type": "https",
      "url": "https://httpbin.org/status/200",
      "intervalSec": 15
    },
    {
      "id": "public-failure",
      "name": "Public Failure",
      "type": "https",
      "url": "https://httpbin.org/status/500",
      "intervalSec": 20
    },
    {
      "id": "tcp-check",
      "name": "TCP Port Check",
      "type": "tcp",
      "hostname": "httpbin.org",
      "port": 80,
      "intervalSec": 25
    },
    {
      "id": "dns-check",
      "name": "DNS Resolution",
      "type": "dns",
      "hostname": "google.com",
      "dnsRecordType": "A",
      "intervalSec": 45
    },
    {
      "id": "script-check",
      "name": "Script Check",
      "type": "script",
      "script": "ping -c 1 8.8.8.8 > /dev/null && echo 'network ok' || echo 'network fail'",
      "intervalSec": 60,
      "expectedContent": "ok"
    }
  ],
  "reporting": {
    "autoOpen": true,
    "includeGraphs": true
  }
}
```

### Appendix B: Minimal Test Config
```json
{
  "channels": [
    {
      "id": "minimal",
      "name": "Minimal Test",
      "type": "https",
      "url": "https://httpbin.org/status/200",
      "intervalSec": 30
    }
  ]
}
```

---

## Test Execution Checklist

### Pre-Test Setup
- [ ] VS Code version 1.74.0+
- [ ] Extension installed and activated
- [ ] Test workspace created
- [ ] Internet connectivity verified
- [ ] Output panel visible

### Core Feature Testing
- [ ] TC-001 through TC-009 (Installation & Probes)
- [ ] TC-010 through TC-011 (Watch Sessions)
- [ ] TC-012 through TC-013 (Guards)
- [ ] TC-014 through TC-015 (Reports)

### UI/UX Testing
- [ ] TC-016 through TC-018 (Interface)
- [ ] TC-019 through TC-020 (Error Handling)

### Performance Testing
- [ ] TC-021 through TC-022 (Performance)

### Sign-off Criteria
- [ ] All critical path tests pass
- [ ] No crashes or data loss
- [ ] Reports contain accurate real data
- [ ] UI remains responsive under load
- [ ] Error recovery works correctly

---

## Bug Report Template

```markdown
**Test Case**: TC-XXX
**Environment**: VS Code version, OS, extension version
**Steps to Reproduce**:
1. 
2. 
3. 

**Expected Result**: 
**Actual Result**: 
**Severity**: Critical/High/Medium/Low
**Configuration Used**: (attach .healthwatch.json)
**Screenshots**: (if applicable)
```

---

## Notes for Testers

1. **Save configurations** between tests - you'll reuse them
2. **Monitor the Output panel** - many details logged there
3. **Test with real network conditions** - disconnect WiFi, etc.
4. **Verify timestamps** in reports match actual test timeline
5. **Check JSON exports** alongside Markdown reports
6. **Test on different networks** - corporate, home, mobile hotspot

This test plan ensures comprehensive coverage of all major features and common edge cases. Execute tests systematically and document any issues found.