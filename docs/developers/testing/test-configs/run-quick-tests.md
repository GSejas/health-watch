# Quick Test Execution Guide

## 1. Basic Functionality Test (5 minutes)
```bash
# Copy minimal config
cp ./test-configs/minimal.json .healthwatch.json

# In VS Code:
# 1. Reload window
# 2. Command Palette → "Health Watch: Start Watch"
# 3. Select "Custom" → Enter "2"
# 4. Wait for completion and report
```

## 2. Comprehensive Test (15 minutes)
```bash
# Copy comprehensive config
cp ./test-configs/comprehensive.json .healthwatch.json

# In VS Code:
# 1. Reload window
# 2. Check tree view shows all channels
# 3. Run individual probes with "Run Channel Now"
# 4. Start 5-minute watch
# 5. Verify report generation
```

## 3. Error Handling Test (10 minutes)
```bash
# Test invalid configurations
cp ./test-configs/invalid-invalid-syntax.json .healthwatch.json
# Reload and check error handling

cp ./test-configs/error-test.json .healthwatch.json
# Test network error scenarios
```

## 4. Performance Test (20 minutes)
```bash
# Test with many channels
cp ./test-configs/performance-test.json .healthwatch.json

# Run 10-minute watch and monitor VS Code performance
```
