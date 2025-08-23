/**
 * 🗣️ Semantic Terminology Mapping
 * 
 * **Purpose**: Standardize user-facing terminology to eliminate conceptual confusion
 * **Philosophy**: Use terminology that matches user mental models, not implementation details
 * 
 * **Risk Analysis**:
 * - ✅ Zero Risk: Pure mapping constants with no runtime logic
 * - ✅ Maintainability: Centralized terminology management
 * - ✅ Consistency: Single source of truth for all user-facing strings
 * 
 * **Inputs**: Internal system concepts and implementation terms
 * **Outputs**: User-friendly, consistent terminology across UI and documentation
 * 
 * **Business Value**:
 * - Eliminates the "Watch vs Monitoring" confusion that prevents proper usage
 * - Creates intuitive user experience that matches expectations
 * - Reduces support burden from terminology misunderstandings
 * 
 * @author Health Watch Team  
 * @version 2.0.0 - Terminology Surgical Fix
 * @since 2025-08-21
 */

/**
 * 🔄 **CORE TERMINOLOGY TRANSFORMATION**
 * 
 * **Problem**: Users think "Start Watch" means "turn on monitoring"
 * **Reality**: Monitoring always runs, "Watch" means "monitor more intensively"
 * **Solution**: Use clear, intuitive terminology that matches user expectations
 */
export const TerminologyMap = {
  
  /** 
   * 🎯 **Monitoring Modes**: Clear hierarchy that users can understand
   */
  MonitoringModes: {
    // ❌ Old confusing terms → ✅ New clear terms
    baseline: {
      old: 'baseline monitoring',
      new: 'Background Monitoring',
      description: 'Continuous health checks at regular intervals',
      userMentalModel: 'Quietly checking if everything is okay'
    },
    intensive: {
      old: 'watch mode', 
      new: 'Active Monitoring',
      description: 'Frequent detailed monitoring for specific period',
      userMentalModel: 'Paying close attention to specific services'
    },
    crisis: {
      old: 'backoff/offline mode',
      new: 'Recovery Monitoring', 
      description: 'Accelerated monitoring during service outages',
      userMentalModel: 'Watching closely for service recovery'
    }
  },

  /**
   * 📊 **Data & Events**: Consistent taxonomy for system events
   */
  DataEvents: {
    sample: {
      old: 'sample',
      new: 'Health Check',
      description: 'Single probe result with latency and status',
      userContext: 'A single test of service health'
    },
    incident: {
      old: 'incident/outage/failure',  // These were used inconsistently
      new: 'Service Alert', 
      description: 'Threshold breach requiring attention',
      userContext: 'Something needs your attention'
    },
    outage: {
      old: 'outage',
      new: 'Service Outage',
      description: 'Confirmed period of service unavailability',
      userContext: 'Service was definitely down for a period'
    },
    stateChange: {
      old: 'state change',
      new: 'Status Change',
      description: 'Transition between online/offline/unknown states',
      userContext: 'Service status has changed'
    }
  },

  /**
   * 🎛️ **User Actions**: Intuitive action names that match intent
   */
  UserActions: {
    startWatch: {
      old: 'Start Watch',
      new: 'Monitor Closely', 
      description: 'Begin intensive monitoring for specified duration',
      buttonText: 'Start Active Monitoring',
      menuText: 'Monitor Closely...',
      tooltip: 'Monitor this service more frequently for detailed insights'
    },
    stopWatch: {
      old: 'Stop Watch',
      new: 'Return to Background',
      description: 'End intensive monitoring, return to baseline',
      buttonText: 'Stop Active Monitoring', 
      tooltip: 'Return to regular background monitoring'
    },
    pauseChannel: {
      old: 'Pause Channel',
      new: 'Pause Monitoring',
      description: 'Temporarily stop monitoring this service',
      buttonText: 'Pause',
      tooltip: 'Temporarily stop monitoring this service'
    },
    runNow: {
      old: 'Run Now', 
      new: 'Check Now',
      description: 'Immediately test this service health',
      buttonText: 'Check Now',
      tooltip: 'Test this service immediately'
    }
  },

  /**
   * 🔍 **Status & States**: Clear status communication
   */
  ServiceStates: {
    online: {
      old: 'online',
      new: 'Healthy',
      description: 'Service is responding normally',
      color: 'emerald',
      icon: '✓'
    },
    offline: {
      old: 'offline',
      new: 'Down',
      description: 'Service is not responding',
      color: 'red', 
      icon: '✗'
    },
    unknown: {
      old: 'unknown',
      new: 'Checking',
      description: 'Service status is being determined',
      color: 'yellow',
      icon: '?'
    }
  },

  /**
   * 📋 **UI Labels**: Consistent interface text
   */
  UILabels: {
    // Dashboard sections
    overviewTab: 'Service Overview',
    timelineTab: 'Timeline History', 
    monitorTab: 'Live Monitoring',
    
    // Status bar
    statusBarHealthy: 'All Services Healthy',
    statusBarIssues: 'Service Issues Detected',
    statusBarActiveMonitoring: 'Active Monitoring',
    
    // Tree view
    treeViewTitle: 'Service Health',
    channelsSection: 'Monitored Services',
    incidentsSection: 'Recent Alerts',
    
    // Notifications  
    serviceDown: 'Service Down',
    serviceRecovered: 'Service Recovered',
    monitoringSuggestion: 'Consider Active Monitoring',
    
    // Configuration
    configTitle: 'Monitoring Configuration',
    intervalsSection: 'Check Frequencies',
    thresholdsSection: 'Alert Thresholds'
  },

  /**
   * 💬 **User Messages**: Clear, helpful communication
   */
  UserMessages: {
    // Onboarding
    welcome: 'Health Watch monitors your services continuously in the background.',
    firstRun: 'Add services to your .healthwatch.json file to begin monitoring.',
    
    // Watch mode explanation
    activeMonitoringExplainer: 'Active Monitoring checks services more frequently for detailed insights. Background monitoring continues automatically.',
    
    // Status explanations
    healthyExplainer: 'All monitored services are responding normally.',
    issuesExplainer: 'Some services are experiencing problems and need attention.',
    
    // Configuration help
    intervalsHelp: 'How often to check each service. Critical services should be checked more frequently.',
    thresholdsHelp: 'How many consecutive failures before considering a service down.'
  }
} as const;

/**
 * 🚀 **Marketing & Design-Optimized Messaging**
 * 
 * Professional, user-friendly text that eliminates confusion and builds confidence.
 */
export const MarketingCopy = {
  
  /** 🎯 Feature descriptions that highlight value, not complexity */
  Features: {
    backgroundMonitoring: {
      headline: 'Always-On Service Health',
      description: 'Continuous background monitoring keeps you informed without interruption.',
      value: 'Peace of mind - know immediately when issues arise'
    },
    activeMonitoring: {
      headline: 'Deep Service Insights', 
      description: 'Intensive monitoring provides detailed performance data when you need it.',
      value: 'Detailed insights - understand exactly what\'s happening'
    },
    smartAlerting: {
      headline: 'Intelligent Notifications',
      description: 'Get notified only when action is needed, with clear context and suggestions.',
      value: 'Focus on what matters - no alert fatigue'
    },
    historicalAnalysis: {
      headline: 'Service Reliability Insights',
      description: 'Track uptime, performance trends, and service reliability over time.',
      value: 'Data-driven decisions - optimize based on real patterns'
    }
  },

  /** 📝 Help text that guides rather than confuses */
  HelpText: {
    configurationGettingStarted: 'Start by adding your critical services to monitor. Health Watch will begin background monitoring automatically.',
    
    understandingAlerts: 'Alerts are sent only when services cross failure thresholds. Each alert includes suggested next steps.',
    
    activeMonitoringWhen: 'Use Active Monitoring during deployments, troubleshooting, or when you need detailed service insights.',
    
    interpretingTimeline: 'The timeline shows service health over time. Green bars indicate healthy periods, red indicates outages.'
  }
} as const;

/**
 * 🔧 **Implementation Guidelines**:
 * 
 * 1. **UI Components**: Use TerminologyMap.UILabels for all interface text
 * 2. **User Actions**: Use TerminologyMap.UserActions for buttons and menus  
 * 3. **Status Display**: Use TerminologyMap.ServiceStates for consistent status presentation
 * 4. **Documentation**: Use MarketingCopy for help text and feature descriptions
 * 5. **Migration**: Replace old terminology gradually, maintaining backward API compatibility
 * 
 * 🎯 **Success Metrics**:
 * - User confusion about "Watch vs Monitoring" eliminated
 * - Support tickets related to terminology reduced by 80%
 * - Feature discovery increased (users understand what actions do)
 * - User confidence improved (clear, professional terminology)
 */