/**
 * Iteration Planning Service Based on User Feedback
 * Analyzes user feedback, performance metrics, and adoption data to plan product iterations
 */

import { supabase } from './supabase';
import { auditLogger, EventType, EventCategory, Severity } from './auditLogger';
import {
  feedbackCollectionService,
  FeedbackAnalytics,
} from './feedbackCollectionService';
import { monitoringService, PerformanceMetrics } from './monitoringService';
import {
  adoptionAnalyticsService,
  GradeLevelAdoption,
} from './adoptionAnalyticsService';
import { costTrackingService, CostMetrics } from './costTrackingService';

export interface IterationPlan {
  id: string;
  planName: string;
  version: string;
  generatedAt: string;
  analysisPeriod: {
    startDate: string;
    endDate: string;
    days: number;
  };
  dataInputs: {
    feedbackAnalytics: FeedbackAnalytics;
    performanceMetrics: PerformanceMetrics;
    adoptionData: GradeLevelAdoption[];
    costMetrics: CostMetrics;
  };
  prioritizedInitiatives: Initiative[];
  roadmapTimeline: RoadmapPhase[];
  riskAssessment: RiskAssessment;
  successMetrics: SuccessMetrics;
  resourceRequirements: ResourceRequirements;
}

export interface Initiative {
  id: string;
  title: string;
  description: string;
  category:
    | 'performance'
    | 'user_experience'
    | 'cost_optimization'
    | 'adoption'
    | 'bug_fix'
    | 'feature_enhancement';
  priority: 'critical' | 'high' | 'medium' | 'low';
  urgency: 'immediate' | 'short_term' | 'medium_term' | 'long_term';
  effort: 'small' | 'medium' | 'large' | 'epic';
  impact: 'high' | 'medium' | 'low';
  confidenceLevel: number; // 0-100
  dataSource: string[]; // What feedback/data supports this initiative
  targetGradeLevels: string[];
  estimatedTimeframe: {
    developmentWeeks: number;
    testingWeeks: number;
    rolloutWeeks: number;
  };
  dependencies: string[];
  successCriteria: string[];
  riskFactors: string[];
}

export interface RoadmapPhase {
  phase: string;
  startWeek: number;
  durationWeeks: number;
  initiatives: string[]; // Initiative IDs
  goals: string[];
  deliverables: string[];
  milestones: Array<{
    week: number;
    milestone: string;
    criteria: string[];
  }>;
}

export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high';
  riskFactors: Array<{
    factor: string;
    probability: 'low' | 'medium' | 'high';
    impact: 'low' | 'medium' | 'high';
    mitigation: string[];
    contingency: string[];
  }>;
  technicalRisks: string[];
  businessRisks: string[];
  userAdoptionRisks: string[];
}

export interface SuccessMetrics {
  kpis: Array<{
    metric: string;
    currentValue: number;
    targetValue: number;
    timeframe: string;
    measurementMethod: string;
  }>;
  gradeLevelTargets: Record<
    string,
    {
      adoptionRate: number;
      retentionRate: number;
      satisfactionScore: number;
    }
  >;
  performanceTargets: {
    successRate: number;
    averageResponseTime: number;
    errorRate: number;
  };
  costTargets: {
    costPerGeneration: number;
    monthlyBudget: number;
    costEfficiencyScore: number;
  };
}

export interface ResourceRequirements {
  development: {
    frontendWeeks: number;
    backendWeeks: number;
    infrastructureWeeks: number;
  };
  design: {
    uxResearchWeeks: number;
    uiDesignWeeks: number;
    testingWeeks: number;
  };
  productManagement: {
    planningWeeks: number;
    coordinationWeeks: number;
    analysisWeeks: number;
  };
  totalEstimatedCost: number;
  criticalSkills: string[];
}

export interface FeedbackPriorityMatrix {
  criticalIssues: Array<{
    feedback: any;
    severity: number;
    frequency: number;
    impactScore: number;
  }>;
  quickWins: Array<{
    feedback: any;
    effort: number;
    impact: number;
    roi: number;
  }>;
  longTermOpportunities: Array<{
    feedback: any;
    strategicValue: number;
    complexity: number;
    userValue: number;
  }>;
}

class IterationPlanningService {
  private static instance: IterationPlanningService;

  public static getInstance(): IterationPlanningService {
    if (!IterationPlanningService.instance) {
      IterationPlanningService.instance = new IterationPlanningService();
    }
    return IterationPlanningService.instance;
  }

  /**
   * Generate comprehensive iteration plan based on all data sources
   */
  async generateIterationPlan(
    analysisWeeks: number = 4,
    planName: string = 'Quarterly Image Generation Optimization',
  ): Promise<IterationPlan> {
    try {
      const startDate = new Date(
        Date.now() - analysisWeeks * 7 * 24 * 60 * 60 * 1000,
      );
      const endDate = new Date();

      console.log('📋 Generating iteration plan:', {
        planName,
        analysisWeeks,
        period: `${startDate.toISOString().split('T')[0]} to ${
          endDate.toISOString().split('T')[0]
        }`,
      });

      // Gather all data inputs
      const feedbackAnalytics =
        await feedbackCollectionService.getFeedbackAnalytics(analysisWeeks * 7);
      const performanceMetrics = await monitoringService.getPerformanceMetrics(
        analysisWeeks * 7 * 24,
      );
      const adoptionData = await adoptionAnalyticsService.getGradeLevelAdoption(
        analysisWeeks * 7,
      );
      const costMetrics = await costTrackingService.getCostMetrics(
        analysisWeeks * 7,
      );

      // Analyze feedback patterns
      const feedbackMatrix = await this.analyzeFeedbackPriorities();

      // Generate prioritized initiatives
      const prioritizedInitiatives = await this.generateInitiatives(
        feedbackAnalytics,
        performanceMetrics,
        adoptionData,
        costMetrics,
        feedbackMatrix,
      );

      // Create roadmap timeline
      const roadmapTimeline = this.createRoadmapTimeline(
        prioritizedInitiatives,
      );

      // Assess risks
      const riskAssessment = this.assessRisks(
        prioritizedInitiatives,
        performanceMetrics,
        adoptionData,
      );

      // Define success metrics
      const successMetrics = this.defineSuccessMetrics(
        performanceMetrics,
        adoptionData,
        costMetrics,
      );

      // Calculate resource requirements
      const resourceRequirements = this.calculateResourceRequirements(
        prioritizedInitiatives,
      );

      const plan: IterationPlan = {
        id: this.generatePlanId(),
        planName,
        version: '1.0',
        generatedAt: new Date().toISOString(),
        analysisPeriod: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          days: analysisWeeks * 7,
        },
        dataInputs: {
          feedbackAnalytics,
          performanceMetrics,
          adoptionData,
          costMetrics,
        },
        prioritizedInitiatives,
        roadmapTimeline,
        riskAssessment,
        successMetrics,
        resourceRequirements,
      };

      // Save the plan
      await this.saveIterationPlan(plan);

      // Log plan generation
      auditLogger.logEvent({
        eventType: EventType.ITERATION_PLAN_GENERATED,
        eventCategory: EventCategory.PLANNING,
        severity: Severity.INFO,
        description: `Iteration plan generated: ${planName}`,
        metadata: {
          planId: plan.id,
          initiativesCount: prioritizedInitiatives.length,
          analysisWeeks,
          overallRisk: riskAssessment.overallRisk,
          totalEstimatedCost: resourceRequirements.totalEstimatedCost,
        },
        context: {
          timestamp: new Date(),
          action: 'plan_generation',
          resource: 'iteration_planning_service',
        },
      });

      console.log('✅ Iteration plan generated successfully:', {
        planId: plan.id,
        initiatives: prioritizedInitiatives.length,
        phases: roadmapTimeline.length,
        estimatedWeeks: Math.max(
          ...roadmapTimeline.map(p => p.startWeek + p.durationWeeks),
        ),
      });

      return plan;
    } catch (error) {
      console.error('Failed to generate iteration plan:', error);
      throw new Error('Failed to generate iteration plan');
    }
  }

  /**
   * Analyze feedback to create priority matrix
   */
  async analyzeFeedbackPriorities(): Promise<FeedbackPriorityMatrix> {
    try {
      const recentFeedback = await feedbackCollectionService.getRecentFeedback(
        100,
      );

      const criticalIssues = [];
      const quickWins = [];
      const longTermOpportunities = [];

      for (const feedback of recentFeedback) {
        const severity = this.calculateSeverity(feedback);
        const frequency = await this.calculateFrequency(feedback);
        const effort = this.estimateEffort(feedback);
        const impact = this.estimateImpact(feedback);

        const impactScore = severity * frequency * impact;
        const roi = effort > 0 ? impact / effort : 0;

        // Categorize feedback
        if (severity >= 8 && frequency >= 5) {
          criticalIssues.push({ feedback, severity, frequency, impactScore });
        } else if (effort <= 3 && impact >= 6) {
          quickWins.push({ feedback, effort, impact, roi });
        } else if (impact >= 7) {
          longTermOpportunities.push({
            feedback,
            strategicValue: impact,
            complexity: effort,
            userValue: this.calculateUserValue(feedback),
          });
        }
      }

      return {
        criticalIssues: criticalIssues
          .sort((a, b) => b.impactScore - a.impactScore)
          .slice(0, 10),
        quickWins: quickWins.sort((a, b) => b.roi - a.roi).slice(0, 15),
        longTermOpportunities: longTermOpportunities
          .sort((a, b) => b.strategicValue - a.strategicValue)
          .slice(0, 20),
      };
    } catch (error) {
      console.error('Failed to analyze feedback priorities:', error);
      return { criticalIssues: [], quickWins: [], longTermOpportunities: [] };
    }
  }

  /**
   * Generate prioritized initiatives based on all data inputs
   */
  async generateInitiatives(
    feedbackAnalytics: FeedbackAnalytics,
    performanceMetrics: PerformanceMetrics,
    adoptionData: GradeLevelAdoption[],
    costMetrics: CostMetrics,
    feedbackMatrix: FeedbackPriorityMatrix,
  ): Promise<Initiative[]> {
    const initiatives: Initiative[] = [];

    // Performance-based initiatives
    if (performanceMetrics.successRate < 90) {
      initiatives.push({
        id: this.generateInitiativeId(),
        title: 'Improve Image Generation Success Rate',
        description: `Enhance API reliability and error handling to increase success rate from ${performanceMetrics.successRate.toFixed(
          1,
        )}% to 95%+`,
        category: 'performance',
        priority: 'high',
        urgency: 'short_term',
        effort: 'medium',
        impact: 'high',
        confidenceLevel: 85,
        dataSource: ['performance_metrics', 'monitoring_data'],
        targetGradeLevels: ['K-2', '3-5', '6-8', '9-12'],
        estimatedTimeframe: {
          developmentWeeks: 3,
          testingWeeks: 2,
          rolloutWeeks: 1,
        },
        dependencies: [],
        successCriteria: [
          'Success rate > 95%',
          'Error rate < 3%',
          'User satisfaction improvement',
        ],
        riskFactors: ['API provider changes', 'Complex error scenarios'],
      });
    }

    if (performanceMetrics.averageResponseTime > 45000) {
      initiatives.push({
        id: this.generateInitiativeId(),
        title: 'Optimize Response Time Performance',
        description: `Reduce average response time from ${(
          performanceMetrics.averageResponseTime / 1000
        ).toFixed(1)}s to under 35s`,
        category: 'performance',
        priority: 'medium',
        urgency: 'medium_term',
        effort: 'medium',
        impact: 'medium',
        confidenceLevel: 75,
        dataSource: ['performance_metrics'],
        targetGradeLevels: ['K-2', '3-5', '6-8', '9-12'],
        estimatedTimeframe: {
          developmentWeeks: 4,
          testingWeeks: 2,
          rolloutWeeks: 1,
        },
        dependencies: [],
        successCriteria: [
          'Average response time < 35s',
          'P95 response time < 60s',
        ],
        riskFactors: [
          'Infrastructure limitations',
          'Third-party API dependencies',
        ],
      });
    }

    // Adoption-based initiatives
    const lowAdoptionGrades = adoptionData.filter(g => g.adoptionRate < 30);
    if (lowAdoptionGrades.length > 0) {
      initiatives.push({
        id: this.generateInitiativeId(),
        title: 'Improve Feature Discoverability and Onboarding',
        description: `Enhance user onboarding for grade levels with low adoption: ${lowAdoptionGrades
          .map(g => g.gradeLevel)
          .join(', ')}`,
        category: 'adoption',
        priority: 'high',
        urgency: 'short_term',
        effort: 'medium',
        impact: 'high',
        confidenceLevel: 90,
        dataSource: ['adoption_analytics', 'user_journey_analysis'],
        targetGradeLevels: lowAdoptionGrades.map(g => g.gradeLevel),
        estimatedTimeframe: {
          developmentWeeks: 2,
          testingWeeks: 1,
          rolloutWeeks: 1,
        },
        dependencies: [],
        successCriteria: [
          `Adoption rate > 40% for ${lowAdoptionGrades
            .map(g => g.gradeLevel)
            .join(', ')}`,
        ],
        riskFactors: ['User resistance to change', 'Complex onboarding flow'],
      });
    }

    // Cost optimization initiatives
    if (costMetrics.averageCostPerRequest > 0.03) {
      initiatives.push({
        id: this.generateInitiativeId(),
        title: 'Optimize API Cost Efficiency',
        description: `Reduce average cost per request from $${costMetrics.averageCostPerRequest.toFixed(
          4,
        )} to under $0.025`,
        category: 'cost_optimization',
        priority: 'medium',
        urgency: 'medium_term',
        effort: 'medium',
        impact: 'medium',
        confidenceLevel: 70,
        dataSource: ['cost_metrics', 'service_comparison'],
        targetGradeLevels: ['K-2', '3-5', '6-8', '9-12'],
        estimatedTimeframe: {
          developmentWeeks: 3,
          testingWeeks: 2,
          rolloutWeeks: 2,
        },
        dependencies: [],
        successCriteria: [
          'Cost per request < $0.025',
          '15% reduction in monthly costs',
        ],
        riskFactors: [
          'Service provider pricing changes',
          'Quality degradation',
        ],
      });
    }

    // Feedback-based initiatives
    for (const critical of feedbackMatrix.criticalIssues.slice(0, 3)) {
      initiatives.push({
        id: this.generateInitiativeId(),
        title: `Critical Fix: ${critical.feedback.title}`,
        description: critical.feedback.description,
        category: 'bug_fix',
        priority: 'critical',
        urgency: 'immediate',
        effort: 'small',
        impact: 'high',
        confidenceLevel: 95,
        dataSource: ['user_feedback', 'bug_reports'],
        targetGradeLevels: this.getAffectedGradeLevels(critical.feedback),
        estimatedTimeframe: {
          developmentWeeks: 1,
          testingWeeks: 1,
          rolloutWeeks: 1,
        },
        dependencies: [],
        successCriteria: [
          'Bug resolved',
          'User satisfaction improvement',
          'No regression',
        ],
        riskFactors: ['Complex system interactions', 'Edge case scenarios'],
      });
    }

    for (const quickWin of feedbackMatrix.quickWins.slice(0, 5)) {
      initiatives.push({
        id: this.generateInitiativeId(),
        title: `Quick Win: ${quickWin.feedback.title}`,
        description: quickWin.feedback.description,
        category: 'user_experience',
        priority: 'medium',
        urgency: 'short_term',
        effort: 'small',
        impact: 'medium',
        confidenceLevel: 85,
        dataSource: ['user_feedback'],
        targetGradeLevels: this.getAffectedGradeLevels(quickWin.feedback),
        estimatedTimeframe: {
          developmentWeeks: 1,
          testingWeeks: 1,
          rolloutWeeks: 1,
        },
        dependencies: [],
        successCriteria: ['Feature implemented', 'User feedback positive'],
        riskFactors: ['Scope creep', 'User expectations'],
      });
    }

    // User satisfaction initiatives
    if (feedbackAnalytics.userSatisfactionScore < 70) {
      initiatives.push({
        id: this.generateInitiativeId(),
        title: 'Enhance User Experience Based on Feedback',
        description: `Improve user satisfaction score from ${feedbackAnalytics.userSatisfactionScore.toFixed(
          1,
        )} to 80+`,
        category: 'user_experience',
        priority: 'high',
        urgency: 'short_term',
        effort: 'large',
        impact: 'high',
        confidenceLevel: 80,
        dataSource: ['user_feedback', 'satisfaction_surveys'],
        targetGradeLevels: ['K-2', '3-5', '6-8', '9-12'],
        estimatedTimeframe: {
          developmentWeeks: 6,
          testingWeeks: 3,
          rolloutWeeks: 2,
        },
        dependencies: [],
        successCriteria: [
          'Satisfaction score > 80',
          'Reduced negative feedback',
        ],
        riskFactors: ['Diverse user preferences', 'Complex requirements'],
      });
    }

    // Sort initiatives by priority and impact
    return initiatives.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const impactOrder = { high: 3, medium: 2, low: 1 };

      const aPriority = priorityOrder[a.priority];
      const bPriority = priorityOrder[b.priority];

      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }

      const aImpact = impactOrder[a.impact];
      const bImpact = impactOrder[b.impact];

      return bImpact - aImpact;
    });
  }

  /**
   * Create roadmap timeline from prioritized initiatives
   */
  private createRoadmapTimeline(initiatives: Initiative[]): RoadmapPhase[] {
    const phases: RoadmapPhase[] = [];
    let currentWeek = 1;

    // Phase 1: Critical Issues and Quick Wins (Weeks 1-4)
    const criticalAndQuickWins = initiatives.filter(
      i =>
        i.priority === 'critical' ||
        (i.priority === 'high' && i.effort === 'small'),
    );

    if (criticalAndQuickWins.length > 0) {
      phases.push({
        phase: 'Phase 1: Critical Fixes and Quick Wins',
        startWeek: currentWeek,
        durationWeeks: 4,
        initiatives: criticalAndQuickWins.map(i => i.id),
        goals: [
          'Resolve critical user-blocking issues',
          'Implement high-impact, low-effort improvements',
          'Stabilize system performance',
        ],
        deliverables: [
          'Critical bug fixes deployed',
          'User experience improvements released',
          'Performance monitoring enhanced',
        ],
        milestones: [
          {
            week: 2,
            milestone: 'Critical bugs resolved',
            criteria: ['All critical issues addressed'],
          },
          {
            week: 4,
            milestone: 'Quick wins deployed',
            criteria: ['5+ quick wins implemented'],
          },
        ],
      });
      currentWeek += 4;
    }

    // Phase 2: Performance and Adoption Improvements (Weeks 5-10)
    const performanceAndAdoption = initiatives.filter(
      i =>
        (i.category === 'performance' || i.category === 'adoption') &&
        i.priority !== 'critical',
    );

    if (performanceAndAdoption.length > 0) {
      phases.push({
        phase: 'Phase 2: Performance Optimization and Adoption Enhancement',
        startWeek: currentWeek,
        durationWeeks: 6,
        initiatives: performanceAndAdoption.map(i => i.id),
        goals: [
          'Improve system performance metrics',
          'Increase user adoption across grade levels',
          'Optimize cost efficiency',
        ],
        deliverables: [
          'Enhanced API performance',
          'Improved onboarding flow',
          'Grade-specific optimizations',
        ],
        milestones: [
          {
            week: currentWeek + 3,
            milestone: 'Performance targets met',
            criteria: ['Success rate > 95%', 'Response time < 35s'],
          },
          {
            week: currentWeek + 6,
            milestone: 'Adoption improvements live',
            criteria: ['Adoption rate improved by 20%'],
          },
        ],
      });
      currentWeek += 6;
    }

    // Phase 3: Feature Enhancements and Long-term Improvements (Weeks 11-18)
    const featureEnhancements = initiatives.filter(
      i =>
        i.category === 'feature_enhancement' ||
        i.category === 'user_experience' ||
        i.effort === 'large',
    );

    if (featureEnhancements.length > 0) {
      phases.push({
        phase: 'Phase 3: Feature Enhancement and User Experience',
        startWeek: currentWeek,
        durationWeeks: 8,
        initiatives: featureEnhancements.map(i => i.id),
        goals: [
          'Enhance user experience based on feedback',
          'Implement advanced features',
          'Improve long-term user engagement',
        ],
        deliverables: [
          'Enhanced image generation features',
          'Improved user interface',
          'Advanced analytics dashboard',
        ],
        milestones: [
          {
            week: currentWeek + 4,
            milestone: 'Core enhancements complete',
            criteria: ['Major UX improvements deployed'],
          },
          {
            week: currentWeek + 8,
            milestone: 'Full feature set released',
            criteria: ['All planned features implemented'],
          },
        ],
      });
    }

    return phases;
  }

  /**
   * Assess risks for the iteration plan
   */
  private assessRisks(
    initiatives: Initiative[],
    performanceMetrics: PerformanceMetrics,
    adoptionData: GradeLevelAdoption[],
  ): RiskAssessment {
    const riskFactors: RiskAssessment['riskFactors'] = [];
    const technicalRisks: string[] = [];
    const businessRisks: string[] = [];
    const userAdoptionRisks: string[] = [];

    // Technical risks
    if (performanceMetrics.successRate < 85) {
      technicalRisks.push('Low system reliability may impact development');
      riskFactors.push({
        factor: 'System Stability',
        probability: 'high' as const,
        impact: 'high' as const,
        mitigation: [
          'Prioritize stability fixes',
          'Implement comprehensive monitoring',
        ],
        contingency: [
          'Roll back changes if stability degrades',
          'Activate backup services',
        ],
      });
    }

    // Business risks
    const highEffortInitiatives = initiatives.filter(
      i => i.effort === 'large',
    ).length;
    if (highEffortInitiatives > 3) {
      businessRisks.push('Too many large initiatives may strain resources');
      riskFactors.push({
        factor: 'Resource Overcommitment',
        probability: 'medium' as const,
        impact: 'high' as const,
        mitigation: [
          'Phase initiatives carefully',
          'Secure additional resources',
        ],
        contingency: [
          'Defer non-critical initiatives',
          'Reduce scope of large projects',
        ],
      });
    }

    // User adoption risks
    const lowAdoptionGrades = adoptionData.filter(
      g => g.adoptionRate < 20,
    ).length;
    if (lowAdoptionGrades > 0) {
      userAdoptionRisks.push(
        'Low adoption in some grade levels may limit impact',
      );
      riskFactors.push({
        factor: 'User Adoption Challenges',
        probability: 'medium' as const,
        impact: 'medium' as const,
        mitigation: ['Targeted user research', 'Grade-specific improvements'],
        contingency: [
          'Focus on high-adoption grades',
          'Simplify user experience',
        ],
      });
    }

    // Determine overall risk
    const highRiskFactors = riskFactors.filter(
      r => r.probability === 'high' && r.impact === 'high',
    ).length;
    const mediumRiskFactors = riskFactors.filter(
      r =>
        (r.probability === 'high' && r.impact === 'medium') ||
        (r.probability === 'medium' && r.impact === 'high'),
    ).length;

    let overallRisk: 'low' | 'medium' | 'high';
    if (highRiskFactors > 0) overallRisk = 'high';
    else if (mediumRiskFactors > 2) overallRisk = 'medium';
    else overallRisk = 'low';

    return {
      overallRisk,
      riskFactors,
      technicalRisks,
      businessRisks,
      userAdoptionRisks,
    };
  }

  /**
   * Define success metrics for the iteration plan
   */
  private defineSuccessMetrics(
    performanceMetrics: PerformanceMetrics,
    adoptionData: GradeLevelAdoption[],
    costMetrics: CostMetrics,
  ): SuccessMetrics {
    const kpis = [
      {
        metric: 'Image Generation Success Rate',
        currentValue: performanceMetrics.successRate,
        targetValue: 95,
        timeframe: '12 weeks',
        measurementMethod: 'Automated monitoring',
      },
      {
        metric: 'Average Response Time',
        currentValue: performanceMetrics.averageResponseTime / 1000,
        targetValue: 35,
        timeframe: '8 weeks',
        measurementMethod: 'Performance monitoring',
      },
      {
        metric: 'Overall Adoption Rate',
        currentValue:
          adoptionData.reduce((sum, g) => sum + g.adoptionRate, 0) /
          adoptionData.length,
        targetValue: 45,
        timeframe: '16 weeks',
        measurementMethod: 'User analytics',
      },
      {
        metric: 'Cost Per Generation',
        currentValue: costMetrics.averageCostPerRequest,
        targetValue: 0.025,
        timeframe: '10 weeks',
        measurementMethod: 'Cost tracking',
      },
    ];

    const gradeLevelTargets: Record<string, any> = {};
    adoptionData.forEach(grade => {
      gradeLevelTargets[grade.gradeLevel] = {
        adoptionRate: Math.max(grade.adoptionRate * 1.3, 40), // 30% improvement or 40% minimum
        retentionRate: Math.max(grade.retentionRate * 1.2, 50), // 20% improvement or 50% minimum
        satisfactionScore: 80,
      };
    });

    return {
      kpis,
      gradeLevelTargets,
      performanceTargets: {
        successRate: 95,
        averageResponseTime: 35000,
        errorRate: 3,
      },
      costTargets: {
        costPerGeneration: 0.025,
        monthlyBudget: 800,
        costEfficiencyScore: 85,
      },
    };
  }

  /**
   * Calculate resource requirements for all initiatives
   */
  private calculateResourceRequirements(
    initiatives: Initiative[],
  ): ResourceRequirements {
    let totalDevWeeks = 0;
    let totalDesignWeeks = 0;
    let totalPMWeeks = 0;

    const criticalSkills = new Set<string>();

    initiatives.forEach(initiative => {
      totalDevWeeks += initiative.estimatedTimeframe.developmentWeeks;
      totalDesignWeeks += initiative.estimatedTimeframe.testingWeeks * 0.5; // Assume 50% design overlap
      totalPMWeeks +=
        (initiative.estimatedTimeframe.developmentWeeks +
          initiative.estimatedTimeframe.testingWeeks +
          initiative.estimatedTimeframe.rolloutWeeks) *
        0.3; // 30% PM overhead

      // Add skills based on category
      if (initiative.category === 'performance') {
        criticalSkills.add('Backend Development');
        criticalSkills.add('DevOps/Infrastructure');
      }
      if (initiative.category === 'user_experience') {
        criticalSkills.add('Frontend Development');
        criticalSkills.add('UX Design');
      }
      if (initiative.category === 'cost_optimization') {
        criticalSkills.add('Data Analysis');
        criticalSkills.add('API Integration');
      }
    });

    const avgDeveloperCostPerWeek = 2500; // Example cost
    const avgDesignerCostPerWeek = 2000;
    const avgPMCostPerWeek = 2200;

    const totalEstimatedCost =
      totalDevWeeks * avgDeveloperCostPerWeek +
      totalDesignWeeks * avgDesignerCostPerWeek +
      totalPMWeeks * avgPMCostPerWeek;

    return {
      development: {
        frontendWeeks: totalDevWeeks * 0.4,
        backendWeeks: totalDevWeeks * 0.5,
        infrastructureWeeks: totalDevWeeks * 0.1,
      },
      design: {
        uxResearchWeeks: totalDesignWeeks * 0.3,
        uiDesignWeeks: totalDesignWeeks * 0.5,
        testingWeeks: totalDesignWeeks * 0.2,
      },
      productManagement: {
        planningWeeks: totalPMWeeks * 0.4,
        coordinationWeeks: totalPMWeeks * 0.4,
        analysisWeeks: totalPMWeeks * 0.2,
      },
      totalEstimatedCost,
      criticalSkills: Array.from(criticalSkills),
    };
  }

  // Helper methods for feedback analysis

  private calculateSeverity(feedback: any): number {
    if (feedback.feedback_type === 'bug_report') {
      const severityMap = { critical: 10, high: 8, medium: 5, low: 2 };
      return severityMap[feedback.severity as keyof typeof severityMap] || 5;
    }
    if (feedback.rating && feedback.rating <= 2) return 8;
    if (feedback.feedback_type === 'feature_request') return 4;
    return 3;
  }

  private async calculateFrequency(feedback: any): Promise<number> {
    // Simplified frequency calculation - would be more sophisticated in production
    const similarFeedback = await supabase
      .from('user_feedback')
      .select('id')
      .ilike('title', `%${feedback.title?.substring(0, 20) || ''}%`)
      .limit(10);

    return similarFeedback.data?.length || 1;
  }

  private estimateEffort(feedback: any): number {
    // Simple effort estimation based on feedback type and description
    if (feedback.feedback_type === 'bug_report') {
      if (
        feedback.description?.includes('crash') ||
        feedback.description?.includes('error')
      )
        return 6;
      return 3;
    }
    if (feedback.feedback_type === 'feature_request') return 8;
    return 2;
  }

  private estimateImpact(feedback: any): number {
    if (
      feedback.feedback_type === 'bug_report' &&
      feedback.severity === 'critical'
    )
      return 10;
    if (feedback.rating && feedback.rating <= 2) return 8;
    if (feedback.feedback_type === 'feature_request') return 6;
    return 4;
  }

  private calculateUserValue(feedback: any): number {
    // Calculate based on user engagement and feedback quality
    let value = 5; // Base value

    if (feedback.rating) {
      value += (5 - feedback.rating) * 2; // Lower ratings = higher user value to fix
    }

    if (feedback.description && feedback.description.length > 100) {
      value += 2; // Detailed feedback is more valuable
    }

    return Math.min(value, 10);
  }

  private getAffectedGradeLevels(_feedback: any): string[] {
    // Simple heuristic - would be more sophisticated with user segmentation
    return ['K-2', '3-5', '6-8', '9-12'];
  }

  private async saveIterationPlan(plan: IterationPlan): Promise<void> {
    try {
      const sb =
        supabase as unknown as import('@supabase/supabase-js').SupabaseClient;
      const { error } = await sb.from('iteration_plans').insert({
        id: plan.id,
        plan_name: plan.planName,
        version: plan.version,
        plan_data: plan,
        created_at: plan.generatedAt,
      });

      if (error) {
        console.warn('Failed to save iteration plan to database:', error);
      } else {
        console.log('✅ Iteration plan saved to database');
      }
    } catch (error) {
      console.error('Error saving iteration plan:', error);
    }
  }

  private generatePlanId(): string {
    return `plan_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  private generateInitiativeId(): string {
    return `init_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }
}

// Export singleton instance
export const iterationPlanningService = IterationPlanningService.getInstance();
export default iterationPlanningService;
