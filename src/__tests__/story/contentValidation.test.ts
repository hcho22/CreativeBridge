// Content Validation Tests
// Comprehensive testing for inappropriate content detection

import { ContentValidator } from '../../services/contentValidator';
import { GradeLevel } from '../../types';

describe('Content Validation', () => {
  let validator: ContentValidator;

  beforeEach(() => {
    validator = new ContentValidator();
  });

  describe('Violence Detection', () => {
    it('should detect explicit violence for young readers', () => {
      const violentContent = [
        'The character was brutally attacked and killed.',
        'Blood splattered everywhere during the fight.',
        'He stabbed the enemy with a sharp knife.',
        'The explosion destroyed everything violently.',
      ];

      violentContent.forEach(content => {
        const result = validator.validateContent(content, 'K-2');
        expect(result.isValid).toBe(false);
        expect(result.flags).toContain('violence');
        expect(result.violenceScore).toBeGreaterThan(0.7);
      });
    });

    it('should allow mild conflict for appropriate ages', () => {
      const mildConflict = [
        'The characters had a disagreement about the plan.',
        'They competed in a friendly race.',
        'The knight faced the dragon bravely.',
        'The superhero stopped the villain peacefully.',
      ];

      mildConflict.forEach(content => {
        const result = validator.validateContent(content, '6-8');
        expect(result.isValid).toBe(true);
        expect(result.violenceScore).toBeLessThan(0.5);
      });
    });

    it('should have different thresholds for different grade levels', () => {
      const borderlineContent =
        'The warrior fought against the monster in an epic battle.';

      const k2Result = validator.validateContent(borderlineContent, 'K-2');
      const highSchoolResult = validator.validateContent(
        borderlineContent,
        '9-12',
      );

      expect(k2Result.isValid).toBe(false);
      expect(highSchoolResult.isValid).toBe(true);
    });
  });

  describe('Language Appropriateness', () => {
    it('should detect profanity and inappropriate language', () => {
      const inappropriateLanguage = [
        'This damn story is really bad.',
        'What the hell is going on here?',
        "That's bullshit and you know it.",
        'Stop being such an idiot.',
      ];

      inappropriateLanguage.forEach(content => {
        const result = validator.validateContent(content, 'K-2');
        expect(result.isValid).toBe(false);
        expect(result.flags).toContain('inappropriate-language');
      });
    });

    it('should detect mild profanity for younger grades', () => {
      const mildLanguage = [
        "That's stupid and dumb.",
        "You're being silly and annoying.",
        'This is crap quality work.',
      ];

      mildLanguage.forEach(content => {
        const k2Result = validator.validateContent(content, 'K-2');
        const olderResult = validator.validateContent(content, '6-8');

        expect(k2Result.isValid).toBe(false);
        expect(olderResult.isValid).toBe(true);
      });
    });

    it('should handle euphemisms and masked profanity', () => {
      const maskedProfanity = [
        'What the f*** is happening?',
        'This is bull****.',
        'D@mn this is hard.',
        'F-word this situation.',
      ];

      maskedProfanity.forEach(content => {
        const result = validator.validateContent(content, 'K-2');
        expect(result.isValid).toBe(false);
        expect(result.flags).toContain('inappropriate-language');
      });
    });
  });

  describe('Sexual Content Detection', () => {
    it('should detect inappropriate sexual content', () => {
      const sexualContent = [
        'They kissed passionately and went to bed together.',
        'The romantic scene became very intimate.',
        'Explicit descriptions of physical attraction.',
      ];

      sexualContent.forEach(content => {
        const result = validator.validateContent(content, 'K-2');
        expect(result.isValid).toBe(false);
        expect(result.flags).toContain('sexual-content');
      });
    });

    it('should allow age-appropriate romance', () => {
      const appropriateRomance = [
        'The prince and princess got married.',
        'They held hands and walked together.',
        'The couple shared a gentle kiss.',
      ];

      appropriateRomance.forEach(content => {
        const result = validator.validateContent(content, '6-8');
        expect(result.isValid).toBe(true);
      });
    });
  });

  describe('Scary Content Detection', () => {
    it('should detect content too scary for young children', () => {
      const scaryContent = [
        'The terrifying monster with sharp teeth lurked in the shadows.',
        'Ghosts and demons haunted the abandoned house.',
        'The nightmare gave her terrible visions of death.',
        'Blood-curdling screams echoed through the dark forest.',
      ];

      scaryContent.forEach(content => {
        const result = validator.validateContent(content, 'K-2');
        expect(result.isValid).toBe(false);
        expect(result.flags).toContain('scary-content');
      });
    });

    it('should allow mild spooky content for older kids', () => {
      const mildSpooky = [
        'The friendly ghost wanted to help.',
        'The mystery in the old house was intriguing.',
        'They heard strange noises but investigated bravely.',
      ];

      mildSpooky.forEach(content => {
        const result = validator.validateContent(content, '3-5');
        expect(result.isValid).toBe(true);
      });
    });
  });

  describe('Complexity and Vocabulary', () => {
    it('should detect overly complex vocabulary for grade level', () => {
      const complexContent = [
        'The protagonist exhibited extraordinary perspicacity in discerning the multifaceted ramifications.',
        'The ecclesiastical architecture demonstrated Byzantine influences.',
        'His perspicacious analysis revealed the underlying epistemological framework.',
      ];

      complexContent.forEach(content => {
        const result = validator.validateContent(content, 'K-2');
        expect(result.isValid).toBe(false);
        expect(result.flags).toContain('vocabulary-too-complex');
        expect(result.readabilityScore).toBeLessThan(0.3);
      });
    });

    it('should calculate appropriate readability scores', () => {
      const gradeContent = {
        'K-2': 'The cat ran fast. It was fun to see.',
        '3-5':
          'The adventure began when Sarah discovered the hidden treasure map.',
        '6-8':
          'The mysterious circumstances surrounding the ancient artifact puzzled the researchers.',
        '9-12':
          'The philosophical implications of quantum mechanics challenge our understanding of reality.',
      };

      Object.entries(gradeContent).forEach(([grade, content]) => {
        const result = validator.validateContent(content, grade as GradeLevel);
        expect(result.isValid).toBe(true);
        expect(result.readabilityScore).toBeGreaterThan(0.6);
      });
    });

    it('should suggest simpler alternatives for complex words', () => {
      const complexSentence =
        'The magnificent creature demonstrated extraordinary capabilities.';
      const result = validator.validateContent(complexSentence, 'K-2');

      expect(result.suggestions).toContain(
        'Use "amazing" instead of "magnificent"',
      );
      expect(result.suggestions).toContain(
        'Use "showed" instead of "demonstrated"',
      );
      expect(result.suggestions).toContain(
        'Use "abilities" instead of "capabilities"',
      );
    });
  });

  describe('Sentence Structure and Length', () => {
    it('should detect overly complex sentence structures', () => {
      const complexSentences = [
        'Although the weather was terrible, and despite the fact that everyone was tired, they decided to continue their journey through the dark forest, which was known to be dangerous, especially at night when the wild animals come out to hunt.',
        'The protagonist, who had been struggling with self-doubt for most of her life, finally realized that the key to success was not in trying to be perfect, but in accepting her flaws and working with them rather than against them.',
      ];

      complexSentences.forEach(content => {
        const result = validator.validateContent(content, 'K-2');
        expect(result.isValid).toBe(false);
        expect(result.flags).toContain('sentence-too-complex');
      });
    });

    it('should recommend appropriate sentence lengths by grade', () => {
      const longSentence =
        'The cat and the dog and the bird all played together in the big yard with lots of toys and had so much fun.';

      const k2Result = validator.validateContent(longSentence, 'K-2');
      const olderResult = validator.validateContent(longSentence, '6-8');

      expect(k2Result.suggestions).toContain('Break into shorter sentences');
      expect(olderResult.isValid).toBe(true);
    });
  });

  describe('Cultural Sensitivity', () => {
    it('should detect potentially offensive cultural references', () => {
      const insensitiveContent = [
        'The savage tribe attacked the civilized explorers.',
        'All people from that country are lazy and dishonest.',
        'The exotic foreigners had strange customs and beliefs.',
      ];

      insensitiveContent.forEach(content => {
        const result = validator.validateContent(content, '3-5');
        expect(result.isValid).toBe(false);
        expect(result.flags).toContain('cultural-insensitivity');
      });
    });

    it('should encourage inclusive language', () => {
      const exclusiveContent =
        'All the kids played, but the boys were stronger than the girls.';
      const result = validator.validateContent(exclusiveContent, 'K-2');

      expect(result.suggestions).toContain('Consider more inclusive language');
    });
  });

  describe('Educational Value Detection', () => {
    it('should recognize educational content', () => {
      const educationalContent = [
        'Sarah learned about photosynthesis and how plants make food from sunlight.',
        'The historical story taught them about ancient civilizations.',
        'Through the adventure, they discovered mathematical patterns in nature.',
      ];

      educationalContent.forEach(content => {
        const result = validator.validateContent(content, '3-5');
        expect(result.isValid).toBe(true);
        expect(result.educationalValue).toBeGreaterThan(0.7);
      });
    });

    it('should identify learning opportunities', () => {
      const content = 'The characters used teamwork to solve the puzzle.';
      const result = validator.validateContent(content, 'K-2');

      expect(result.learningOpportunities).toContain('teamwork');
      expect(result.learningOpportunities).toContain('problem-solving');
    });
  });

  describe('Custom Filters and Rules', () => {
    it('should support custom word filters', () => {
      const customFilter = validator.addCustomFilter('bannedword', 'K-2');
      const content =
        'This story contains a bannedword that should be flagged.';

      const result = validator.validateContent(content, 'K-2');

      expect(result.isValid).toBe(false);
      expect(result.flags).toContain('custom-filter');
    });

    it('should allow whitelist exceptions', () => {
      const content = 'The knight fought the dragon in a legendary battle.';

      // Add 'battle' to whitelist for this grade
      validator.addWhitelistWord('battle', '3-5');

      const result = validator.validateContent(content, '3-5');
      expect(result.isValid).toBe(true);
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle very long content efficiently', () => {
      const longContent = 'Once upon a time, '.repeat(1000);
      const startTime = Date.now();

      const result = validator.validateContent(longContent, 'K-2');
      const processingTime = Date.now() - startTime;

      expect(processingTime).toBeLessThan(1000); // Should process in under 1 second
      expect(result.isValid).toBeDefined();
    });

    it('should handle empty and invalid input', () => {
      const edgeCases = ['', '   ', '\n\n\n', null, undefined];

      edgeCases.forEach(content => {
        const result = validator.validateContent(content as any, 'K-2');
        expect(result.isValid).toBe(false);
        expect(result.flags).toContain('empty-content');
      });
    });

    it('should handle special characters and emojis', () => {
      const emojiContent =
        'The cat 🐱 was happy 😊 and played with friends! 🎉';
      const result = validator.validateContent(emojiContent, 'K-2');

      expect(result.isValid).toBe(true);
      expect(result.hasEmojis).toBe(true);
    });

    it('should detect and handle different languages', () => {
      const spanishContent = 'El gato corrió rápidamente por el jardín.';
      const result = validator.validateContent(spanishContent, 'K-2');

      expect(result.detectedLanguage).toBe('es');
      expect(result.flags).toContain('non-english-content');
    });
  });

  describe('Batch Validation', () => {
    it('should efficiently validate multiple content pieces', () => {
      const contentArray = [
        'The cat played happily.',
        'Violence and bad words here.',
        'Educational content about science.',
        'Another appropriate story piece.',
      ];

      const results = validator.validateBatch(contentArray, 'K-2');

      expect(results).toHaveLength(4);
      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(false);
      expect(results[2].isValid).toBe(true);
      expect(results[3].isValid).toBe(true);
    });
  });
});
