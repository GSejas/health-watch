# Known Issue: Channel Details inline action (info icon)

Status: Disabled (2025-08-23)

## Symptom
- Clicking the inline info icon (Show Channel Details) in the Channels tree causes a VS Code error:
  - "Unexpected type" originating from workbench editor integration.
- Primary row click (now opens .healthwatch.json at channel object) works.

## Root Cause (RCA)
- The tree item has a primary `item.command` (open channel config). When an inline menu command is also present, VS Code sometimes invokes the contributed command with an unexpected argument object.
- The workbench attempts to treat that object as an editor input and fails with "Unexpected type" before our handler logic can validate.

## What we tried
- Hardened the command handler to accept string/TreeItem/undefined and prompt when needed.
- Wrapped the details webview creation and render in try/catch.
- Issue persists because the failure occurs in VS Code prior to our handler (inline action argument marshalling + primary command interaction).

## Current mitigation
- The inline info action is hidden.
- The `healthWatch.showChannelDetails` command is disabled and shows an informational message.
- Channel row click opens `.healthwatch.json` at the channel block for quick editing.

## Workarounds
- Use the Command Palette: "Health Watch: Show Channel Details" (when re-enabled) or open the Dashboard for richer details.
- Right-click context menu (non-inline) version may work if we re-contribute it outside the inline group.

## Remediation plan
1. Replace inline action with a non-inline context menu contribution passing a stable argument (channel id).
2. Alternatively, remove the tree item primary command and drive both actions via context menus to avoid the argument ambiguity.
3. As a fallback, make the details button in the Channel Details webview open configuration.

## Tracking
- TODO: Create a GitHub issue and link here once opened.
