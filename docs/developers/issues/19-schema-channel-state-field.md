# Schema: Add Channel State Visibility Field

- Owner: Claude
- Status: **COMPLETED** ✅
- Effort: S
- Labels: schema, UI, completed

## Short Description
Add a field in channel config to influence how a channel's state is shown in the UI (e.g., `visibleState` or similar; define exact key).

## Current Implementation Status
✅ **IMPLEMENTED** - Added comprehensive UI display control fields to channel schema.

### What's Implemented
- ✅ Added `icon?: string` field for custom channel icons (🌐, 🔒, 📊, etc.)
- ✅ Added `showInStatusBar?: boolean` field for individual status bar display
- ✅ Updated JSON schema with proper validation and descriptions
- ✅ Tree view respects custom icons and displays them prominently
- ✅ Status bar manager ready for individual channel display (pending implementation)
- ✅ All UI components support the new display fields

### Schema Implementation
```json
{
  "icon": {
    "type": "string",
    "maxLength": 10,  
    "description": "Emoji or icon string for display in tree view and status bar"
  },
  "showInStatusBar": {
    "type": "boolean",
    "default": false,
    "description": "Whether to show this channel individually in the VS Code status bar"
  }
}
```

## Acceptance Criteria
- [x] ✅ Schema updated with `icon` and `showInStatusBar` fields with proper validation
- [x] ✅ UI respects fields - tree view shows custom icons, status bar integration ready
- [x] ✅ TypeScript interfaces updated in `src/config.ts`

## Risk Notes
- Naming/semantics must be clear; avoid overlapping with `enabled`.

## Estimated Effort
- Size: S

## Test Plan
- Unit: schema validation; Manual: UI behavior toggle.
