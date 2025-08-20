# Change Log

All notable changes to the "health-watch" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

## [1.0.5] - 2025-08-20

### Added
- Live markdown reports dashboard with real-time Mermaid charts
- Unit tests for various components and storage managers
- Time range filtering to timeline heatmap view
- Integrated FilterPanel for Timeline views

### Changed
- Improved extension activation with async initialization
- Overview metrics layout changed to horizontal for better wide-screen utilization
- Replaced Reports tab with integrated FilterPanel for Timeline views

### Fixed
- Fixed storage saveState calls to not block async operations
- Improved extension startup reliability with proper async handling

## [1.0.4] - 2025-08-19

### Added
- Initial release with core monitoring functionality
- Multi-channel monitoring (HTTPS, TCP, DNS, Script probes)
- Interactive dashboards with timeline views and heatmaps
- Incident management with CRUD operations
- Rich reporting with Markdown and Mermaid diagrams
- SLO monitoring and tracking
- Local-first data storage