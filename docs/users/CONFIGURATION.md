![Configuration Guide Banner](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8ZGVmcz4KICAgIAogICAgPHBhdHRlcm4gaWQ9InBhdHRlcm4iIHg9IjAiIHk9IjAiIHdpZHRoPSIyOCIgaGVpZ2h0PSIyNCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+CiAgICAgIDxyZWN0IHdpZHRoPSIyOCIgaGVpZ2h0PSIyNCIgZmlsbD0iIzA2NWY0NiIvPgogICAgICA8cG9seWdvbiBwb2ludHM9IjE0LDIgMjQsOCAyNCwxNiAxNCwyMiA0LDE2IDQsOCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMzRkMzk5IiBzdHJva2Utd2lkdGg9IjEiIG9wYWNpdHk9IjAuMiIvPgogICAgPC9wYXR0ZXJuPgogIDwvZGVmcz4KICA8cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0idXJsKCNwYXR0ZXJuKSIvPgogIDx0ZXh0IHg9IjQwMCIgeT0iMzUiIGZvbnQtZmFtaWx5PSJBcmlhbCBCbGFjayIgZm9udC1zaXplPSIyNCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkNvbmZpZ3VyYXRpb24gR3VpZGU8L3RleHQ+CiAgPHRleHQgeD0iNDAwIiB5PSI1NSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSIjMzRkMzk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5IZWFsdGggV2F0Y2ggU2V0dXAgVGVtcGxhdGVzICYgU2V0dGluZ3M8L3RleHQ+CiAgPHRleHQgeD0iNDAwIiB5PSI3NSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEyIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuNykiIHRleHQtYW5jaG9yPSJtaWRkbGUiPuKame+4jyDimpnvuI8gVGVtcGxhdGVzIOKAoiBDb25maWd1cmF0aW9uIOKAoiBTZXR1cCBPcHRpb25zPC90ZXh0Pgo8L3N2Zz4=)

# Health Watch Configuration Templates

This directory contains several pre-configured templates to help you get started quickly with Health Watch monitoring.

## Available Templates

### `.healthwatch.json.simple`
**Best for:** Beginners, basic monitoring needs
- 4 channels: Internet connectivity, Google, GitHub API, local server
- Conservative intervals (30-120 seconds)
- Simple expectations without complex validation

### `.healthwatch.json.developer`
**Best for:** Software developers, local development
- 10 channels: NPM registry, GitHub, Docker Hub, local services
- Developer tools: Docker daemon, Git status, Node.js version
- Local database and Redis monitoring
- Shorter intervals for active development

### `.healthwatch.json.production`
**Best for:** DevOps engineers, production monitoring
- 12 channels: Production websites, APIs, infrastructure
- System monitoring: SSL certificates, disk space, memory, load
- VPN-aware internal service monitoring
- Longer intervals suitable for production environments

### `.healthwatch.json.template`
**Best for:** Comprehensive setup, all features demonstration
- 12 channels covering all supported probe types
- Examples of guards, expectations, and advanced configurations
- Mix of public and internal services
- Detailed descriptions for learning

## Quick Setup

1. Choose the template that best matches your needs
2. Copy it to `.healthwatch.json` in your workspace root:
   ```bash
   cp .healthwatch.json.simple .healthwatch.json
   ```
3. Edit the configuration to match your actual services:
   - Replace example URLs with your real endpoints
   - Update hostnames and ports for your infrastructure
   - Adjust intervals based on your monitoring needs
4. Start Health Watch monitoring

## Customization Tips

### Adjusting Intervals
- **Development**: 15-60 seconds for quick feedback
- **Staging**: 60-300 seconds for regular checks  
- **Production**: 300-3600 seconds to avoid noise

### Setting Thresholds
- **Critical services**: threshold = 1 (immediate alerts)
- **Normal services**: threshold = 2-3 (avoid false positives)
- **Background services**: threshold = 5+ (only persistent issues)

### Using Guards
```json
"guards": {
  "internet": {
    "type": "dns", 
    "hostname": "8.8.8.8"
  },
  "vpn": {
    "type": "dns",
    "hostname": "internal.company.com"
  }
}
```

### Expectation Examples
```json
"expect": {
  "status": [200, 201],
  "bodyRegex": "healthy|ok|up",
  "headerHas": {
    "content-type": "application/json"
  },
  "treatAuthAsReachable": true
}
```

## Security Notes

- Script probes require user confirmation on first use
- Avoid storing credentials in configuration files
- Use environment variables for sensitive data
- Review script commands before enabling

## Troubleshooting

### Common Issues
1. **DNS timeouts**: Check your network/firewall settings
2. **Script failures**: Verify shell availability and permissions
3. **TCP connection refused**: Confirm target service is running
4. **HTTPS certificate errors**: Check SSL configuration

### Validation
Use the command palette to validate your configuration:
- "Health Watch: Run Channel Now" - Test individual channels
- Check the Health Watch output panel for detailed error messages
- Use the tree view to see channel status at a glance

## Next Steps

After setting up your basic configuration:
1. Start a watch session to collect baseline data
2. Adjust intervals and thresholds based on your observations
3. Add custom guards for your network topology
4. Set up notifications and reporting preferences
5. Explore the API for integration with other tools
