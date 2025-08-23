# Project Status Badges

## Standard Badge Collection

[![Build](https://img.shields.io/badge/Build-passing-brightgreen?style=flat)](#build-status) [![Coverage](https://img.shields.io/badge/Coverage-85%25-brightgreen?style=flat)](#test-coverage) [![Version](https://img.shields.io/badge/Version-v1.0.8-blue?style=flat)](#version) [![License](https://img.shields.io/badge/License-MIT-green?style=flat)](#license)

## Health Watch Specific Badges

[![VS Code Extension](https://img.shields.io/badge/VS%20Code-Extension-blue?style=flat&logo=visual-studio-code)](#vscode)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?style=flat&logo=typescript)](#typescript)
[![Testing](https://img.shields.io/badge/Vitest-Testing-yellow?style=flat&logo=vitest)](#testing)
[![Coordination](https://img.shields.io/badge/Multi--Window-Coordination-green?style=flat)](#coordination)

## Module Status Badges

[![Core Logic](https://img.shields.io/badge/Core%20Logic-85%25-yellow?style=flat)](#core)
[![Storage](https://img.shields.io/badge/Storage-92%25-brightgreen?style=flat)](#storage)
[![UI Components](https://img.shields.io/badge/UI%20Components-76%25-yellow?style=flat)](#ui)
[![Testing](https://img.shields.io/badge/Testing-68%25-red?style=flat)](#testing)
[![Watch Mgmt](https://img.shields.io/badge/Watch%20Management-95%25-brightgreen?style=flat)](#watch)

## Quality Badges

[![Code Quality](https://img.shields.io/badge/Code%20Quality-A-brightgreen?style=flat)](#quality)
[![Security](https://img.shields.io/badge/Security-Zero%20Telemetry-green?style=flat)](#security)
[![Privacy](https://img.shields.io/badge/Privacy-Local%20First-green?style=flat)](#privacy)
[![Performance](https://img.shields.io/badge/Performance-High-brightgreen?style=flat)](#performance)

## Architecture Badges

[![Architecture](https://img.shields.io/badge/Architecture-Event%20Driven-blue?style=flat)](#architecture)
[![Storage](https://img.shields.io/badge/Storage-Multi%20Backend-blue?style=flat)](#storage-arch)
[![Coordination](https://img.shields.io/badge/Coordination-Leader%20Election-blue?style=flat)](#coordination-arch)
[![Testing](https://img.shields.io/badge/Testing-Comprehensive-blue?style=flat)](#testing-arch)

## Feature Status Badges

[![Individual Watches](https://img.shields.io/badge/Individual%20Watches-✅%20Complete-brightgreen?style=flat)](#individual-watches)
[![Multi Window](https://img.shields.io/badge/Multi%20Window-✅%20Complete-brightgreen?style=flat)](#multi-window)
[![Adaptive Backoff](https://img.shields.io/badge/Adaptive%20Backoff-✅%20Complete-brightgreen?style=flat)](#adaptive-backoff)
[![Terminology](https://img.shields.io/badge/Terminology-✅%20Complete-brightgreen?style=flat)](#terminology)

## Usage

### In README.md

```markdown
# Health Watch

[![Build](https://img.shields.io/badge/Build-passing-brightgreen?style=flat)](#build-status)
[![Coverage](https://img.shields.io/badge/Coverage-85%25-brightgreen?style=flat)](#test-coverage)
[![Version](https://img.shields.io/badge/Version-v1.0.8-blue?style=flat)](#version)

<!-- Rest of README content -->
```

### In Documentation

```markdown
## Module Status

[![Core Logic](https://img.shields.io/badge/Core%20Logic-85%25-yellow?style=flat)](#core)
[![Storage](https://img.shields.io/badge/Storage-92%25-brightgreen?style=flat)](#storage)
```

## Generation Command

```bash
node scripts/visual-aid-generator.js badges --version=1.0.8 --coverage=85 --build=passing
```

## Customization

Badges automatically update colors based on values:
- **Green**: 80%+ coverage, passing builds
- **Yellow**: 60-79% coverage 
- **Red**: <60% coverage, failing builds

## Badge Styles

- `flat` - Clean, minimal design (recommended)
- `flat-square` - Square edges
- `plastic` - Glossy 3D effect
- `for-the-badge` - Large, bold text