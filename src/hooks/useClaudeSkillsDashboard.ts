/**
 * React Hook for Claude Skills Real-Time Monitoring Dashboard
 *
 * Provides real-time metrics and alerts for the monitoring dashboard
 */

import { useState, useEffect, useCallback } from 'react';
import {
  claudeSkillsMonitor,
  RealTimeMetrics,
  ClaudeSkillsPerformanceMetrics,
  PerformanceAlert,
} from '../services/claudeSkillsMonitor';
import { SkillType } from '../types/claudeSkills';

export interface DashboardData {
  realTimeMetrics: RealTimeMetrics;
  performanceMetrics: ClaudeSkillsPerformanceMetrics;
  alerts: PerformanceAlert[];
  isLoading: boolean;
  error: Error | null;
  lastUpdated: Date;
}

export interface UseClaudeSkillsDashboardOptions {
  refreshInterval?: number; // milliseconds
  hours?: number; // for performance metrics
  skillType?: SkillType; // filter by skill type
  autoRefresh?: boolean; // enable auto-refresh
}

/**
 * Hook for accessing Claude Skills monitoring dashboard data
 */
export function useClaudeSkillsDashboard(
  options: UseClaudeSkillsDashboardOptions = {},
): DashboardData {
  const {
    refreshInterval = 5000, // 5 seconds default
    hours = 24,
    skillType,
    autoRefresh = true,
  } = options;

  const [realTimeMetrics, setRealTimeMetrics] = useState<RealTimeMetrics>(
    claudeSkillsMonitor.getRealTimeMetrics(),
  );
  const [performanceMetrics, setPerformanceMetrics] =
    useState<ClaudeSkillsPerformanceMetrics>(
      claudeSkillsMonitor.getCurrentMetrics(),
    );
  const [alerts, setAlerts] = useState<PerformanceAlert[]>(
    claudeSkillsMonitor.getActiveAlerts(),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const refreshData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get real-time metrics (synchronous)
      const realTime = claudeSkillsMonitor.getRealTimeMetrics();
      setRealTimeMetrics(realTime);

      // Get performance metrics (async, may query database)
      const perfMetrics = await claudeSkillsMonitor.getPerformanceMetrics(
        hours,
        skillType,
      );
      setPerformanceMetrics(perfMetrics);

      // Get active alerts
      const activeAlerts = claudeSkillsMonitor.getActiveAlerts();
      setAlerts(activeAlerts);

      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      console.error('Error refreshing dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [hours, skillType]);

  useEffect(() => {
    // Initial load
    refreshData();

    // Set up auto-refresh if enabled
    if (autoRefresh) {
      const interval = setInterval(refreshData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refreshData, autoRefresh, refreshInterval]);

  return {
    realTimeMetrics,
    performanceMetrics,
    alerts,
    isLoading,
    error,
    lastUpdated,
  };
}

/**
 * Hook for resolving alerts
 */
export function useClaudeSkillsAlerts() {
  const resolveAlert = useCallback(async (alertId: string) => {
    await claudeSkillsMonitor.resolveAlert(alertId);
  }, []);

  const clearResolvedAlerts = useCallback(async () => {
    return await claudeSkillsMonitor.clearResolvedAlerts();
  }, []);

  return {
    resolveAlert,
    clearResolvedAlerts,
  };
}
