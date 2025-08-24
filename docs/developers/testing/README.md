![Testing Documentation Banner](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8ZGVmcz4KICAgIAogICAgPHBhdHRlcm4gaWQ9InBhdHRlcm4iIHg9IjAiIHk9IjAiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+CiAgICAgIDxyZWN0IHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgZmlsbD0iIzBmMTcyYSIvPgogICAgICA8cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjM2I4MmY2IiBzdHJva2Utd2lkdGg9IjEiIG9wYWNpdHk9IjAuMiIvPgogICAgPC9wYXR0ZXJuPgogIDwvZGVmcz4KICA8cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0idXJsKCNwYXR0ZXJuKSIvPgogIDx0ZXh0IHg9IjQwMCIgeT0iMzUiIGZvbnQtZmFtaWx5PSJBcmlhbCBCbGFjayIgZm9udC1zaXplPSIyNCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiPlRlc3RpbmcgRG9jdW1lbnRhdGlvbjwvdGV4dD4KICA8dGV4dCB4PSI0MDAiIHk9IjU1IiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiMzYjgyZjYiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkhlYWx0aCBXYXRjaCBUZXN0IFBsYW5zICYgUXVhbGl0eSBBc3N1cmFuY2U8L3RleHQ+CiAgPHRleHQgeD0iNDAwIiB5PSI3NSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEyIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuNykiIHRleHQtYW5jaG9yPSJtaWRkbGUiPvCfp6og8J+nqiBUZXN0IFBsYW5zIOKAoiBRdWFsaXR5IENvbnRyb2wg4oCiIFZhbGlkYXRpb248L3RleHQ+Cjwvc3ZnPg==)

# Health Watch Testing Documentation

This directory contains comprehensive testing resources for the Health Watch VS Code extension.

## 📋 Manual Test Plan

**File**: `manual-test-plan.md`

A complete manual testing plan covering:
- **22 detailed test cases** with step-by-step instructions
- **Installation and activation testing**
- **All probe types** (HTTPS, TCP, DNS, Script)
- **Watch session flows** (start, stop, reports)
- **Guard condition testing**
- **Error handling scenarios**
- **Performance validation**
- **UI/UX verification**

### Test Categories:
1. **Installation & Activation** (TC-001 to TC-002)
2. **Configuration Management** (TC-003 to TC-004) 
3. **Probe Testing** (TC-005 to TC-009)
4. **Watch Sessions** (TC-010 to TC-011)
5. **Guard Conditions** (TC-012 to TC-013)
6. **Report Generation** (TC-014 to TC-015)
7. **User Interface** (TC-016 to TC-018)
8. **Error Handling** (TC-019 to TC-020)
9. **Performance** (TC-021 to TC-022)

## 🛠️ Test Data Generator

**File**: `test-data-generator.js`

Automated script that generates:
- **9 specialized test configurations**
- **3 invalid configurations** for error testing
- **Quick test execution guides**
- **Test checklists and documentation**

### Generated Configurations:
- `minimal.json` - Basic functionality test
- `comprehensive.json` - Full feature coverage
- `performance-test.json` - Load testing with 15 channels
- `guards-test.json` - Network interface and DNS guards
- `error-test.json` - Error condition testing
- `baseline-test.json` - Anomaly detection testing
- `slo-test.json` - SLO monitoring and breach detection
- `mixed-intervals.json` - Various probe timing tests
- `content-validation.json` - Response validation tests

## 🚀 Quick Start Testing

### 1. Generate Test Data
```bash
cd docs/testing
node test-data-generator.js
```

### 2. Run Basic Tests (5 minutes)
```bash
# Copy minimal config to workspace
cp test-configs/minimal.json /path/to/workspace/.healthwatch.json

# In VS Code:
# - Reload window
# - Start 2-minute watch
# - Verify report generation
```

### 3. Run Comprehensive Tests (30 minutes)
```bash
# Follow the complete manual test plan
# Use comprehensive.json for full feature testing
```

## 📊 Test Coverage Areas

| Area | Coverage | Test Cases | Status |
|------|----------|------------|---------|
| **Core Probes** | Complete | TC-005 to TC-009 | ✅ Ready |
| **Watch Sessions** | Complete | TC-010 to TC-011 | ✅ Ready |
| **Guard Conditions** | Complete | TC-012 to TC-013 | ✅ Ready |
| **Report Generation** | Complete | TC-014 to TC-015 | ✅ Ready |
| **Error Handling** | Complete | TC-019 to TC-020 | ✅ Ready |
| **Performance** | Complete | TC-021 to TC-022 | ✅ Ready |
| **UI/UX** | Complete | TC-016 to TC-018 | ✅ Ready |

## 🎯 Critical Path Tests

**Essential tests that must pass for release:**

1. **TC-001**: Extension installation and activation
2. **TC-003**: Basic configuration loading
3. **TC-005**: HTTPS probe success
4. **TC-010**: Complete watch session with report
5. **TC-016**: Status bar behavior
6. **TC-019**: Error recovery

## 🐛 Known Test Considerations

- **Network Dependencies**: Some tests require internet connectivity
- **Platform Differences**: Script probes use platform-specific commands
- **Timing Sensitivity**: Watch session tests need accurate timing
- **Permission Requirements**: Script probes may need user confirmation

## 📈 Performance Benchmarks

**Expected Performance Characteristics:**
- **Memory Usage**: < 50MB additional for 10 channels
- **CPU Impact**: < 5% during active monitoring
- **UI Responsiveness**: No noticeable lag in VS Code
- **Network Overhead**: Minimal (HEAD requests for HTTPS)

## 🔍 Debugging Failed Tests

### Common Issues:
1. **Network Timeouts**: Increase timeout values or use local endpoints
2. **Guard Failures**: Verify network interface names for your system
3. **Script Security**: Accept security prompts for script probes
4. **Configuration Errors**: Validate JSON syntax and schema compliance

### Debug Resources:
- **Output Panel**: "Health Watch" channel shows detailed logs
- **Developer Console**: `Help > Toggle Developer Tools`
- **Extension Host**: Check for runtime errors
- **Network Tab**: Verify probe network requests

## 📝 Test Reporting

### Bug Report Template:
```markdown
**Test Case**: TC-XXX
**Environment**: VS Code version, OS, extension version
**Configuration**: (attach .healthwatch.json)
**Steps**: 
1. Step one
2. Step two
3. Step three

**Expected**: What should happen
**Actual**: What actually happened
**Severity**: Critical/High/Medium/Low
```

### Test Results Summary:
- **Total Test Cases**: 22
- **Critical Path**: 6 tests
- **Estimated Execution Time**: 2-3 hours for complete suite
- **Quick Validation**: 15 minutes for essential features

## 🎉 Sign-off Criteria

Extension is ready for release when:
- [ ] All critical path tests pass
- [ ] No crashes or data loss in any scenario
- [ ] Reports contain accurate real-world data
- [ ] Performance meets benchmarks
- [ ] Error recovery works correctly
- [ ] UI remains responsive under load

---

**Generated**: Tests cover complete functionality as of v1.0.0
**Maintained**: Update test cases when adding new features
**Contact**: Reference CLAUDE.md for implementation details