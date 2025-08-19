# Health Watch VS Code Extension

A local-first VS Code extension for monitoring multi-channel connectivity (public internet + VPN-only internal services) with intelligent baseline tracking, interactive dashboards, and automatic report generation.

## ✨ New in v1.0.4

🎯 **Enhanced Status Bar Experience**
- **Multi-channel status bar**: Show individual status for each channel with configurable icons
- **Three display modes**: `none`, `minimal` (single internet item), or `mini-multi-channel` (per-channel items)
- **Smart overflow handling**: Automatic truncation with `+N` indicators for many channels
- **Customizable formatting**: Control latency display, separators, and ordering

📊 **Improved Dashboard & UI**
- **Live monitoring views**: Real-time activity logs and status updates
- **Enhanced timeline views**: Heatmaps, incidents, and swimlanes with React components
- **Modern styling**: Tailwind CSS integration for consistent, responsive design
- **Better error handling**: Clear validation messages and actionable error dialogs

🛠️ **Developer Experience**
- **Comprehensive testing**: Unit tests, E2E tests, and test coverage reporting
- **Better documentation**: User journey guides, troubleshooting flowcharts, and setup templates
- **Improved configuration**: Enhanced JSON schema validation with detailed error messages
- **Template system**: Quick-start templates for different use cases

## Features

- **Multi-channel monitoring**: HTTPS, TCP, DNS, and Script probes
- **Guard conditions**: Prevent false positives with network interface and DNS checks
- **Smart baseline tracking**: Automatic anomaly detection
- **Interactive dashboards**: Real-time monitoring with timeline views, heatmaps, and live activity logs
- **Incident management**: Track and manage incidents with full CRUD operations
- **Rich reporting**: Auto-generated Markdown reports with Mermaid diagrams
- **SLO monitoring**: Track availability targets and performance thresholds
- **Local-first**: All data stored locally, no telemetry
- **Watch sessions**: Time-boxed monitoring with detailed end-of-session reports

## Getting Started

1. Install the extension
2. Set up your configuration:
   - **Quick setup:** Run `./setup-config.sh` (Linux/Mac) or `./setup-config.ps1` (Windows)
   - **Manual setup:** Copy one of the `.healthwatch.json.*` templates to `.healthwatch.json`
   - **Custom setup:** Create your own `.healthwatch.json` (see Configuration section)
3. Edit the configuration to match your actual services
4. Start monitoring via the command palette: "Health Watch: Start Watch"

## Configuration

Create a `.healthwatch.json` file in your workspace root. You can use one of the provided templates:

### Quick Start Templates

**Simple Setup** ([`.healthwatch.json.simple`](./.healthwatch.json.simple)) — copy to your workspace for a minimal starter configuration:
- Basic internet connectivity
- Popular websites (Google, GitHub)
- Local development server

**Developer Setup** ([`.healthwatch.json.developer`](./.healthwatch.json.developer)) — copy into `.healthwatch.json` for a developer-focused setup:
- NPM registry, GitHub, Docker Hub
- Local API/frontend servers
- Database and Redis connections
- Docker daemon and Git status

**Production Setup** ([`.healthwatch.json.production`](./.healthwatch.json.production)) — production-ready defaults and system checks:
- Production websites and APIs
- Database clusters and CDN
- SSL certificate monitoring
- System resource monitoring

**Full Template** ([`.healthwatch.json.template`](./.healthwatch.json.template)) — comprehensive example covering all channel types and guards:
- Comprehensive monitoring setup
- All channel types with examples
- Common infrastructure patterns

Quick copy commands:

```powershell
# Windows (PowerShell)
Copy-Item .\.healthwatch.json.developer .\.healthwatch.json

# macOS / Linux (bash)
cp .healthwatch.json.simple .healthwatch.json
```

### Manual Configuration

```json
{
  "channels": [
    {
      "id": "public-site",
      "name": "Public Website",
      "type": "https",
      "url": "https://example.com/health",
      "intervalSec": 30,
      "expect": {
        "status": [200],
        "bodyRegex": "ok|healthy"
      }
    },
    {
      "id": "internal-db",
      "name": "Internal Database",
      "type": "tcp",
      "target": "db.internal:5432",
      "intervalSec": 60,
      "guards": ["vpn"]
    }
  ]
}
```

## Extension Settings

This extension contributes the following VS Code settings:

**Core Settings:**
- `healthWatch.enabled`: Enable/disable health monitoring
- `healthWatch.defaults.intervalSec`: Default probe interval in seconds (default: 60)
- `healthWatch.defaults.timeoutMs`: Default probe timeout in milliseconds (default: 3000)
- `healthWatch.defaults.threshold`: Default failure threshold before marking offline (default: 3)

**Status Bar Configuration:**
- `healthWatch.statusBar.mode`: Display mode - `none`, `minimal`, or `mini-multi-channel` (default: minimal)
- `healthWatch.statusBar.showInternet`: Show internet connectivity in minimal mode (default: true)
- `healthWatch.statusBar.format.showLatency`: Include latency in per-channel items (default: false)
- `healthWatch.statusBar.format.separator`: Separator between icon and status (default: ":")
- `healthWatch.statusBar.format.maxChannelItems`: Maximum per-channel items to show (default: 6)
- `healthWatch.statusBar.format.order`: Item ordering - `explicit` or `worst-first` (default: explicit)

**Status Bar Icons:**
- `healthWatch.statusBar.icons.online`: Icon for online status (default: 🟢)
- `healthWatch.statusBar.icons.offline`: Icon for offline status (default: 🔴)
- `healthWatch.statusBar.icons.unknown`: Icon for unknown status (default: 🟡)

**Watch & Reporting:**
- `healthWatch.watch.defaultDuration`: Default watch duration - `1h`, `12h`, or `forever` (default: 1h)
- `healthWatch.watch.highCadenceIntervalSec`: Probe interval during active watch (default: 15)
- `healthWatch.report.autoOpen`: Auto-open reports after watch sessions (default: true)
- `healthWatch.report.sloTarget`: SLO availability target percentage (default: 99)

**Security & Advanced:**
- `healthWatch.script.enabled`: Enable script probes (requires confirmation, default: false)
- `healthWatch.quietHours.enabled`: Enable quiet hours for notifications (default: false)
- `healthWatch.onlyWhenFishy.enabled`: Enable smart anomaly detection (default: true)

## Commands

**Monitoring & Watch Sessions:**
- `Health Watch: Start Watch`: Begin a time-boxed monitoring session
- `Health Watch: Stop Watch`: End current monitoring session
- `Health Watch: Run All Probes Now`: Execute all channel probes immediately
- `Health Watch: Run Channel Now`: Execute a specific channel probe

**Dashboard & Reporting:**
- `Health Watch: Open Dashboard`: Launch interactive monitoring dashboard with live views
- `Health Watch: Open Last Report`: View the most recent session report
- `Health Watch: Export Data as JSON`: Export all monitoring data

**Incident Management:**
- `Health Watch: Add Incident`: Create a new incident record
- `Health Watch: Edit Incident`: Modify existing incident details
- `Health Watch: Delete Incident`: Remove incident from records
- `Health Watch: Refresh Incidents`: Update incident tree view

**Configuration:**
- `Health Watch: Open Configuration`: Open `.healthwatch.json` for editing
- `Health Watch: Refresh Channels`: Reload channel configuration
- `Health Watch: Toggle Channel Enabled`: Enable/disable specific channels

**Channel Control:**
- `Health Watch: Pause Channel`: Temporarily pause a channel's probes
- `Health Watch: Resume Channel`: Resume a paused channel
- `Health Watch: Stop Channel`: Stop a running channel permanently
- `Health Watch: Show Channel Details`: View detailed channel information

## Requirements

- VS Code 1.103.0 or higher
- Node.js runtime (bundled with VS Code)

## Known Issues

- Script probes require user confirmation on first use for security
- DNS probes may timeout in restricted network environments

## Release Notes

### 1.0.4 (Latest)

**🎯 Enhanced Status Bar Experience**
- Added multi-channel status bar with three display modes: `none`, `minimal`, and `mini-multi-channel`
- Configurable per-channel status items with custom icons, latency display, and ordering
- Smart overflow handling with `+N` indicators for many channels
- Individual channel opt-in/opt-out via `showInStatusBar` configuration

**📊 Improved Dashboard & UI**
- New live monitoring views with real-time activity logs
- Enhanced timeline views using React components and Tremor UI
- Modern styling with Tailwind CSS integration
- Responsive design improvements across all dashboard views

**🛠️ Developer Experience & Testing**
- Comprehensive test suite with unit tests and E2E testing
- Enhanced JSON schema validation with detailed error messages
- Improved configuration templates and setup scripts
- Better error handling with actionable error dialogs

**📖 Documentation & User Experience**
- New user journey documentation with flowcharts and troubleshooting guides
- Enhanced setup templates for different use cases
- Improved first-time user experience with better error messages
- ASCII art diagrams and Mermaid flowcharts in documentation

### 1.0.3

**🔧 Configuration & Templates**
- Added comprehensive configuration templates for different use cases
- Improved setup scripts for Windows (PowerShell) and Unix (bash)
- Enhanced JSON schema validation and error reporting

### 1.0.2

**🎨 UI & Icon Improvements**
- Updated extension icon to PNG format for better compatibility
- Enhanced tree view layouts and visual consistency

### 1.0.1

**🐛 Fixes & Improvements**
- Fixed HTTP probe support for internal health monitoring
- Improved error handling and validation

### 1.0.0

Initial release of Health Watch with complete monitoring capabilities.

---

**Local-first monitoring for VS Code**