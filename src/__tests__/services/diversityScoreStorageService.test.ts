/**
 * Tests for Diversity Score Storage Service
 *
 * Verifies diversity score calculation, storage, and warning logging.
 * Part of US-012: Store diversity scores with story metadata
 */

import { diversityScoreStorageService } from '../../services/diversityScoreStorageService';
import { diversityScoreService } from '../../services/diversityScoreService';
import { recentElementsService } from '../../services/recentElementsService';
import { supabase } from '../../services/supabase';
import type { ExtractedElements } from '../../services/storyElementExtractionService';
import type { RecentElements } from '../../services/recentElementsService';
import type { DiversityScore } from '../../services/diversityScoreService';

// Mock dependencies
jest.mock('../../services/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock('../../services/recentElementsService', () => ({
  recentElementsService: {
    getRecentElements: jest.fn(),
  },
}));

jest.mock('../../services/diversityScoreService', () => ({
  diversityScoreService: {
    calculateDiversityScore: jest.fn(),
  },
}));

describe('DiversityScoreStorageService', () => {
  // Test data
  const mockStoryId = 'story-123';
  const mockSessionId = 'session-456';

  const mockExtractedElements: ExtractedElements = {
    characters: [
      { name: 'Luna the cat', type: 'animal', role: 'protagonist' },
      { name: 'Max the wizard', type: 'human', role: 'mentor' },
    ],
    settings: [{ location: 'enchanted forest', environment: 'magical' }],
    objects: [{ name: 'magic wand', magical: true, purpose: 'casting spells' }],
    plot_patterns: [{ action: 'discovery', discovery_type: 'hidden treasure' }],
  };

  const mockRecentElements: RecentElements = {
    characters: [],
    settings: [],
    objects: [],
    plot_patterns: [],
  };

  const mockDiversityScore: DiversityScore = {
    score: 0.85,
    novelElementCount: 4,
    totalElementCount: 5,
    noveltyRatio: 0.8,
    avgSemanticDistance: 0.9,
    elementBreakdown: {
      characters: { novel: 2, total: 2, avgDistance: 0.95 },
      settings: { novel: 1, total: 1, avgDistance: 0.85 },
      objects: { novel: 1, total: 1, avgDistance: 0.9 },
      plot_patterns: { novel: 0, total: 1, avgDistance: 0.2 },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('storeDiversityScore', () => {
    it('should successfully calculate and store diversity score', async () => {
      // Mock successful flow
      (recentElementsService.getRecentElements as jest.Mock).mockResolvedValue(
        mockRecentElements,
      );

      (
        diversityScoreService.calculateDiversityScore as jest.Mock
      ).mockReturnValue(mockDiversityScore);

      const mockInsert = jest.fn().mockResolvedValue({ error: null });
      (supabase.from as jest.Mock).mockReturnValue({
        insert: mockInsert,
      });

      // Execute
      const result = await diversityScoreStorageService.storeDiversityScore({
        storyId: mockStoryId,
        sessionId: mockSessionId,
        extractedElements: mockExtractedElements,
      });

      // Verify
      expect(result.success).toBe(true);
      expect(result.score).toBe(0.85);
      expect(result.errors).toEqual([]);
      expect(result.duration).toBeGreaterThanOrEqual(0);

      // Verify recent elements fetch
      expect(recentElementsService.getRecentElements).toHaveBeenCalledWith({
        sessionId: mockSessionId,
        limit: 10,
      });

      // Verify diversity score calculation
      expect(
        diversityScoreService.calculateDiversityScore,
      ).toHaveBeenCalledWith(mockExtractedElements, mockRecentElements);

      // Verify database insertion
      expect(mockInsert).toHaveBeenCalledWith({
        story_id: mockStoryId,
        diversity_score: 0.85,
        novel_element_count: 4,
        metadata: {
          total_element_count: 5,
          novelty_ratio: 0.8,
          avg_semantic_distance: 0.9,
          element_breakdown: mockDiversityScore.elementBreakdown,
        },
      });

      // Verify no warning logged (score > 0.4)
      expect(console.warn).not.toHaveBeenCalled();
    });

    it('should log warning when diversity score is below threshold', async () => {
      // Mock low diversity score
      const lowScore: DiversityScore = {
        ...mockDiversityScore,
        score: 0.35,
        novelElementCount: 1,
      };

      (recentElementsService.getRecentElements as jest.Mock).mockResolvedValue(
        mockRecentElements,
      );
      (
        diversityScoreService.calculateDiversityScore as jest.Mock
      ).mockReturnValue(lowScore);

      const mockInsert = jest.fn().mockResolvedValue({ error: null });
      (supabase.from as jest.Mock).mockReturnValue({
        insert: mockInsert,
      });

      // Execute
      const result = await diversityScoreStorageService.storeDiversityScore({
        storyId: mockStoryId,
        sessionId: mockSessionId,
        extractedElements: mockExtractedElements,
      });

      // Verify success
      expect(result.success).toBe(true);
      expect(result.score).toBe(0.35);

      // Verify warning logged
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('LOW DIVERSITY DETECTED'),
      );
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('score=0.350'),
      );
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining(mockStoryId),
      );
    });

    it('should handle error when fetching recent elements fails', async () => {
      // Mock fetch failure
      const error = new Error('Database connection failed');
      (recentElementsService.getRecentElements as jest.Mock).mockRejectedValue(
        error,
      );

      // Execute
      const result = await diversityScoreStorageService.storeDiversityScore({
        storyId: mockStoryId,
        sessionId: mockSessionId,
        extractedElements: mockExtractedElements,
      });

      // Verify
      expect(result.success).toBe(false);
      expect(result.score).toBeUndefined();
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Failed to fetch recent elements');

      // Verify error logged
      expect(console.error).toHaveBeenCalled();

      // Verify score calculation not attempted
      expect(
        diversityScoreService.calculateDiversityScore,
      ).not.toHaveBeenCalled();
    });

    it('should handle error when score calculation fails', async () => {
      // Mock successful fetch but failed calculation
      (recentElementsService.getRecentElements as jest.Mock).mockResolvedValue(
        mockRecentElements,
      );

      const error = new Error('Invalid embeddings');
      (
        diversityScoreService.calculateDiversityScore as jest.Mock
      ).mockImplementation(() => {
        throw error;
      });

      // Execute
      const result = await diversityScoreStorageService.storeDiversityScore({
        storyId: mockStoryId,
        sessionId: mockSessionId,
        extractedElements: mockExtractedElements,
      });

      // Verify
      expect(result.success).toBe(false);
      expect(result.score).toBeUndefined();
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Failed to calculate diversity score');

      // Verify error logged
      expect(console.error).toHaveBeenCalled();
    });

    it('should handle error when database insertion fails', async () => {
      // Mock successful calculation but failed insertion
      (recentElementsService.getRecentElements as jest.Mock).mockResolvedValue(
        mockRecentElements,
      );
      (
        diversityScoreService.calculateDiversityScore as jest.Mock
      ).mockReturnValue(mockDiversityScore);

      const dbError = { message: 'Unique constraint violation' };
      const mockInsert = jest.fn().mockResolvedValue({ error: dbError });
      (supabase.from as jest.Mock).mockReturnValue({
        insert: mockInsert,
      });

      // Execute
      const result = await diversityScoreStorageService.storeDiversityScore({
        storyId: mockStoryId,
        sessionId: mockSessionId,
        extractedElements: mockExtractedElements,
      });

      // Verify
      expect(result.success).toBe(false);
      expect(result.score).toBe(0.85); // Score calculated but not stored
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Failed to store diversity score');

      // Verify error logged
      expect(console.error).toHaveBeenCalled();
    });

    it('should include complete metadata in database record', async () => {
      // Mock successful flow
      (recentElementsService.getRecentElements as jest.Mock).mockResolvedValue(
        mockRecentElements,
      );
      (
        diversityScoreService.calculateDiversityScore as jest.Mock
      ).mockReturnValue(mockDiversityScore);

      const mockInsert = jest.fn().mockResolvedValue({ error: null });
      (supabase.from as jest.Mock).mockReturnValue({
        insert: mockInsert,
      });

      // Execute
      await diversityScoreStorageService.storeDiversityScore({
        storyId: mockStoryId,
        sessionId: mockSessionId,
        extractedElements: mockExtractedElements,
      });

      // Verify metadata structure
      const insertedRecord = mockInsert.mock.calls[0][0];
      expect(insertedRecord.metadata).toEqual({
        total_element_count: 5,
        novelty_ratio: 0.8,
        avg_semantic_distance: 0.9,
        element_breakdown: mockDiversityScore.elementBreakdown,
      });
    });

    it('should handle score exactly at threshold (no warning)', async () => {
      // Score exactly at 0.4 threshold - should NOT warn
      const borderlineScore: DiversityScore = {
        ...mockDiversityScore,
        score: 0.4,
      };

      (recentElementsService.getRecentElements as jest.Mock).mockResolvedValue(
        mockRecentElements,
      );
      (
        diversityScoreService.calculateDiversityScore as jest.Mock
      ).mockReturnValue(borderlineScore);

      const mockInsert = jest.fn().mockResolvedValue({ error: null });
      (supabase.from as jest.Mock).mockReturnValue({
        insert: mockInsert,
      });

      // Execute
      await diversityScoreStorageService.storeDiversityScore({
        storyId: mockStoryId,
        sessionId: mockSessionId,
        extractedElements: mockExtractedElements,
      });

      // Verify no warning (0.4 is at threshold, not below)
      expect(console.warn).not.toHaveBeenCalled();
    });

    it('should handle score just below threshold (with warning)', async () => {
      // Score just below 0.4 threshold - should warn
      const lowScore: DiversityScore = {
        ...mockDiversityScore,
        score: 0.39,
      };

      (recentElementsService.getRecentElements as jest.Mock).mockResolvedValue(
        mockRecentElements,
      );
      (
        diversityScoreService.calculateDiversityScore as jest.Mock
      ).mockReturnValue(lowScore);

      const mockInsert = jest.fn().mockResolvedValue({ error: null });
      (supabase.from as jest.Mock).mockReturnValue({
        insert: mockInsert,
      });

      // Execute
      await diversityScoreStorageService.storeDiversityScore({
        storyId: mockStoryId,
        sessionId: mockSessionId,
        extractedElements: mockExtractedElements,
      });

      // Verify warning logged
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('LOW DIVERSITY DETECTED'),
      );
    });
  });

  describe('storeDiversityScoreAsync', () => {
    it('should execute without blocking (fire-and-forget)', async () => {
      // Mock successful flow
      (recentElementsService.getRecentElements as jest.Mock).mockResolvedValue(
        mockRecentElements,
      );
      (
        diversityScoreService.calculateDiversityScore as jest.Mock
      ).mockReturnValue(mockDiversityScore);

      const mockInsert = jest.fn().mockResolvedValue({ error: null });
      (supabase.from as jest.Mock).mockReturnValue({
        insert: mockInsert,
      });

      // Execute - should return immediately (void)
      const result = diversityScoreStorageService.storeDiversityScoreAsync({
        storyId: mockStoryId,
        sessionId: mockSessionId,
        extractedElements: mockExtractedElements,
      });

      expect(result).toBeUndefined();

      // Wait for async operation to complete
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify storage was called
      expect(mockInsert).toHaveBeenCalled();
    });

    it('should handle errors gracefully without throwing', async () => {
      // Mock error
      const error = new Error('Storage failed');
      (recentElementsService.getRecentElements as jest.Mock).mockRejectedValue(
        error,
      );

      // Execute - should not throw
      expect(() => {
        diversityScoreStorageService.storeDiversityScoreAsync({
          storyId: mockStoryId,
          sessionId: mockSessionId,
          extractedElements: mockExtractedElements,
        });
      }).not.toThrow();

      // Wait for async operation to complete
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify error logged
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('getDiversityScore', () => {
    it('should retrieve diversity score for a story', async () => {
      const mockScoreRecord = {
        id: 'score-123',
        story_id: mockStoryId,
        diversity_score: 0.75,
        novel_element_count: 3,
        metadata: {
          total_element_count: 5,
        },
        created_at: new Date().toISOString(),
      };

      const mockSingle = jest.fn().mockResolvedValue({
        data: mockScoreRecord,
        error: null,
      });

      const mockEq = jest.fn().mockReturnValue({
        single: mockSingle,
      });

      const mockSelect = jest.fn().mockReturnValue({
        eq: mockEq,
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: mockSelect,
      });

      // Execute
      const result = await diversityScoreStorageService.getDiversityScore(
        mockStoryId,
      );

      // Verify
      expect(result).toEqual(mockScoreRecord);
      expect(supabase.from).toHaveBeenCalledWith('story_diversity_scores');
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(mockEq).toHaveBeenCalledWith('story_id', mockStoryId);
    });

    it('should return null when score not found', async () => {
      const mockSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });

      const mockEq = jest.fn().mockReturnValue({
        single: mockSingle,
      });

      const mockSelect = jest.fn().mockReturnValue({
        eq: mockEq,
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: mockSelect,
      });

      // Execute
      const result = await diversityScoreStorageService.getDiversityScore(
        mockStoryId,
      );

      // Verify
      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });

    it('should handle unexpected errors gracefully', async () => {
      const mockSingle = jest
        .fn()
        .mockRejectedValue(new Error('Database error'));

      const mockEq = jest.fn().mockReturnValue({
        single: mockSingle,
      });

      const mockSelect = jest.fn().mockReturnValue({
        eq: mockEq,
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: mockSelect,
      });

      // Execute
      const result = await diversityScoreStorageService.getDiversityScore(
        mockStoryId,
      );

      // Verify
      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('getSessionDiversityStats', () => {
    it('should calculate statistics for a session', async () => {
      // Mock story elements
      const mockElements = [
        { story_id: 'story-1' },
        { story_id: 'story-1' },
        { story_id: 'story-2' },
        { story_id: 'story-3' },
      ];

      // Mock diversity scores
      const mockScores = [
        { diversity_score: 0.8 },
        { diversity_score: 0.6 },
        { diversity_score: 0.3 }, // Low diversity
      ];

      // Create mock chain for story_elements query
      const mockEqElements = jest.fn().mockResolvedValue({
        data: mockElements,
        error: null,
      });

      const mockSelectElements = jest.fn().mockReturnValue({
        eq: mockEqElements,
      });

      // Create mock chain for story_diversity_scores query
      const mockIn = jest.fn().mockResolvedValue({
        data: mockScores,
        error: null,
      });

      const mockSelectScores = jest.fn().mockReturnValue({
        in: mockIn,
      });

      // Setup supabase.from to return different mocks based on table name
      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'story_elements') {
          return {
            select: mockSelectElements,
          };
        } else if (table === 'story_diversity_scores') {
          return {
            select: mockSelectScores,
          };
        }
        return {};
      });

      // Execute
      const result =
        await diversityScoreStorageService.getSessionDiversityStats(
          mockSessionId,
        );

      // Verify
      expect(result.storyCount).toBe(3);
      expect(result.averageScore).toBeCloseTo(0.567, 2); // (0.8 + 0.6 + 0.3) / 3
      expect(result.lowDiversityCount).toBe(1); // Only 0.3 is < 0.4
    });

    it('should handle empty session (no elements)', async () => {
      const mockSelectElements = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const mockEq = jest.fn().mockReturnValue({
        select: mockSelectElements,
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: mockEq,
        }),
      });

      // Execute
      const result =
        await diversityScoreStorageService.getSessionDiversityStats(
          mockSessionId,
        );

      // Verify
      expect(result).toEqual({
        averageScore: 0,
        storyCount: 0,
        lowDiversityCount: 0,
      });
    });

    it('should handle session with elements but no scores', async () => {
      const mockElements = [{ story_id: 'story-1' }];

      // Create mock chain for story_elements query
      const mockEqElements = jest.fn().mockResolvedValue({
        data: mockElements,
        error: null,
      });

      const mockSelectElements = jest.fn().mockReturnValue({
        eq: mockEqElements,
      });

      // Create mock chain for story_diversity_scores query (no scores)
      const mockIn = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const mockSelectScores = jest.fn().mockReturnValue({
        in: mockIn,
      });

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'story_elements') {
          return {
            select: mockSelectElements,
          };
        } else if (table === 'story_diversity_scores') {
          return {
            select: mockSelectScores,
          };
        }
        return {};
      });

      // Execute
      const result =
        await diversityScoreStorageService.getSessionDiversityStats(
          mockSessionId,
        );

      // Verify
      expect(result).toEqual({
        averageScore: 0,
        storyCount: 0,
        lowDiversityCount: 0,
      });
    });

    it('should handle database errors gracefully', async () => {
      // Create mock that throws error when eq is awaited
      const mockEq = jest.fn().mockRejectedValue(new Error('DB error'));

      const mockSelect = jest.fn().mockReturnValue({
        eq: mockEq,
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: mockSelect,
      });

      // Execute
      const result =
        await diversityScoreStorageService.getSessionDiversityStats(
          mockSessionId,
        );

      // Verify default values
      expect(result).toEqual({
        averageScore: 0,
        storyCount: 0,
        lowDiversityCount: 0,
      });
      expect(console.error).toHaveBeenCalled();
    });
  });
});
