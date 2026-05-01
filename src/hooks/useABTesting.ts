/**
 * React Hook for A/B Testing
 *
 * Provides A/B testing functionality integrated with user context
 */

import { useState, useEffect, useCallback } from 'react';
import { abTestingService, ExperimentResults } from '../services/abTesting';
import { useAuth } from '../context/AuthContext';
import { UserContext } from '../services/featureFlags';

export interface UseABTestingResult {
  variantId: string | null;
  isInExperiment: boolean;
  claudeSkillsEnabled: boolean;
  loading: boolean;
  error: Error | null;
  trackMetric: (metricName: string, metricValue: number) => Promise<void>;
  trackConversion: (conversionType: string) => Promise<void>;
}

export interface UseABTestingOptions {
  experimentId?: string;
  autoTrack?: boolean;
}

/**
 * Hook for A/B testing functionality
 */
export function useABTesting(
  options: UseABTestingOptions = {},
): UseABTestingResult {
  const { experimentId = 'claude_skills_performance', autoTrack = true } =
    options;
  const { user, userProfile } = useAuth();

  const [variantId, setVariantId] = useState<string | null>(null);
  const [isInExperiment, setIsInExperiment] = useState(false);
  const [claudeSkillsEnabled, setClaudeSkillsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const assignUser = useCallback(async () => {
    if (!user || !userProfile) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const userContext: UserContext = {
        userId: user.id,
        gradeLevel: userProfile.preferred_grade_level,
        totalXp: userProfile.total_xp || 0,
      };

      // Get or assign user to experiment
      const assignment = await abTestingService.assignUserToExperiment(
        user.id,
        experimentId,
        userContext,
      );

      if (assignment) {
        setVariantId(assignment.variantId);
        setIsInExperiment(true);

        // Check if Claude Skills should be enabled
        const enabled = await abTestingService.shouldEnableClaudeSkills(
          user.id,
          experimentId,
          userContext,
        );
        setClaudeSkillsEnabled(enabled);

        // Auto-track assignment if enabled
        if (autoTrack) {
          await abTestingService.trackConversion(
            user.id,
            experimentId,
            'experiment_assigned',
            { variantId: assignment.variantId },
          );
        }
      } else {
        setIsInExperiment(false);
        setClaudeSkillsEnabled(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      console.error('Error assigning user to experiment:', err);
    } finally {
      setLoading(false);
    }
  }, [user, userProfile, experimentId, autoTrack]);

  useEffect(() => {
    assignUser();
  }, [assignUser]);

  const trackMetric = useCallback(
    async (metricName: string, metricValue: number) => {
      if (!user || !isInExperiment) {
        return;
      }

      try {
        await abTestingService.trackMetric(
          user.id,
          experimentId,
          metricName,
          metricValue,
        );
      } catch (err) {
        console.error('Error tracking metric:', err);
      }
    },
    [user, experimentId, isInExperiment],
  );

  const trackConversion = useCallback(
    async (conversionType: string) => {
      if (!user || !isInExperiment) {
        return;
      }

      try {
        await abTestingService.trackConversion(
          user.id,
          experimentId,
          conversionType,
        );
      } catch (err) {
        console.error('Error tracking conversion:', err);
      }
    },
    [user, experimentId, isInExperiment],
  );

  return {
    variantId,
    isInExperiment,
    claudeSkillsEnabled,
    loading,
    error,
    trackMetric,
    trackConversion,
  };
}

/**
 * Hook for viewing experiment results
 */
export function useExperimentResults(experimentId: string) {
  const [results, setResults] = useState<ExperimentResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refreshResults = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const experimentResults = await abTestingService.getExperimentResults(
        experimentId,
      );
      setResults(experimentResults);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [experimentId]);

  useEffect(() => {
    refreshResults();
  }, [refreshResults]);

  return {
    results,
    loading,
    error,
    refreshResults,
  };
}
