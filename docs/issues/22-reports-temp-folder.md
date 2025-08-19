# Reports: Write to OS Temp Folder

- Owner: Claude
- Status: Planned
- Effort: S
- Labels: reports, filesystem

## Short Description
Generate reports in the user’s OS temp directory instead of the repo root.

## Acceptance Criteria
- [ ] Use `os.tmpdir()` (or platform-equivalent) for default output.
- [ ] Command to open the last report still works.
- [ ] Optional export/copy to workspace `/docs` on demand.

## Estimated Effort
- Size: S

## Test Plan
- Manual: Generate a report; path is temp dir; open succeeds; export works.
