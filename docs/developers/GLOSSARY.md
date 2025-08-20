# 📚 Health Watch Glossary
## Complete Reference Guide for Terms, Concepts & Components

```
╔══════════════════════════════════════════════════════════════════════════╗
║                           📚 GLOSSARY 📚                                 ║
║                                                                          ║
║   Your comprehensive reference for Health Watch terminology,             ║
║   concepts, and components. From basic monitoring terms to              ║
║   advanced configuration patterns.                                       ║
║                                                                          ║
║   🎯 Quick Lookup  •  🔍 Cross-Referenced  •  📖 Beginner-Friendly      ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝
```

---

## 📑 Table of Contents

1. [🎯 Core Concepts](#core-concepts)
2. [🔌 Probe Types & Monitoring](#probe-types--monitoring)
3. [🛡️ Guards & Conditional Logic](#guards--conditional-logic)
4. [⚙️ Configuration Terms](#configuration-terms)
5. [🎨 UI & Status Components](#ui--status-components)
6. [📊 Data & Metrics](#data--metrics)
7. [🔄 System & Runtime](#system--runtime)
8. [🚀 VS Code Integration](#vs-code-integration)
9. [🌐 Networking Terms](#networking-terms)
10. [📈 Observability & SRE](#observability--sre)

---

## 🎯 Core Concepts

### **Health Watch**
The VS Code extension that provides real-time monitoring and observability for web services, APIs, databases, and network infrastructure directly within your development environment.

### **Channel** 
A single monitoring target or service being watched. Each channel represents one thing you want to monitor (e.g., a website, API endpoint, database connection). Channels are the fundamental unit of monitoring in Health Watch.

**Example**: A channel monitoring `https://api.example.com/health`

### **Probe**
The actual monitoring check performed against a channel's target. Different probe types (HTTPS, TCP, DNS, Script) test different aspects of service health.

**Types**: `https`, `http`, `tcp`, `dns`, `script`

### **Workspace Configuration**
The `.healthwatch.json` file in your VS Code workspace root that defines all channels, guards, and monitoring settings for that project.

### **Local-First**
Health Watch's core philosophy: all monitoring data stays on your machine. No telemetry, no cloud dependencies, complete privacy.

---

## 🔌 Probe Types & Monitoring

### **HTTPS/HTTP Probe**
Tests web services and APIs by making HTTP requests and validating responses.

**Use Cases**: Web services, REST APIs, health check endpoints, CDNs
```json
{ "type": "https", "url": "https://api.example.com/health" }
```

### **TCP Probe**
Tests network connectivity by attempting to connect to a specific host and port.

**Use Cases**: Database connections, message queues, SSH access, custom services
```json
{ "type": "tcp", "target": "database.example.com:5432" }
```

### **DNS Probe**
Tests domain name resolution and DNS infrastructure health.

**Use Cases**: Domain resolution, CDN health, DNS infrastructure
```json
{ "type": "dns", "hostname": "example.com", "recordType": "A" }
```

### **Script Probe**
Executes custom scripts or commands for complex health checks.

**Use Cases**: Custom validation logic, integration tests, multi-step checks
```json
{ "type": "script", "command": "node", "args": ["./health-check.js"] }
```

### **Expectation Rules**
Validation criteria for probe responses (status codes, headers, body content).

**Example**: `"expect": { "status": [200, 201], "bodyRegex": "healthy" }`

---

## 🛡️ Guards & Conditional Logic

### **Guard**
A prerequisite condition that must be met before a channel's probe runs. Guards prevent false negatives by checking environmental conditions first.

**Purpose**: Answer "Should we even try to monitor this service right now?"

### **Guard Types**

#### **DNS Guard**
Checks if DNS resolution works for a specific hostname.
```json
{ "type": "dns", "hostname": "8.8.8.8" }
```
**Use Case**: Verify internet connectivity before probing external services

#### **Network Interface Guard (netIfUp)**
Checks if a specific network interface is up and active.
```json
{ "type": "netIfUp", "name": "tun0" }
```
**Use Cases**: VPN connectivity, specific network requirements

### **Guard Manager**
The system component that registers, caches, and executes guard checks.

### **Guard Result**
The outcome of a guard check: `{ passed: boolean, error?: string, details?: any }`

### **Guard Cache**
Temporary storage of guard results (30-second TTL) to avoid repeated expensive checks.

---

## ⚙️ Configuration Terms

### **Defaults Section**
Global default values applied to all channels unless overridden.
```json
"defaults": { "intervalSec": 300, "threshold": 3, "timeoutMs": 5000 }
```

### **Configuration Layering**
The precedence system: Channel-specific > Workspace config > VS Code settings > Extension defaults

### **Interval (intervalSec)**
How often to probe a channel, in seconds. Default: 600 seconds (10 minutes)

### **Threshold**
Number of consecutive failures required before marking a channel as "offline". Default: 3

### **Timeout (timeoutMs)**
Maximum time to wait for a probe response before considering it failed. Default: 3000ms

### **Jitter (jitterPct)**
Random timing variation (percentage) applied to intervals to prevent thundering herd effects. Default: 10%

### **Hot Reload**
Automatic reloading of configuration changes without restarting the extension.

### **JSON Schema Validation**
Real-time validation of `.healthwatch.json` files using JSON Schema with IntelliSense support.

---

## 🎨 UI & Status Components

### **Status Bar**
The VS Code bottom status bar area where Health Watch displays monitoring status.

#### **Status Bar Modes**
- **None**: No status bar items
- **Minimal**: Single aggregate status item
- **Mini-Multi-Channel**: Individual item per channel
- **Compact**: Single item with aggregated summary

### **Tree View**
The side panel explorer view showing all channels, their status, and management actions.

**Views**: Channels, Status, Incidents

### **Dashboard**
The webview panel showing detailed monitoring data, timeline, metrics, and incident history.

### **Codicons**
VS Code's built-in icon system used for consistent, theme-aware icons.

**Examples**: `$(check)` ✅, `$(error)` ❌, `$(server)` 🖥️

### **Status Bar Item**
Individual UI element in VS Code's status bar representing channel status.

---

## 📊 Data & Metrics

### **Sample**
A single monitoring data point containing timestamp, success status, latency, and optional error details.
```typescript
{ timestamp: number, success: boolean, latencyMs?: number, error?: string }
```

### **Channel State**
Current status and metadata for a channel: online/offline/unknown, last sample, failure count, etc.

### **Outage**
A period when a channel was marked offline, with start/end times and impact tracking.

### **Incident**
User-facing representation of an outage with impact duration and recovery information.

### **MTTR (Mean Time To Recovery)**
Average time between outage detection and service recovery.

### **Availability**
Percentage of time a service was online over a given period.

### **SLA/SLO**
Service Level Agreement/Objective - target availability percentages (e.g., 99.9% uptime).

### **Watch Session**
A focused monitoring period with specific duration and high-frequency data collection.

---

## 🔄 System & Runtime

### **Channel Runner**
The component responsible for executing probes for individual channels, managing state, and handling backoff.

### **Scheduler**
The system component that coordinates timing and execution of all channel probes.

### **Storage Manager**
Handles persistence of monitoring data, samples, outages, and configuration to disk.

### **Backoff Strategy**
Progressive delay increases after failures to avoid overwhelming failed services.

### **State Transition**
Changes between online/offline/unknown states, which trigger notifications and outage tracking.

### **Probe Result**
The outcome of a single probe execution: `{ success: boolean, latencyMs: number, error?: string }`

### **Extension Host**
The VS Code process where Health Watch runs, providing access to VS Code APIs and file system.

---

## 🚀 VS Code Integration

### **Command Palette**
VS Code's command interface (`Ctrl+Shift+P`) where Health Watch commands are accessible.

### **Webview**
VS Code's embedded browser component used for the Health Watch dashboard.

### **Extension Context**
VS Code's execution environment for extensions, providing lifecycle and API access.

### **Workspace**
A VS Code project folder containing source code and configuration files.

### **Settings.json**
VS Code's configuration file for user and workspace settings.

### **CSP (Content Security Policy)**
Security restrictions for webview content to prevent XSS attacks.

### **Local Resource Roots**
Permitted file system paths that webviews can access for loading assets.

### **Nonce (Webview CSP Nonce)**

A nonce is a short, single-use token inserted into the Content Security Policy (CSP) and applied to inline <style> or <script> tags so that the webview can safely allow specific inline resources while keeping a strict CSP. Health Watch uses nonces when it injects generated CSS into the dashboard webview to avoid enabling unsafe-inline styles globally.

```
╔══════════════════════════════════════════════════════════════════════════╗
║                             NONCE (OVERVIEW)                             ║
╟──────────────────────────────────────────────────────────────────────────╢
║  Purpose: Allow specific inline styles/scripts in a secure way           ║
║  Usage: Generate a random token per webview panel, embed in CSP and tags ║
║  Security: Prevents broad 'unsafe-inline' by restricting to known nonce ║
╚══════════════════════════════════════════════════════════════════════════╝
```

#### Why use a nonce?
- CSP with a nonce lets you keep a strict policy (no 'unsafe-inline') and still inject small amounts of critical CSS or JS generated at runtime.
- It is safer than `style-src 'unsafe-inline'` because only tags with the correct nonce are allowed.
- Nonces are short-lived and unique per webview instance.

#### How it works (high-level)
1. On webview creation, the extension generates a random nonce string (e.g., `a1b2c3d4`).
2. The extension injects a CSP meta tag that includes the nonce: `style-src 'nonce-a1b2c3d4' ${panel.webview.cspSource};`.
3. The generated `<style>` tag includes `nonce="a1b2c3d4"`.
4. Browser checks the CSP and allows the `<style>` tag because its nonce matches.

```
📐 Diagram: Nonce flow

[Extension Host] --create webview--> [Panel] --generate nonce--> [nonce=xyz123]
    │                                               │
    │ embed CSP meta tag with nonce                  │
    │---------------------------------------------->│
    │                                               │
    │ inject <style nonce="xyz123">...            │
    │---------------------------------------------->│
    │                                               │
    │ Browser verifies nonce matches CSP and allows  │
    │ the inline style.                              │
```

#### Typical implementation sketch (TypeScript)

```ts
function createNonce(length = 16): string {
  const allowed = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let nonce = '';
  for (let i = 0; i < length; i++) {
    nonce += allowed[Math.floor(Math.random() * allowed.length)];
  }
  return nonce;
}

// In webview creation
const nonce = createNonce();
const csp = `default-src 'none'; style-src 'nonce-${nonce}' ${panel.webview.cspSource}; script-src 'nonce-${nonce}' ${panel.webview.cspSource};`;
const html = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${csp}">` +
  `<style nonce="${nonce}">/* injected css */</style></head><body>...</body></html>`;
```

#### Diagram: CSP header and nonce
```
┌──────────────────────────────────────────────┐
│ Content-Security-Policy:                      │
│   default-src 'none';                         │
│   style-src 'nonce-abc123' https://vscode-webview-resource; │
│   script-src 'nonce-abc123' https://vscode-webview-resource; │
└──────────────────────────────────────────────┘
```

#### Best practices
- Generate a unique nonce per webview panel and per creation event.
- Never reuse a nonce across different webviews or sessions.
- Prefer external stylesheet via `webview.asWebviewUri()` for large CSS; use nonce-injection only for small, critical CSS or dynamic styles.
- Use `script-src` and `style-src` nonces separately as needed.
- Avoid building the entire Tailwind output inline — use nonces for critical/above-the-fold CSS only.

```
📸 [IMAGE PLACEHOLDER: DevTools Security panel showing CSP and nonce match]
```

#### Troubleshooting nonces
- If styles don't apply, verify the nonce in the HTML tag matches the nonce in the CSP meta tag.
- Check `panel.webview.cspSource` is included in the CSP for external sources.
- Use the DevTools Security and Console panels to diagnose CSP violations.

```
🎬 [GIF PLACEHOLDER: Generate nonce -> Inject style -> DevTools show CSP OK]
```

---

## 🌐 Networking Terms

### **DNS Resolution**
The process of converting domain names (example.com) to IP addresses.

### **Network Interface**
A connection point between a computer and network (eth0, wlan0, tun0).

### **VPN (Virtual Private Network)**
Encrypted network connection, often detected via interface names like `tun0` or `wg0`.

### **HTTP Status Code**
Numeric response codes indicating request outcomes (200 = OK, 404 = Not Found, 500 = Server Error).

### **Latency**
The time delay between sending a request and receiving a response, measured in milliseconds.

### **Timeout**
Maximum time to wait for a network operation before giving up.

### **TCP Connection**
Reliable, connection-oriented network protocol used by most internet services.

### **Port**
Numeric identifier for specific services on a host (80 = HTTP, 443 = HTTPS, 5432 = PostgreSQL).

---

## 📈 Observability & SRE

### **Observability**
The ability to understand system behavior through monitoring, logging, and tracing.

### **SRE (Site Reliability Engineering)**
Practice of applying software engineering to operations for reliable services.

### **Health Check**
An endpoint or probe specifically designed to report service status.

### **Synthetic Monitoring**
Automated testing that simulates user interactions to detect issues proactively.

### **Uptime**
The percentage of time a service is available and functioning correctly.

### **Downtime**
Period when a service is unavailable or not functioning properly.

### **Service Degradation**
Reduced performance or functionality without complete failure.

### **Alert Fatigue**
Reduced responsiveness to alerts due to too many false positives or noise.

---

## 🔧 Technical Implementation Terms

### **TypeScript Interface**
Structured data definitions used throughout Health Watch for type safety.

### **JSON Schema**
Specification for validating JSON data structure and content.

### **Singleton Pattern**
Design pattern ensuring only one instance of managers (GuardManager, ConfigManager).

### **Event-Driven Architecture**
System design where components communicate through events and notifications.

### **Hot Configuration Reload**
Ability to update configuration without restarting the monitoring system.

### **Graceful Degradation**
System behavior that maintains core functionality when optional features fail.

---

## 🎯 Quick Reference Lookup

### **Common Abbreviations**
- **MTTR**: Mean Time To Recovery
- **SLA**: Service Level Agreement  
- **SLO**: Service Level Objective
- **DNS**: Domain Name System
- **TCP**: Transmission Control Protocol
- **HTTP**: HyperText Transfer Protocol
- **API**: Application Programming Interface
- **CDN**: Content Delivery Network
- **VPN**: Virtual Private Network
- **UI**: User Interface
- **CSP**: Content Security Policy

### **File Extensions**
- `.healthwatch.json`: Workspace configuration file
- `.vsix`: VS Code extension package format

### **Default Values Quick Reference**
```
intervalSec: 600 (10 minutes)
timeoutMs: 3000 (3 seconds)  
threshold: 3 (failures before offline)
jitterPct: 10 (±10% timing variance)
```

### **Status States**
- **Online**: Service responding successfully
- **Offline**: Service failing consistently (threshold exceeded)
- **Unknown**: Cannot determine status (guards failed, not yet tested)

---

## 🔗 Cross-References

### **Related Documentation**
- [Configuration User Guide](./CONFIGURATION-USER-GUIDE.md) - Complete setup tutorial
- [Architecture README](./DASHBOARD-ARCHITECTURE-README.md) - System design
- [Integration Points](./CONFIGURATION-INTEGRATION-POINTS.md) - Code integration

### **Key Source Files**
- `src/types.ts` - Core data structures
- `src/config.ts` - Configuration management
- `src/guards.ts` - Guard system implementation
- `src/probes/` - Probe implementations
- `src/ui/` - User interface components

---

## 💡 Usage Patterns & Examples

### **Simple Monitoring**
```json
{
  "channels": [
    { "id": "web", "type": "https", "url": "https://example.com" }
  ]
}
```

### **Guarded Monitoring**
```json
{
  "guards": {
    "internet": { "type": "dns", "hostname": "8.8.8.8" }
  },
  "channels": [
    { 
      "id": "api", 
      "type": "https", 
      "url": "https://api.example.com",
      "guards": ["internet"]
    }
  ]
}
```

### **VPN-Dependent Monitoring**
```json
{
  "guards": {
    "vpn": { "type": "netIfUp", "name": "tun0" }
  },
  "channels": [
    {
      "id": "internal",
      "type": "https", 
      "url": "https://internal.corp.com",
      "guards": ["vpn"]
    }
  ]
}
```

---

*📖 **Need more help?** This glossary is cross-referenced with the [Configuration User Guide](./CONFIGURATION-USER-GUIDE.md) for detailed tutorials and examples.*

```
╔══════════════════════════════════════════════════════════════════════════╗
║                        📚 Knowledge Index 📚                             ║
║                                                                          ║
║  This glossary serves as the central reference for all Health Watch     ║
║  terminology. When in doubt about any term, concept, or component,      ║
║  start here for clear definitions and cross-references to detailed      ║
║  documentation.                                                          ║
║                                                                          ║
║  🎯 Quick Search: Use Ctrl+F to find any term instantly                 ║
║  🔗 Cross-Referenced: Links to relevant guides and source code          ║
║  📖 Beginner-Friendly: Clear explanations for all experience levels     ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝
```
