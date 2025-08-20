# Test Execution Checklist

## Pre-Test Setup
- [ ] VS Code 1.74.0+ installed
- [ ] Health Watch extension installed from .vsix
- [ ] Test workspace created
- [ ] Test configurations copied to workspace

## Core Tests
- [ ] Extension activation (TC-001, TC-002)
- [ ] Configuration loading (TC-003, TC-004)
- [ ] HTTPS probes (TC-005, TC-006)
- [ ] TCP probes (TC-007)
- [ ] DNS probes (TC-008)
- [ ] Script probes (TC-009)
- [ ] Watch sessions (TC-010, TC-011)
- [ ] Guards (TC-012, TC-013)
- [ ] Report generation (TC-014, TC-015)

## UI Tests
- [ ] Status bar behavior (TC-016)
- [ ] Tree view functionality (TC-017)
- [ ] Notifications (TC-018)

## Error Handling
- [ ] Invalid configuration recovery (TC-019)
- [ ] Network disconnection (TC-020)

## Performance
- [ ] Multiple channel load (TC-021)
- [ ] Long-duration watch (TC-022)

## Sign-off
- [ ] All critical tests pass
- [ ] No crashes or data loss
- [ ] Reports contain real data
- [ ] Performance acceptable
