#!/usr/bin/env node

/**
 * 🎨 Visual Aid Generator for Health Watch Documentation
 * 
 * Generates various visual aids beyond banners:
 * - Progress bars and status indicators
 * - ASCII art diagrams and charts
 * - Badge collections
 * - Code flow diagrams
 * - Timeline visualizations
 * - Data visualization blocks
 * 
 * Usage: node scripts/visual-aid-generator.js [type] [options]
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// 📊 PROGRESS BARS & STATUS INDICATORS
// ============================================================================

function generateProgressBar(percentage, width = 40, label = '') {
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  const emoji = percentage >= 90 ? '🟢' : percentage >= 70 ? '🟡' : '🔴';
  
  return `${label}${label ? ': ' : ''}${emoji} ${bar} ${percentage}%`;
}

function generateModuleStatusGrid(modules) {
  const header = `
┌─────────────────────────┬──────────┬──────────┬─────────────┐
│ Module                  │ Progress │ Priority │ Status      │
├─────────────────────────┼──────────┼──────────┼─────────────┤`;

  const rows = modules.map(module => {
    const name = module.name.padEnd(23);
    const progress = `${module.progress}%`.padEnd(8);
    const priority = module.priority.padEnd(8);
    const status = module.status.padEnd(11);
    return `│ ${name} │ ${progress} │ ${priority} │ ${status} │`;
  }).join('\n');

  const footer = `
└─────────────────────────┴──────────┴──────────┴─────────────┘`;

  return header + '\n' + rows + footer;
}

// ============================================================================
// 🎯 BADGE COLLECTIONS
// ============================================================================

function generateBadgeCollection(badges) {
  return badges.map(badge => {
    const color = badge.color || 'brightgreen';
    const style = badge.style || 'flat';
    return `[![${badge.label}](https://img.shields.io/badge/${encodeURIComponent(badge.label)}-${encodeURIComponent(badge.message)}-${color}?style=${style})](${badge.link || '#'})`;
  }).join(' ');
}

function generateStatusBadges(projectData) {
  const badges = [
    {
      label: 'Build',
      message: projectData.build || 'passing',
      color: projectData.build === 'passing' ? 'brightgreen' : 'red',
      link: '#build-status'
    },
    {
      label: 'Coverage',
      message: `${projectData.coverage || 0}%`,
      color: projectData.coverage >= 80 ? 'brightgreen' : projectData.coverage >= 60 ? 'yellow' : 'red',
      link: '#test-coverage'
    },
    {
      label: 'Version',
      message: `v${projectData.version || '1.0.0'}`,
      color: 'blue',
      link: '#version'
    },
    {
      label: 'License',
      message: projectData.license || 'MIT',
      color: 'green',
      link: '#license'
    }
  ];
  
  return generateBadgeCollection(badges);
}

// ============================================================================
// 📈 ASCII CHARTS & DIAGRAMS
// ============================================================================

function generateASCIIBarChart(data, maxWidth = 50) {
  const maxValue = Math.max(...data.map(d => d.value));
  
  const chart = data.map(item => {
    const barLength = Math.round((item.value / maxValue) * maxWidth);
    const bar = '█'.repeat(barLength);
    const padding = ' '.repeat(Math.max(0, 15 - item.label.length));
    const percentage = ((item.value / maxValue) * 100).toFixed(1);
    
    return `${item.label}${padding} │${bar} ${item.value} (${percentage}%)`;
  }).join('\n');
  
  const header = ''.padEnd(15) + ' │' + '─'.repeat(maxWidth + 10);
  return header + '\n' + chart;
}

function generateTimelineASCII(events) {
  const timeline = events.map((event, index) => {
    const connector = index === 0 ? '┌' : index === events.length - 1 ? '└' : '├';
    const line = index === events.length - 1 ? '  ' : '│ ';
    const status = event.completed ? '✅' : '🔄';
    
    return `${connector}─ ${status} ${event.date} - ${event.title}\n${line}   ${event.description}`;
  }).join('\n');
  
  return timeline;
}

function generateArchitectureASCII(components) {
  const maxNameLength = Math.max(...components.map(c => c.name.length));
  
  return components.map(component => {
    const padding = ' '.repeat(maxNameLength - component.name.length);
    const status = component.status === 'implemented' ? '✅' : 
                  component.status === 'planned' ? '🔄' : '❌';
    const arrow = component.dependencies?.length > 0 ? ' ──→ ' : '     ';
    const deps = component.dependencies?.join(', ') || '';
    
    return `${status} ${component.name}${padding}${arrow}${deps}`;
  }).join('\n');
}

// ============================================================================
// 🗺️ ROADMAP VISUALIZATIONS
// ============================================================================

function generateRoadmapTimeline(milestones) {
  const timeline = `
Timeline: ${milestones[0]?.startDate} ──────────────────────── ${milestones[milestones.length - 1]?.endDate}

${milestones.map((milestone, index) => {
  const position = '─'.repeat(index * 8) + '●';
  const status = milestone.completed ? '✅' : milestone.inProgress ? '🔄' : '⏳';
  
  return `${position} ${status} ${milestone.name}\n${' '.repeat(index * 8 + 2)} │ ${milestone.description}\n${' '.repeat(index * 8 + 2)} │ Due: ${milestone.dueDate}`;
}).join('\n\n')}`;

  return timeline;
}

function generateFeatureMatrix(features) {
  const platforms = ['VS Code', 'Web', 'CLI', 'API'];
  
  const header = `
┌─────────────────────────┬─────────┬─────────┬─────────┬─────────┐
│ Feature                 │ VS Code │   Web   │   CLI   │   API   │
├─────────────────────────┼─────────┼─────────┼─────────┼─────────┤`;

  const rows = features.map(feature => {
    const name = feature.name.padEnd(23);
    const support = platforms.map(platform => {
      const status = feature.platforms[platform];
      const symbol = status === 'full' ? '   ✅   ' :
                    status === 'partial' ? '   🟡   ' :
                    status === 'planned' ? '   🔄   ' : '   ❌   ';
      return symbol;
    });
    
    return `│ ${name} │${support.join('│')}│`;
  }).join('\n');

  const footer = `
└─────────────────────────┴─────────┴─────────┴─────────┴─────────┘`;

  return header + '\n' + rows + footer;
}

// ============================================================================
// 🔄 WORKFLOW & PROCESS DIAGRAMS
// ============================================================================

function generateWorkflowDiagram(steps) {
  return steps.map((step, index) => {
    const connector = index === 0 ? '' : '     │\n     ▼\n';
    const box = `┌─────────────────────────────────┐\n│ ${step.title.padEnd(31)} │\n│ ${step.description.padEnd(31)} │\n└─────────────────────────────────┘`;
    
    return connector + box;
  }).join('\n');
}

function generateDecisionTree(tree) {
  function renderNode(node, depth = 0) {
    const indent = '  '.repeat(depth);
    const prefix = depth === 0 ? '🤔' : node.type === 'decision' ? '❓' : '✅';
    
    let result = `${indent}${prefix} ${node.question || node.action}\n`;
    
    if (node.options) {
      node.options.forEach(option => {
        result += `${indent}├─ ${option.condition} → \n`;
        result += renderNode(option.result, depth + 1);
      });
    }
    
    return result;
  }
  
  return renderNode(tree);
}

// ============================================================================
// 📊 DATA VISUALIZATION BLOCKS
// ============================================================================

function generateMetricsTable(metrics) {
  const header = `
┌─────────────────────────┬─────────────┬──────────┬─────────────┐
│ Metric                  │ Current     │ Target   │ Status      │
├─────────────────────────┼─────────────┼──────────┼─────────────┤`;

  const rows = metrics.map(metric => {
    const name = metric.name.padEnd(23);
    const current = metric.current.toString().padEnd(11);
    const target = metric.target.toString().padEnd(8);
    const status = metric.current >= metric.target ? '✅ Met     ' : 
                  metric.current >= metric.target * 0.8 ? '🟡 Close   ' : '🔴 Below   ';
    
    return `│ ${name} │ ${current} │ ${target} │ ${status} │`;
  }).join('\n');

  const footer = `
└─────────────────────────┴─────────────┴──────────┴─────────────┘`;

  return header + '\n' + rows + footer;
}

function generateComparisonChart(comparisons) {
  return comparisons.map(comp => {
    const beforeBar = '█'.repeat(Math.round(comp.before / 10));
    const afterBar = '█'.repeat(Math.round(comp.after / 10));
    const improvement = ((comp.before - comp.after) / comp.before * 100).toFixed(1);
    
    return `${comp.metric}:
  Before: ${beforeBar} ${comp.before}${comp.unit}
  After:  ${afterBar} ${comp.after}${comp.unit}
  Change: ${improvement > 0 ? '📈' : '📉'} ${improvement}% improvement`;
  }).join('\n\n');
}

// ============================================================================
// 🎨 VISUAL SEPARATOR GENERATORS
// ============================================================================

function generateSeparators() {
  return {
    heavy: '═'.repeat(80),
    light: '─'.repeat(80),
    dashed: '┈'.repeat(80),
    double: '╬'.repeat(80),
    wave: '~'.repeat(80),
    dotted: '·'.repeat(80)
  };
}

function generateBoxes(content, style = 'double') {
  const styles = {
    single: { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' },
    double: { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' },
    rounded: { tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│' },
    thick: { tl: '┏', tr: '┓', bl: '┗', br: '┛', h: '━', v: '┃' }
  };
  
  const s = styles[style];
  const lines = content.split('\n');
  const maxLength = Math.max(...lines.map(line => line.length));
  
  const top = s.tl + s.h.repeat(maxLength + 2) + s.tr;
  const middle = lines.map(line => `${s.v} ${line.padEnd(maxLength)} ${s.v}`).join('\n');
  const bottom = s.bl + s.h.repeat(maxLength + 2) + s.br;
  
  return top + '\n' + middle + '\n' + bottom;
}

// ============================================================================
// 🚀 CLI INTERFACE
// ============================================================================

function showHelp() {
  console.log(`
🎨 Visual Aid Generator for Health Watch

Usage: node visual-aid-generator.js [type] [options]

Available Types:
  progress     Generate progress bars and status indicators
  badges       Generate project status badges
  chart        Generate ASCII bar charts
  timeline     Generate project timeline
  roadmap      Generate feature roadmap
  workflow     Generate process workflow diagram
  matrix       Generate feature/platform matrix
  metrics      Generate metrics comparison table
  separators   Generate visual separators and boxes

Examples:
  node visual-aid-generator.js progress --modules="Core:85,Storage:92,UI:76"
  node visual-aid-generator.js badges --version=1.0.8 --coverage=85 --build=passing
  node visual-aid-generator.js timeline --file=milestones.json
  node visual-aid-generator.js chart --data="Tests:139,Coverage:85,Modules:8"

Options:
  --help       Show this help message
  --output     Output file (default: stdout)
  --format     Output format: markdown, ascii, html
`);
}

// Sample data generators for testing
function generateSampleData(type) {
  const samples = {
    modules: [
      { name: 'Core Business Logic', progress: 85, priority: 'HIGH', status: 'In Progress' },
      { name: 'Storage Layer', progress: 92, priority: 'HIGH', status: 'Complete' },
      { name: 'UI Components', progress: 76, priority: 'MEDIUM', status: 'In Progress' },
      { name: 'Testing Suite', progress: 68, priority: 'HIGH', status: 'Behind' }
    ],
    
    chartData: [
      { label: 'Unit Tests', value: 139 },
      { label: 'Integration', value: 23 },
      { label: 'E2E Tests', value: 8 },
      { label: 'Coverage %', value: 85 }
    ],
    
    timeline: [
      { date: '2025-08-20', title: 'Architecture Phase', description: 'Complete system design and ADRs', completed: true },
      { date: '2025-08-21', title: 'Implementation Phase', description: 'Build core functionality', completed: false },
      { date: '2025-08-25', title: 'Testing Phase', description: 'Comprehensive testing and QA', completed: false },
      { date: '2025-09-01', title: 'Release Phase', description: 'Final release and documentation', completed: false }
    ],
    
    metrics: [
      { name: 'Test Coverage', current: 85, target: 80, unit: '%' },
      { name: 'Build Time', current: 45, target: 60, unit: 's' },
      { name: 'Bundle Size', current: 2.1, target: 3.0, unit: 'MB' },
      { name: 'Performance Score', current: 92, target: 90, unit: '/100' }
    ]
  };
  
  return samples[type] || samples.modules;
}

// Main CLI handler
if (require.main === module) {
  const args = process.argv.slice(2);
  const type = args[0];
  
  if (!type || type === '--help') {
    showHelp();
    process.exit(0);
  }
  
  let output = '';
  
  switch (type) {
    case 'progress':
      const modules = generateSampleData('modules');
      output = generateModuleStatusGrid(modules);
      break;
      
    case 'badges':
      const projectData = { version: '1.0.8', coverage: 85, build: 'passing', license: 'MIT' };
      output = generateStatusBadges(projectData);
      break;
      
    case 'chart':
      const chartData = generateSampleData('chartData');
      output = generateASCIIBarChart(chartData);
      break;
      
    case 'timeline':
      const timelineData = generateSampleData('timeline');
      output = generateTimelineASCII(timelineData);
      break;
      
    case 'metrics':
      const metricsData = generateSampleData('metrics');
      output = generateMetricsTable(metricsData);
      break;
      
    case 'separators':
      const seps = generateSeparators();
      output = Object.entries(seps).map(([name, sep]) => `${name}: ${sep}`).join('\n');
      break;
      
    case 'box':
      const content = args[1] || 'Sample content\nMultiple lines\nBox demonstration';
      output = generateBoxes(content, args[2] || 'double');
      break;
      
    default:
      console.error(`Unknown type: ${type}`);
      showHelp();
      process.exit(1);
  }
  
  console.log(output);
}

module.exports = {
  generateProgressBar,
  generateModuleStatusGrid,
  generateBadgeCollection,
  generateStatusBadges,
  generateASCIIBarChart,
  generateTimelineASCII,
  generateArchitectureASCII,
  generateRoadmapTimeline,
  generateFeatureMatrix,
  generateWorkflowDiagram,
  generateDecisionTree,
  generateMetricsTable,
  generateComparisonChart,
  generateSeparators,
  generateBoxes
};