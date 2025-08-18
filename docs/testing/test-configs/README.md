# Health Watch Test Configurations

This directory contains test configurations and scripts for manual testing of the Health Watch VS Code extension.

## Configuration Files

### Basic Configurations
- `minimal.json` - Simplest possible configuration for quick testing
- `comprehensive.json` - Full-featured configuration testing all capabilities

### Specialized Tests
- `performance-test.json` - 15 channels for load testing
- `guards-test.json` - Tests guard conditions and network interface detection
- `error-test.json` - Configurations designed to trigger various error conditions
- `baseline-test.json` - Tests baseline monitoring and anomaly detection
- `slo-test.json` - Tests SLO monitoring and breach detection
- `mixed-intervals.json` - Different probe intervals for timing tests
- `content-validation.json` - Tests response content validation

### Invalid Configurations
- `invalid-*.json` - Malformed configurations for error handling tests

## Quick Start

1. Copy a configuration to your workspace:
   ```bash
   cp minimal.json /path/to/your/workspace/.healthwatch.json
   ```

2. Reload VS Code window

3. Start testing via Command Palette → "Health Watch: Start Watch"

## Test Execution

See `run-quick-tests.md` for step-by-step testing procedures.
See `test-checklist.md` for comprehensive test coverage checklist.

## Configuration Notes

- All external URLs use httpbin.org for consistent testing
- Guard configurations may need adjustment for your system's network interfaces
- Script probes are platform-aware (Windows vs Unix commands)
- Performance tests use staggered intervals to simulate real-world usage

## Customization

Edit configurations as needed for your testing environment:
- Adjust hostnames for internal network testing
- Modify intervals for faster/slower testing
- Update guard interface names to match your system
- Add authentication headers for protected endpoints

Generated on: 2025-08-18T04:14:43.849Z
