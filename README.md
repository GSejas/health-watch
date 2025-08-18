# Health Watch VS Code Extension

A local-first VS Code extension for monitoring multi-channel connectivity (public internet + VPN-only internal services) with intelligent baseline tracking and automatic report generation.

## Features

- **Multi-channel monitoring**: HTTPS, TCP, DNS, and Script probes
- **Guard conditions**: Prevent false positives with network interface and DNS checks
- **Smart baseline tracking**: Automatic anomaly detection
- **Rich reporting**: Auto-generated Markdown reports with Mermaid diagrams
- **SLO monitoring**: Track availability targets and performance thresholds
- **Local-first**: All data stored locally, no telemetry
- **Watch sessions**: Time-boxed monitoring with detailed end-of-session reports

## Getting Started

1. Install the extension
2. Create a `.healthwatch.json` configuration file in your workspace
3. Start monitoring via the command palette: "Health Watch: Start Watch"

## Configuration

Create a `.healthwatch.json` file in your workspace root:

```json
{
  "channels": [
    {
      "id": "public-site",
      "name": "Public Website",
      "type": "https",
      "url": "https://example.com/health",
      "intervalSec": 30,
      "expectedContent": "ok"
    },
    {
      "id": "internal-db",
      "name": "Internal Database",
      "type": "tcp",
      "hostname": "db.internal",
      "port": 5432,
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

## Requirements

- VS Code 1.74.0 or higher
- Node.js runtime (bundled with VS Code)

## Known Issues

- Script probes require user confirmation on first use for security
- DNS probes may timeout in restricted network environments

## Release Notes

### 1.0.0

Initial release of Health Watch with complete monitoring capabilities.

---

**Local-first monitoring for VS Code**