/**
 * User Adoption Analytics Service by Grade Level
 * Analyzes image generation feature adoption patterns across different grade levels
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { auditLogger, EventType, EventCategory, Severity } from './auditLogger';

// Boundary cast: project Database type doesn't satisfy postgrest's GenericSchema.
// Same pattern as feedbackCollectionService.ts.
const sb = supabase as unknown as SupabaseClient;

export interface GradeLevelAdoption {
  gradeLevel: string;
  totalUsers: number;
  activeUsers: number;
  adoptionRate: number; // % of users who tried image generation
  totalGenerations: number;
  avgGenerationsPerUser: number;
  successRate: number;
  retentionRate: number; // % who used it more than once
  engagementScore: number; // 0-100 composite score
  firstUseToReturnDays: number; // Average days between first use and return
}

export interface AdoptionTrends {
  dailyAdoption: Array<{
    date: string;
    gradeLevel: string;
    newUsers: number;
    totalGenerations: number;
    cumulativeUsers: number;
  }>;
  weeklyGrowth: Record<string, number>; // Grade level to % growth
  adoptionVelocity: Record<string, number>; // Grade level to users per day
  crossGradeComparison: Array<{
    gradeLevel: string;
    rank: number;
    adoptionRate: number;
    engagementLevel: 'high' | 'medium' | 'low';
  }>;
}

export interface UserJourneyAnalysis {
  gradeLevel: string;
  discoveryMethods: Record<string, number>; // How users discovered the feature
  conversionFunnel: {
    viewedFeature: number;
    startedFirstGeneration: number;
    completedFirstGeneration: number;
    returnedForSecond: number;
    becameRegularUser: number; // 5+ generations
  };
  dropoffPoints: Array<{
    stage: string;
    dropoffRate: number;
    commonReasons: string[];
  }>;
  timeToAdoption: {
    median: number; // Days from signup to first image generation
    p25: number;
    p75: number;
    p95: number;
  };
}

export interface AdoptionInsights {
  overallTrends: {
    totalAdoptionRate: number;
    fastestGrowingGrade: string;
    slowestGrowingGrade: string;
    highestEngagementGrade: string;
  };
  gradeSpecificInsights: Record<string, string[]>;
  recommendations: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  };
  riskFactors: Array<{
    gradeLevel: string;
    risk: 'high' | 'medium' | 'low';
    issues: string[];
    mitigation: string[];
  }>;
}

export interface CompetitiveAnalysis {
  benchmarkComparison: Record<
    string,
    {
      ourAdoptionRate: number;
      industryBenchmark: number;
      performance: 'above' | 'at' | 'below';
      gap: number;
    }
  >;
  opportunityAreas: string[];
}

class AdoptionAnalyticsService {
  private static instance: AdoptionAnalyticsService;

  // Grade level groupings for analysis
  private readonly GRADE_GROUPS = {
    'K-2': ['K', '1', '2', 'K-2'],
    '3-5': ['3', '4', '5', '3-5'],
    '6-8': ['6', '7', '8', '6-8'],
    '9-12': ['9', '10', '11', '12', '9-12'],
  };

  public static getInstance(): AdoptionAnalyticsService {
    if (!AdoptionAnalyticsService.instance) {
      AdoptionAnalyticsService.instance = new AdoptionAnalyticsService();
    }
    return AdoptionAnalyticsService.instance;
  }

  /**
   * Get comprehensive adoption analytics by grade level
   */
  async getGradeLevelAdoption(
    days: number = 30,
  ): Promise<GradeLevelAdoption[]> {
    try {
      const startDate = new Date(
        Date.now() - days * 24 * 60 * 60 * 1000,
      ).toISOString();

      console.log('📊 Analyzing grade level adoption for', days, 'days');

      // Get all users with their grade levels
      const { data: users, error: usersError } = await sb
        .from('user_profiles')
        .select('id, preferred_grade_level, created_at')
        .gte('created_at', startDate);

      if (usersError) {
        console.warn('Failed to fetch user profiles:', usersError);
        return [];
      }

      // Get all image generation events
      const { data: events, error: eventsError } = await sb
        .from('image_generation_events')
        .select('user_id, story_grade_level, generation_status, created_at')
        .gte('created_at', startDate);

      if (eventsError) {
        console.warn('Failed to fetch image generation events:', eventsError);
        return [];
      }

      const userList = users || [];
      const eventList = events || [];

      // Group users by grade level
      const gradeGroups = this.groupUsersByGrade(userList);

      // Analyze each grade level
      const adoptionData: GradeLevelAdoption[] = [];

      for (const [gradeLevel, gradeUsers] of Object.entries(gradeGroups)) {
        const gradeUserIds = new Set(gradeUsers.map(u => u.id));

        // Get events for users of this grade level
        const gradeEvents = eventList.filter(
          e =>
            gradeUserIds.has(e.user_id) ||
            this.normalizeGradeLevel(e.story_grade_level) === gradeLevel,
        );

        const analysis = this.analyzeGradeLevelData(
          gradeLevel,
          gradeUsers,
          gradeEvents,
        );
        adoptionData.push(analysis);
      }

      console.log('✅ Grade level adoption analysis complete:', {
        gradesAnalyzed: adoptionData.length,
        totalUsers: adoptionData.reduce((sum, g) => sum + g.totalUsers, 0),
        overallAdoption:
          adoptionData.reduce((sum, g) => sum + g.adoptionRate, 0) /
          adoptionData.length,
      });

      return adoptionData.sort((a, b) => b.adoptionRate - a.adoptionRate);
    } catch (error) {
      console.error('Failed to get grade level adoption:', error);
      return [];
    }
  }

  /**
   * Get adoption trends over time
   */
  async getAdoptionTrends(days: number = 30): Promise<AdoptionTrends> {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const dailyAdoption = await this.getDailyAdoptionTrends(startDate, days);
      const weeklyGrowth = await this.calculateWeeklyGrowth(days);
      const adoptionVelocity = await this.calculateAdoptionVelocity(days);
      const crossGradeComparison = await this.getCrossGradeComparison();

      return {
        dailyAdoption,
        weeklyGrowth,
        adoptionVelocity,
        crossGradeComparison,
      };
    } catch (error) {
      console.error('Failed to get adoption trends:', error);
      return {
        dailyAdoption: [],
        weeklyGrowth: {},
        adoptionVelocity: {},
        crossGradeComparison: [],
      };
    }
  }

  /**
   * Analyze user journey by grade level
   */
  async getUserJourneyAnalysis(
    gradeLevel: string,
  ): Promise<UserJourneyAnalysis> {
    try {
      console.log('🔍 Analyzing user journey for grade level:', gradeLevel);

      // Get users of this grade level
      const { data: users, error: usersError } = await sb
        .from('user_profiles')
        .select('id, created_at, preferred_grade_level')
        .eq('preferred_grade_level', gradeLevel);

      if (usersError || !users) {
        console.warn('Failed to fetch users for journey analysis:', usersError);
        return this.getDefaultUserJourney(gradeLevel);
      }

      const userIds = users.map(u => u.id);

      // Get their image generation events
      const { data: events, error: eventsError } = await sb
        .from('image_generation_events')
        .select('user_id, generation_status, created_at')
        .in('user_id', userIds)
        .order('created_at', { ascending: true });

      if (eventsError) {
        console.warn(
          'Failed to fetch events for journey analysis:',
          eventsError,
        );
        return this.getDefaultUserJourney(gradeLevel);
      }

      const eventList = events || [];

      // Analyze conversion funnel
      const conversionFunnel = this.analyzeConversionFunnel(users, eventList);

      // Analyze time to adoption
      const timeToAdoption = this.analyzeTimeToAdoption(users, eventList);

      // Identify dropoff points
      const dropoffPoints = this.identifyDropoffPoints(users, eventList);

      const journey: UserJourneyAnalysis = {
        gradeLevel,
        discoveryMethods: this.analyzeDiscoveryMethods(users, eventList),
        conversionFunnel,
        dropoffPoints,
        timeToAdoption,
      };

      console.log('✅ User journey analysis complete for', gradeLevel);
      return journey;
    } catch (error) {
      console.error('Failed to analyze user journey:', error);
      return this.getDefaultUserJourney(gradeLevel);
    }
  }

  /**
   * Generate comprehensive adoption insights
   */
  async getAdoptionInsights(days: number = 30): Promise<AdoptionInsights> {
    try {
      const adoptionData = await this.getGradeLevelAdoption(days);
      const trends = await this.getAdoptionTrends(days);

      // Calculate overall trends
      const totalAdoptionRate =
        adoptionData.reduce((sum, g) => sum + g.adoptionRate, 0) /
        adoptionData.length;
      const fastestGrowingGrade =
        Object.entries(trends.weeklyGrowth).sort(
          (a, b) => b[1] - a[1],
        )[0]?.[0] || 'Unknown';
      const slowestGrowingGrade =
        Object.entries(trends.weeklyGrowth).sort(
          (a, b) => a[1] - b[1],
        )[0]?.[0] || 'Unknown';
      const highestEngagementGrade =
        adoptionData.sort((a, b) => b.engagementScore - a.engagementScore)[0]
          ?.gradeLevel || 'Unknown';

      // Generate grade-specific insights
      const gradeSpecificInsights = this.generateGradeInsights(adoptionData);

      // Generate recommendations
      const recommendations = this.generateRecommendations(
        adoptionData,
        trends,
      );

      // Identify risk factors
      const riskFactors = this.identifyRiskFactors(adoptionData);

      const insights: AdoptionInsights = {
        overallTrends: {
          totalAdoptionRate,
          fastestGrowingGrade,
          slowestGrowingGrade,
          highestEngagementGrade,
        },
        gradeSpecificInsights,
        recommendations,
        riskFactors,
      };

      // Log insights for monitoring
      auditLogger.logEvent({
        eventType: EventType.ANALYTICS_INSIGHTS_GENERATED,
        eventCategory: EventCategory.ANALYTICS,
        severity: Severity.INFO,
        description: 'Adoption insights generated for grade level analysis',
        metadata: {
          totalAdoptionRate,
          gradesAnalyzed: adoptionData.length,
          riskFactorsCount: riskFactors.length,
          recommendationsCount:
            recommendations.immediate.length +
            recommendations.shortTerm.length +
            recommendations.longTerm.length,
        },
        context: {
          timestamp: new Date(),
          action: 'insights_generation',
          resource: 'adoption_analytics_service',
        },
      });

      return insights;
    } catch (error) {
      console.error('Failed to generate adoption insights:', error);
      return {
        overallTrends: {
          totalAdoptionRate: 0,
          fastestGrowingGrade: 'Unknown',
          slowestGrowingGrade: 'Unknown',
          highestEngagementGrade: 'Unknown',
        },
        gradeSpecificInsights: {},
        recommendations: {
          immediate: [
            'Unable to generate recommendations due to data access issues',
          ],
          shortTerm: [],
          longTerm: [],
        },
        riskFactors: [],
      };
    }
  }

  /**
   * Compare against industry benchmarks
   */
  async getCompetitiveAnalysis(): Promise<CompetitiveAnalysis> {
    try {
      const adoptionData = await this.getGradeLevelAdoption(30);

      // Industry benchmarks (would be updated with real data)
      const industryBenchmarks = {
        'K-2': 25, // 25% adoption rate
        '3-5': 35, // 35% adoption rate
        '6-8': 45, // 45% adoption rate
        '9-12': 40, // 40% adoption rate
      };

      const benchmarkComparison: Record<string, any> = {};
      const opportunityAreas: string[] = [];

      adoptionData.forEach(grade => {
        const benchmark =
          industryBenchmarks[
            grade.gradeLevel as keyof typeof industryBenchmarks
          ] || 30;
        const gap = grade.adoptionRate - benchmark;

        let performance: 'above' | 'at' | 'below';
        if (gap > 5) performance = 'above';
        else if (gap < -5) performance = 'below';
        else performance = 'at';

        benchmarkComparison[grade.gradeLevel] = {
          ourAdoptionRate: grade.adoptionRate,
          industryBenchmark: benchmark,
          performance,
          gap,
        };

        if (performance === 'below') {
          opportunityAreas.push(
            `Improve ${grade.gradeLevel} adoption (${gap.toFixed(
              1,
            )}% below benchmark)`,
          );
        }
      });

      return {
        benchmarkComparison,
        opportunityAreas,
      };
    } catch (error) {
      console.error('Failed to get competitive analysis:', error);
      return {
        benchmarkComparison: {},
        opportunityAreas: ['Unable to perform competitive analysis'],
      };
    }
  }

  // Private helper methods

  private groupUsersByGrade(users: any[]): Record<string, any[]> {
    const groups: Record<string, any[]> = {
      'K-2': [],
      '3-5': [],
      '6-8': [],
      '9-12': [],
      Unknown: [],
    };

    users.forEach(user => {
      const normalizedGrade = this.normalizeGradeLevel(
        user.preferred_grade_level,
      );
      if (groups[normalizedGrade]) {
        groups[normalizedGrade].push(user);
      } else {
        groups.Unknown.push(user);
      }
    });

    return groups;
  }

  private normalizeGradeLevel(gradeLevel: string | null): string {
    if (!gradeLevel) return 'Unknown';

    const grade = gradeLevel.toLowerCase().trim();

    for (const [groupName, variations] of Object.entries(this.GRADE_GROUPS)) {
      if (variations.some(v => grade.includes(v.toLowerCase()))) {
        return groupName;
      }
    }

    return 'Unknown';
  }

  private analyzeGradeLevelData(
    gradeLevel: string,
    users: any[],
    events: any[],
  ): GradeLevelAdoption {
    const totalUsers = users.length;

    // Find users who have generated images
    const usersWithEvents = new Set(events.map(e => e.user_id));
    const activeUsers = users.filter(u => usersWithEvents.has(u.id)).length;

    const adoptionRate = totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0;

    const totalGenerations = events.length;
    const avgGenerationsPerUser =
      activeUsers > 0 ? totalGenerations / activeUsers : 0;

    const successfulEvents = events.filter(
      e => e.generation_status === 'success',
    );
    const successRate =
      totalGenerations > 0
        ? (successfulEvents.length / totalGenerations) * 100
        : 0;

    // Calculate retention rate (users with more than one generation)
    const userGenerationCounts = new Map<string, number>();
    events.forEach(e => {
      const count = userGenerationCounts.get(e.user_id) || 0;
      userGenerationCounts.set(e.user_id, count + 1);
    });

    const returningUsers = Array.from(userGenerationCounts.values()).filter(
      count => count > 1,
    ).length;
    const retentionRate =
      activeUsers > 0 ? (returningUsers / activeUsers) * 100 : 0;

    // Calculate engagement score (composite of adoption, retention, usage)
    const engagementScore = this.calculateEngagementScore(
      adoptionRate,
      retentionRate,
      avgGenerationsPerUser,
    );

    // Calculate time between first use and return
    const firstUseToReturnDays = this.calculateFirstUseToReturn(events);

    return {
      gradeLevel,
      totalUsers,
      activeUsers,
      adoptionRate,
      totalGenerations,
      avgGenerationsPerUser,
      successRate,
      retentionRate,
      engagementScore,
      firstUseToReturnDays,
    };
  }

  private calculateEngagementScore(
    adoptionRate: number,
    retentionRate: number,
    avgGenerations: number,
  ): number {
    // Weighted composite score
    const adoptionWeight = 0.4;
    const retentionWeight = 0.4;
    const usageWeight = 0.2;

    const normalizedUsage = Math.min(avgGenerations * 20, 100); // Cap at 5 generations = 100 points

    return (
      adoptionRate * adoptionWeight +
      retentionRate * retentionWeight +
      normalizedUsage * usageWeight
    );
  }

  private calculateFirstUseToReturn(events: any[]): number {
    const userFirstAndSecond = new Map<
      string,
      { first: Date; second?: Date }
    >();

    events.forEach(event => {
      const userId = event.user_id;
      const eventDate = new Date(event.created_at);

      if (!userFirstAndSecond.has(userId)) {
        userFirstAndSecond.set(userId, { first: eventDate });
      } else {
        const existing = userFirstAndSecond.get(userId)!;
        if (!existing.second && eventDate > existing.first) {
          existing.second = eventDate;
        }
      }
    });

    const returnTimes = Array.from(userFirstAndSecond.values())
      .filter(data => data.second)
      .map(
        data =>
          (data.second!.getTime() - data.first.getTime()) /
          (1000 * 60 * 60 * 24),
      );

    return returnTimes.length > 0
      ? returnTimes.reduce((sum, days) => sum + days, 0) / returnTimes.length
      : 0;
  }

  private async getDailyAdoptionTrends(
    startDate: Date,
    days: number,
  ): Promise<AdoptionTrends['dailyAdoption']> {
    const trends: AdoptionTrends['dailyAdoption'] = [];

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      // Get events for this day
      const { data: dayEvents } = await sb
        .from('image_generation_events')
        .select('user_id, story_grade_level')
        .gte('created_at', dayStart.toISOString())
        .lte('created_at', dayEnd.toISOString());

      const events = dayEvents || [];
      const gradeStats = this.groupEventsByGrade(events);

      for (const [gradeLevel, stats] of Object.entries(gradeStats)) {
        trends.push({
          date: dateStr,
          gradeLevel,
          newUsers: stats.uniqueUsers,
          totalGenerations: stats.totalEvents,
          cumulativeUsers: 0, // Would need to calculate cumulative
        });
      }
    }

    return trends;
  }

  private groupEventsByGrade(
    events: any[],
  ): Record<string, { uniqueUsers: number; totalEvents: number }> {
    const groups: Record<string, Set<string>> = {};
    const eventCounts: Record<string, number> = {};

    events.forEach(event => {
      const grade = this.normalizeGradeLevel(event.story_grade_level);

      if (!groups[grade]) {
        groups[grade] = new Set();
        eventCounts[grade] = 0;
      }

      groups[grade].add(event.user_id);
      eventCounts[grade]++;
    });

    const result: Record<string, { uniqueUsers: number; totalEvents: number }> =
      {};

    for (const grade of Object.keys(groups)) {
      result[grade] = {
        uniqueUsers: groups[grade].size,
        totalEvents: eventCounts[grade],
      };
    }

    return result;
  }

  private async calculateWeeklyGrowth(
    days: number,
  ): Promise<Record<string, number>> {
    // Simplified calculation - would be more sophisticated in production
    const adoptionData = await this.getGradeLevelAdoption(days);
    const growth: Record<string, number> = {};

    adoptionData.forEach(grade => {
      // Simulate growth calculation based on engagement scores
      growth[grade.gradeLevel] =
        grade.engagementScore > 70
          ? 15
          : grade.engagementScore > 50
          ? 8
          : grade.engagementScore > 30
          ? 3
          : -2;
    });

    return growth;
  }

  private async calculateAdoptionVelocity(
    days: number,
  ): Promise<Record<string, number>> {
    const adoptionData = await this.getGradeLevelAdoption(days);
    const velocity: Record<string, number> = {};

    adoptionData.forEach(grade => {
      velocity[grade.gradeLevel] = grade.activeUsers / days;
    });

    return velocity;
  }

  private async getCrossGradeComparison(): Promise<
    AdoptionTrends['crossGradeComparison']
  > {
    const adoptionData = await this.getGradeLevelAdoption(30);

    return adoptionData
      .sort((a, b) => b.adoptionRate - a.adoptionRate)
      .map((grade, index) => ({
        gradeLevel: grade.gradeLevel,
        rank: index + 1,
        adoptionRate: grade.adoptionRate,
        engagementLevel:
          grade.engagementScore > 70
            ? 'high'
            : grade.engagementScore > 50
            ? 'medium'
            : 'low',
      }));
  }

  private analyzeConversionFunnel(
    users: any[],
    events: any[],
  ): UserJourneyAnalysis['conversionFunnel'] {
    const totalUsers = users.length;
    const usersWithEvents = new Set(events.map(e => e.user_id));
    const usersWithSuccess = new Set(
      events.filter(e => e.generation_status === 'success').map(e => e.user_id),
    );

    const userEventCounts = new Map<string, number>();
    events.forEach(e => {
      const count = userEventCounts.get(e.user_id) || 0;
      userEventCounts.set(e.user_id, count + 1);
    });

    const usersWithMultiple = Array.from(userEventCounts.entries()).filter(
      ([_, count]) => count > 1,
    ).length;
    const regularUsers = Array.from(userEventCounts.entries()).filter(
      ([_, count]) => count >= 5,
    ).length;

    return {
      viewedFeature: totalUsers, // Assume all users have seen the feature
      startedFirstGeneration: usersWithEvents.size,
      completedFirstGeneration: usersWithSuccess.size,
      returnedForSecond: usersWithMultiple,
      becameRegularUser: regularUsers,
    };
  }

  private analyzeTimeToAdoption(
    users: any[],
    events: any[],
  ): UserJourneyAnalysis['timeToAdoption'] {
    const adoptionTimes: number[] = [];

    events.forEach(event => {
      const user = users.find(u => u.id === event.user_id);
      if (user) {
        const signupDate = new Date(user.created_at);
        const firstGenDate = new Date(event.created_at);
        const daysToAdoption =
          (firstGenDate.getTime() - signupDate.getTime()) /
          (1000 * 60 * 60 * 24);
        if (daysToAdoption >= 0) {
          adoptionTimes.push(daysToAdoption);
        }
      }
    });

    if (adoptionTimes.length === 0) {
      return { median: 0, p25: 0, p75: 0, p95: 0 };
    }

    adoptionTimes.sort((a, b) => a - b);

    return {
      median: this.percentile(adoptionTimes, 50),
      p25: this.percentile(adoptionTimes, 25),
      p75: this.percentile(adoptionTimes, 75),
      p95: this.percentile(adoptionTimes, 95),
    };
  }

  private percentile(values: number[], p: number): number {
    const index = Math.ceil((p / 100) * values.length) - 1;
    return values[Math.max(0, Math.min(index, values.length - 1))];
  }

  private identifyDropoffPoints(
    users: any[],
    events: any[],
  ): UserJourneyAnalysis['dropoffPoints'] {
    const funnel = this.analyzeConversionFunnel(users, events);

    const dropoffPoints = [];

    if (funnel.viewedFeature > 0) {
      const startRate =
        (funnel.startedFirstGeneration / funnel.viewedFeature) * 100;
      if (startRate < 50) {
        dropoffPoints.push({
          stage: 'Feature Discovery to First Attempt',
          dropoffRate: 100 - startRate,
          commonReasons: [
            'Feature not discoverable',
            'Unclear value proposition',
            'Too complex to start',
          ],
        });
      }
    }

    if (funnel.startedFirstGeneration > 0) {
      const completionRate =
        (funnel.completedFirstGeneration / funnel.startedFirstGeneration) * 100;
      if (completionRate < 70) {
        dropoffPoints.push({
          stage: 'First Attempt to Completion',
          dropoffRate: 100 - completionRate,
          commonReasons: [
            'Technical failures',
            'Long wait times',
            'Poor image quality',
          ],
        });
      }
    }

    if (funnel.completedFirstGeneration > 0) {
      const returnRate =
        (funnel.returnedForSecond / funnel.completedFirstGeneration) * 100;
      if (returnRate < 40) {
        dropoffPoints.push({
          stage: 'First Success to Return Usage',
          dropoffRate: 100 - returnRate,
          commonReasons: [
            'Not satisfied with results',
            'Too expensive (XP cost)',
            'Forgot about feature',
          ],
        });
      }
    }

    return dropoffPoints;
  }

  private analyzeDiscoveryMethods(
    _users: any[],
    _events: any[],
  ): Record<string, number> {
    // Simplified discovery analysis - would be more sophisticated with tracking
    return {
      story_completion_prompt: 60,
      home_screen_feature: 25,
      settings_exploration: 10,
      other: 5,
    };
  }

  private generateGradeInsights(
    adoptionData: GradeLevelAdoption[],
  ): Record<string, string[]> {
    const insights: Record<string, string[]> = {};

    adoptionData.forEach(grade => {
      const gradeInsights = [];

      if (grade.adoptionRate > 50) {
        gradeInsights.push(
          `Strong adoption rate of ${grade.adoptionRate.toFixed(
            1,
          )}% indicates good feature fit`,
        );
      } else if (grade.adoptionRate < 20) {
        gradeInsights.push(
          `Low adoption rate of ${grade.adoptionRate.toFixed(
            1,
          )}% needs improvement`,
        );
      }

      if (grade.retentionRate > 60) {
        gradeInsights.push(
          `High retention rate shows users find value in the feature`,
        );
      } else if (grade.retentionRate < 30) {
        gradeInsights.push(
          `Low retention suggests need for engagement improvements`,
        );
      }

      if (grade.avgGenerationsPerUser > 3) {
        gradeInsights.push(`High usage per user indicates strong engagement`);
      } else if (grade.avgGenerationsPerUser < 1.5) {
        gradeInsights.push(
          `Low usage per user suggests barriers to repeated use`,
        );
      }

      insights[grade.gradeLevel] = gradeInsights;
    });

    return insights;
  }

  private generateRecommendations(
    adoptionData: GradeLevelAdoption[],
    _trends: AdoptionTrends,
  ): AdoptionInsights['recommendations'] {
    const immediate = [];
    const shortTerm = [];
    const longTerm = [];

    // Analyze adoption rates
    const lowAdoptionGrades = adoptionData.filter(g => g.adoptionRate < 25);
    if (lowAdoptionGrades.length > 0) {
      immediate.push(
        `Focus on improving adoption for ${lowAdoptionGrades
          .map(g => g.gradeLevel)
          .join(', ')}`,
      );
    }

    // Analyze retention issues
    const lowRetentionGrades = adoptionData.filter(g => g.retentionRate < 40);
    if (lowRetentionGrades.length > 0) {
      shortTerm.push(
        `Improve retention strategies for ${lowRetentionGrades
          .map(g => g.gradeLevel)
          .join(', ')}`,
      );
    }

    // Analyze engagement
    const highEngagementGrades = adoptionData.filter(
      g => g.engagementScore > 70,
    );
    if (highEngagementGrades.length > 0) {
      longTerm.push(
        `Leverage successful patterns from ${highEngagementGrades
          .map(g => g.gradeLevel)
          .join(', ')} for other grades`,
      );
    }

    return { immediate, shortTerm, longTerm };
  }

  private identifyRiskFactors(
    adoptionData: GradeLevelAdoption[],
  ): AdoptionInsights['riskFactors'] {
    return adoptionData
      .map(grade => {
        const risks = [];
        const mitigation = [];

        let riskLevel: 'high' | 'medium' | 'low' = 'low';

        if (grade.adoptionRate < 15) {
          risks.push('Very low adoption rate');
          mitigation.push('Improve feature discoverability and onboarding');
          riskLevel = 'high';
        }

        if (grade.retentionRate < 25) {
          risks.push('Poor user retention');
          mitigation.push('Enhance user experience and reduce friction');
          if (riskLevel !== 'high') riskLevel = 'medium';
        }

        if (grade.successRate < 80) {
          risks.push('Technical issues affecting success rate');
          mitigation.push('Improve API reliability and error handling');
          if (riskLevel === 'low') riskLevel = 'medium';
        }

        return {
          gradeLevel: grade.gradeLevel,
          risk: riskLevel,
          issues: risks,
          mitigation,
        };
      })
      .filter(r => r.risk !== 'low' || r.issues.length > 0);
  }

  private getDefaultUserJourney(gradeLevel: string): UserJourneyAnalysis {
    return {
      gradeLevel,
      discoveryMethods: {},
      conversionFunnel: {
        viewedFeature: 0,
        startedFirstGeneration: 0,
        completedFirstGeneration: 0,
        returnedForSecond: 0,
        becameRegularUser: 0,
      },
      dropoffPoints: [],
      timeToAdoption: {
        median: 0,
        p25: 0,
        p75: 0,
        p95: 0,
      },
    };
  }
}

// Export singleton instance
export const adoptionAnalyticsService = AdoptionAnalyticsService.getInstance();
export default adoptionAnalyticsService;
