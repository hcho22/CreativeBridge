/**
 * Claude-Powered Quality Assessment Tests
 *
 * Tests for the comprehensive content quality assessment system
 * Task 5.1: Claude-Powered Quality Assessment
 */

import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';
import {
  ContentQualityService,
  QualityAssessmentResult,
} from '../../services/contentQuality';
import { StoryRequest, StoryResponse } from '../../types/story';
import { SkillManager } from '../../types/claudeSkills';

jest.mock('../../utils/logger');

describe('Claude-Powered Quality Assessment', () => {
  let mockSkillManager: jest.Mocked<SkillManager>;
  let qualityService: ContentQualityService;

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

    qualityService = new ContentQualityService(mockSkillManager);
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('Comprehensive Quality Assessment', () => {
    it('should assess content quality considering full context', async () => {
      // Mock successful Claude quality assessment
      mockSkillManager.executeSkill.mockResolvedValue({
        success: true,
        data: {
          overallScore: 88,
          educationalValue: 85,
          narrativeCoherence: 90,
          gradeAppropriateness: 92,
          engagementPotential: 85,
          culturalSensitivity: 95,
          vocabularyComplexity: 80,
          contentSafety: 100,
          issues: [],
          recommendations: ['Enhance character development'],
          improvements: ['Add more sensory details'],
        },
        confidence: 0.9,
        executionTimeMs: 150,
        skillType: 'ComprehensiveQualityAssessmentSkill',
      });

      const story: StoryResponse = {
        story:
          'Once upon a time, there was a curious little girl named Maya who loved to explore the colorful garden behind her house.',
        gradeLevel: 'K-2',
        isPersonalized: false,
        confidence: 0.8,
      };

      const request: StoryRequest = {
        gradeLevel: 'K-2',
        userInput: 'Tell me a story about a garden',
      };

      const result = await qualityService.assessContent(story, request);

      expect(result.passed).toBe(true);
      expect(result.metrics.overallScore).toBe(88);
      expect(result.metrics.educationalValue).toBe(85);
      expect(result.metrics.narrativeCoherence).toBe(90);
      expect(result.confidence).toBe(0.9);
      expect(result.recommendations).toContain('Enhance character development');
      expect(result.improvementSuggestions).toContain(
        'Add more sensory details',
      );

      // Verify skill was called with correct parameters
      expect(mockSkillManager.executeSkill).toHaveBeenCalledWith(
        'ComprehensiveQualityAssessmentSkill',
        expect.objectContaining({
          content: story.story,
          gradeLevel: 'K-2',
          userInput: request.userInput,
          assessmentDimensions: expect.arrayContaining([
            'educational_value',
            'narrative_coherence',
            'grade_appropriateness',
            'engagement_potential',
            'cultural_sensitivity',
            'vocabulary_complexity',
            'content_safety',
          ]),
        }),
      );
    });

    it('should identify quality issues and provide specific recommendations', async () => {
      // Mock assessment with quality issues
      mockSkillManager.executeSkill.mockResolvedValue({
        success: true,
        data: {
          overallScore: 65,
          educationalValue: 60,
          narrativeCoherence: 70,
          gradeAppropriateness: 50,
          engagementPotential: 75,
          culturalSensitivity: 80,
          vocabularyComplexity: 85,
          contentSafety: 95,
          issues: [
            {
              type: 'appropriateness',
              severity: 'high',
              description: 'Vocabulary too complex for K-2 grade level',
              suggestion: 'Use simpler words appropriate for young readers',
            },
            {
              type: 'educational',
              severity: 'medium',
              description: 'Limited educational value',
              suggestion: 'Include learning opportunities or teachable moments',
            },
          ],
          recommendations: [
            'Simplify vocabulary for target grade level',
            'Add educational elements to the story',
          ],
          improvements: [
            'Use shorter sentences',
            'Include counting or color recognition',
          ],
        },
        confidence: 0.8,
        executionTimeMs: 200,
        skillType: 'ComprehensiveQualityAssessmentSkill',
      });

      const story: StoryResponse = {
        story:
          'The protagonist embarked upon an extraordinary expedition through the magnificent botanical sanctuary.',
        gradeLevel: 'K-2',
        isPersonalized: false,
        confidence: 0.7,
      };

      const request: StoryRequest = {
        gradeLevel: 'K-2',
        userInput: 'Garden adventure',
      };

      const result = await qualityService.assessContent(story, request);

      expect(result.passed).toBe(false); // Below threshold due to appropriateness issues
      expect(result.metrics.overallScore).toBe(65);
      expect(result.issues).toHaveLength(2);

      const appropriatenessIssue = result.issues.find(
        issue => issue.type === 'appropriateness',
      );
      expect(appropriatenessIssue).toBeDefined();
      expect(appropriatenessIssue?.severity).toBe('high');
      expect(appropriatenessIssue?.description).toContain(
        'Vocabulary too complex',
      );

      const educationalIssue = result.issues.find(
        issue => issue.type === 'educational',
      );
      expect(educationalIssue).toBeDefined();
      expect(educationalIssue?.severity).toBe('medium');
      expect(educationalIssue?.suggestion).toContain('learning opportunities');
    });

    it('should handle skill execution failures gracefully', async () => {
      // Mock skill execution failure
      mockSkillManager.executeSkill.mockResolvedValue({
        success: false,
        error: 'Quality assessment skill temporarily unavailable',
        executionTimeMs: 100,
        skillType: 'ComprehensiveQualityAssessmentSkill',
      });

      const story: StoryResponse = {
        story: 'A simple story for testing fallback behavior.',
        gradeLevel: '3-5',
        isPersonalized: false,
        confidence: 0.8,
      };

      const request: StoryRequest = {
        gradeLevel: '3-5',
        userInput: 'Simple test story',
      };

      const result = await qualityService.assessContent(story, request);

      // Should provide fallback assessment
      expect(result.passed).toBe(true); // Fallback is more permissive
      expect(result.confidence).toBe(0.6); // Lower confidence for fallback
      expect(result.recommendations).toContain(
        'Review content manually for quality assurance',
      );
      expect(result.improvementSuggestions).toContain(
        'Consider manual review due to assessment system limitations',
      );
    });
  });

  describe('Grade-Level Appropriateness Assessment', () => {
    it('should accurately assess grade-level appropriateness with high confidence', async () => {
      // Mock grade-level assessment skill
      mockSkillManager.executeSkill.mockResolvedValue({
        success: true,
        data: {
          appropriateness: 0.95,
          adjustments: [],
        },
        confidence: 0.92,
        executionTimeMs: 120,
        skillType: 'GradeLevelAssessmentSkill',
      });

      const story: StoryResponse = {
        story:
          'The little cat found a red ball in the yard. She played with it all day.',
        gradeLevel: 'K-2',
        isPersonalized: false,
        confidence: 0.9,
      };

      const result = await qualityService.assessGradeLevelAppropriateness(
        story,
        'K-2',
      );

      expect(result.appropriate).toBe(true);
      expect(result.confidence).toBe(0.92);
      expect(result.suggestedAdjustments).toHaveLength(0);

      expect(mockSkillManager.executeSkill).toHaveBeenCalledWith(
        'GradeLevelAssessmentSkill',
        expect.objectContaining({
          content: story.story,
          targetGradeLevel: 'K-2',
          assessmentCriteria: expect.arrayContaining([
            'vocabulary_complexity',
            'sentence_structure',
            'concept_difficulty',
            'content_maturity',
            'reading_level',
          ]),
        }),
      );
    });

    it('should suggest adjustments for inappropriate grade level content', async () => {
      // Mock assessment with appropriateness issues
      mockSkillManager.executeSkill.mockResolvedValue({
        success: true,
        data: {
          appropriateness: 0.65,
          adjustments: [
            'Replace complex words with simpler alternatives',
            'Shorten sentence length',
            'Remove abstract concepts',
          ],
        },
        confidence: 0.85,
        executionTimeMs: 140,
        skillType: 'GradeLevelAssessmentSkill',
      });

      const story: StoryResponse = {
        story:
          'The protagonist contemplated the philosophical implications of their extraordinary discovery.',
        gradeLevel: 'K-2',
        isPersonalized: false,
        confidence: 0.8,
      };

      const result = await qualityService.assessGradeLevelAppropriateness(
        story,
        'K-2',
      );

      expect(result.appropriate).toBe(false); // Below 0.9 threshold
      expect(result.confidence).toBe(0.85);
      expect(result.suggestedAdjustments).toHaveLength(3);
      expect(result.suggestedAdjustments).toContain(
        'Replace complex words with simpler alternatives',
      );
      expect(result.suggestedAdjustments).toContain('Shorten sentence length');
      expect(result.suggestedAdjustments).toContain('Remove abstract concepts');
    });

    it('should provide fallback assessment when skill fails', async () => {
      // Mock skill failure
      mockSkillManager.executeSkill.mockRejectedValue(
        new Error('Network timeout'),
      );

      const story: StoryResponse = {
        story: 'The cat sat on the mat. It was a sunny day.',
        gradeLevel: 'K-2',
        isPersonalized: false,
        confidence: 0.8,
      };

      const result = await qualityService.assessGradeLevelAppropriateness(
        story,
        'K-2',
      );

      // Should provide fallback based on simple heuristics
      expect(result.appropriate).toBe(true); // Simple sentences should pass
      expect(result.confidence).toBe(0.7); // Lower confidence for fallback
      expect(result.suggestedAdjustments).toEqual([]);
    });
  });

  describe('Narrative Coherence Evaluation', () => {
    it('should evaluate narrative coherence and identify flow improvements', async () => {
      // Mock narrative coherence assessment
      mockSkillManager.executeSkill.mockResolvedValue({
        success: true,
        data: {
          coherenceScore: 0.88,
          issues: [
            'Transition between second and third paragraph could be smoother',
          ],
          improvements: [
            'Add transitional phrases between ideas',
            'Strengthen character motivation connections',
          ],
        },
        confidence: 0.87,
        executionTimeMs: 180,
        skillType: 'NarrativeCoherenceSkill',
      });

      const story: StoryResponse = {
        story:
          'Maya walked into the garden. She saw beautiful flowers everywhere. The flowers were red, yellow, and purple. Maya decided to pick some for her mom.',
        gradeLevel: '3-5',
        isPersonalized: false,
        confidence: 0.85,
      };

      const request: StoryRequest = {
        gradeLevel: '3-5',
        userInput: 'Story about flowers',
      };

      const result = await qualityService.evaluateNarrativeCoherence(
        story,
        request,
      );

      expect(result.coherenceScore).toBe(88); // Converted to 0-100 scale
      expect(result.flowIssues).toHaveLength(1);
      expect(result.flowIssues[0]).toContain(
        'Transition between second and third paragraph',
      );
      expect(result.improvements).toHaveLength(2);
      expect(result.improvements).toContain(
        'Add transitional phrases between ideas',
      );

      expect(mockSkillManager.executeSkill).toHaveBeenCalledWith(
        'NarrativeCoherenceSkill',
        expect.objectContaining({
          content: story.story,
          gradeLevel: '3-5',
          evaluationAspects: expect.arrayContaining([
            'character_consistency',
            'plot_progression',
            'setting_continuity',
            'cause_effect_relationships',
            'resolution_quality',
          ]),
        }),
      );
    });

    it('should provide fallback coherence assessment when skill unavailable', async () => {
      // Mock skill failure
      mockSkillManager.executeSkill.mockResolvedValue({
        success: false,
        error: 'Service temporarily unavailable',
        executionTimeMs: 50,
        skillType: 'NarrativeCoherenceSkill',
      });

      const story: StoryResponse = {
        story: 'Simple story with basic narrative structure.',
        gradeLevel: '3-5',
        isPersonalized: false,
        confidence: 0.8,
      };

      const request: StoryRequest = {
        gradeLevel: '3-5',
        userInput: 'Test story',
      };

      const result = await qualityService.evaluateNarrativeCoherence(
        story,
        request,
      );

      // Should provide conservative fallback assessment
      expect(result.coherenceScore).toBe(80);
      expect(result.flowIssues).toEqual([]);
      expect(result.improvements).toEqual([]);
    });
  });

  describe('Contextual Content Validation', () => {
    it('should validate content consistency with context', async () => {
      // Mock contextual validation skill
      mockSkillManager.executeSkill.mockResolvedValue({
        success: true,
        data: {
          contextConsistency: 0.92,
          inconsistencies: [],
        },
        confidence: 0.89,
        executionTimeMs: 110,
        skillType: 'ContentValidationSkill',
      });

      const story: StoryResponse = {
        story:
          'Maya continued exploring the garden, finding more colorful flowers just as she had hoped.',
        gradeLevel: 'K-2',
        isPersonalized: false,
        confidence: 0.8,
      };

      const request: StoryRequest = {
        gradeLevel: 'K-2',
        userInput: 'Continue exploring',
      };

      const previousContext = {
        setting: 'garden',
        character: 'Maya',
        theme: 'exploration',
      };

      const result = await qualityService.validateContextualContent(
        story,
        request,
        previousContext,
      );

      expect(result.valid).toBe(true);
      expect(result.contextConsistency).toBe(0.92);
      expect(result.issues).toEqual([]);

      expect(mockSkillManager.executeSkill).toHaveBeenCalledWith(
        'ContentValidationSkill',
        expect.objectContaining({
          content: story.story,
          request,
          previousContext,
          validationType: 'contextual',
        }),
      );
    });

    it('should identify context inconsistencies', async () => {
      // Mock validation with inconsistencies
      mockSkillManager.executeSkill.mockResolvedValue({
        success: true,
        data: {
          contextConsistency: 0.45,
          inconsistencies: [
            'Character name changed from Maya to Sarah',
            'Setting shifted from garden to beach without explanation',
          ],
        },
        confidence: 0.78,
        executionTimeMs: 130,
        skillType: 'ContentValidationSkill',
      });

      const story: StoryResponse = {
        story:
          'Sarah ran along the sandy beach, collecting seashells in the warm sunshine.',
        gradeLevel: 'K-2',
        isPersonalized: false,
        confidence: 0.8,
      };

      const request: StoryRequest = {
        gradeLevel: 'K-2',
        userInput: 'Keep exploring',
      };

      const result = await qualityService.validateContextualContent(
        story,
        request,
      );

      expect(result.valid).toBe(false); // Below 0.8 threshold
      expect(result.contextConsistency).toBe(0.45);
      expect(result.issues).toHaveLength(2);
      expect(result.issues).toContain(
        'Character name changed from Maya to Sarah',
      );
      expect(result.issues).toContain(
        'Setting shifted from garden to beach without explanation',
      );
    });
  });

  describe('Quality Metrics and Monitoring', () => {
    it('should track quality metrics for monitoring', () => {
      // Initially no metrics
      const initialMetrics = qualityService.getQualityMetrics();
      expect(initialMetrics.assessmentCount).toBe(0);
      expect(initialMetrics.averageQualityScore).toBe(0);
      expect(initialMetrics.passRate).toBe(0);

      // Simulate some cached assessments by manually adding to cache
      const mockAssessments: QualityAssessmentResult[] = [
        {
          metrics: {
            overallScore: 85,
            educationalValue: 80,
            narrativeCoherence: 85,
            gradeAppropriatenesss: 90,
            engagementPotential: 80,
            culturalSensitivity: 90,
            vocabularyComplexity: 80,
            contentSafety: 95,
          },
          passed: true,
          confidence: 0.9,
          recommendations: [],
          issues: [
            {
              type: 'vocabulary',
              severity: 'low',
              description: 'Minor complexity issue',
              suggestion: 'Simplify one word',
            },
          ],
          improvementSuggestions: [],
        },
        {
          metrics: {
            overallScore: 75,
            educationalValue: 70,
            narrativeCoherence: 75,
            gradeAppropriatenesss: 80,
            engagementPotential: 75,
            culturalSensitivity: 85,
            vocabularyComplexity: 70,
            contentSafety: 90,
          },
          passed: false,
          confidence: 0.8,
          recommendations: [],
          issues: [
            {
              type: 'educational',
              severity: 'medium',
              description: 'Limited educational value',
              suggestion: 'Add learning elements',
            },
          ],
          improvementSuggestions: [],
        },
      ];

      // Add to cache using private method access
      (qualityService as any).assessmentCache.set('test1', mockAssessments[0]);
      (qualityService as any).assessmentCache.set('test2', mockAssessments[1]);

      const metrics = qualityService.getQualityMetrics();
      expect(metrics.assessmentCount).toBe(2);
      expect(metrics.averageQualityScore).toBe(80); // (85 + 75) / 2
      expect(metrics.passRate).toBe(0.5); // 1 out of 2 passed
      expect(metrics.commonIssues).toHaveLength(2);
      expect(metrics.commonIssues[0].type).toBe('vocabulary');
      expect(metrics.commonIssues[1].type).toBe('educational');
    });

    it('should cache assessment results to improve performance', async () => {
      // Mock successful assessment
      mockSkillManager.executeSkill.mockResolvedValue({
        success: true,
        data: {
          overallScore: 90,
          educationalValue: 88,
          narrativeCoherence: 92,
          gradeAppropriateness: 90,
          engagementPotential: 85,
          culturalSensitivity: 95,
          vocabularyComplexity: 85,
          contentSafety: 100,
          issues: [],
          recommendations: [],
          improvements: [],
        },
        confidence: 0.92,
        executionTimeMs: 150,
        skillType: 'ComprehensiveQualityAssessmentSkill',
      });

      const story: StoryResponse = {
        story: 'A wonderful story about friendship and adventure.',
        gradeLevel: '3-5',
        isPersonalized: false,
        confidence: 0.9,
      };

      const request: StoryRequest = {
        gradeLevel: '3-5',
        userInput: 'Adventure story',
      };

      // First call should execute skill
      const result1 = await qualityService.assessContent(story, request);
      expect(mockSkillManager.executeSkill).toHaveBeenCalledTimes(1);
      expect(result1.metrics.overallScore).toBe(90);

      // Second call with same content should use cache
      const result2 = await qualityService.assessContent(story, request);
      expect(mockSkillManager.executeSkill).toHaveBeenCalledTimes(1); // No additional calls
      expect(result2.metrics.overallScore).toBe(90);
    });
  });
});
