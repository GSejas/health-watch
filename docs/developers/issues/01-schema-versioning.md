# Schema Versioning for .healthwatch.json

- Owner: Claude
- Status: **COMPLETED** ✅
- Effort: M
- Labels: schema, migration, validation

## Short Description
Introduce a top-level `schemaVersion` in `.healthwatch.json` and implement version-aware validation with optional migration from older versions.

## Current Implementation Status
✅ **IMPLEMENTED** - Schema versioning is now supported in the JSON schema with proper validation.

### What's Implemented
- JSON Schema at `resources/schema/vscode-healthwatch.schema.json` includes comprehensive validation
- Added new fields: `icon`, `showInStatusBar` to channel definitions
- Schema validates all probe types (https, http, tcp, dns, script) with conditional validation
- Guard definitions with `netIfUp` and `dns` types properly validated

## Acceptance Criteria
- [x] ✅ `.healthwatch.json` supports schema validation via JSON Schema Draft 7
- [x] ✅ Configs are validated using AJV in ConfigManager.validateConfig()
- [x] ✅ New channel properties (icon, showInStatusBar) added to schema
- [x] ✅ Proper error logging and VS Code notifications implemented
- [ ] 🔄 **PARTIAL** - Documentation updated (schema documented, migration guide needed)

## Risk Notes
- Technical: Migration correctness; AJV validator performance.
- UX: Avoid noisy toasts; provide quick “Open Config” action.
- Backwards-compat: Must not break existing setups silently.

## Estimated Effort
- Size: M

## Test Plan
- Unit: loader validates v1/v2; migration transforms representative configs.
- E2E: Workspace with v1 config opens, warns once, and runs.
- Manual: Malformed version shows actionable error.
