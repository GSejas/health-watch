# Health Watch MCP Server

Model Context Protocol (MCP) server integration for the Health Watch VS Code extension.

## Overview

This MCP server exposes 4 essential tools that allow AI assistants (like Copilot) to interact with the Health Watch extension:

1. **`get_health_watch_config`** - Get complete extension configuration and status
2. **`update_health_watch_setting`** - Modify extension settings programmatically  
3. **`get_channel_status`** - Get monitoring status of all or specific channels
4. **`start_watch_session`** - Start a monitoring watch session

## Setup

### 1. Enable MCP in Health Watch Settings

```json
{
  "healthWatch.mcp.enabled": true
}
```

### 2. Option A: VS Code Integration (Embedded)

Use the built-in commands in VS Code:
- `Health Watch: Start MCP Server`
- `Health Watch: Stop MCP Server` 
- `Health Watch: Test MCP Configuration`

### 3. Option B: Standalone MCP Server

Create `.vscode/mcp.json` in your workspace:

```json
{
  "servers": [
    {
      "name": "health-watch",
      "command": "node",
      "args": ["./src/mcp/standalone-server.js"],
      "transport": "stdio"
    }
  ]
}
```

## Tools Reference

### get_health_watch_config

**Description**: Get complete Health Watch extension configuration  
**Parameters**: None  
**Returns**: JSON with settings, channels, internet status, and extension info

### update_health_watch_setting

**Description**: Update a Health Watch extension setting  
**Parameters**:
- `key` (string): Setting key (e.g., 'defaults.intervalSec', 'internet.enabled')
- `value` (any): Setting value (will be parsed as JSON if string)
- `scope` (optional): 'workspace' or 'global' (default: workspace)

### get_channel_status

**Description**: Get current monitoring status of channels  
**Parameters**:
- `channelId` (optional string): Specific channel ID to filter

**Returns**: JSON with internet connectivity status, channel details, and summary

### start_watch_session

**Description**: Start a monitoring watch session  
**Parameters**:
- `duration` (optional): '1h', '12h', or 'forever' (default: '1h')
- `channels` (optional array): Specific channel IDs to watch
- `profile` (optional string): Profile name for the session

## File Structure

```
src/mcp/
├── README.md                 # This file
├── simpleMCPServer.ts        # Main MCP server (embedded in extension)
├── standalone-server.js      # Standalone MCP server for external use
└── archive/                  # Archived complex version with schemas
```

## Dependencies

- `@modelcontextprotocol/sdk`: Official MCP TypeScript SDK
- VS Code Extension API for settings and extension interaction

## Usage Examples

### Via VS Code Command Palette

1. Open Command Palette (`Ctrl+Shift+P`)
2. Run "Health Watch: Start MCP Server"
3. Use AI assistant with MCP support (like Copilot)

### Via Claude Desktop

Configure in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "health-watch": {
      "command": "node",
      "args": ["path/to/health-watch/src/mcp/standalone-server.js"],
      "cwd": "path/to/your/workspace"
    }
  }
}
```

## Troubleshooting

- Enable MCP server logging in VS Code Developer Console
- Check that `healthWatch.mcp.enabled` is `true`
- Verify MCP server is running with "Health Watch: Test MCP Configuration"
- Ensure workspace has proper `.healthwatch.json` configuration for standalone mode

## Implementation Notes

- Uses simple JSON Schema for tool definitions (no Zod dependency)
- Embedded server integrates directly with extension APIs
- Standalone server reads from `.healthwatch.json` and `.vscode/settings.json`
- All tools return structured JSON for easy AI assistant consumption