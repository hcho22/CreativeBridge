/**
 * A/B Testing Integration Tests
 *
 * Integration tests for Task 1.4: A/B Testing Framework
 */

import { abTestingService } from '../../services/abTesting';
import { claudeSkillsMonitor } from '../../services/claudeSkillsMonitor';
import { UserContext } from '../../services/featureFlags';

describe('A/B Testing Integration', () => {
  const mockUserContext: UserContext = {
    userId: 'integration_user_123',
    gradeLevel: 'K-2',
    totalXp: 2000,
  };

  beforeEach(async () => {
    // Reset monitor
    await claudeSkillsMonitor.resetMetrics();
  });

  describe('Claude Skills Integration', () => {
    test('A/B test controls Claude Skills usage', async () => {
      const experimentId = 'claude_skills_performance';
      await abTestingService.setExperimentEnabled(experimentId, true);

      // Assign user
      const assignment = await abTestingService.assignUserToExperiment(
        mockUserContext.userId,
        experimentId,
        mockUserContext,
      );

      expect(assignment).toBeDefined();

      // Check if Claude Skills should be enabled
      const shouldEnable = await abTestingService.shouldEnableClaudeSkills(
        mockUserContext.userId,
        experimentId,
        mockUserContext,
      );

      // Should be boolean (true for treatment, false for control)
      expect(typeof shouldEnable).toBe('boolean');
    });

    test('Metrics tracked when Claude Skills used', async () => {
      const experimentId = 'claude_skills_performance';
      await abTestingService.setExperimentEnabled(experimentId, true);

      await abTestingService.assignUserToExperiment(
        mockUserContext.userId,
        experimentId,
        mockUserContext,
      );

      // Simulate skill execution and track metrics
      const executionId = 'integration_exec';
      const skillType = 'ContentPredictionSkill';
      const skillId = 'test_skill';

      claudeSkillsMonitor.trackExecutionStart(
        executionId,
        skillType,
        skillId,
        mockUserContext.userId,
      );

      const result = {
        success: true,
        data: {},
        executionTimeMs: 250,
        skillType,
      };

      await claudeSkillsMonitor.trackExecutionComplete(
        executionId,
        result,
        skillId,
        mockUserContext.userId,
      );

      // Track metric in A/B test
      await abTestingService.trackMetric(
        mockUserContext.userId,
        experimentId,
        'averageResponseTime',
        250,
      );

      // Verify metrics are tracked
      const metrics = claudeSkillsMonitor.getCurrentMetrics();
      expect(metrics.totalExecutions).toBeGreaterThan(0);
    });
  });

  describe('Feature Flag Integration', () => {
    test('Feature flags work with A/B testing', async () => {
      const experimentId = 'claude_skills_performance';
      await abTestingService.setExperimentEnabled(experimentId, true);

      // Assign user to experiment
      await abTestingService.assignUserToExperiment(
        mockUserContext.userId,
        experimentId,
        mockUserContext,
      );

      // Check feature flag (should respect A/B test)
      const variantId = await abTestingService.getUserVariant(
        mockUserContext.userId,
        experimentId,
        mockUserContext,
      );

      expect(variantId).toBeDefined();
      expect(['control', 'treatment']).toContain(variantId);
    });
  });

  describe('Cross-Session Persistence', () => {
    test('A/B tests work across app sessions', async () => {
      const experimentId = 'claude_skills_performance';
      await abTestingService.setExperimentEnabled(experimentId, true);

      // First session
      const assignment1 = await abTestingService.assignUserToExperiment(
        mockUserContext.userId,
        experimentId,
        mockUserContext,
      );

      // Simulate app restart - get variant again
      const variantId = await abTestingService.getUserVariant(
        mockUserContext.userId,
        experimentId,
        mockUserContext,
      );

      // Should be same variant
      expect(variantId).toBe(assignment1?.variantId);
    });
  });

  describe('Statistical Analysis Integration', () => {
    test('Results include statistical significance', async () => {
      const experimentId = 'claude_skills_performance';
      await abTestingService.setExperimentEnabled(experimentId, true);

      // Create test data
      const users = Array.from({ length: 50 }, (_, i) => `stat_user_${i}`);

      for (const userId of users) {
        await abTestingService.assignUserToExperiment(userId, experimentId, {
          userId,
        });

        // Track metrics
        await abTestingService.trackMetric(
          userId,
          experimentId,
          'successRate',
          Math.random() * 0.2 + 0.8, // Random between 0.8 and 1.0
        );
      }

      const results = await abTestingService.getExperimentResults(experimentId);

      expect(results).toBeDefined();
      expect(results?.statisticalSignificance).toBeDefined();
      expect(results?.statisticalSignificance.isSignificant).toBeDefined();
      expect(typeof results?.statisticalSignificance.pValue).toBe('number');
      expect(results?.statisticalSignificance.confidenceLevel).toBeGreaterThan(
        0,
      );
    });
  });

  describe('Reporting Integration', () => {
    test('Results export correctly to analytics system', async () => {
      const experimentId = 'claude_skills_performance';
      await abTestingService.setExperimentEnabled(experimentId, true);

      // Create sample data
      await abTestingService.assignUserToExperiment(
        mockUserContext.userId,
        experimentId,
        mockUserContext,
      );

      await abTestingService.trackMetric(
        mockUserContext.userId,
        experimentId,
        'successRate',
        0.9,
      );

      const results = await abTestingService.getExperimentResults(experimentId);

      expect(results).toBeDefined();
      expect(results?.variantResults.length).toBeGreaterThan(0);
      expect(results?.recommendation).toBeDefined();
    });

    test('Dashboard shows accurate test results', async () => {
      const experimentId = 'claude_skills_performance';
      await abTestingService.setExperimentEnabled(experimentId, true);

      // Create diverse test data
      const controlUsers = Array.from({ length: 30 }, (_, i) => `control_${i}`);
      const treatmentUsers = Array.from(
        { length: 30 },
        (_, i) => `treatment_${i}`,
      );

      // Note: In real implementation, assignment would be automatic
      // For testing, we'll just track metrics
      for (const userId of [...controlUsers, ...treatmentUsers]) {
        await abTestingService.assignUserToExperiment(userId, experimentId, {
          userId,
        });

        await abTestingService.trackMetric(
          userId,
          experimentId,
          'successRate',
          Math.random() * 0.3 + 0.7,
        );
      }

      const results = await abTestingService.getExperimentResults(experimentId);

      expect(results).toBeDefined();
      expect(results?.sampleSize).toBeGreaterThan(0);
      expect(results?.duration).toBeGreaterThanOrEqual(0);
      expect(results?.lastUpdated).toBeInstanceOf(Date);
    });
  });
});
