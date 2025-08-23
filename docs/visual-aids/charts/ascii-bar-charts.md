# ASCII Bar Charts

## Test Coverage Distribution

```
                │────────────────────────────────────────────────────────────
Unit Tests      │██████████████████████████████████████████████████ 139 (100.0%)
Integration     │████████ 23 (16.5%)
E2E Tests       │███ 8 (5.8%)
Coverage %      │███████████████████████████████ 85 (61.2%)
```

## Module Implementation Progress

```
                │────────────────────────────────────────────────────────────
Core Logic      │████████████████████████████████████████████ 85 (94.4%)
Storage         │██████████████████████████████████████████████████ 92 (100.0%)
UI Components   │████████████████████████████████████████ 76 (82.6%)
Testing         │██████████████████████████████████ 68 (73.9%)
Watch Mgmt      │█████████████████████████████████████████████████ 95 (100.0%)
Coordination    │███████████████████████████████████████████████ 88 (95.7%)
```

## Performance Metrics

```
                │────────────────────────────────────────────────────────────
Build Time      │███████ 45s (75.0%)
Bundle Size     │██████████████ 2.1MB (70.0%)
Test Runtime    │████████████ 8.5s (56.7%)
Memory Usage    │█████████████████████████████████████ 156MB (86.7%)
CPU Usage       │███████████████████████████ 23% (76.7%)
```

## Resource Usage Comparison (Before vs After Coordination)

```
Before Multi-Window Coordination:
CPU Usage       │████████████████████████████████████████████████ 300% (100.0%)
Memory Usage    │███████████████████████████████████████████████ 450MB (95.7%)
Network Req     │████████████████████████████████████████████████ 180/min (100.0%)

After Multi-Window Coordination:
CPU Usage       │████████████████████ 105% (35.0%)
Memory Usage    │██████████████████ 180MB (38.3%)
Network Req     │████████████████████ 60/min (33.3%)

Improvement:    │██████████████████████████████████████ 65% reduction
```

## Test Coverage by Module

```
                │────────────────────────────────────────────────────────────
Core Tests      │████████████████████████████████████████████ 85% (94.4%)
Storage Tests   │███████████████████████████████████████████████ 92% (100.0%)
UI Tests        │████████████████████████████████████ 76% (82.6%)
E2E Tests       │█████████████████████████████ 68% (73.9%)
Integration     │██████████████████████████████████████ 80% (86.7%)
```

## Feature Implementation Timeline

```
Week 1-2        │████████████████████████████████████████████████ Architecture (100%)
Week 3-4        │███████████████████████████████████████████████ Core Logic (95%)
Week 5-6        │████████████████████████████████████████████ Storage (90%)
Week 7-8        │███████████████████████████████████████ UI Components (80%)
Week 9-10       │████████████████████████████████████ Testing (75%)
Week 11-12      │██████████████████████████████ Documentation (65%)
```

## Error Rate Analysis

```
                │────────────────────────────────────────────────────────────
Critical Errors │█ 2 (2.9%)
Major Errors    │███ 5 (7.4%)
Minor Issues    │████████████ 15 (22.1%)
Warnings        │████████████████████████████████████████████ 45 (66.2%)
Info Messages   │██████████████████████████████████████████████████ 68 (100.0%)
```

## Browser/Platform Support

```
                │────────────────────────────────────────────────────────────
VS Code         │████████████████████████████████████████████████ 100% (100.0%)
VS Code Web     │████████████████████████████████████████████ 90% (90.0%)
Codespaces      │████████████████████████████████████████ 85% (85.0%)
Remote Dev      │██████████████████████████████████████ 80% (80.0%)
```

## How to Generate

```bash
# Basic chart
node scripts/visual-aid-generator.js chart

# Custom data
node scripts/visual-aid-generator.js chart --data="Tests:139,Coverage:85,Modules:8"

# From JSON file
node scripts/visual-aid-generator.js chart --file=metrics.json
```

## Customization

The charts automatically scale to show relative proportions and include:
- **Percentage indicators** for easy comparison
- **Bar length scaling** based on maximum value
- **Consistent formatting** with padding and alignment
- **ASCII characters** that render in all text environments

## Use Cases

- **Progress tracking** in project documentation
- **Performance metrics** in README files
- **Test coverage** in CI/CD reports
- **Resource usage** comparisons
- **Feature completeness** status
- **Timeline visualization** for milestones