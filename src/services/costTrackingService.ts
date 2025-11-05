/**
 * API Cost Tracking and Optimization Monitoring Service
 * Tracks image generation API costs, usage patterns, and provides optimization insights
 */

import { supabase } from './supabase';
import { auditLogger, EventType, EventCategory, Severity } from './auditLogger';
import { ServiceUsed, GenerationStatus } from '../types/database';

export interface CostMetrics {
  totalCost: number;
  totalRequests: number;
  averageCostPerRequest: number;
  costByService: Record<ServiceUsed, number>;
  costByStatus: Record<GenerationStatus, number>;
  requestsByService: Record<ServiceUsed, number>;
  dailyCosts: Array<{
    date: string;
    cost: number;
    requests: number;
    avgCostPerRequest: number;
  }>;
  costTrend: 'increasing' | 'stable' | 'decreasing';
  projectedMonthlyCost: number;
}

export interface OptimizationInsights {
  costEfficiencyScore: number; // 0-100
  recommendations: string[];
  potentialSavings: number;
  servicePerformanceComparison: Array<{
    service: ServiceUsed;
    avgCost: number;
    successRate: number;
    avgResponseTime: number;
    costEfficiencyRating: number;
  }>;
  usagePatterns: {
    peakHours: Array<{ hour: number; cost: number; requests: number }>;
    costPerGradeLevel: Record<string, number>;
    failureImpactOnCosts: {
      wastedCost: number;
      refundedAmount: number;
      netLoss: number;
    };
  };
}

export interface CostAlert {
  id: string;
  type:
    | 'daily_budget'
    | 'monthly_budget'
    | 'unusual_spike'
    | 'service_cost_increase';
  severity: 'warning' | 'critical';
  threshold: number;
  currentValue: number;
  message: string;
  timestamp: Date;
  actionRequired: boolean;
}

export interface BudgetConfig {
  dailyBudgetLimit: number;
  monthlyBudgetLimit: number;
  costPerRequestThreshold: number;
  spikeDetectionPercentage: number; // % increase that triggers alert
  autoOptimizationEnabled: boolean;
}

class CostTrackingService {
  private static instance: CostTrackingService;

  // Service-specific cost rates (per request)
  private readonly SERVICE_COSTS: Record<ServiceUsed, number> = {
    replicate_primary: 0.023, // Example cost per generation
    replicate_backup: 0.02, // Backup service might be slightly cheaper
  };

  // Budget configuration
  private budgetConfig: BudgetConfig = {
    dailyBudgetLimit: 50.0, // $50 per day
    monthlyBudgetLimit: 1000.0, // $1000 per month
    costPerRequestThreshold: 0.05, // Alert if cost > $0.05 per request
    spikeDetectionPercentage: 150, // Alert if daily cost is 150% of average
    autoOptimizationEnabled: true,
  };

  public static getInstance(): CostTrackingService {
    if (!CostTrackingService.instance) {
      CostTrackingService.instance = new CostTrackingService();
    }
    return CostTrackingService.instance;
  }

  /**
   * Record API cost for an image generation request
   */
  async recordAPIRequest(
    eventId: string,
    service: ServiceUsed,
    status: GenerationStatus,
    apiResponseTimeMs?: number,
    metadata?: Record<string, any>,
  ): Promise<void> {
    try {
      const cost = this.calculateRequestCost(service, status, metadata);

      console.log('💰 Recording API cost:', {
        eventId,
        service,
        status,
        cost: `$${cost.toFixed(4)}`,
        responseTime: apiResponseTimeMs ? `${apiResponseTimeMs}ms` : 'unknown',
      });

      // Update the image generation event with cost information
      const { error } = await supabase
        .from('image_generation_events')
        .update({
          api_cost: cost,
          service_used: service,
          generation_status: status,
          api_response_time_ms: apiResponseTimeMs,
          cost_recorded_at: new Date().toISOString(),
        })
        .eq('id', eventId);

      if (error) {
        console.error('Failed to record API cost:', error);
        return;
      }

      // Log the cost tracking event
      auditLogger.logEvent({
        eventType: EventType.API_COST_RECORDED,
        eventCategory: EventCategory.SYSTEM,
        severity: Severity.INFO,
        description: `API cost recorded: $${cost.toFixed(4)} for ${service}`,
        metadata: {
          eventId,
          service,
          status,
          cost,
          apiResponseTimeMs,
          ...metadata,
        },
        context: {
          timestamp: new Date(),
          action: 'cost_tracking',
          resource: 'cost_tracking_service',
        },
      });

      // Check for budget alerts
      await this.checkBudgetAlerts();
    } catch (error) {
      console.error('Failed to record API request cost:', error);
    }
  }

  /**
   * Get comprehensive cost metrics for a given period
   */
  async getCostMetrics(days: number = 30): Promise<CostMetrics> {
    try {
      const startDate = new Date(
        Date.now() - days * 24 * 60 * 60 * 1000,
      ).toISOString();
      const endDate = new Date().toISOString();

      const { data: events, error } = await supabase
        .from('image_generation_events')
        .select('*')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .not('api_cost', 'is', null);

      if (error) {
        console.warn('Failed to fetch cost data:', error);
        return this.getDefaultCostMetrics();
      }

      const costEvents = events || [];
      return this.calculateCostMetrics(costEvents, days);
    } catch (error) {
      console.error('Failed to get cost metrics:', error);
      return this.getDefaultCostMetrics();
    }
  }

  /**
   * Generate optimization insights and recommendations
   */
  async getOptimizationInsights(
    days: number = 30,
  ): Promise<OptimizationInsights> {
    try {
      const costMetrics = await this.getCostMetrics(days);
      const startDate = new Date(
        Date.now() - days * 24 * 60 * 60 * 1000,
      ).toISOString();

      const { data: events, error } = await supabase
        .from('image_generation_events')
        .select('*')
        .gte('created_at', startDate);

      if (error) {
        throw new Error(`Failed to fetch events: ${error.message}`);
      }

      const allEvents = events || [];

      return this.calculateOptimizationInsights(costMetrics, allEvents);
    } catch (error) {
      console.error('Failed to get optimization insights:', error);
      return this.getDefaultOptimizationInsights();
    }
  }

  /**
   * Check for cost-related alerts and budget violations
   */
  async checkBudgetAlerts(): Promise<CostAlert[]> {
    try {
      const alerts: CostAlert[] = [];

      // Check daily budget
      const dailyCost = await this.getDailyCost();
      if (dailyCost > this.budgetConfig.dailyBudgetLimit) {
        alerts.push({
          id: `daily_budget_${Date.now()}`,
          type: 'daily_budget',
          severity: 'critical',
          threshold: this.budgetConfig.dailyBudgetLimit,
          currentValue: dailyCost,
          message: `Daily budget exceeded: $${dailyCost.toFixed(2)} > $${
            this.budgetConfig.dailyBudgetLimit
          }`,
          timestamp: new Date(),
          actionRequired: true,
        });
      }

      // Check monthly budget
      const monthlyCost = await this.getMonthlyCost();
      if (monthlyCost > this.budgetConfig.monthlyBudgetLimit) {
        alerts.push({
          id: `monthly_budget_${Date.now()}`,
          type: 'monthly_budget',
          severity: 'critical',
          threshold: this.budgetConfig.monthlyBudgetLimit,
          currentValue: monthlyCost,
          message: `Monthly budget exceeded: $${monthlyCost.toFixed(2)} > $${
            this.budgetConfig.monthlyBudgetLimit
          }`,
          timestamp: new Date(),
          actionRequired: true,
        });
      }

      // Check for unusual cost spikes
      const spikeAlert = await this.detectCostSpike();
      if (spikeAlert) {
        alerts.push(spikeAlert);
      }

      // Log alerts
      if (alerts.length > 0) {
        console.log('💸 Cost alerts triggered:', alerts.length);

        for (const alert of alerts) {
          auditLogger.logEvent({
            eventType: EventType.BUDGET_ALERT,
            eventCategory: EventCategory.SYSTEM,
            severity:
              alert.severity === 'critical' ? Severity.ERROR : Severity.WARNING,
            description: alert.message,
            metadata: {
              alertId: alert.id,
              alertType: alert.type,
              threshold: alert.threshold,
              currentValue: alert.currentValue,
            },
            context: {
              timestamp: new Date(),
              action: 'budget_monitoring',
              resource: 'cost_tracking_service',
            },
          });
        }
      }

      return alerts;
    } catch (error) {
      console.error('Failed to check budget alerts:', error);
      return [];
    }
  }

  /**
   * Get cost breakdown by service for comparison
   */
  async getServiceCostComparison(days: number = 7): Promise<
    Array<{
      service: ServiceUsed;
      totalCost: number;
      totalRequests: number;
      avgCostPerRequest: number;
      successRate: number;
      avgResponseTime: number;
    }>
  > {
    try {
      const startDate = new Date(
        Date.now() - days * 24 * 60 * 60 * 1000,
      ).toISOString();

      const { data: events, error } = await supabase
        .from('image_generation_events')
        .select('*')
        .gte('created_at', startDate)
        .not('service_used', 'is', null);

      if (error) {
        console.warn('Failed to fetch service comparison data:', error);
        return [];
      }

      const serviceGroups = new Map<ServiceUsed, any[]>();

      (events || []).forEach(event => {
        const service = event.service_used as ServiceUsed;
        if (!serviceGroups.has(service)) {
          serviceGroups.set(service, []);
        }
        serviceGroups.get(service)!.push(event);
      });

      const comparison = Array.from(serviceGroups.entries()).map(
        ([service, serviceEvents]) => {
          const totalCost = serviceEvents.reduce(
            (sum, e) => sum + (e.api_cost || 0),
            0,
          );
          const totalRequests = serviceEvents.length;
          const successfulEvents = serviceEvents.filter(
            e => e.generation_status === 'success',
          );
          const successRate =
            totalRequests > 0
              ? (successfulEvents.length / totalRequests) * 100
              : 0;

          const responseTimes = serviceEvents
            .filter(e => e.api_response_time_ms && e.api_response_time_ms > 0)
            .map(e => e.api_response_time_ms);
          const avgResponseTime =
            responseTimes.length > 0
              ? responseTimes.reduce((sum, time) => sum + time, 0) /
                responseTimes.length
              : 0;

          return {
            service,
            totalCost,
            totalRequests,
            avgCostPerRequest:
              totalRequests > 0 ? totalCost / totalRequests : 0,
            successRate,
            avgResponseTime,
          };
        },
      );

      console.log('📊 Service cost comparison:', comparison);
      return comparison;
    } catch (error) {
      console.error('Failed to get service cost comparison:', error);
      return [];
    }
  }

  /**
   * Update budget configuration
   */
  updateBudgetConfig(config: Partial<BudgetConfig>): void {
    this.budgetConfig = { ...this.budgetConfig, ...config };
    console.log('💰 Budget configuration updated:', this.budgetConfig);
  }

  /**
   * Get current budget status
   */
  async getBudgetStatus(): Promise<{
    dailyUsed: number;
    dailyRemaining: number;
    monthlyUsed: number;
    monthlyRemaining: number;
    isOverBudget: boolean;
    daysUntilMonthEnd: number;
    projectedMonthlyTotal: number;
  }> {
    try {
      const dailyUsed = await this.getDailyCost();
      const monthlyUsed = await this.getMonthlyCost();
      const daysUntilMonthEnd = this.getDaysUntilMonthEnd();
      const projectedMonthlyTotal = monthlyUsed + dailyUsed * daysUntilMonthEnd;

      return {
        dailyUsed,
        dailyRemaining: Math.max(
          0,
          this.budgetConfig.dailyBudgetLimit - dailyUsed,
        ),
        monthlyUsed,
        monthlyRemaining: Math.max(
          0,
          this.budgetConfig.monthlyBudgetLimit - monthlyUsed,
        ),
        isOverBudget:
          dailyUsed > this.budgetConfig.dailyBudgetLimit ||
          monthlyUsed > this.budgetConfig.monthlyBudgetLimit,
        daysUntilMonthEnd,
        projectedMonthlyTotal,
      };
    } catch (error) {
      console.error('Failed to get budget status:', error);
      return {
        dailyUsed: 0,
        dailyRemaining: this.budgetConfig.dailyBudgetLimit,
        monthlyUsed: 0,
        monthlyRemaining: this.budgetConfig.monthlyBudgetLimit,
        isOverBudget: false,
        daysUntilMonthEnd: 30,
        projectedMonthlyTotal: 0,
      };
    }
  }

  // Private helper methods

  private calculateRequestCost(
    service: ServiceUsed,
    status: GenerationStatus,
    metadata?: Record<string, any>,
  ): number {
    let baseCost = this.SERVICE_COSTS[service] || 0.025; // Default cost

    // Failed requests might have reduced cost (depending on provider billing)
    if (status === 'failed' || status === 'timeout') {
      baseCost *= 0.5; // Assume 50% cost for failed requests
    }

    // Adjust for specific metadata (image size, complexity, etc.)
    if (metadata?.imageSize === 'large') {
      baseCost *= 1.5;
    }

    return baseCost;
  }

  private calculateCostMetrics(events: any[], days: number): CostMetrics {
    const totalCost = events.reduce((sum, e) => sum + (e.api_cost || 0), 0);
    const totalRequests = events.length;
    const averageCostPerRequest =
      totalRequests > 0 ? totalCost / totalRequests : 0;

    // Group by service
    const costByService: Record<ServiceUsed, number> = {
      replicate_primary: 0,
      replicate_backup: 0,
    };
    const requestsByService: Record<ServiceUsed, number> = {
      replicate_primary: 0,
      replicate_backup: 0,
    };

    // Group by status
    const costByStatus: Record<GenerationStatus, number> = {
      pending: 0,
      in_progress: 0,
      success: 0,
      failed: 0,
      timeout: 0,
      refunded: 0,
    };

    events.forEach(event => {
      const service = event.service_used as ServiceUsed;
      const status = event.generation_status as GenerationStatus;
      const cost = event.api_cost || 0;

      if (service && costByService.hasOwnProperty(service)) {
        costByService[service] += cost;
        requestsByService[service] += 1;
      }

      if (status && costByStatus.hasOwnProperty(status)) {
        costByStatus[status] += cost;
      }
    });

    // Calculate daily costs
    const dailyCosts = this.calculateDailyCosts(events, days);
    const costTrend = this.calculateCostTrend(dailyCosts);
    const projectedMonthlyCost = this.calculateProjectedMonthlyCost(dailyCosts);

    return {
      totalCost,
      totalRequests,
      averageCostPerRequest,
      costByService,
      costByStatus,
      requestsByService,
      dailyCosts,
      costTrend,
      projectedMonthlyCost,
    };
  }

  private calculateDailyCosts(
    events: any[],
    days: number,
  ): Array<{
    date: string;
    cost: number;
    requests: number;
    avgCostPerRequest: number;
  }> {
    const dailyData = new Map<string, { cost: number; requests: number }>();

    // Initialize all days
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      dailyData.set(dateStr, { cost: 0, requests: 0 });
    }

    // Aggregate events by day
    events.forEach(event => {
      const eventDate = new Date(event.created_at).toISOString().split('T')[0];
      const existing = dailyData.get(eventDate);
      if (existing) {
        existing.cost += event.api_cost || 0;
        existing.requests += 1;
      }
    });

    return Array.from(dailyData.entries()).map(([date, data]) => ({
      date,
      cost: data.cost,
      requests: data.requests,
      avgCostPerRequest: data.requests > 0 ? data.cost / data.requests : 0,
    }));
  }

  private calculateCostTrend(
    dailyCosts: Array<{ cost: number }>,
  ): 'increasing' | 'stable' | 'decreasing' {
    if (dailyCosts.length < 3) return 'stable';

    const recentDays = dailyCosts.slice(-3);
    const firstDayCost = recentDays[0].cost;
    const lastDayCost = recentDays[recentDays.length - 1].cost;

    if (lastDayCost > firstDayCost * 1.1) return 'increasing';
    if (lastDayCost < firstDayCost * 0.9) return 'decreasing';
    return 'stable';
  }

  private calculateProjectedMonthlyCost(
    dailyCosts: Array<{ cost: number }>,
  ): number {
    if (dailyCosts.length === 0) return 0;

    const recentDays = dailyCosts.slice(-7); // Use last 7 days for projection
    const avgDailyCost =
      recentDays.reduce((sum, day) => sum + day.cost, 0) / recentDays.length;

    return avgDailyCost * 30; // Project for 30 days
  }

  private calculateOptimizationInsights(
    metrics: CostMetrics,
    events: any[],
  ): OptimizationInsights {
    const recommendations: string[] = [];
    let potentialSavings = 0;

    // Analyze service efficiency
    const servicePerformanceComparison = this.analyzeServicePerformance(events);

    // Generate recommendations based on metrics
    if (
      metrics.averageCostPerRequest > this.budgetConfig.costPerRequestThreshold
    ) {
      recommendations.push(
        `Average cost per request ($${metrics.averageCostPerRequest.toFixed(
          4,
        )}) exceeds threshold`,
      );
      recommendations.push(
        'Consider optimizing prompt complexity or image size',
      );
      potentialSavings += metrics.totalCost * 0.15; // Estimate 15% savings
    }

    if (metrics.costByStatus.failed > metrics.totalCost * 0.1) {
      recommendations.push(
        'High failure costs detected - review error handling and retry logic',
      );
      potentialSavings += metrics.costByStatus.failed * 0.5; // Estimate 50% of failure costs could be saved
    }

    // Analyze usage patterns
    const usagePatterns = this.analyzeUsagePatterns(events);

    const costEfficiencyScore = this.calculateCostEfficiencyScore(
      metrics,
      servicePerformanceComparison,
    );

    return {
      costEfficiencyScore,
      recommendations,
      potentialSavings,
      servicePerformanceComparison,
      usagePatterns,
    };
  }

  private analyzeServicePerformance(events: any[]): Array<{
    service: ServiceUsed;
    avgCost: number;
    successRate: number;
    avgResponseTime: number;
    costEfficiencyRating: number;
  }> {
    const serviceGroups = new Map<ServiceUsed, any[]>();

    events.forEach(event => {
      if (event.service_used) {
        const service = event.service_used as ServiceUsed;
        if (!serviceGroups.has(service)) {
          serviceGroups.set(service, []);
        }
        serviceGroups.get(service)!.push(event);
      }
    });

    return Array.from(serviceGroups.entries()).map(
      ([service, serviceEvents]) => {
        const avgCost =
          serviceEvents.reduce((sum, e) => sum + (e.api_cost || 0), 0) /
          serviceEvents.length;
        const successfulEvents = serviceEvents.filter(
          e => e.generation_status === 'success',
        );
        const successRate =
          (successfulEvents.length / serviceEvents.length) * 100;

        const responseTimes = serviceEvents
          .filter(e => e.api_response_time_ms)
          .map(e => e.api_response_time_ms);
        const avgResponseTime =
          responseTimes.length > 0
            ? responseTimes.reduce((sum, time) => sum + time, 0) /
              responseTimes.length
            : 0;

        // Calculate efficiency rating (0-100) based on cost, success rate, and speed
        const costScore = Math.max(0, 100 - (avgCost / 0.05) * 100); // Lower cost = higher score
        const successScore = successRate; // Success rate is already 0-100
        const speedScore = Math.max(
          0,
          100 - ((avgResponseTime - 30000) / 30000) * 50,
        ); // Faster = higher score

        const costEfficiencyRating =
          (costScore + successScore + speedScore) / 3;

        return {
          service,
          avgCost,
          successRate,
          avgResponseTime,
          costEfficiencyRating,
        };
      },
    );
  }

  private analyzeUsagePatterns(
    events: any[],
  ): OptimizationInsights['usagePatterns'] {
    // Analyze peak hours
    const hourlyData = new Map<number, { cost: number; requests: number }>();
    for (let hour = 0; hour < 24; hour++) {
      hourlyData.set(hour, { cost: 0, requests: 0 });
    }

    // Analyze by grade level
    const gradeData = new Map<string, number>();

    // Analyze failure impact
    let wastedCost = 0;
    let refundedAmount = 0;

    events.forEach(event => {
      const hour = new Date(event.created_at).getHours();
      const hourData = hourlyData.get(hour)!;
      hourData.cost += event.api_cost || 0;
      hourData.requests += 1;

      // Grade level analysis
      if (event.story_grade_level) {
        const currentCost = gradeData.get(event.story_grade_level) || 0;
        gradeData.set(
          event.story_grade_level,
          currentCost + (event.api_cost || 0),
        );
      }

      // Failure cost analysis
      if (
        event.generation_status === 'failed' ||
        event.generation_status === 'timeout'
      ) {
        wastedCost += event.api_cost || 0;
      }
      if (event.generation_status === 'refunded') {
        refundedAmount += event.api_cost || 0;
      }
    });

    return {
      peakHours: Array.from(hourlyData.entries()).map(([hour, data]) => ({
        hour,
        cost: data.cost,
        requests: data.requests,
      })),
      costPerGradeLevel: Object.fromEntries(gradeData),
      failureImpactOnCosts: {
        wastedCost,
        refundedAmount,
        netLoss: wastedCost - refundedAmount,
      },
    };
  }

  private calculateCostEfficiencyScore(
    metrics: CostMetrics,
    serviceComparison: Array<{ costEfficiencyRating: number }>,
  ): number {
    let score = 75; // Start with neutral score

    // Factor in average cost per request
    if (metrics.averageCostPerRequest < 0.02) score += 15;
    else if (metrics.averageCostPerRequest > 0.04) score -= 15;

    // Factor in cost trend
    if (metrics.costTrend === 'decreasing') score += 10;
    else if (metrics.costTrend === 'increasing') score -= 10;

    // Factor in service efficiency
    if (serviceComparison.length > 0) {
      const avgServiceEfficiency =
        serviceComparison.reduce((sum, s) => sum + s.costEfficiencyRating, 0) /
        serviceComparison.length;
      score += (avgServiceEfficiency - 75) * 0.2; // Scale service efficiency impact
    }

    return Math.max(0, Math.min(100, score));
  }

  private async getDailyCost(): Promise<number> {
    const today = new Date();
    const startOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );

    const { data, error } = await supabase
      .from('image_generation_events')
      .select('api_cost')
      .gte('created_at', startOfDay.toISOString())
      .not('api_cost', 'is', null);

    if (error) return 0;

    return (data || []).reduce((sum, event) => sum + (event.api_cost || 0), 0);
  }

  private async getMonthlyCost(): Promise<number> {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const { data, error } = await supabase
      .from('image_generation_events')
      .select('api_cost')
      .gte('created_at', startOfMonth.toISOString())
      .not('api_cost', 'is', null);

    if (error) return 0;

    return (data || []).reduce((sum, event) => sum + (event.api_cost || 0), 0);
  }

  private getDaysUntilMonthEnd(): number {
    const today = new Date();
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return Math.ceil(
      (endOfMonth.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );
  }

  private async detectCostSpike(): Promise<CostAlert | null> {
    try {
      // Get last 7 days of daily costs
      const dailyCosts = await this.getDailyCosts(7);

      if (dailyCosts.length < 3) return null;

      const todayCost = dailyCosts[dailyCosts.length - 1];
      const previousDays = dailyCosts.slice(0, -1);
      const avgPreviousCost =
        previousDays.reduce((sum, day) => sum + day.cost, 0) /
        previousDays.length;

      const spikePercentage =
        avgPreviousCost > 0 ? (todayCost.cost / avgPreviousCost) * 100 : 0;

      if (spikePercentage > this.budgetConfig.spikeDetectionPercentage) {
        return {
          id: `cost_spike_${Date.now()}`,
          type: 'unusual_spike',
          severity: 'warning',
          threshold:
            avgPreviousCost *
            (this.budgetConfig.spikeDetectionPercentage / 100),
          currentValue: todayCost.cost,
          message: `Unusual cost spike detected: ${spikePercentage.toFixed(
            0,
          )}% increase from average`,
          timestamp: new Date(),
          actionRequired: false,
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  private async getDailyCosts(
    days: number,
  ): Promise<Array<{ date: string; cost: number }>> {
    const costs = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const startOfDay = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
      );
      const endOfDay = new Date(startOfDay);
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('image_generation_events')
        .select('api_cost')
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString())
        .not('api_cost', 'is', null);

      const dailyCost = error
        ? 0
        : (data || []).reduce((sum, event) => sum + (event.api_cost || 0), 0);

      costs.push({
        date: startOfDay.toISOString().split('T')[0],
        cost: dailyCost,
      });
    }

    return costs;
  }

  private getDefaultCostMetrics(): CostMetrics {
    return {
      totalCost: 0,
      totalRequests: 0,
      averageCostPerRequest: 0,
      costByService: {
        replicate_primary: 0,
        replicate_backup: 0,
      },
      costByStatus: {
        pending: 0,
        in_progress: 0,
        success: 0,
        failed: 0,
        timeout: 0,
        refunded: 0,
      },
      requestsByService: {
        replicate_primary: 0,
        replicate_backup: 0,
      },
      dailyCosts: [],
      costTrend: 'stable',
      projectedMonthlyCost: 0,
    };
  }

  private getDefaultOptimizationInsights(): OptimizationInsights {
    return {
      costEfficiencyScore: 75,
      recommendations: ['No cost data available for analysis'],
      potentialSavings: 0,
      servicePerformanceComparison: [],
      usagePatterns: {
        peakHours: [],
        costPerGradeLevel: {},
        failureImpactOnCosts: {
          wastedCost: 0,
          refundedAmount: 0,
          netLoss: 0,
        },
      },
    };
  }
}

// Export singleton instance
export const costTrackingService = CostTrackingService.getInstance();
export default costTrackingService;
