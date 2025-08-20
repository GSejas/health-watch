# 🔧 Health Watch Configuration Guide
## The Complete, Hands-On Tutorial for Power Users

```
╔══════════════════════════════════════════════════════════════════════════╗
║                         📊 HEALTH WATCH CONFIG 📊                        ║
║                                                                          ║
║   ┌─────────────┐    ┌──────────────┐    ┌─────────────────────────┐   ║
║   │ Workspace   │    │   VS Code    │    │      Dashboard &       │   ║
║   │   Config    │ ──▶│   Settings   │ ──▶│     Status Bar UI       │   ║
║   │.healthwatch │    │              │    │                         │   ║
║   │   .json     │    │              │    │                         │   ║
║   └─────────────┘    └──────────────┘    └─────────────────────────┘   ║
║                                                                          ║
║  • File-based configuration with JSON Schema validation                  ║
║  • Hot-reload support for real-time config changes                      ║
║  • Layered defaults: Global → Workspace → Channel-specific              ║
║  • Guard system for conditional monitoring                              ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝
```

---

## Table of Contents

1. [🎯 Philosophy & Design Principles](#philosophy--design-principles)
2. [🚀 Quick Start Guide](#quick-start-guide)
3. [📖 Configuration Anatomy](#configuration-anatomy)
4. [🔌 Probe Types Deep Dive](#probe-types-deep-dive)
5. [🛡️ Guards System](#guards-system)
6. [⚙️ Advanced Configuration](#advanced-configuration)
7. [🎨 UI & Status Bar Customization](#ui--status-bar-customization)
8. [📊 Integration Points](#integration-points)
9. [🐛 Troubleshooting & Validation](#troubleshooting--validation)
10. [📝 Real-World Examples](#real-world-examples)

> 📚 **New to Health Watch?** Check out the [Glossary](./GLOSSARY.md) for definitions of all terms and concepts.

---

## 🎯 Philosophy & Design Principles

### Core Design Philosophy

Health Watch follows a **local-first, configuration-as-code** approach built on these foundational principles:

```
╭─────────────────────────────────────────────────────────────────────╮
│                    🏗️  DESIGN PRINCIPLES 🏗️                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  🔒 LOCAL-FIRST PRIVACY                                             │
│    • Zero telemetry • No cloud dependencies • Your data stays      │
│      with you                                                       │
│                                                                     │
│  📝 CONFIGURATION-AS-CODE                                           │
│    • Version controllable • Team shareable • Documentation         │
│      embedded                                                       │
│                                                                     │
│  🚀 PROGRESSIVE COMPLEXITY                                          │
│    • Simple start • Power user features • Graceful degradation     │
│                                                                     │
│  🔄 REAL-TIME FEEDBACK                                              │
│    • Hot configuration reload • Live validation • Instant          │
│      visual feedback                                                │
│                                                                     │
│  🎯 DEVELOPER-CENTRIC UX                                            │
│    • VS Code native • JSON Schema validation • IntelliSense        │
│      support                                                        │
│                                                                     │
╰─────────────────────────────────────────────────────────────────────╯
```

### UX/UI Principles

**Information Hierarchy**: Critical states are immediately visible, detailed information is available on-demand.

**Contextual Awareness**: The extension adapts its behavior based on your workspace, current focus, and development context.

**Non-Intrusive Monitoring**: Health Watch operates silently in the background until there's something that requires your attention.

**Accessibility First**: Uses VS Code's theme-aware icons, respects user preferences, and provides multiple information modalities (visual, textual, dashboard).

---

## 🚀 Quick Start Guide

### Step 1: Create Your First Configuration

The fastest way to get started is to create a minimal `.healthwatch.json` file in your workspace root:

```json
{
  "channels": [
    {
      "id": "basic-connectivity",
      "name": "Internet Check",
      "type": "https",
      "url": "https://httpbin.org/status/200",
      "intervalSec": 30,
      "icon": "$(globe)"
    }
  ]
}
```

```
📸 [SCREENSHOT PLACEHOLDER: VS Code workspace with .healthwatch.json file open,
showing IntelliSense autocompletion for channel properties]
```

### Step 2: Verify Configuration

1. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Run `Health Watch: Validate Configuration`
3. Check the status bar for your new monitoring channel

```
🎬 [GIF PLACEHOLDER: Creating configuration file → Command palette → 
Status bar updating with new channel]
```

### Step 3: Explore the Dashboard

1. Command Palette → `Health Watch: Open Dashboard`
2. Observe real-time monitoring data
3. Explore the timeline view for historical data

```
📸 [SCREENSHOT PLACEHOLDER: Health Watch dashboard showing timeline, 
metrics, and incident history for the basic connectivity channel]
```

---

## 📖 Configuration Anatomy

### File Structure Overview

A Health Watch configuration follows this hierarchical structure:

```
📁 .healthwatch.json
├── 🌐 defaults          # Global defaults for all channels
├── 🛡️  guards           # Conditional monitoring logic  
├── 📊 channels          # Individual monitoring targets
├── 🎨 statusBar         # UI customization options
└── 📈 reporting         # Report generation settings
```

### Complete Configuration Schema

```json
{
  "defaults": {
    "intervalSec": 600,        // How often to probe (seconds)
    "timeoutMs": 3000,         // Max wait time for response
    "threshold": 3,            // Failures before marking offline
    "jitterPct": 10           // Random timing variation (%)
  },
  
  "guards": {
    "internet": {              // Named guard conditions
      "type": "dns",
      "hostname": "8.8.8.8"
    }
  },
  
  "channels": [
    {
      "enabled": true,         // Channel on/off switch
      "id": "my-service",      // Unique identifier
      "name": "My Service",    // Display name
      "description": "...",    // Tooltip description
      "type": "https",         // Probe type
      "url": "https://...",    // Target URL
      "intervalSec": 60,       // Override default interval
      "threshold": 2,          // Override default threshold
      "guards": ["internet"],  // Required guard conditions
      "icon": "$(server)",     // VS Code codicon
      "showInStatusBar": true, // Individual status bar item
      "expect": {              // Response validation rules
        "status": [200, 201],
        "bodyRegex": "ok|healthy"
      }
    }
  ],
  
  "statusBar": {
    "mode": "compact",         // Display mode
    "format": {
      "template": "{icon} {name}: {state}",
      "showLatency": true
    },
    "icons": {
      "online": "$(check)",
      "offline": "$(error)",
      "unknown": "$(question)"
    }
  }
}
```

### Configuration Layers & Precedence

Health Watch uses a sophisticated layering system for configuration:

```
╭─────────────────────────────────────────────────────────────────────╮
│                   ⚡ CONFIGURATION PRECEDENCE ⚡                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  🔥 CHANNEL-SPECIFIC                                                │
│     ↑ Highest Priority                                              │
│     └─ Individual channel overrides                                 │
│                                                                     │
│  📄 WORKSPACE CONFIG                                                │
│     ↑ Medium Priority                                               │
│     └─ .healthwatch.json "defaults" section                        │
│                                                                     │
│  🔧 VS CODE SETTINGS                                                │
│     ↑ Lower Priority                                                │
│     └─ User/workspace settings.json                                 │
│                                                                     │
│  🏭 EXTENSION DEFAULTS                                              │
│     ↑ Lowest Priority                                               │
│     └─ Built-in fallback values                                     │
│                                                                     │
╰─────────────────────────────────────────────────────────────────────╯
```

---

## 🔌 Probe Types Deep Dive

### HTTPS/HTTP Probes

**Best For**: Web services, APIs, CDNs, load balancers

```json
{
  "id": "api-health",
  "type": "https",
  "url": "https://api.example.com/health",
  "expect": {
    "status": [200, 201],           // Acceptable status codes
    "statusRange": [200, 299],      // OR status range
    "headerHas": {                  // Required headers
      "content-type": "application/json"
    },
    "bodyRegex": "status.*ok",      // Body content validation
    "treatAuthAsReachable": true    // 401/403 = reachable but auth issue
  }
}
```

**Advanced HTTPS Configuration**:

```json
{
  "id": "complex-api",
  "type": "https", 
  "url": "https://api.example.com/status",
  "timeoutMs": 5000,
  "expect": {
    "status": [200],
    "headerHas": {
      "x-service-version": "^v[0-9]+\\.[0-9]+",  // Regex validation
      "cache-control": "no-cache"
    },
    "bodyRegex": "\"health\":\\s*\"ok\"",         // JSON structure check
    "treatAuthAsReachable": false
  }
}
```

### TCP Connectivity Probes  

**Best For**: Database connections, message queues, SSH access, custom services

```json
{
  "id": "database",
  "type": "tcp", 
  "target": "db.prod.example.com:5432",
  "timeoutMs": 2000
}
```

**Common TCP Targets**:
- `db.example.com:5432` (PostgreSQL)
- `redis.example.com:6379` (Redis)
- `mail.example.com:587` (SMTP)
- `example.com:22` (SSH)

### DNS Resolution Probes

**Best For**: Domain resolution, CDN health, DNS infrastructure

```json
{
  "id": "dns-check",
  "type": "dns",
  "hostname": "api.example.com",
  "recordType": "A",              // A, AAAA, MX, CNAME, TXT
  "expectedIP": "203.0.113.1"    // Optional: validate resolved IP
}
```

**DNS Record Types**:
- `A`: IPv4 address resolution
- `AAAA`: IPv6 address resolution  
- `MX`: Mail server records
- `CNAME`: Canonical name records
- `TXT`: Text records (SPF, DKIM, etc.)

### Script Probes (Advanced)

**Best For**: Custom health checks, complex validation logic, integration tests

```json
{
  "id": "custom-check",
  "type": "script",
  "command": "node",
  "args": ["./health-check.js"],
  "workingDir": "${workspaceFolder}/scripts",
  "env": {
    "API_KEY": "your-api-key-here"
  }
}
```

**Script Requirements**:
- Exit code `0` = success, non-zero = failure
- Optional JSON output to stdout for detailed results
- Timeout respects channel `timeoutMs` setting

```
📸 [SCREENSHOT PLACEHOLDER: VS Code showing different probe types configured
with syntax highlighting and validation errors/warnings]
```

---

## 🛡️ Guards System

Guards provide conditional monitoring - channels only run when their guard conditions are met.

### Guard Types

#### DNS Guards
```json
{
  "guards": {
    "internet": {
      "type": "dns",
      "hostname": "8.8.8.8"
    },
    "corporate-dns": {
      "type": "dns", 
      "hostname": "internal.corp.com"
    }
  }
}
```

#### Network Interface Guards
```json
{
  "guards": {
    "wifi-connected": {
      "type": "netIfUp",
      "name": "wlan0"           // Linux/macOS
    },
    "ethernet-connected": {
      "type": "netIfUp", 
      "name": "Ethernet"       // Windows
    }
  }
}
```

### Using Guards in Channels

```json
{
  "channels": [
    {
      "id": "internal-api",
      "type": "https",
      "url": "https://internal.corp.com/api/health",
      "guards": ["corporate-dns", "wifi-connected"],  // ALL must pass
      "intervalSec": 30
    }
  ]
}
```

### Guard Evaluation Flow

```
╭─────────────────────────────────────────────────────────────────────╮
│                      🔍 GUARD EVALUATION 🔍                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  📋 CHANNEL SCHEDULED                                               │
│    ↓                                                                │
│  🛡️  CHECK ALL GUARDS                                               │
│    ├─ Guard 1: PASS ✅                                              │
│    ├─ Guard 2: PASS ✅                                              │
│    └─ Guard 3: FAIL ❌                                              │
│    ↓                                                                │
│  ⏭️  SKIP CHANNEL PROBE                                             │
│    └─ Channel marked as "unknown" state                            │
│                                                                     │
│  vs.                                                                │
│                                                                     │
│  📋 CHANNEL SCHEDULED                                               │
│    ↓                                                                │
│  🛡️  CHECK ALL GUARDS                                               │
│    ├─ Guard 1: PASS ✅                                              │
│    ├─ Guard 2: PASS ✅                                              │
│    └─ Guard 3: PASS ✅                                              │
│    ↓                                                                │
│  🔍 EXECUTE PROBE                                                   │
│    └─ Update channel state based on probe result                   │
│                                                                     │
╰─────────────────────────────────────────────────────────────────────╯
```

---

## ⚙️ Advanced Configuration

### Timing & Backoff Strategies

```json
{
  "defaults": {
    "intervalSec": 300,    // Base interval: 5 minutes
    "jitterPct": 15,       // ±15% random variance
    "threshold": 3         // 3 failures = offline
  }
}
```

**Jitter Calculation**:
```
Actual Interval = intervalSec ± (intervalSec × jitterPct / 100)
Example: 300s ± 45s = 255s to 345s
```

**Backoff Behavior**:
- Online state: Normal interval
- After failure: Immediate retry, then exponential backoff
- Offline state: Reduced frequency probing
- Recovery: Return to normal interval

### Environment-Specific Configurations

#### Development Environment
```json
{
  "defaults": {
    "intervalSec": 30,     // Faster feedback in dev
    "threshold": 1         // Immediate failure detection
  },
  "channels": [
    {
      "id": "localhost-api",
      "type": "https",
      "url": "http://localhost:3000/health"
    }
  ]
}
```

#### Production Environment  
```json
{
  "defaults": {
    "intervalSec": 300,    // Less frequent, reduce load
    "threshold": 5         // More tolerant of transient issues  
  },
  "channels": [
    {
      "id": "prod-api",
      "type": "https", 
      "url": "https://api.production.com/health",
      "guards": ["internet"]
    }
  ]
}
```

### Configuration Templates

Health Watch provides several built-in templates accessible via:

**Command Palette** → `Health Watch: Create Configuration from Template`

```
📸 [SCREENSHOT PLACEHOLDER: Command palette showing template options:
- Simple Web Service
- Microservices Stack  
- Database & Cache Layer
- Full Production Setup]
```

---

## 🎨 UI & Status Bar Customization

### Status Bar Modes

```json
{
  "statusBar": {
    "mode": "compact",              // "none", "minimal", "mini-multi-channel", "compact"
    "format": {
      "template": "{icon} {name}: {state} {latency}",
      "showLatency": true,
      "latencyUnit": "ms"
    },
    "icons": {
      "online": "$(check)",         // VS Code codicons
      "offline": "$(error)",
      "unknown": "$(question)"
    }
  }
}
```

### Visual Status Bar Modes

```
╭─────────────────────────────────────────────────────────────────────╮
│                     📊 STATUS BAR MODES 📊                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  🚫 NONE MODE                                                       │
│    [ VS Code Status Bar - no Health Watch items ]                  │
│                                                                     │
│  📉 MINIMAL MODE                                                    │
│    [ 🟢 Health Watch ]                                              │
│                                                                     │
│  🔗 MINI-MULTI-CHANNEL MODE                                         │
│    [ 🟢 Web ] [ 🔴 DB ] [ 🟡 Cache ]                               │
│                                                                     │
│  📊 COMPACT MODE (Recommended)                                      │
│    [ 🔴 Health Watch: 1 offline, 2 online (45ms avg) ]            │
│                                                                     │
╰─────────────────────────────────────────────────────────────────────╯
```

### Icon Customization

**VS Code Codicons** (Recommended):
```json
{
  "icons": {
    "online": "$(check)",      // Green checkmark
    "offline": "$(error)",     // Red X  
    "unknown": "$(question)"   // Question mark
  }
}
```

**Emoji Icons** (Legacy support):
```json
{
  "icons": {
    "online": "✅",
    "offline": "❌", 
    "unknown": "❓"
  }
}
```

**Custom Channel Icons**:
```json
{
  "channels": [
    {
      "id": "database",
      "icon": "$(database)",    // Database icon
      "type": "tcp"
    },
    {
      "id": "web-service",  
      "icon": "$(globe)",       // Globe icon
      "type": "https"
    }
  ]
}
```

---

## 📊 Integration Points

### Code Integration & Help Redirections

Health Watch provides contextual help at multiple integration points:

#### 1. **Configuration Validation Errors**
```typescript
// When config validation fails:
// Error: "Invalid channel configuration"
// → "Learn more about channel configuration: [link to this guide]"
```

#### 2. **Command Palette Commands**
```
Health Watch: Open Configuration Guide    → This document
Health Watch: Validate Configuration      → Troubleshooting section
Health Watch: Create from Template        → Quick Start section  
Health Watch: Probe Types Documentation   → Probe Types section
```

#### 3. **Status Bar Context Menu**
```
Right-click status bar item:
├─ Configure Health Watch     → Configuration Anatomy section
├─ Add New Channel            → Quick Start section
├─ Troubleshoot Issues        → Troubleshooting section
└─ View Documentation         → This document
```

#### 4. **Tree View Actions**
```
Right-click channel in explorer:
├─ Edit Channel Configuration → Channel-specific documentation
├─ Copy Configuration         → Examples section
└─ Help with This Probe Type  → Relevant probe type section
```

#### 5. **Dashboard Help Links**
```
Dashboard interface includes contextual help:
├─ "Configure Monitoring"     → Configuration Anatomy  
├─ "Add Channels"             → Probe Types section
├─ "Understanding Metrics"    → Metrics documentation
└─ "Export & Reporting"       → Reporting section
```

### VS Code Settings Integration

```json
// In settings.json - provides global defaults
{
  "healthWatch.enabled": true,
  "healthWatch.defaults.intervalSec": 600,
  "healthWatch.defaults.timeoutMs": 3000,
  "healthWatch.statusBar.mode": "compact",
  "healthWatch.report.autoOpen": false
}
```

### Workspace-Specific Overrides

```json
// In .vscode/settings.json - workspace-specific behavior  
{
  "healthWatch.defaults.intervalSec": 30,    // Faster in development
  "healthWatch.watch.defaultDuration": "1h", // Shorter watch sessions
  "healthWatch.report.sloTarget": 99.9       // Higher SLA for this project
}
```

---

## 🐛 Troubleshooting & Validation

### Common Configuration Issues

#### 1. **Schema Validation Errors**

```
❌ Error: Channel "my-api" is missing required property "url"
🔧 Solution: Add the url property to your HTTPS channel
```

```json
{
  "id": "my-api",
  "type": "https",
  "url": "https://api.example.com"  // ← Add this
}
```

#### 2. **Guard Reference Errors**

```
❌ Error: Channel "internal-api" references unknown guard "vpn-connected"
🔧 Solution: Define the guard or remove the reference
```

```json
{
  "guards": {
    "vpn-connected": {                // ← Add guard definition
      "type": "dns",
      "hostname": "internal.corp.com"
    }
  }
}
```

#### 3. **Invalid Probe Configuration**

```
❌ Error: TCP target "invalid-format" must be in format "host:port"
🔧 Solution: Use proper host:port format
```

```json
{
  "type": "tcp",
  "target": "database.example.com:5432"  // ← Correct format
}
```

### Validation Commands

#### Live Configuration Validation
```
Command Palette → Health Watch: Validate Configuration
```

#### JSON Schema Validation
VS Code provides real-time validation with IntelliSense when the schema is properly configured.

```
🎬 [GIF PLACEHOLDER: Typing in .healthwatch.json with IntelliSense
showing available properties and validation errors in real-time]
```

### Debug Mode

Enable debug logging for troubleshooting:

```json
// In VS Code settings.json
{
  "healthWatch.debug.enabled": true,
  "healthWatch.debug.logLevel": "verbose"
}
```

Check the Output panel (`View > Output`) and select "Health Watch" from the dropdown.

### Common Networking Issues

#### DNS Resolution Problems
```json
{
  "guards": {
    "dns-test": {
      "type": "dns", 
      "hostname": "8.8.8.8"  // Use IP instead of hostname
    }
  }
}
```

#### Timeout Issues
```json
{
  "defaults": {
    "timeoutMs": 10000      // Increase for slow networks
  }
}
```

#### Proxy Configuration
```json
// VS Code settings for proxy environments
{
  "healthWatch.https.allowProxy": true,
  "http.proxy": "http://proxy.corp.com:8080"
}
```

---

## 📝 Real-World Examples

### Microservices Architecture

```json
{
  "defaults": {
    "intervalSec": 120,
    "threshold": 3,
    "timeoutMs": 5000
  },
  
  "guards": {
    "kubernetes": {
      "type": "dns",
      "hostname": "kubernetes.default.svc.cluster.local"
    },
    "internet": {
      "type": "dns", 
      "hostname": "8.8.8.8"
    }
  },
  
  "channels": [
    {
      "id": "api-gateway",
      "name": "API Gateway",
      "type": "https",
      "url": "https://api.mycompany.com/health",
      "intervalSec": 60,
      "icon": "$(globe)",
      "expect": {
        "status": [200],
        "bodyRegex": "\"status\":\\s*\"healthy\""
      }
    },
    {
      "id": "user-service",
      "name": "User Service", 
      "type": "https",
      "url": "https://users.internal.mycompany.com/health",
      "guards": ["kubernetes"],
      "icon": "$(person)",
      "expect": {
        "status": [200, 503],         // 503 = degraded but reachable
        "treatAuthAsReachable": true
      }
    },
    {
      "id": "postgres-primary",
      "name": "PostgreSQL Primary",
      "type": "tcp",
      "target": "postgres-primary.internal:5432",
      "guards": ["kubernetes"],
      "icon": "$(database)"
    },
    {
      "id": "redis-cache",
      "name": "Redis Cache",
      "type": "tcp", 
      "target": "redis.internal:6379",
      "guards": ["kubernetes"],
      "icon": "$(symbol-misc)"
    },
    {
      "id": "external-payment-api",
      "name": "Payment Provider",
      "type": "https",
      "url": "https://api.stripe.com/v1/charges",
      "guards": ["internet"],
      "icon": "$(credit-card)",
      "expect": {
        "status": [401],              // Expected auth error
        "treatAuthAsReachable": true
      }
    }
  ],
  
  "statusBar": {
    "mode": "compact",
    "format": {
      "template": "🔧 Services: {summary}",
      "showLatency": true
    }
  }
}
```

### Development Environment

```json
{
  "defaults": {
    "intervalSec": 30,        // Fast feedback
    "threshold": 1,           // Immediate detection
    "jitterPct": 5           // Low variance
  },
  
  "channels": [
    {
      "id": "local-api",
      "name": "Local API Server",
      "type": "https",
      "url": "http://localhost:3000/api/health",
      "icon": "$(server-process)"
    },
    {
      "id": "local-db",
      "name": "Local Database",
      "type": "tcp",
      "target": "localhost:5432",
      "icon": "$(database)"
    },
    {
      "id": "webpack-dev",
      "name": "Webpack Dev Server", 
      "type": "https",
      "url": "http://localhost:8080",
      "expect": {
        "status": [200, 404]    // 404 is OK for dev server
      },
      "icon": "$(package)"
    }
  ],
  
  "statusBar": {
    "mode": "mini-multi-channel"  // See each service individually
  }
}
```

### Production Monitoring

```json
{
  "defaults": {
    "intervalSec": 300,       // 5-minute intervals
    "threshold": 5,           // Conservative threshold
    "timeoutMs": 8000,        // Generous timeout
    "jitterPct": 20          // Spread load
  },
  
  "guards": {
    "internet": {
      "type": "dns",
      "hostname": "8.8.8.8"
    }
  },
  
  "channels": [
    {
      "id": "primary-web", 
      "name": "Primary Website",
      "type": "https",
      "url": "https://www.mycompany.com",
      "intervalSec": 180,
      "guards": ["internet"],
      "icon": "$(home)",
      "expect": {
        "status": [200, 301, 302],
        "bodyRegex": "<!DOCTYPE html"
      }
    },
    {
      "id": "api-prod",
      "name": "Production API",
      "type": "https", 
      "url": "https://api.mycompany.com/v1/health",
      "guards": ["internet"],
      "icon": "$(server)",
      "expect": {
        "status": [200],
        "headerHas": {
          "x-api-version": "v1"
        },
        "bodyRegex": "\"healthy\":\\s*true"
      }
    },
    {
      "id": "cdn-assets",
      "name": "CDN Assets",
      "type": "https",
      "url": "https://cdn.mycompany.com/health",
      "intervalSec": 600,      // Less critical, check less often
      "guards": ["internet"],
      "icon": "$(cloud)",
      "expect": {
        "status": [200, 304]    // Cache hits are OK
      }
    }
  ],
  
  "statusBar": {
    "mode": "compact",
    "format": {
      "template": "🏭 Production: {summary}",
      "showLatency": false      // Less visual noise in prod
    }
  }
}
```

---

## 📚 Advanced Topics

### Configuration Inheritance Patterns

```json
// Base configuration (shared)
{
  "defaults": {
    "intervalSec": 300,
    "threshold": 3
  },
  "guards": {
    "internet": { "type": "dns", "hostname": "8.8.8.8" }
  }
}

// Environment-specific extensions
// .healthwatch.staging.json
{
  "extends": ".healthwatch.json",     // Hypothetical feature
  "defaults": {
    "intervalSec": 60                 // Override for staging
  },
  "channels": [
    // Additional staging-specific channels
  ]
}
```

### Dynamic Configuration with Scripts

```json
{
  "id": "dynamic-health",
  "type": "script",
  "command": "node",
  "args": ["./scripts/health-check.js"],
  "env": {
    "NODE_ENV": "production",
    "API_ENDPOINT": "${workspaceFolder}/config/api-endpoint.txt"
  }
}
```

**health-check.js**:
```javascript
#!/usr/bin/env node

const https = require('https');
const fs = require('fs');

// Read dynamic endpoint
const endpoint = fs.readFileSync(process.env.API_ENDPOINT, 'utf8').trim();

https.get(endpoint + '/health', (res) => {
  const success = res.statusCode === 200;
  
  // Output for Health Watch
  console.log(JSON.stringify({
    success,
    latencyMs: Date.now() - start,
    details: { statusCode: res.statusCode, endpoint }
  }));
  
  process.exit(success ? 0 : 1);
}).on('error', (err) => {
  console.log(JSON.stringify({
    success: false,
    error: err.message
  }));
  process.exit(1);
});

const start = Date.now();
```

---

## 🚀 Getting Help & Community

### Documentation Hierarchy

```
📚 Health Watch Documentation
├── 📖 This Configuration Guide         (Comprehensive tutorial)
├── 🏗️  Architecture Documentation      (For contributors)  
├── 🐛 Troubleshooting Guide           (Issue-specific help)
├── 📊 Dashboard & UI Guide            (Interface documentation)
└── 🔧 API & Extension Guide           (Integration documentation)
```

### Support Channels

1. **GitHub Issues**: Bug reports and feature requests
2. **VS Code Marketplace**: Reviews and basic questions  
3. **Configuration Validation**: Built-in real-time help
4. **Command Palette**: `Health Watch: Open Documentation`

### Contributing Configuration Examples

Share your real-world configurations! Submit examples via GitHub pull requests to help other users.

---

## 📋 Quick Reference

### Minimal Configuration
```json
{ "channels": [{ "id": "test", "type": "https", "url": "https://httpbin.org/status/200" }] }
```

### Full Configuration Template
```json
{
  "defaults": { "intervalSec": 300, "threshold": 3, "timeoutMs": 5000 },
  "guards": { "internet": { "type": "dns", "hostname": "8.8.8.8" } },
  "channels": [
    {
      "id": "example", "name": "Example Service", "type": "https",
      "url": "https://example.com", "guards": ["internet"],
      "expect": { "status": [200] }, "icon": "$(globe)"
    }
  ],
  "statusBar": { "mode": "compact" }
}
```

### Common Probe Patterns
```json
// HTTPS with auth tolerance
{ "type": "https", "url": "https://...", "expect": { "treatAuthAsReachable": true } }

// TCP connectivity
{ "type": "tcp", "target": "host.example.com:5432" }

// DNS resolution
{ "type": "dns", "hostname": "example.com", "recordType": "A" }

// Custom script
{ "type": "script", "command": "node", "args": ["./health.js"] }
```

---

*🎯 **Pro Tip**: Start simple with a single HTTPS channel, then gradually add complexity as your monitoring needs grow. The configuration is live-reloaded, so you can experiment safely!*

```
╔══════════════════════════════════════════════════════════════════════════╗
║                         🎉 Happy Monitoring! 🎉                          ║
║                                                                          ║
║  You're now equipped to configure Health Watch for any monitoring       ║
║  scenario. Remember: start simple, iterate quickly, and leverage the     ║
║  real-time feedback to build robust monitoring configurations.          ║
║                                                                          ║
║  📖 More docs: Command Palette → "Health Watch: Open Documentation"     ║
║  🐛 Issues: github.com/your-repo/health-watch/issues                    ║
║  💡 Ideas: Share your configurations with the community!                ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝
```
