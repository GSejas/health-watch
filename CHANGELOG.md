![Release History Banner](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8ZGVmcz4KICAgIAogICAgPHBhdHRlcm4gaWQ9InBhdHRlcm4iIHg9IjAiIHk9IjAiIHdpZHRoPSIzMCIgaGVpZ2h0PSIzMCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+CiAgICAgIDxyZWN0IHdpZHRoPSIzMCIgaGVpZ2h0PSIzMCIgZmlsbD0iIzU4MWM4NyIvPgogICAgICA8Y2lyY2xlIGN4PSIxNSIgY3k9IjE1IiByPSIzIiBmaWxsPSIjYTg1NWY3IiBvcGFjaXR5PSIwLjI1Ii8+CiAgICA8L3BhdHRlcm4+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSI4MDAiIGhlaWdodD0iMTAwIiBmaWxsPSJ1cmwoI3BhdHRlcm4pIi8+CiAgPHRleHQgeD0iNDAwIiB5PSIzNSIgZm9udC1mYW1pbHk9IkFyaWFsIEJsYWNrIiBmb250LXNpemU9IjI0IiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+UmVsZWFzZSBIaXN0b3J5PC90ZXh0PgogIDx0ZXh0IHg9IjQwMCIgeT0iNTUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iI2E4NTVmNyIgdGV4dC1hbmNob3I9Im1pZGRsZSI+SGVhbHRoIFdhdGNoIFZlcnNpb24gQ29udHJvbCAmIFVwZGF0ZXM8L3RleHQ+CiAgPHRleHQgeD0iNDAwIiB5PSI3NSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEyIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuNykiIHRleHQtYW5jaG9yPSJtaWRkbGUiPvCfk4sg8J+TiyBDaGFuZ2Vsb2cg4oCiIFZlcnNpb24gQ29udHJvbCDigKIgUmVsZWFzZSBOb3RlczwvdGV4dD4KPC9zdmc+)

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