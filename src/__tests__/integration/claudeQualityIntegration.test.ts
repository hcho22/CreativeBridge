/**
 * Claude Quality Assessment Integration Tests
 *
 * Integration tests for Claude-powered quality assessment with story agent
 * Task 5.1: Claude-Powered Quality Assessment Integration
 */

import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { storyAgentService } from '../../services/storyAgent';
import { contentQualityService } from '../../services/contentQuality';
import { StoryRequest, StoryResponse } from '../../types/story';
import { SkillManager } from '../../types/claudeSkills';

jest.mock('../../utils/logger');
jest.mock('../../services/storyGenerationService');

describe('Claude Quality Assessment Integration', () => {
  let mockSkillManager: jest.Mocked<SkillManager>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSkillManager = {
      initialize: jest.fn().mockResolvedValue(undefined),
      registerSkill: jest.fn(),
      executeSkill: jest.fn(),
      getSkillStatus: jest.fn().mockReturnValue('idle'),
      shutdown: jest.fn().mockResolvedValue(undefined),
      isInitialized: jest.fn().mockReturnValue(true),
    };

    // Initialize Claude quality assessment in story agent
    storyAgentService.initializeClaudeQuality(mockSkillManager);
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('End-to-End Quality Assessment Integration', () => {
    it('should integrate Claude quality assessment with story generation workflow', async () => {
      // Mock high-quality story generation
      const mockStoryGenerationService = require('../../services/storyGenerationService');
      mockStoryGenerationService.storyGenerationService.generateStory.mockResolvedValue(
        {
          story:
            'Maya discovered a beautiful garden filled with colorful flowers that seemed to dance in the gentle breeze.',
          success: true,
          gradeLevel: 'K-2',
          confidence: 0.9,
        },
      );

      // Mock excellent quality assessment
      mockSkillManager.executeSkill.mockResolvedValue({
        success: true,
        data: {
          overallScore: 92,
          educationalValue: 90,
          narrativeCoherence: 94,
          gradeAppropriateness: 95,
          engagementPotential: 88,
          culturalSensitivity: 95,
          vocabularyComplexity: 85,
          contentSafety: 100,
          issues: [],
          recommendations: ['Consider adding more sensory details'],
          improvements: ['Include sounds or smells from the garden'],
        },
        confidence: 0.93,
        executionTimeMs: 180,
        skillType: 'ComprehensiveQualityAssessmentSkill',
      });

      const request: StoryRequest = {
        gradeLevel: 'K-2',
        userInput: 'Tell me about a magical garden',
      };

      const result = await storyAgentService.continueStory(request);

      expect(result.success).toBe(true);
      expect(result.story).toContain('Maya discovered a beautiful garden');
      expect(mockSkillManager.executeSkill).toHaveBeenCalledWith(
        'ComprehensiveQualityAssessmentSkill',
        expect.objectContaining({
          content: expect.stringContaining('Maya discovered'),
          gradeLevel: 'K-2',
          userInput: 'Tell me about a magical garden',
        }),
      );
    });

    it('should handle quality assessment failures gracefully without blocking story generation', async () => {
      // Mock successful story generation
      const mockStoryGenerationService = require('../../services/storyGenerationService');
      mockStoryGenerationService.storyGenerationService.generateStory.mockResolvedValue(
        {
          story: 'A simple story about friendship and adventure.',
          success: true,
          gradeLevel: '3-5',
          confidence: 0.8,
        },
      );

      // Mock quality assessment failure
      mockSkillManager.executeSkill.mockRejectedValue(
        new Error('Quality assessment service unavailable'),
      );

      const request: StoryRequest = {
        gradeLevel: '3-5',
        userInput: 'Adventure with friends',
      };

      const result = await storyAgentService.continueStory(request);

      // Story generation should still succeed despite quality assessment failure
      expect(result.success).toBe(true);
      expect(result.story).toContain('A simple story about friendship');
    });

    it('should provide quality insights for story improvement', async () => {
      // Mock story with quality issues
      const mockStoryGenerationService = require('../../services/storyGenerationService');
      mockStoryGenerationService.storyGenerationService.generateStory.mockResolvedValue(
        {
          story:
            'The protagonist embarked upon an extraordinary expedition through magnificent botanical specimens.',
          success: true,
          gradeLevel: 'K-2',
          confidence: 0.7,
        },
      );

      // Mock quality assessment with issues
      mockSkillManager.executeSkill.mockResolvedValue({
        success: true,
        data: {
          overallScore: 68,
          educationalValue: 65,
          narrativeCoherence: 75,
          gradeAppropriateness: 45, // Too complex for K-2
          engagementPotential: 70,
          culturalSensitivity: 90,
          vocabularyComplexity: 90, // Too complex
          contentSafety: 95,
          issues: [
            {
              type: 'appropriateness',
              severity: 'high',
              description: 'Vocabulary too advanced for kindergarten students',
              suggestion:
                'Use simpler words like "walked", "garden", and "flowers"',
            },
            {
              type: 'vocabulary',
              severity: 'medium',
              description: 'Complex sentence structure',
              suggestion: 'Break into shorter, simpler sentences',
            },
          ],
          recommendations: [
            'Simplify vocabulary for target age group',
            'Use shorter sentence structures',
            'Include more concrete, visual descriptions',
          ],
          improvements: [
            'Replace "protagonist" with "little girl" or character name',
            'Replace "botanical specimens" with "flowers"',
            'Use simple past tense verbs',
          ],
        },
        confidence: 0.87,
        executionTimeMs: 210,
        skillType: 'ComprehensiveQualityAssessmentSkill',
      });

      const request: StoryRequest = {
        gradeLevel: 'K-2',
        userInput: 'Garden exploration',
      };

      const result = await storyAgentService.continueStory(request);

      expect(result.success).toBe(true);

      // Verify that quality assessment was performed and logged issues
      expect(mockSkillManager.executeSkill).toHaveBeenCalledWith(
        'ComprehensiveQualityAssessmentSkill',
        expect.objectContaining({
          gradeLevel: 'K-2',
        }),
      );
    });
  });

  describe('Grade-Level Appropriateness Integration', () => {
    it('should validate grade-level appropriateness across different levels', async () => {
      const testCases = [
        {
          gradeLevel: 'K-2' as const,
          story: 'The cat played with a red ball in the sunny yard.',
          expectedAppropriate: true,
          expectedScore: 0.95,
        },
        {
          gradeLevel: '3-5' as const,
          story:
            "Sarah discovered an ancient map hidden in her grandmother's attic, leading to an exciting treasure hunt.",
          expectedAppropriate: true,
          expectedScore: 0.88,
        },
        {
          gradeLevel: '6-8' as const,
          story:
            "The archaeological expedition revealed artifacts that challenged conventional understanding of the civilization's technological capabilities.",
          expectedAppropriate: true,
          expectedScore: 0.91,
        },
      ];

      for (const testCase of testCases) {
        // Mock grade-level assessment
        mockSkillManager.executeSkill.mockResolvedValue({
          success: true,
          data: {
            appropriateness: testCase.expectedScore,
            adjustments: testCase.expectedAppropriate
              ? []
              : ['Simplify vocabulary'],
          },
          confidence: 0.89,
          executionTimeMs: 140,
          skillType: 'GradeLevelAssessmentSkill',
        });

        const story: StoryResponse = {
          story: testCase.story,
          gradeLevel: testCase.gradeLevel,
          isPersonalized: false,
          confidence: 0.8,
        };

        const result =
          await contentQualityService.assessGradeLevelAppropriateness(
            story,
            testCase.gradeLevel,
          );

        expect(result.appropriate).toBe(testCase.expectedAppropriate);
        expect(result.confidence).toBeGreaterThan(0.8);

        if (!testCase.expectedAppropriate) {
          expect(result.suggestedAdjustments.length).toBeGreaterThan(0);
        }

        // Reset mock for next iteration
        mockSkillManager.executeSkill.mockClear();
      }
    });

    it('should provide actionable feedback for grade-level mismatches', async () => {
      // Test complex content for young grade level
      mockSkillManager.executeSkill.mockResolvedValue({
        success: true,
        data: {
          appropriateness: 0.35,
          adjustments: [
            'Replace "contemplated" with "thought about"',
            'Replace "philosophical implications" with "what it means"',
            'Break long sentences into shorter ones',
            'Remove abstract concepts like "existential questions"',
          ],
        },
        confidence: 0.92,
        executionTimeMs: 160,
        skillType: 'GradeLevelAssessmentSkill',
      });

      const story: StoryResponse = {
        story:
          'The young child contemplated the philosophical implications of their existential questions about the universe.',
        gradeLevel: 'K-2',
        isPersonalized: false,
        confidence: 0.8,
      };

      const result =
        await contentQualityService.assessGradeLevelAppropriateness(
          story,
          'K-2',
        );

      expect(result.appropriate).toBe(false);
      expect(result.suggestedAdjustments).toHaveLength(4);
      expect(result.suggestedAdjustments).toContain(
        'Replace "contemplated" with "thought about"',
      );
      expect(result.suggestedAdjustments).toContain(
        'Remove abstract concepts like "existential questions"',
      );
    });
  });

  describe('Narrative Coherence Integration', () => {
    it('should evaluate story flow and narrative consistency', async () => {
      // Mock coherence assessment
      mockSkillManager.executeSkill.mockResolvedValue({
        success: true,
        data: {
          coherenceScore: 0.86,
          issues: [
            'Character motivation could be clearer in paragraph 2',
            'Transition from scene 1 to scene 2 needs improvement',
          ],
          improvements: [
            'Add a sentence explaining why the character made that choice',
            'Include a transitional phrase like "Later that day" or "Meanwhile"',
            'Strengthen the cause-and-effect relationship between events',
          ],
        },
        confidence: 0.84,
        executionTimeMs: 195,
        skillType: 'NarrativeCoherenceSkill',
      });

      const story: StoryResponse = {
        story:
          'Emma walked to school. She saw a puppy. The puppy was lost. Emma helped the puppy find its way home. Her teacher was proud of her kindness.',
        gradeLevel: '3-5',
        isPersonalized: false,
        confidence: 0.8,
      };

      const request: StoryRequest = {
        gradeLevel: '3-5',
        userInput: 'Story about helping animals',
      };

      const result = await contentQualityService.evaluateNarrativeCoherence(
        story,
        request,
      );

      expect(result.coherenceScore).toBe(86);
      expect(result.flowIssues).toHaveLength(2);
      expect(result.improvements).toHaveLength(3);
      expect(result.flowIssues).toContain(
        'Character motivation could be clearer in paragraph 2',
      );
      expect(result.improvements).toContain(
        'Add a sentence explaining why the character made that choice',
      );
    });

    it('should handle different narrative complexity levels appropriately', async () => {
      const complexityTests = [
        {
          gradeLevel: 'K-2' as const,
          expectedCoherence: 0.82,
          focusAreas: [
            'simple_sequence',
            'clear_characters',
            'basic_resolution',
          ],
        },
        {
          gradeLevel: '3-5' as const,
          expectedCoherence: 0.78,
          focusAreas: [
            'character_development',
            'problem_solving',
            'cause_effect',
          ],
        },
        {
          gradeLevel: '6-8' as const,
          expectedCoherence: 0.85,
          focusAreas: [
            'complex_themes',
            'character_growth',
            'subplot_integration',
          ],
        },
      ];

      for (const test of complexityTests) {
        mockSkillManager.executeSkill.mockResolvedValue({
          success: true,
          data: {
            coherenceScore: test.expectedCoherence,
            issues: [],
            improvements: [],
          },
          confidence: 0.88,
          executionTimeMs: 170,
          skillType: 'NarrativeCoherenceSkill',
        });

        const story: StoryResponse = {
          story: `Sample story appropriate for ${test.gradeLevel}`,
          gradeLevel: test.gradeLevel,
          isPersonalized: false,
          confidence: 0.8,
        };

        const request: StoryRequest = {
          gradeLevel: test.gradeLevel,
          userInput: 'Test narrative',
        };

        const result = await contentQualityService.evaluateNarrativeCoherence(
          story,
          request,
        );

        expect(result.coherenceScore).toBe(test.expectedCoherence * 100);

        // Verify that skill was called with appropriate evaluation aspects
        expect(mockSkillManager.executeSkill).toHaveBeenCalledWith(
          'NarrativeCoherenceSkill',
          expect.objectContaining({
            gradeLevel: test.gradeLevel,
            evaluationAspects: expect.arrayContaining([
              'character_consistency',
              'plot_progression',
              'setting_continuity',
            ]),
          }),
        );

        mockSkillManager.executeSkill.mockClear();
      }
    });
  });

  describe('Quality Metrics Monitoring Integration', () => {
    it('should track quality trends across multiple assessments', async () => {
      const assessmentScenarios = [
        { score: 90, passed: true },
        { score: 85, passed: true },
        { score: 75, passed: false },
        { score: 88, passed: true },
        { score: 82, passed: true },
      ];

      // Run multiple assessments
      for (let i = 0; i < assessmentScenarios.length; i++) {
        const scenario = assessmentScenarios[i];

        mockSkillManager.executeSkill.mockResolvedValue({
          success: true,
          data: {
            overallScore: scenario.score,
            educationalValue: scenario.score - 5,
            narrativeCoherence: scenario.score + 2,
            gradeAppropriateness: scenario.score + 3,
            engagementPotential: scenario.score - 3,
            culturalSensitivity: 95,
            vocabularyComplexity: scenario.score,
            contentSafety: 100,
            issues: scenario.passed
              ? []
              : [
                  {
                    type: 'educational',
                    severity: 'medium',
                    description: 'Needs improvement',
                  },
                ],
            recommendations: [],
            improvements: [],
          },
          confidence: 0.85,
          executionTimeMs: 150,
          skillType: 'ComprehensiveQualityAssessmentSkill',
        });

        const story: StoryResponse = {
          story: `Test story ${i + 1}`,
          gradeLevel: '3-5',
          isPersonalized: false,
          confidence: 0.8,
        };

        const request: StoryRequest = {
          gradeLevel: '3-5',
          userInput: `Test input ${i + 1}`,
        };

        await contentQualityService.assessContent(story, request, false); // Disable cache for testing
        mockSkillManager.executeSkill.mockClear();
      }

      const metrics = contentQualityService.getQualityMetrics();

      expect(metrics.assessmentCount).toBe(5);
      expect(metrics.averageQualityScore).toBe(84); // (90+85+75+88+82)/5
      expect(metrics.passRate).toBe(0.8); // 4 out of 5 passed
      expect(metrics.commonIssues).toBeDefined();
    });

    it('should provide insights for quality improvement', async () => {
      // Mock assessment with specific improvement areas
      mockSkillManager.executeSkill.mockResolvedValue({
        success: true,
        data: {
          overallScore: 72,
          educationalValue: 65,
          narrativeCoherence: 70,
          gradeAppropriateness: 85,
          engagementPotential: 60,
          culturalSensitivity: 90,
          vocabularyComplexity: 80,
          contentSafety: 95,
          issues: [
            {
              type: 'educational',
              severity: 'high',
              description: 'Limited learning value',
              suggestion: 'Add educational elements',
            },
            {
              type: 'engagement',
              severity: 'medium',
              description: 'Could be more exciting',
              suggestion: 'Include adventure elements',
            },
          ],
          recommendations: [
            'Incorporate counting or alphabet elements for educational value',
            'Add more action and adventure to increase engagement',
            'Consider interactive elements that encourage participation',
          ],
          improvements: [
            'Include questions that prompt thinking',
            'Add descriptive language that engages the senses',
            'Create opportunities for problem-solving',
          ],
        },
        confidence: 0.81,
        executionTimeMs: 200,
        skillType: 'ComprehensiveQualityAssessmentSkill',
      });

      const story: StoryResponse = {
        story: 'A basic story without much educational content or engagement.',
        gradeLevel: 'K-2',
        isPersonalized: false,
        confidence: 0.7,
      };

      const request: StoryRequest = {
        gradeLevel: 'K-2',
        userInput: 'Simple story',
      };

      const result = await contentQualityService.assessContent(story, request);

      expect(result.passed).toBe(false);
      expect(result.issues).toHaveLength(2);
      expect(result.recommendations).toHaveLength(3);
      expect(result.improvementSuggestions).toHaveLength(3);

      // Verify specific improvement suggestions
      expect(result.recommendations).toContain(
        'Incorporate counting or alphabet elements for educational value',
      );
      expect(result.improvementSuggestions).toContain(
        'Include questions that prompt thinking',
      );
    });
  });
});
