/**
 * Tests for Diversity Debug Service
 *
 * Comprehensive test suite for diversity debugging endpoints including:
 * - Recent elements retrieval
 * - Diversity score retrieval
 * - Authentication and authorization
 * - Error handling
 * - Data transformation
 */

import DiversityDebugService, {
  diversityDebugService,
} from '../../services/diversityDebugService';
import { supabase } from '../../services/supabase';

// Mock Supabase
jest.mock('../../services/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
  },
}));

describe('DiversityDebugService', () => {
  let service: DiversityDebugService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DiversityDebugService();
  });

  describe('getRecentElements', () => {
    it('should retrieve recent elements for a session successfully', async () => {
      // Mock RPC response
      const mockResponse = {
        sessionInfo: {
          sessionId: 'div_sess_123',
          userId: 'user-uuid-456',
          createdAt: '2026-01-14T12:00:00Z',
          totalStories: 5,
          storiesInWindow: 10,
        },
        dateRange: {
          earliest: '2026-01-13T10:00:00Z',
          latest: '2026-01-14T12:00:00Z',
        },
        elementsByType: {
          character: [
            {
              text: 'dragon',
              frequency: 3,
              lastUsed: '2026-01-14T12:00:00Z',
              embedding: [0.1, 0.2, 0.3],
              storyIds: ['story-1', 'story-2', 'story-3'],
            },
          ],
          setting: [
            {
              text: 'forest',
              frequency: 2,
              lastUsed: '2026-01-14T11:00:00Z',
              embedding: [0.4, 0.5, 0.6],
              storyIds: ['story-1', 'story-2'],
            },
          ],
        },
        totalElements: 12,
      };

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      // Call service
      const result = await service.getRecentElements('div_sess_123', 10);

      // Assertions
      expect(supabase.rpc).toHaveBeenCalledWith(
        'get_recent_elements_for_debugging',
        {
          p_session_id: 'div_sess_123',
          p_limit: 10,
        },
      );

      expect(result.sessionInfo.sessionId).toBe('div_sess_123');
      expect(result.sessionInfo.totalStories).toBe(5);
      expect(result.sessionInfo.createdAt).toBeInstanceOf(Date);

      expect(result.elementsByType.character).toHaveLength(1);
      expect(result.elementsByType.character![0].text).toBe('dragon');
      expect(result.elementsByType.character![0].frequency).toBe(3);

      expect(result.totalElements).toBe(12);
    });

    it('should use default limit of 10 when not specified', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: {
          sessionInfo: {
            sessionId: 'div_sess_123',
            userId: 'user-uuid-456',
            createdAt: '2026-01-14T12:00:00Z',
            totalStories: 0,
            storiesInWindow: 10,
          },
          dateRange: { earliest: null, latest: null },
          elementsByType: {},
          totalElements: 0,
        },
        error: null,
      });

      await service.getRecentElements('div_sess_123');

      expect(supabase.rpc).toHaveBeenCalledWith(
        'get_recent_elements_for_debugging',
        {
          p_session_id: 'div_sess_123',
          p_limit: 10,
        },
      );
    });

    it('should throw error for invalid session ID', async () => {
      await expect(service.getRecentElements('', 10)).rejects.toThrow(
        'Session ID is required and must be a string',
      );

      await expect(service.getRecentElements(null as any, 10)).rejects.toThrow(
        'Session ID is required and must be a string',
      );
    });

    it('should throw error for invalid limit', async () => {
      await expect(
        service.getRecentElements('div_sess_123', 0),
      ).rejects.toThrow('Limit must be between 1 and 100');

      await expect(
        service.getRecentElements('div_sess_123', 101),
      ).rejects.toThrow('Limit must be between 1 and 100');
    });

    it('should throw error when session not found', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: {
          message: 'Session not found or expired',
          hint: 'Provide a valid, non-expired session_id',
        },
      });

      await expect(
        service.getRecentElements('div_sess_invalid', 10),
      ).rejects.toThrow('Session not found or expired');
    });

    it('should throw error when user is not authenticated', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: {
          message: 'Authentication required',
          hint: 'User must be logged in to access this endpoint',
        },
      });

      await expect(
        service.getRecentElements('div_sess_123', 10),
      ).rejects.toThrow('Authentication required');
    });

    it('should throw error when user does not own session', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: {
          message: 'Access denied',
          hint: 'You can only access your own sessions',
        },
      });

      await expect(
        service.getRecentElements('div_sess_other', 10),
      ).rejects.toThrow('Access denied');
    });

    it('should handle empty elements gracefully', async () => {
      const mockResponse = {
        sessionInfo: {
          sessionId: 'div_sess_123',
          userId: 'user-uuid-456',
          createdAt: '2026-01-14T12:00:00Z',
          totalStories: 0,
          storiesInWindow: 10,
        },
        dateRange: { earliest: null, latest: null },
        elementsByType: {},
        totalElements: 0,
      };

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const result = await service.getRecentElements('div_sess_empty', 10);

      expect(result.totalElements).toBe(0);
      expect(result.dateRange.earliest).toBeNull();
      expect(result.dateRange.latest).toBeNull();
      expect(Object.keys(result.elementsByType)).toHaveLength(0);
    });

    it('should parse all element types correctly', async () => {
      const mockResponse = {
        sessionInfo: {
          sessionId: 'div_sess_123',
          userId: 'user-uuid-456',
          createdAt: '2026-01-14T12:00:00Z',
          totalStories: 4,
          storiesInWindow: 10,
        },
        dateRange: {
          earliest: '2026-01-13T10:00:00Z',
          latest: '2026-01-14T12:00:00Z',
        },
        elementsByType: {
          character: [
            {
              text: 'wizard',
              frequency: 2,
              lastUsed: '2026-01-14T12:00:00Z',
              embedding: null,
              storyIds: ['story-1'],
            },
          ],
          setting: [
            {
              text: 'castle',
              frequency: 1,
              lastUsed: '2026-01-14T11:00:00Z',
              embedding: [0.1],
              storyIds: ['story-2'],
            },
          ],
          object: [
            {
              text: 'wand',
              frequency: 3,
              lastUsed: '2026-01-14T10:00:00Z',
              embedding: [0.2],
              storyIds: ['story-3'],
            },
          ],
          plot_pattern: [
            {
              text: 'discovery',
              frequency: 1,
              lastUsed: '2026-01-14T09:00:00Z',
              embedding: [0.3],
              storyIds: ['story-4'],
            },
          ],
        },
        totalElements: 7,
      };

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const result = await service.getRecentElements('div_sess_123', 10);

      expect(result.elementsByType.character).toHaveLength(1);
      expect(result.elementsByType.setting).toHaveLength(1);
      expect(result.elementsByType.object).toHaveLength(1);
      expect(result.elementsByType.plot_pattern).toHaveLength(1);

      expect(result.elementsByType.character![0].text).toBe('wizard');
      expect(result.elementsByType.setting![0].text).toBe('castle');
      expect(result.elementsByType.object![0].text).toBe('wand');
      expect(result.elementsByType.plot_pattern![0].text).toBe('discovery');
    });
  });

  describe('getDiversityScore', () => {
    it('should retrieve diversity score for a story successfully', async () => {
      const mockResponse = {
        storyId: 'story-uuid-123',
        diversityScore: 0.75,
        novelElementCount: 5,
        calculatedAt: '2026-01-14T12:00:00Z',
        breakdown: {
          total_element_count: 7,
          novelty_ratio: 0.714,
          avg_semantic_distance: 0.65,
          element_breakdown: {
            character: { novel: 2, total: 3 },
            setting: { novel: 1, total: 2 },
          },
        },
      };

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const result = await service.getDiversityScore('story-uuid-123');

      expect(supabase.rpc).toHaveBeenCalledWith('get_diversity_score_debug', {
        p_story_id: 'story-uuid-123',
      });

      expect(result.storyId).toBe('story-uuid-123');
      expect(result.diversityScore).toBe(0.75);
      expect(result.novelElementCount).toBe(5);
      expect(result.calculatedAt).toBeInstanceOf(Date);
      expect(result.breakdown.total_element_count).toBe(7);
      expect(result.breakdown.element_breakdown?.character.novel).toBe(2);
    });

    it('should throw error for invalid story ID', async () => {
      await expect(service.getDiversityScore('')).rejects.toThrow(
        'Story ID is required and must be a string',
      );

      await expect(service.getDiversityScore(null as any)).rejects.toThrow(
        'Story ID is required and must be a string',
      );
    });

    it('should throw error when story not found', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: {
          message: 'Story not found',
          hint: 'Provide a valid story_id',
        },
      });

      await expect(service.getDiversityScore('story-invalid')).rejects.toThrow(
        'Story not found',
      );
    });

    it('should throw error when diversity score not found', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: {
          message: 'Diversity score not found for this story',
          hint: 'Score may not have been calculated yet',
        },
      });

      await expect(service.getDiversityScore('story-no-score')).rejects.toThrow(
        'Diversity score not found',
      );
    });

    it('should throw error when user does not own story', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: {
          message: 'Access denied',
          hint: 'You can only access your own stories',
        },
      });

      await expect(
        service.getDiversityScore('story-other-user'),
      ).rejects.toThrow('Access denied');
    });

    it('should handle missing breakdown gracefully', async () => {
      const mockResponse = {
        storyId: 'story-uuid-123',
        diversityScore: 0.5,
        novelElementCount: 3,
        calculatedAt: '2026-01-14T12:00:00Z',
        breakdown: null,
      };

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const result = await service.getDiversityScore('story-uuid-123');

      expect(result.diversityScore).toBe(0.5);
      expect(result.breakdown).toEqual({});
    });
  });

  describe('canAccessSession', () => {
    it('should return true when user owns non-expired session', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: { id: 'user-123' } },
      });

      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            user_id: 'user-123',
            expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
          },
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const canAccess = await service.canAccessSession('div_sess_123');

      expect(canAccess).toBe(true);
      expect(supabase.from).toHaveBeenCalledWith('user_sessions');
    });

    it('should return false when user is not authenticated', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: null },
      });

      const canAccess = await service.canAccessSession('div_sess_123');

      expect(canAccess).toBe(false);
    });

    it('should return false when user does not own session', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: { id: 'user-123' } },
      });

      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            user_id: 'user-456', // Different user
            expires_at: new Date(Date.now() + 3600000).toISOString(),
          },
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const canAccess = await service.canAccessSession('div_sess_other');

      expect(canAccess).toBe(false);
    });

    it('should return false when session is expired', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: { id: 'user-123' } },
      });

      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            user_id: 'user-123',
            expires_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
          },
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const canAccess = await service.canAccessSession('div_sess_expired');

      expect(canAccess).toBe(false);
    });

    it('should return false when session not found', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: { id: 'user-123' } },
      });

      const mockFrom = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockFrom);

      const canAccess = await service.canAccessSession('div_sess_notfound');

      expect(canAccess).toBe(false);
    });

    it('should handle exceptions gracefully', async () => {
      (supabase.auth.getUser as jest.Mock).mockRejectedValue(
        new Error('Database error'),
      );

      const canAccess = await service.canAccessSession('div_sess_123');

      expect(canAccess).toBe(false);
    });
  });

  describe('getSessionStats', () => {
    it('should calculate session statistics correctly', async () => {
      const mockResponse = {
        sessionInfo: {
          sessionId: 'div_sess_123',
          userId: 'user-uuid-456',
          createdAt: '2026-01-14T12:00:00Z',
          totalStories: 5,
          storiesInWindow: 100,
        },
        dateRange: {
          earliest: '2026-01-13T10:00:00Z',
          latest: '2026-01-14T12:00:00Z',
        },
        elementsByType: {
          character: [
            {
              text: 'dragon',
              frequency: 3,
              lastUsed: '2026-01-14T12:00:00Z',
              embedding: null,
              storyIds: ['s1'],
            },
            {
              text: 'wizard',
              frequency: 2,
              lastUsed: '2026-01-14T11:00:00Z',
              embedding: null,
              storyIds: ['s2'],
            },
          ],
          setting: [
            {
              text: 'forest',
              frequency: 1,
              lastUsed: '2026-01-14T10:00:00Z',
              embedding: null,
              storyIds: ['s3'],
            },
          ],
        },
        totalElements: 20,
      };

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const stats = await service.getSessionStats('div_sess_123');

      expect(stats.totalStories).toBe(5);
      expect(stats.totalElements).toBe(20);
      expect(stats.uniqueElements).toBe(3); // 2 characters + 1 setting
      expect(stats.averageElementsPerStory).toBe(4); // 20 / 5 = 4
    });

    it('should handle zero stories gracefully', async () => {
      const mockResponse = {
        sessionInfo: {
          sessionId: 'div_sess_empty',
          userId: 'user-uuid-456',
          createdAt: '2026-01-14T12:00:00Z',
          totalStories: 0,
          storiesInWindow: 100,
        },
        dateRange: { earliest: null, latest: null },
        elementsByType: {},
        totalElements: 0,
      };

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const stats = await service.getSessionStats('div_sess_empty');

      expect(stats.totalStories).toBe(0);
      expect(stats.totalElements).toBe(0);
      expect(stats.uniqueElements).toBe(0);
      expect(stats.averageElementsPerStory).toBe(0); // Avoid division by zero
    });
  });

  describe('Singleton export', () => {
    it('should export singleton instance', () => {
      expect(diversityDebugService).toBeInstanceOf(DiversityDebugService);
    });

    it('should use singleton instance consistently', () => {
      const instance1 = diversityDebugService;
      const instance2 = diversityDebugService;

      expect(instance1).toBe(instance2);
    });
  });
});
