#!/usr/bin/env node

/**
 * Health Watch Test Data Generator
 * 
 * This script generates various test configurations for manual testing
 * of the Health Watch VS Code extension.
 * 
 * Usage: node test-data-generator.js [output-dir]
 */

const fs = require('fs');
const path = require('path');

const outputDir = process.argv[2] || './test-configs';

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Test configuration templates
const configs = {
    'minimal.json': {
        channels: [
            {
                id: 'minimal-test',
                name: 'Minimal Test',
                type: 'https',
                url: 'https://httpbin.org/status/200',
                intervalSec: 30
            }
        ]
    },

    'comprehensive.json': {
        defaults: {
            intervalSec: 30,
            timeoutMs: 5000,
            threshold: 3,
            jitterPct: 10
        },
        guards: {
            internet: {
                type: 'dns',
                hostname: '8.8.8.8'
            },
            vpn: {
                type: 'netIfUp',
                name: 'eth0'
            }
        },
        channels: [
            {
                id: 'public-success',
                name: 'Public Success Test',
                type: 'https',
                url: 'https://httpbin.org/status/200',
                intervalSec: 15,
                expectedContent: 'status',
                expectedStatusCode: 200
            },
            {
                id: 'public-failure',
                name: 'Public Failure Test',
                type: 'https',
                url: 'https://httpbin.org/status/404',
                intervalSec: 20
            },
            {
                id: 'slow-response',
                name: 'Slow Response Test',
                type: 'https',
                url: 'https://httpbin.org/delay/2',
                intervalSec: 45,
                timeoutSec: 10
            },
            {
                id: 'tcp-port-check',
                name: 'TCP Port Check',
                type: 'tcp',
                hostname: 'httpbin.org',
                port: 80,
                intervalSec: 25
            },
            {
                id: 'tcp-port-fail',
                name: 'TCP Port Fail',
                type: 'tcp',
                hostname: 'httpbin.org',
                port: 9999,
                intervalSec: 60,
                timeoutSec: 5
            },
            {
                id: 'dns-resolution',
                name: 'DNS Resolution Test',
                type: 'dns',
                hostname: 'google.com',
                dnsRecordType: 'A',
                intervalSec: 35
            },
            {
                id: 'dns-mx-record',
                name: 'DNS MX Record Test',
                type: 'dns',
                hostname: 'gmail.com',
                dnsRecordType: 'MX',
                intervalSec: 90
            },
            {
                id: 'script-success',
                name: 'Script Success Test',
                type: 'script',
                script: 'echo "health check passed"',
                intervalSec: 40,
                expectedContent: 'passed'
            },
            {
                id: 'script-failure',
                name: 'Script Failure Test',
                type: 'script',
                script: 'exit 1',
                intervalSec: 120
            },
            {
                id: 'guarded-channel',
                name: 'Guarded Channel Test',
                type: 'https',
                url: 'https://httpbin.org/status/200',
                intervalSec: 30,
                guards: ['internet']
            }
        ],
        reporting: {
            autoOpen: true,
            includeGraphs: true
        },
        notifications: {
            enabled: true,
            onFailure: true,
            onRecovery: true
        }
    },

    'performance-test.json': {
        defaults: {
            intervalSec: 10,
            timeoutMs: 3000
        },
        channels: Array.from({ length: 15 }, (_, i) => ({
            id: `perf-test-${i + 1}`,
            name: `Performance Test ${i + 1}`,
            type: 'https',
            url: `https://httpbin.org/status/${i % 2 === 0 ? 200 : 404}`,
            intervalSec: 10 + (i * 2)
        }))
    },

    'guards-test.json': {
        guards: {
            ethernet: {
                type: 'netIfUp',
                name: 'eth0'
            },
            wifi: {
                type: 'netIfUp',
                name: 'wlan0'
            },
            publicDNS: {
                type: 'dns',
                hostname: '8.8.8.8'
            },
            corporateDNS: {
                type: 'dns',
                hostname: 'internal.corp.com'
            }
        },
        channels: [
            {
                id: 'public-no-guards',
                name: 'Public (No Guards)',
                type: 'https',
                url: 'https://httpbin.org/status/200',
                intervalSec: 30
            },
            {
                id: 'ethernet-only',
                name: 'Ethernet Only',
                type: 'https',
                url: 'https://httpbin.org/status/200',
                intervalSec: 30,
                guards: ['ethernet']
            },
            {
                id: 'wifi-only',
                name: 'WiFi Only',
                type: 'https',
                url: 'https://httpbin.org/status/200',
                intervalSec: 30,
                guards: ['wifi']
            },
            {
                id: 'multiple-guards',
                name: 'Multiple Guards',
                type: 'https',
                url: 'https://httpbin.org/status/200',
                intervalSec: 30,
                guards: ['publicDNS', 'ethernet']
            }
        ]
    },

    'error-test.json': {
        channels: [
            {
                id: 'invalid-url',
                name: 'Invalid URL Test',
                type: 'https',
                url: 'https://this-domain-does-not-exist-12345.invalid',
                intervalSec: 60,
                timeoutSec: 5
            },
            {
                id: 'connection-refused',
                name: 'Connection Refused',
                type: 'tcp',
                hostname: '127.0.0.1',
                port: 12345,
                intervalSec: 45,
                timeoutSec: 3
            },
            {
                id: 'dns-timeout',
                name: 'DNS Timeout Test',
                type: 'dns',
                hostname: 'timeout.invalid.test.domain',
                dnsRecordType: 'A',
                intervalSec: 90
            },
            {
                id: 'script-timeout',
                name: 'Script Timeout Test',
                type: 'script',
                script: process.platform === 'win32' ? 'timeout /t 10' : 'sleep 10',
                intervalSec: 60,
                timeoutSec: 2
            }
        ]
    },

    'baseline-test.json': {
        channels: [
            {
                id: 'baseline-monitor',
                name: 'Baseline Monitor',
                type: 'https',
                url: 'https://httpbin.org/status/200',
                intervalSec: 30,
                baseline: {
                    enabled: true,
                    baselineIntervalSec: 300
                }
            },
            {
                id: 'variable-latency',
                name: 'Variable Latency',
                type: 'https',
                url: 'https://httpbin.org/delay/1',
                intervalSec: 45,
                baseline: {
                    enabled: true,
                    baselineIntervalSec: 180
                }
            }
        ]
    },

    'slo-test.json': {
        channels: [
            {
                id: 'high-slo',
                name: 'High SLO Service',
                type: 'https',
                url: 'https://httpbin.org/status/200',
                intervalSec: 30,
                sla: {
                    targetAvailPct: 99.9,
                    latencyMsP95: 200
                }
            },
            {
                id: 'low-slo',
                name: 'Low SLO Service',
                type: 'https',
                url: 'https://httpbin.org/status/500',
                intervalSec: 30,
                sla: {
                    targetAvailPct: 95.0,
                    latencyMsP95: 1000
                }
            }
        ]
    },

    'mixed-intervals.json': {
        channels: [
            {
                id: 'fast-check',
                name: 'Fast Check (10s)',
                type: 'https',
                url: 'https://httpbin.org/status/200',
                intervalSec: 10
            },
            {
                id: 'medium-check',
                name: 'Medium Check (60s)',
                type: 'tcp',
                hostname: 'httpbin.org',
                port: 80,
                intervalSec: 60
            },
            {
                id: 'slow-check',
                name: 'Slow Check (300s)',
                type: 'dns',
                hostname: 'google.com',
                dnsRecordType: 'A',
                intervalSec: 300
            }
        ]
    },

    'content-validation.json': {
        channels: [
            {
                id: 'json-response',
                name: 'JSON Response Validation',
                type: 'https',
                url: 'https://httpbin.org/json',
                intervalSec: 45,
                expectedContent: 'slideshow'
            },
            {
                id: 'html-response',
                name: 'HTML Response Validation',
                type: 'https',
                url: 'https://httpbin.org/html',
                intervalSec: 60,
                expectedContent: 'Herman Melville'
            },
            {
                id: 'status-code-check',
                name: 'Status Code Check',
                type: 'https',
                url: 'https://httpbin.org/status/201',
                intervalSec: 30,
                expectedStatusCode: 201
            }
        ]
    }
};

// Generate invalid configurations for error testing
const invalidConfigs = {
    'invalid-syntax.json': '{\n  "channels": [\n    {\n      "id": "broken",\n      // This comment breaks JSON\n      "name": "Broken Config"\n    }\n  ]\n}',
    
    'invalid-schema.json': JSON.stringify({
        channels: [
            {
                id: 'missing-fields',
                name: 'Missing Required Fields'
                // Missing type and intervalSec
            }
        ]
    }, null, 2),

    'invalid-types.json': JSON.stringify({
        channels: [
            {
                id: 'wrong-types',
                name: 'Wrong Types',
                type: 'invalid-type',
                intervalSec: 'not-a-number',
                url: 123
            }
        ]
    }, null, 2)
};

// Generate all configurations
console.log('Generating test configurations...');

Object.entries(configs).forEach(([filename, config]) => {
    const filePath = path.join(outputDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
    console.log(`✓ Generated ${filename}`);
});

// Generate invalid configurations
Object.entries(invalidConfigs).forEach(([filename, content]) => {
    const filePath = path.join(outputDir, `invalid-${filename}`);
    fs.writeFileSync(filePath, content);
    console.log(`✓ Generated invalid-${filename}`);
});

// Generate test scripts
const testScripts = {
    'run-quick-tests.md': `# Quick Test Execution Guide

## 1. Basic Functionality Test (5 minutes)
\`\`\`bash
# Copy minimal config
cp ${outputDir}/minimal.json .healthwatch.json

# In VS Code:
# 1. Reload window
# 2. Command Palette → "Health Watch: Start Watch"
# 3. Select "Custom" → Enter "2"
# 4. Wait for completion and report
\`\`\`

## 2. Comprehensive Test (15 minutes)
\`\`\`bash
# Copy comprehensive config
cp ${outputDir}/comprehensive.json .healthwatch.json

# In VS Code:
# 1. Reload window
# 2. Check tree view shows all channels
# 3. Run individual probes with "Run Channel Now"
# 4. Start 5-minute watch
# 5. Verify report generation
\`\`\`

## 3. Error Handling Test (10 minutes)
\`\`\`bash
# Test invalid configurations
cp ${outputDir}/invalid-invalid-syntax.json .healthwatch.json
# Reload and check error handling

cp ${outputDir}/error-test.json .healthwatch.json
# Test network error scenarios
\`\`\`

## 4. Performance Test (20 minutes)
\`\`\`bash
# Test with many channels
cp ${outputDir}/performance-test.json .healthwatch.json

# Run 10-minute watch and monitor VS Code performance
\`\`\`
`,

    'test-checklist.md': `# Test Execution Checklist

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
`
};

Object.entries(testScripts).forEach(([filename, content]) => {
    const filePath = path.join(outputDir, filename);
    fs.writeFileSync(filePath, content);
    console.log(`✓ Generated ${filename}`);
});

// Generate README for the test data
const readmeContent = `# Health Watch Test Configurations

This directory contains test configurations and scripts for manual testing of the Health Watch VS Code extension.

## Configuration Files

### Basic Configurations
- \`minimal.json\` - Simplest possible configuration for quick testing
- \`comprehensive.json\` - Full-featured configuration testing all capabilities

### Specialized Tests
- \`performance-test.json\` - 15 channels for load testing
- \`guards-test.json\` - Tests guard conditions and network interface detection
- \`error-test.json\` - Configurations designed to trigger various error conditions
- \`baseline-test.json\` - Tests baseline monitoring and anomaly detection
- \`slo-test.json\` - Tests SLO monitoring and breach detection
- \`mixed-intervals.json\` - Different probe intervals for timing tests
- \`content-validation.json\` - Tests response content validation

### Invalid Configurations
- \`invalid-*.json\` - Malformed configurations for error handling tests

## Quick Start

1. Copy a configuration to your workspace:
   \`\`\`bash
   cp minimal.json /path/to/your/workspace/.healthwatch.json
   \`\`\`

2. Reload VS Code window

3. Start testing via Command Palette → "Health Watch: Start Watch"

## Test Execution

See \`run-quick-tests.md\` for step-by-step testing procedures.
See \`test-checklist.md\` for comprehensive test coverage checklist.

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

Generated on: ${new Date().toISOString()}
`;

fs.writeFileSync(path.join(outputDir, 'README.md'), readmeContent);
console.log(`✓ Generated README.md`);

console.log(`\n🎉 Test data generation complete!`);
console.log(`📁 Output directory: ${path.resolve(outputDir)}`);
console.log(`📋 Files generated: ${Object.keys(configs).length + Object.keys(invalidConfigs).length + Object.keys(testScripts).length + 1}`);
console.log(`\n📖 Next steps:`);
console.log(`   1. Copy test configurations to your VS Code workspace`);
console.log(`   2. Follow the manual test plan in docs/testing/manual-test-plan.md`);
console.log(`   3. Use run-quick-tests.md for rapid validation`);
console.log(`   4. Check off items in test-checklist.md as you complete them`);