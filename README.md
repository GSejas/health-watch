# Health Watch VS Code Extension

A local-first VS Code extension for monitoring multi-channel connectivity (public internet + VPN-only internal services) with intelligent baseline tracking and automatic report generation.

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

- `healthWatch.enabled`: Enable/disable health monitoring
- `healthWatch.defaults.intervalSec`: Default probe interval in seconds
- `healthWatch.defaults.timeoutMs`: Default probe timeout in milliseconds
- `healthWatch.watch.durationDefault`: Default watch duration
- `healthWatch.report.autoOpen`: Auto-open reports after watch sessions

## Commands

- `Health Watch: Start Watch`: Begin a monitoring session
- `Health Watch: Stop Watch`: End current monitoring session
- `Health Watch: Run Channel Now`: Execute a single channel probe
- `Health Watch: Open Last Report`: View the most recent report
- `Health Watch: Open Dashboard`: Launch interactive monitoring dashboard
- `Health Watch: Add Incident`: Create a new incident record
- `Health Watch: Export Data as JSON`: Export monitoring data

## Requirements

- VS Code 1.103.0 or higher
- Node.js runtime (bundled with VS Code)

## Known Issues

- Script probes require user confirmation on first use for security
- DNS probes may timeout in restricted network environments

## Release Notes

### 1.0.0

Initial release of Health Watch with complete monitoring capabilities.

---

**Local-first monitoring for VS Code**