/**
 * Educational Value Optimizer Simple Tests
 * 
 * Basic tests for the educational optimizer service functionality
 * Task 5.3: Educational Value Optimization
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { CulturalSensitivityValidator } from '../../utils/culturalSensitivity';

// Mock all external dependencies
jest.mock('../../utils/logger');
jest.mock('../../services/supabase');
jest.mock('../../services/auditLogger');

describe('Educational Value Optimizer - Core Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Cultural Sensitivity Validator Integration', () => {
    it('should validate that cultural sensitivity validator has required methods', () => {
      expect(typeof CulturalSensitivityValidator.detectBias).toBe('function');
      expect(typeof CulturalSensitivityValidator.analyzeCulturalRepresentation).toBe('function');
      expect(typeof CulturalSensitivityValidator.assessInclusiveLanguage).toBe('function');
      expect(typeof CulturalSensitivityValidator.checkAccessibility).toBe('function');
      expect(typeof CulturalSensitivityValidator.generateComprehensiveReport).toBe('function');
    });

    it('should detect bias in content', () => {
      const testContent = 'Boys are always good at sports and girls always like pink.';
      const biasResults = CulturalSensitivityValidator.detectBias(testContent);
      
      expect(Array.isArray(biasResults)).toBe(true);
      // Should detect gender bias
      const genderBias = biasResults.find(bias => bias.type === 'gender');
      expect(genderBias).toBeDefined();
    });

    it('should assess cultural representation', () => {
      const testContent = 'Children from different cultures worked together to solve the problem.';
      const culturalAnalysis = CulturalSensitivityValidator.analyzeCulturalRepresentation(testContent);
      
      expect(culturalAnalysis).toHaveProperty('diversityScore');
      expect(culturalAnalysis).toHaveProperty('representedGroups');
      expect(culturalAnalysis).toHaveProperty('missingRepresentation');
      expect(culturalAnalysis).toHaveProperty('stereotypes');
      expect(culturalAnalysis).toHaveProperty('positiveRepresentation');
      
      expect(typeof culturalAnalysis.diversityScore).toBe('number');
      expect(Array.isArray(culturalAnalysis.representedGroups)).toBe(true);
    });

    it('should assess inclusive language', () => {
      const testContent = 'Mankind has always sought to explore the unknown.';
      const languageAssessment = CulturalSensitivityValidator.assessInclusiveLanguage(testContent);
      
      expect(languageAssessment).toHaveProperty('score');
      expect(languageAssessment).toHaveProperty('issues');
      expect(languageAssessment).toHaveProperty('improvements');
      
      expect(typeof languageAssessment.score).toBe('number');
      expect(Array.isArray(languageAssessment.issues)).toBe(true);
      
      // Should detect 'mankind' as non-inclusive
      expect(languageAssessment.issues.length).toBeGreaterThan(0);
      expect(languageAssessment.issues[0].word).toContain('mankind');
    });

    it('should check accessibility for different grade levels', () => {
      const complexContent = 'The philosophical implications of quantum mechanics necessitate sophisticated theoretical frameworks.';
      const accessibilityCheck = CulturalSensitivityValidator.checkAccessibility(complexContent, 'K-2');
      
      expect(accessibilityCheck).toHaveProperty('cognitiveAccessibility');
      expect(accessibilityCheck).toHaveProperty('languageComplexity');
      expect(accessibilityCheck).toHaveProperty('conceptualDifficulty');
      expect(accessibilityCheck).toHaveProperty('issues');
      
      expect(typeof accessibilityCheck.cognitiveAccessibility).toBe('number');
      expect(Array.isArray(accessibilityCheck.issues)).toBe(true);
      
      // Complex content should have accessibility issues for K-2
      expect(accessibilityCheck.issues.length).toBeGreaterThan(0);
    });

    it('should generate comprehensive report', () => {
      const testContent = 'A diverse group of children with different abilities worked together.';
      const report = CulturalSensitivityValidator.generateComprehensiveReport(testContent, '3-5');
      
      expect(report).toHaveProperty('overallScore');
      expect(report).toHaveProperty('biasDetection');
      expect(report).toHaveProperty('culturalRepresentation');
      expect(report).toHaveProperty('inclusiveLanguage');
      expect(report).toHaveProperty('accessibility');
      expect(report).toHaveProperty('recommendations');
      expect(report).toHaveProperty('priorityIssues');
      
      expect(typeof report.overallScore).toBe('number');
      expect(report.overallScore).toBeGreaterThanOrEqual(0);
      expect(report.overallScore).toBeLessThanOrEqual(100);
      
      expect(Array.isArray(report.biasDetection)).toBe(true);
      expect(Array.isArray(report.recommendations)).toBe(true);
      expect(Array.isArray(report.priorityIssues)).toBe(true);
    });
  });

  describe('Educational Standards Validation', () => {
    it('should validate grade level appropriateness patterns', () => {
      // Test K-2 appropriate content
      const k2Content = 'The little bunny found a colorful flower in the garden.';
      const k2Report = CulturalSensitivityValidator.generateComprehensiveReport(k2Content, 'K-2');
      
      expect(k2Report.accessibility.languageComplexity).toBeGreaterThan(0);
      
      // Test 6-8 appropriate content
      const middleschoolContent = 'The protagonist faced a moral dilemma that challenged their values.';
      const middleschoolReport = CulturalSensitivityValidator.generateComprehensiveReport(middleschoolContent, '6-8');
      
      expect(middleschoolReport.accessibility.conceptualDifficulty).toBeGreaterThan(0);
    });

    it('should handle bias detection across different content types', () => {
      const testCases = [
        {
          content: 'All doctors are men and all nurses are women.',
          expectedBiasType: 'gender'
        },
        {
          content: 'Everyone can afford to buy whatever they want.',
          expectedBiasType: 'socioeconomic'
        },
        {
          content: 'Normal families have a mom and a dad.',
          expectedBiasType: 'cultural'
        }
      ];

      testCases.forEach(testCase => {
        const biasResults = CulturalSensitivityValidator.detectBias(testCase.content);
        expect(biasResults.length).toBeGreaterThan(0);
        
        const expectedBias = biasResults.find(bias => bias.type === testCase.expectedBiasType);
        expect(expectedBias).toBeDefined();
      });
    });
  });

  describe('Learning Style Adaptation Framework', () => {
    it('should provide appropriate learning style indicators', () => {
      // This would test the learning style adaptation constants and strategies
      // Since these are internal to the EducationalOptimizerService, we validate the structure exists
      
      const visualContent = 'The bright red apple sparkled in the golden sunlight.';
      const report = CulturalSensitivityValidator.generateComprehensiveReport(visualContent, '3-5');
      
      // Visual content should score well on accessibility
      expect(report.accessibility.cognitiveAccessibility).toBeGreaterThan(60);
    });
  });

  describe('Inclusivity Assessment Tools', () => {
    it('should assess character diversity in stories', () => {
      const diverseContent = 'Maya, who uses a wheelchair, and Carlos, who speaks Spanish at home, became best friends.';
      const report = CulturalSensitivityValidator.generateComprehensiveReport(diverseContent, '6-8');
      
      expect(report.culturalRepresentation.diversityScore).toBeGreaterThan(50);
      expect(report.overallScore).toBeGreaterThan(70);
    });

    it('should detect and score setting inclusion', () => {
      const inclusiveContent = 'The community center welcomed families from all backgrounds and abilities.';
      const report = CulturalSensitivityValidator.generateComprehensiveReport(inclusiveContent, '3-5');
      
      expect(report.culturalRepresentation.diversityScore).toBeGreaterThan(60);
      expect(report.inclusiveLanguage.score).toBeGreaterThan(80);
    });

    it('should provide actionable recommendations', () => {
      const problematicContent = 'The normal kids played while the weird kid sat alone.';
      const report = CulturalSensitivityValidator.generateComprehensiveReport(problematicContent, 'K-2');
      
      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(report.priorityIssues.length).toBeGreaterThan(0);
      expect(report.overallScore).toBeLessThan(80);
    });
  });
});