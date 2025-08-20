# Open/Create .healthwatch.json Flow

- Owner: Claude
- Status: Planned
- Effort: S
- Labels: ux, config

## Short Description
When users add new config, open `.healthwatch.json` or create it if missing (like launch.json flow).

## Acceptance Criteria
- [ ] Command opens existing config; if missing, prompts and scaffolds a template.
- [ ] Cursor positioned at channels section for quick edit.
- [ ] Undo-friendly file creation; errors handled gracefully.

## Estimated Effort
- Size: S

## Test Plan
- Manual: run with/without existing file; verify behavior.
