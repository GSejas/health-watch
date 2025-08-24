# Health Watch VS Code Extension

![Health Watch Banner](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8ZGVmcz4KICAgIAogICAgPHBhdHRlcm4gaWQ9InBhdHRlcm4iIHg9IjAiIHk9IjAiIHdpZHRoPSI2MCIgaGVpZ2h0PSIyMCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+CiAgICAgIDxyZWN0IHdpZHRoPSI2MCIgaGVpZ2h0PSIyMCIgZmlsbD0iI2RjMjYyNiIvPgogICAgICA8cGF0aCBkPSJNMCwxMCBRMTUsNSAzMCwxMCBUNjAsMTAiIHN0cm9rZT0iI2ZiYmYyNCIgc3Ryb2tlLXdpZHRoPSIyIiBmaWxsPSJub25lIiBvcGFjaXR5PSIwLjMiLz4KICAgIDwvcGF0dGVybj4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjgwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9InVybCgjcGF0dGVybikiLz4KICA8dGV4dCB4PSI0MDAiIHk9IjM1IiBmb250LWZhbWlseT0iQXJpYWwgQmxhY2siIGZvbnQtc2l6ZT0iMjQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5IZWFsdGggV2F0Y2g8L3RleHQ+CiAgPHRleHQgeD0iNDAwIiB5PSI1NSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSIjZmJiZjI0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5NdWx0aS1DaGFubmVsIENvbm5lY3Rpdml0eSBNb25pdG9yaW5nIGZvciBWUyBDb2RlPC90ZXh0PgogIDx0ZXh0IHg9IjQwMCIgeT0iNzUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjcpIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj7wn5OKIFByb2R1Y3Rpb24gUmVhZHkg4oCiIHYxLjAuMTEg4oCiIFByaXZhY3kgRmlyc3Q8L3RleHQ+Cjwvc3ZnPg==)

[![Build](https://img.shields.io/badge/Build-passing-brightgreen?style=flat)](#build-status) [![Coverage](https://img.shields.io/badge/Coverage-75%25-yellow?style=flat)](#test-coverage) [![Version](https://img.shields.io/badge/Version-v1.0.11-blue?style=flat)](#version) [![License](https://img.shields.io/badge/License-MIT-green?style=flat)](#license)

> **A production-ready VS Code extension for intelligent multi-channel connectivity monitoring with interactive dashboards, automatic report generation, and privacy-first design.**

---

## 🚀 Quick Start

Health Watch is ready to use out-of-the-box with sensible defaults:

1. **Install** the extension from VS Code marketplace
2. **Open** any workspace in VS Code  
3. **Enable monitoring** via Command Palette → "Health Watch: Enable Monitoring"
4. **Configure channels** (optional) by creating `.healthwatch.json`

No configuration required for basic internet connectivity monitoring!

---

![Features Overview Banner](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8ZGVmcz4KICAgIAogICAgPHBhdHRlcm4gaWQ9InBhdHRlcm4iIHg9IjAiIHk9IjAiIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+CiAgICAgIDxyZWN0IHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0iIzFmMjkzNyIvPgogICAgICA8Y2lyY2xlIGN4PSIxMCIgY3k9IjEwIiByPSIyIiBmaWxsPSIjMTBiOTgxIiBvcGFjaXR5PSIwLjMiLz4KICAgIDwvcGF0dGVybj4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjgwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9InVybCgjcGF0dGVybikiLz4KICA8dGV4dCB4PSI0MDAiIHk9IjM1IiBmb250LWZhbWlseT0iQXJpYWwgQmxhY2siIGZvbnQtc2l6ZT0iMjQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5GZWF0dXJlcyBPdmVydmlldzwvdGV4dD4KICA8dGV4dCB4PSI0MDAiIHk9IjU1IiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiMxMGI5ODEiIHRleHQtYW5jaG9yPSJtaWRkbGUiPk11bHRpLVByb2JlIE1vbml0b3Jpbmcg4oCiIFNtYXJ0IERldGVjdGlvbiDigKIgTm8gVGVsZW1ldHJ5PC90ZXh0PgogIAo8L3N2Zz4=)

### 🎯 **Core Monitoring Features**

- **🔍 Multi-Probe Monitoring** - HTTPS, TCP, DNS, Script, and VS Code Task probes
- **🛡️ Smart Guard System** - Network interface & DNS connectivity checks
- **⚡ Individual Channel Watches** - Per-channel monitoring control
- **🌐 Automatic Internet Detection** - Built-in connectivity monitoring
- **🔄 Adaptive Backoff** - Intelligent failure handling

### 📊 **Interactive Dashboards** 

- **Real-time Overview** - Live status with channel cards
- **Timeline Visualization** - Heatmaps, swimlanes, and incident timelines  
- **Watch Session Management** - Time-boxed monitoring with statistics
- **Multi-Window Coordination** - Seamless workspace switching

### 📈 **Reporting & Analytics**

- **Auto-Generated Reports** - Markdown with Mermaid diagrams
- **SLO Monitoring** - Availability targets and performance thresholds
- **Incident Tracking** - Complete lifecycle management
- **Statistics & Metrics** - MTTR, latency percentiles, availability

### 🔒 **Privacy & Security**

- **Local-First** - All data stored locally, no cloud dependencies
- **Zero Telemetry** - No data collection or tracking
- **CSP Compliant** - Secure webview implementation
- **Opt-in Script Execution** - Security warnings for script probes

---

## 📊 Project Status

```
┌─────────────────────────┬──────────┬──────────┬─────────────┐
│ Module                  │ Progress │ Priority │ Status      │
├─────────────────────────┼──────────┼──────────┼─────────────┤
│ Core Monitoring         │ 95%      │ HIGH     │ Complete    │
│ Multi-Window Coord      │ 90%      │ HIGH     │ Complete    │
│ React Dashboards        │ 85%      │ MEDIUM   │ Complete    │
│ Individual Watches      │ 95%      │ HIGH     │ Complete    │
│ VS Code Tasks           │ 100%     │ MEDIUM   │ Complete    │
│ Testing Coverage        │ 75%      │ HIGH     │ In Progress │
└─────────────────────────┴──────────┴──────────┴─────────────┘
```

---

## ⚙️ Configuration

Health Watch uses an **opt-in monitoring approach** - no monitoring happens until you enable it.

### Basic Setup (Recommended)

1. **Enable via Command Palette**: `Health Watch: Enable Monitoring`
2. **Optional**: Create `.healthwatch.json` for custom channels

### Advanced Configuration

Create a `.healthwatch.json` file in your workspace root:

```json
{
  "defaults": {
    "intervalSec": 60,
    "timeoutMs": 3000,
    "threshold": 3
  },
  "channels": [
    {
      "id": "internet",
      "name": "🌐 Internet",
      "type": "https",
      "url": "https://1.1.1.1",
      "intervalSec": 15,
      "enabled": true
    },
    {
      "id": "vpn-gateway",
      "name": "🔒 VPN Gateway",
      "type": "tcp",
      "target": "10.0.0.1:443",
      "intervalSec": 60,
      "enabled": false
    },
    {
      "id": "demo-task",
      "name": "🔧 Custom Task Check",
      "type": "task",
      "intervalSec": 300,
      "enabled": false,
      "runTask": {
        "taskLabel": "my-health-check-task",
        "expectExitCode": 0
      }
    }
  ]
}
```

### 🔧 VS Code Tasks Integration

Health Watch can execute **VS Code tasks** as monitoring probes. This allows you to integrate custom health checks, scripts, and external tools into your monitoring workflow.

#### Setting up Task-Based Channels

1. **Create VS Code tasks** in `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "my-health-check-task",
      "type": "shell",
      "command": "curl",
      "args": ["-f", "-s", "http://localhost:3000/health"],
      "group": "test",
      "presentation": {
        "reveal": "silent"
      }
    }
  ]
}
```

2. **Configure Health Watch** to use the task:

```json
{
  "channels": [
    {
      "id": "api-health",
      "name": "🩺 API Health Check",
      "type": "task",
      "intervalSec": 120,
      "runTask": {
        "taskLabel": "my-health-check-task",
        "expectExitCode": 0
      }
    }
  ]
}
```

#### Task Configuration Options

- **`taskLabel`** - Name of the VS Code task to execute
- **`expectExitCode`** - Expected exit code for success (default: 0)
- **`timeoutMs`** - Task execution timeout (inherits from channel defaults)

#### Benefits of Task-Based Monitoring

- ✅ **Flexible Integration** - Use any command-line tool or script
- ✅ **VS Code Integration** - Leverage existing task configurations
- ✅ **Cross-Platform** - Works on Windows, macOS, and Linux
- ✅ **Problem Matchers** - Parse structured output from tasks
- ✅ **Terminal Integration** - View task output in VS Code terminals

---

## 🔗 Channel Types

### HTTP/HTTPS Channels
- **Purpose**: Web service availability and response time monitoring
- **Features**: Custom headers, body validation, authentication handling

### TCP Channels  
- **Purpose**: Port connectivity and network service availability
- **Features**: Connection testing, timeout handling, network diagnostics

### DNS Channels
- **Purpose**: Domain name resolution monitoring
- **Features**: IPv4/IPv6 resolution, DNS server testing

### Task Channels ✨ **NEW**
- **Purpose**: Custom script and tool integration via VS Code tasks
- **Features**: Exit code validation, structured output parsing, cross-platform execution

---

## 🏗️ Development

### Building

```bash
npm install
npm run compile
```

### Testing

```bash
npm run test:unit
npm run test:integration
```

### Demo & Testing

The repository includes demo tasks for testing the VS Code tasks integration:

- **`healthwatch:demo-simple-check`** - Basic echo command
- **`healthwatch:demo-node-version`** - Node.js version check
- **`healthwatch:demo-timeout-test`** - PowerShell timeout test

Enable the "🔧 Demo Task Check" channel to see task execution in action.

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.