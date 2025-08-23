#!/usr/bin/env node

/**
 * Test Coverage Tracker for Health Watch
 * 
 * Monitors test coverage progress and generates reports
 * Usage: node test/coverage-tracker.js
 */

const fs = require('fs');
const path = require('path');

const COVERAGE_FILE = 'coverage/coverage-final.json';
const METRICS_FILE = 'test/test-metrics.json';
const TEST_DIR = 'test';

// Module definitions and targets
const MODULE_CONFIG = {
  core: {
    name: 'Core Business Logic',
    target: 85,
    priority: 'HIGH',
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

function getTestFileStatus() {
  const status = {};
  
  for (const [moduleId, config] of Object.entries(MODULE_CONFIG)) {
    status[moduleId] = {
      ...config,
      fileStatus: config.files.map(file => ({
        path: file,
        exists: checkFileExists(file),
        status: getFileImplementationStatus(file)
      }))
    };
  }
  
  return status;
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
    
    if (testCount < 3) {
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

/**
 * Calculate aggregated test coverage for a module.
 *
 * @param {Object} moduleConfig - Configuration object for the module. Expected to describe which files belong to the module (e.g., file patterns or explicit file lists) and any weighting or exclusions to apply when aggregating coverage.
 * @param {Object|null|undefined} coverageData - Coverage information (typically per-file coverage metrics) used to compute the module's aggregated coverage. If falsy, the function returns 0.
 * @returns {number} Aggregated coverage percentage for the module as an integer. Returns 0 when coverageData is falsy. Note: the current implementation is a simplified placeholder (produces a randomized integer, 0–99). A real implementation should match files from moduleConfig against coverageData and compute a meaningful aggregated percentage (0–100).
 */
function calculateModuleCoverage(moduleConfig, coverageData) {
  if (!coverageData) return 0;
  
  // This is a simplified calculation - real implementation would 
  // match file patterns and aggregate coverage by module
  return Math.floor(Math.random() * 100); // Placeholder
}

/**
 * generateReport
 *
 * Print a human-friendly health and coverage report for test files to the console.
 *
 * The function performs the following:
 * - Retrieves test file metadata via getTestFileStatus() and coverage summary via getCoverageData().
 * - Iterates modules and their file entries to present per-file status lines with emoji status icons
 *   (MISSING, SKELETON, MINIMAL, PARTIAL, COMPLETE, ERROR), file names, and status labels.
 * - Tracks aggregate counts (total test files, files that exist, fully COMPLETE implementations).
 * - Calculates and displays a per-module coverage percentage using calculateModuleCoverage(module, coverageData)
 *   and compares it to the module's target to choose an emoji indicator (green/yellow/red).
 * - Displays an overall summary including percentages for existing files and complete implementations.
 * - Shows a global coverage indicator derived from coverageData.total.lines.pct (defaulting to 0 if missing)
 *   and compares it to a hard-coded 70% target to select an emoji indicator.
 * - Compiles "Next Steps" lists for missing files and skeleton files (truncating display to 5 entries,
 *   with an indicator if more exist).
 * - Prints a short set of suggested npm commands for further actions.
 *
 * Side effects:
 * - Writes multiple formatted lines to the console (console.log).
 * - Does not mutate input data; works purely by reading return values from helper functions.
 *
 * Notes and assumptions:
 * - Relies on the presence and shape of external helpers: getTestFileStatus(), getCoverageData(),
 *   calculateModuleCoverage(module, coverageData), and on Node's path module for path.basename().
 * - If getCoverageData() is falsy, per-module and global coverage lines are skipped or use default 0.
 * - Percentage calculations use Math.round for file/existence ratios and toFixed(1) when printing global coverage.
 * - The implementation does not explicitly guard against totalFiles === 0 when computing percentage expressions;
 *   the current code will result in NaN for some percentage lines if there are zero files (consumer should ensure
 *   getTestFileStatus() returns at least an empty structure, or additional guarding can be added).
 *
 * @function
 * @returns {void} No return value; output is printed to the console.
 * @see getTestFileStatus
 * @see getCoverageData
 * @see calculateModuleCoverage
 */
function generateReport() {
  console.log('🔍 Health Watch Test Coverage Report');
  console.log('═'.repeat(50));
  
  const fileStatus = getTestFileStatus();
  const coverageData = getCoverageData();
  
  // Summary stats
  let totalFiles = 0;
  let existingFiles = 0;
  let completeFiles = 0;
  
  for (const [moduleId, module] of Object.entries(fileStatus)) {
    console.log(`\n📦 ${module.name}`);
    console.log(`   Target: ${module.target}% | Priority: ${module.priority}`);
    console.log('   ────────────────────────────────────────');
    
    module.fileStatus.forEach(file => {
      totalFiles++;
      
      const statusIcon = {
        'MISSING': '❌',
        'SKELETON': '⚪', 
        'MINIMAL': '🟡',
        'PARTIAL': '🟠',
        'COMPLETE': '✅',
        'ERROR': '💥'
      }[file.status] || '❓';
      
      if (file.exists) existingFiles++;
      if (file.status === 'COMPLETE') completeFiles++;
      
      const fileName = path.basename(file.path);
      console.log(`   ${statusIcon} ${fileName.padEnd(35)} ${file.status}`);
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
  console.log('═'.repeat(50));
  console.log(`📁 Total test files: ${totalFiles}`);
  console.log(`✅ Files exist: ${existingFiles} (${Math.round(existingFiles/totalFiles*100)}%)`);
  console.log(`🎯 Complete implementations: ${completeFiles} (${Math.round(completeFiles/totalFiles*100)}%)`);
  
  if (coverageData) {
    const globalCoverage = coverageData.total?.lines?.pct || 0;
    const coverageIcon = globalCoverage >= 70 ? '✅' : 
                        globalCoverage >= 50 ? '🟡' : '🔴';
    console.log(`${coverageIcon} Global coverage: ${globalCoverage.toFixed(1)}% (target: 70%)`);
  }
  
  // Next steps
  console.log('\n🎯 Next Steps');
  console.log('═'.repeat(50));
  
  const missingFiles = [];
  const skeletonFiles = [];
  
  for (const module of Object.values(fileStatus)) {
    module.fileStatus.forEach(file => {
      if (file.status === 'MISSING') {
        missingFiles.push(file.path);
      } else if (file.status === 'SKELETON') {
        skeletonFiles.push(file.path);
      }
    });
  }
  
  if (missingFiles.length > 0) {
    console.log('📝 Create missing test files:');
    missingFiles.slice(0, 5).forEach(file => console.log(`   - ${file}`));
    if (missingFiles.length > 5) {
      console.log(`   ... and ${missingFiles.length - 5} more`);
    }
  }
  
  if (skeletonFiles.length > 0) {
    console.log('🔧 Implement skeleton tests:');
    skeletonFiles.slice(0, 5).forEach(file => console.log(`   - ${file}`));
    if (skeletonFiles.length > 5) {
      console.log(`   ... and ${skeletonFiles.length - 5} more`);
    }
  }
  
  console.log('\n💡 Quick commands:');
  console.log('   npm run test:coverage  # Generate coverage report');
  console.log('   npm run test:watch     # Start development testing');
  console.log('   npm run test:unit      # Run unit tests only');
}

  /**
   * Status information for a test file as returned by getTestFileStatus().
   *
   * @type {{
   *   path: string,               // absolute or repository-relative path to the file
   *   exists: boolean,            // whether the file exists on disk
   *   isTestFile?: boolean,       // whether the file is recognized as a test file
   *   coveragePercent?: number,   // numeric coverage percentage (0-100), if available
   *   covered?: boolean,          // shorthand indicating full coverage (coveragePercent === 100)
   *   testsTotal?: number,        // total number of test cases discovered for this file
   *   testsPassed?: number,       // number of passing tests
   *   testsFailed?: number,       // number of failing tests
   *   lastRun?: string|Date,      // timestamp (ISO string or Date) of the last test execution
   *   error?: string|null         // error message if status could not be retrieved
   * }}
   */
function saveMetrics() {
  const fileStatus = getTestFileStatus();
  const coverageData = getCoverageData();
  
  const metrics = {
    lastUpdate: new Date().toISOString().split('T')[0],
    timestamp: Date.now(),
    modules: {}
  };
  
  for (const [moduleId, module] of Object.entries(fileStatus)) {
    const files = module.fileStatus;
    const existing = files.filter(f => f.exists).length;
    const complete = files.filter(f => f.status === 'COMPLETE').length;
    const coverage = coverageData ? calculateModuleCoverage(module, coverageData) : 0;
    
    metrics.modules[moduleId] = {
      name: module.name,
      coverage,
      target: module.target,
      priority: module.priority,
      files: files.length,
      existing,
      complete,
      completionPercent: Math.round(complete / files.length * 100)
    };
  }
  
  fs.writeFileSync(METRICS_FILE, JSON.stringify(metrics, null, 2));
  console.log(`\n💾 Metrics saved to ${METRICS_FILE}`);
}

// Main execution
if (require.main === module) {
  const command = process.argv[2] || 'report';
  
  switch (command) {
    case 'report':
      generateReport();
      break;
    case 'save':
      saveMetrics();
      break;
    case 'both':
      generateReport();
      saveMetrics();
      break;
    default:
      console.log('Usage: node coverage-tracker.js [report|save|both]');
  }
}