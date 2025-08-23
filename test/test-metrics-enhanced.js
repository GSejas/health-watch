#!/usr/bin/env node

/**
 * Enhanced Test Metrics Tracker for Health Watch
 * 
 * Generates comprehensive test coverage reports, CSV tracking,
 * and actionable metrics for development planning.
 * 
 * Usage: node test/test-metrics-enhanced.js [report|csv|json|markdown|all]
 */

const fs = require('fs');
const path = require('path');

const COVERAGE_FILE = 'coverage/coverage-final.json';
const METRICS_FILE = 'test/test-metrics-enhanced.json';
const CSV_FILE = 'test/test-coverage-tracker-enhanced.csv';
const MARKDOWN_FILE = 'TEST-COVERAGE-REPORT.md';
const PRIORITY_TRACKING_FILE = 'test/priority-tracking.json';

// Enhanced module configuration with new modules
const MODULE_CONFIG = {
  core: {
    name: 'Core Business Logic',
    target: 85,
    priority: 'HIGH',
    description: 'Channel state management, configuration, scheduling',
    srcPattern: 'src/{runner,config,*.ts}',
    testPattern: 'test/unit/core/**/*.test.ts',
    files: [
      'test/unit/core/channels.test.ts',
      'test/unit/core/runner.test.ts', 
      'test/unit/core/config.test.ts',
      'test/unit/core/scheduler.test.ts'
    ]
  },
  storage: {
    name: 'Storage Layer',
    target: 80,
    priority: 'HIGH',
    description: 'Data persistence, multi-backend storage, failover',
    srcPattern: 'src/storage/**/*.ts',
    testPattern: 'test/unit/storage/**/*.test.ts',
    files: [
      'test/unit/storage/MySQLStorage.test.ts',
      'test/unit/storage/ModularStorageManager.test.ts',
      'test/unit/storage/core.test.ts',
      'test/unit/storage/DiskStorageAdapter.test.ts'
    ]
  },
  react: {
    name: 'React Components',
    target: 75,
    priority: 'MEDIUM',
    description: 'Dashboard UI components, timeline views, interactions',
    srcPattern: 'src/ui/react/**/*.tsx',
    testPattern: 'test/unit/react/**/*.test.tsx',
    files: [
      'test/unit/react/OverviewView.test.tsx',
      'test/unit/react/TimelineNavigation.test.tsx',
      'test/unit/react/TimelineHeatmapView.test.tsx',
      'test/unit/react/TimelineSwimlanesView.test.tsx',
      'test/unit/react/TimelineIncidentsView.test.tsx',
      'test/unit/react/components.test.tsx'
    ]
  },
  ui: {
    name: 'VS Code Integration',
    target: 70,
    priority: 'HIGH',
    description: 'Status bar, tree view, notifications, webview management',
    srcPattern: 'src/ui/{*.ts,views/*.ts}',
    testPattern: 'test/unit/ui/**/*.test.ts',
    files: [
      'test/unit/ui/statusBar.test.ts',
      'test/unit/ui/treeView.test.ts',
      'test/unit/ui/dashboard.test.ts',
      'test/unit/ui/notifications.test.ts',
      'test/unit/ui/webview.test.ts'
    ]
  },
  probes: {
    name: 'Probes & Monitoring', 
    target: 80,
    priority: 'HIGH',
    description: 'Network probes (HTTPS/TCP/DNS/Script), guards, monitoring logic',
    srcPattern: 'src/{probes,guards}.ts',
    testPattern: 'test/unit/probes/**/*.test.ts',
    files: [
      'test/unit/probes.test.ts',
      'test/unit/guards.test.ts',
      'test/unit/probes/https.test.ts',
      'test/unit/probes/tcp.test.ts',
      'test/unit/probes/dns.test.ts',
      'test/unit/probes/script.test.ts'
    ]
  },
  utils: {
    name: 'Utilities & Data',
    target: 75,
    priority: 'MEDIUM',
    description: 'Data processing, statistics, report generation',
    srcPattern: 'src/{dashboardUtils,stats,report}.ts',
    testPattern: 'test/unit/{stats,report,dashboardUtils,outageDuration}.test.ts',
    files: [
      'test/unit/dashboardUtils.test.ts',
      'test/unit/outageDuration.test.ts',
      'test/unit/stats.test.ts',
      'test/unit/report.test.ts'
    ]
  },
  watch: {
    name: 'Watch Management',
    target: 85,
    priority: 'HIGH',
    description: 'Individual channel watches, global sessions, hierarchy',
    srcPattern: 'src/watch/**/*.ts',
    testPattern: 'test/unit/watch/**/*.test.ts',
    files: [
      'test/unit/watch/individualWatchManager.test.ts',
      'test/unit/watch/watchSession.test.ts',
      'test/unit/watch/watchCoordination.test.ts'
    ]
  },
  coordination: {
    name: 'Multi-Window Coordination',
    target: 80,
    priority: 'HIGH',
    description: 'Leader election, shared state, multi-window synchronization',
    srcPattern: 'src/coordination/**/*.ts',
    testPattern: 'test/unit/coordination/**/*.test.ts',
    files: [
      'test/unit/coordination/multiWindowCoordination.test.ts',
      'test/unit/coordination/coordinatedScheduler.test.ts',
      'test/unit/coordination/leaderElection.test.ts'
    ]
  }
};

function checkFileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (error) {
    return false;
  }
}

function getFileImplementationStatus(filePath) {
  if (!checkFileExists(filePath)) {
    return 'MISSING';
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check for skeleton tests
    if (content.includes('expect(true).toBe(true)')) {
      return 'SKELETON';
    }
    
    // Check for basic implementation
    const testCount = (content.match(/it\s*\(/g) || []).length;
    const describeCount = (content.match(/describe\s*\(/g) || []).length;
    
    if (testCount === 0) {
      return 'EMPTY';
    } else if (testCount < 3) {
      return 'MINIMAL';
    } else if (testCount < 10) {
      return 'PARTIAL';
    } else {
      return 'COMPLETE';
    }
  } catch (error) {
    return 'ERROR';
  }
}

function getTestFileStatus() {
  const status = {};
  
  for (const [moduleId, config] of Object.entries(MODULE_CONFIG)) {
    status[moduleId] = {
      ...config,
      fileStatus: config.files.map(file => ({
        path: file,
        exists: checkFileExists(file),
        status: getFileImplementationStatus(file),
        testCount: getTestCount(file),
        lastModified: getLastModified(file)
      }))
    };
  }
  
  return status;
}

function getTestCount(filePath) {
  if (!checkFileExists(filePath)) {
    return 0;
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return (content.match(/it\s*\(/g) || []).length;
  } catch (error) {
    return 0;
  }
}

function getLastModified(filePath) {
  if (!checkFileExists(filePath)) {
    return null;
  }
  
  try {
    const stats = fs.statSync(filePath);
    return stats.mtime.toISOString().split('T')[0];
  } catch (error) {
    return null;
  }
}

function getCoverageData() {
  if (!checkFileExists(COVERAGE_FILE)) {
    console.log('⚠️  No coverage data found. Run: npm run test:coverage');
    return null;
  }
  
  try {
    const coverageData = JSON.parse(fs.readFileSync(COVERAGE_FILE, 'utf8'));
    return coverageData;
  } catch (error) {
    console.error('❌ Error reading coverage data:', error.message);
    return null;
  }
}

function calculateModuleCoverage(moduleConfig, coverageData) {
  if (!coverageData) return 0;
  
  // Enhanced calculation - match file patterns to actual coverage
  let totalLines = 0;
  let coveredLines = 0;
  
  for (const [filePath, fileCoverage] of Object.entries(coverageData)) {
    // Simple pattern matching - could be enhanced
    if (filePath.includes('src/')) {
      const lines = fileCoverage.s || {};
      const lineCount = Object.keys(lines).length;
      const covered = Object.values(lines).filter(hits => hits > 0).length;
      
      totalLines += lineCount;
      coveredLines += covered;
    }
  }
  
  return totalLines > 0 ? Math.round((coveredLines / totalLines) * 100) : 0;
}

function generateConsoleReport() {
  console.log('🔍 Health Watch Enhanced Test Coverage Report');
  console.log('═'.repeat(70));
  
  const fileStatus = getTestFileStatus();
  const coverageData = getCoverageData();
  
  // Summary stats
  let totalFiles = 0;
  let existingFiles = 0;
  let completeFiles = 0;
  let totalTests = 0;
  
  for (const [moduleId, module] of Object.entries(fileStatus)) {
    console.log(`\n📦 ${module.name}`);
    console.log(`   Target: ${module.target}% | Priority: ${module.priority}`);
    console.log(`   ${module.description}`);
    console.log('   ──────────────────────────────────────────────────────────');
    
    module.fileStatus.forEach(file => {
      totalFiles++;
      totalTests += file.testCount;
      
      const statusIcon = {
        'MISSING': '❌',
        'EMPTY': '⚪',
        'SKELETON': '⚪', 
        'MINIMAL': '🟡',
        'PARTIAL': '🟠',
        'COMPLETE': '✅',
        'ERROR': '💥'
      }[file.status] || '❓';
      
      if (file.exists) existingFiles++;
      if (file.status === 'COMPLETE') completeFiles++;
      
      const fileName = path.basename(file.path);
      const testInfo = file.testCount > 0 ? ` (${file.testCount} tests)` : '';
      const modifiedInfo = file.lastModified ? ` [${file.lastModified}]` : '';
      
      console.log(`   ${statusIcon} ${fileName.padEnd(35)} ${file.status}${testInfo}${modifiedInfo}`);
    });
    
    // Show module coverage if available
    if (coverageData) {
      const coverage = calculateModuleCoverage(module, coverageData);
      const coverageIcon = coverage >= module.target ? '✅' : 
                          coverage >= module.target * 0.8 ? '🟡' : '🔴';
      console.log(`   ${coverageIcon} Coverage: ${coverage}% (target: ${module.target}%)`);
    }
  }
  
  // Overall summary
  console.log('\n📊 Overall Status');
  console.log('═'.repeat(70));
  console.log(`📁 Total test files: ${totalFiles}`);
  console.log(`✅ Files exist: ${existingFiles} (${Math.round(existingFiles/totalFiles*100)}%)`);
  console.log(`🎯 Complete implementations: ${completeFiles} (${Math.round(completeFiles/totalFiles*100)}%)`);
  console.log(`🧪 Total tests: ${totalTests}`);
  
  if (coverageData) {
    const globalCoverage = coverageData.total?.lines?.pct || 0;
    const coverageIcon = globalCoverage >= 70 ? '✅' : 
                        globalCoverage >= 50 ? '🟡' : '🔴';
    console.log(`${coverageIcon} Global coverage: ${globalCoverage.toFixed(1)}% (target: 70%)`);
  }
  
  // Priority-based next steps
  console.log('\n🎯 Priority Action Items');
  console.log('═'.repeat(70));
  
  const highPriorityMissing = [];
  const mediumPriorityMissing = [];
  const skeletonFiles = [];
  
  for (const [moduleId, module] of Object.entries(fileStatus)) {
    module.fileStatus.forEach(file => {
      if (file.status === 'MISSING') {
        if (module.priority === 'HIGH') {
          highPriorityMissing.push({ file: file.path, module: module.name });
        } else {
          mediumPriorityMissing.push({ file: file.path, module: module.name });
        }
      } else if (file.status === 'SKELETON' || file.status === 'EMPTY') {
        skeletonFiles.push({ file: file.path, module: module.name });
      }
    });
  }
  
  if (highPriorityMissing.length > 0) {
    console.log('🚨 HIGH Priority - Create missing test files:');
    highPriorityMissing.slice(0, 8).forEach(item => {
      console.log(`   - ${path.basename(item.file)} (${item.module})`);
    });
    if (highPriorityMissing.length > 8) {
      console.log(`   ... and ${highPriorityMissing.length - 8} more HIGH priority`);
    }
  }
  
  if (skeletonFiles.length > 0) {
    console.log('🔧 Implement skeleton/empty tests:');
    skeletonFiles.slice(0, 5).forEach(item => {
      console.log(`   - ${path.basename(item.file)} (${item.module})`);
    });
    if (skeletonFiles.length > 5) {
      console.log(`   ... and ${skeletonFiles.length - 5} more`);
    }
  }
  
  console.log('\n💡 Quick commands:');
  console.log('   npm run test:coverage     # Generate coverage report');
  console.log('   npm run test:watch        # Start development testing');
  console.log('   npm run test:unit         # Run unit tests only');
  console.log('   node test/test-metrics-enhanced.js markdown  # Generate markdown report');
}

function generateMarkdownReport() {
  const fileStatus = getTestFileStatus();
  const coverageData = getCoverageData();
  const timestamp = new Date().toISOString().split('T')[0];
  
  let markdown = `# Health Watch Test Coverage Report

*Generated: ${timestamp}*

## 📊 Overview

`;

  // Calculate summary stats
  let totalFiles = 0;
  let existingFiles = 0;
  let completeFiles = 0;
  let totalTests = 0;
  
  for (const module of Object.values(fileStatus)) {
    module.fileStatus.forEach(file => {
      totalFiles++;
      totalTests += file.testCount;
      if (file.exists) existingFiles++;
      if (file.status === 'COMPLETE') completeFiles++;
    });
  }
  
  markdown += `| Metric | Value | Progress |\n`;
  markdown += `|--------|-------|----------|\n`;
  markdown += `| Total Test Files | ${totalFiles} | - |\n`;
  markdown += `| Files Implemented | ${existingFiles} | ${Math.round(existingFiles/totalFiles*100)}% |\n`;
  markdown += `| Complete Tests | ${completeFiles} | ${Math.round(completeFiles/totalFiles*100)}% |\n`;
  markdown += `| Total Test Cases | ${totalTests} | - |\n`;
  
  if (coverageData) {
    const globalCoverage = coverageData.total?.lines?.pct || 0;
    markdown += `| Global Coverage | ${globalCoverage.toFixed(1)}% | Target: 70% |\n`;
  }
  
  markdown += `\n## 📦 Module Details

`;

  // Module breakdown
  for (const [moduleId, module] of Object.entries(fileStatus)) {
    const existing = module.fileStatus.filter(f => f.exists).length;
    const complete = module.fileStatus.filter(f => f.status === 'COMPLETE').length;
    const tests = module.fileStatus.reduce((sum, f) => sum + f.testCount, 0);
    
    markdown += `### ${module.name}

**Priority:** ${module.priority} | **Target:** ${module.target}% | **Description:** ${module.description}

| File | Status | Tests | Last Modified |
|------|--------|-------|---------------|
`;
    
    module.fileStatus.forEach(file => {
      const fileName = path.basename(file.path);
      const statusEmoji = {
        'MISSING': '❌',
        'EMPTY': '⚪',
        'SKELETON': '⚪', 
        'MINIMAL': '🟡',
        'PARTIAL': '🟠',
        'COMPLETE': '✅',
        'ERROR': '💥'
      }[file.status] || '❓';
      
      markdown += `| ${fileName} | ${statusEmoji} ${file.status} | ${file.testCount} | ${file.lastModified || 'N/A'} |\n`;
    });
    
    // Module summary
    markdown += `\n**Module Stats:** ${existing}/${module.files.length} files implemented, ${complete} complete, ${tests} total tests\n\n`;
  }
  
  // Action items
  markdown += `## 🎯 Action Items

### 🚨 High Priority Missing Tests
`;
  
  let actionCount = 0;
  for (const [moduleId, module] of Object.entries(fileStatus)) {
    if (module.priority === 'HIGH') {
      module.fileStatus.forEach(file => {
        if (file.status === 'MISSING' && actionCount < 10) {
          markdown += `- [ ] **${path.basename(file.path)}** (${module.name})\n`;
          actionCount++;
        }
      });
    }
  }
  
  markdown += `\n### 🔧 Skeleton/Empty Tests to Implement
`;
  
  actionCount = 0;
  for (const module of Object.values(fileStatus)) {
    module.fileStatus.forEach(file => {
      if ((file.status === 'SKELETON' || file.status === 'EMPTY') && actionCount < 8) {
        markdown += `- [ ] **${path.basename(file.path)}** (${module.name}) - ${file.testCount} skeleton tests\n`;
        actionCount++;
      }
    });
  }
  
  markdown += `\n## 📈 Progress Tracking

This report is automatically generated. Update test files and run:
\`\`\`bash
npm run test:coverage
node test/test-metrics-enhanced.js markdown
\`\`\`

`;
  
  fs.writeFileSync(MARKDOWN_FILE, markdown);
  console.log(`📝 Markdown report saved to ${MARKDOWN_FILE}`);
}

function saveMetricsJSON() {
  const fileStatus = getTestFileStatus();
  const coverageData = getCoverageData();
  
  const metrics = {
    lastUpdate: new Date().toISOString().split('T')[0],
    timestamp: Date.now(),
    summary: {
      totalFiles: 0,
      existingFiles: 0,
      completeFiles: 0,
      totalTests: 0,
      globalCoverage: coverageData?.total?.lines?.pct || 0
    },
    modules: {}
  };
  
  for (const [moduleId, module] of Object.entries(fileStatus)) {
    const files = module.fileStatus;
    const existing = files.filter(f => f.exists).length;
    const complete = files.filter(f => f.status === 'COMPLETE').length;
    const tests = files.reduce((sum, f) => sum + f.testCount, 0);
    const coverage = coverageData ? calculateModuleCoverage(module, coverageData) : 0;
    
    metrics.summary.totalFiles += files.length;
    metrics.summary.existingFiles += existing;
    metrics.summary.completeFiles += complete;
    metrics.summary.totalTests += tests;
    
    metrics.modules[moduleId] = {
      name: module.name,
      description: module.description,
      priority: module.priority,
      coverage,
      target: module.target,
      files: files.length,
      existing,
      complete,
      totalTests: tests,
      completionPercent: Math.round(complete / files.length * 100),
      fileDetails: files.map(f => ({
        path: f.path,
        status: f.status,
        testCount: f.testCount,
        lastModified: f.lastModified
      }))
    };
  }
  
  fs.writeFileSync(METRICS_FILE, JSON.stringify(metrics, null, 2));
  console.log(`💾 JSON metrics saved to ${METRICS_FILE}`);
}

function updateCSVTracking() {
  // Read existing CSV to preserve manual updates
  if (checkFileExists(CSV_FILE)) {
    console.log(`✅ CSV tracking file exists at ${CSV_FILE}`);
    // Could add logic to update status from actual file analysis
  } else {
    console.log(`⚠️  CSV tracking file not found at ${CSV_FILE}`);
  }
}

// Main execution
if (require.main === module) {
  const command = process.argv[2] || 'report';
  
  switch (command) {
    case 'report':
    case 'console':
      generateConsoleReport();
      break;
    case 'csv':
      updateCSVTracking();
      break;
    case 'json':
      saveMetricsJSON();
      break;
    case 'markdown':
      generateMarkdownReport();
      break;
    case 'all':
      generateConsoleReport();
      saveMetricsJSON();
      generateMarkdownReport();
      updateCSVTracking();
      break;
    default:
      console.log('Usage: node test-metrics-enhanced.js [report|csv|json|markdown|all]');
  }
}

module.exports = {
  generateConsoleReport,
  generateMarkdownReport,
  saveMetricsJSON,
  updateCSVTracking,
  getTestFileStatus,
  MODULE_CONFIG
};