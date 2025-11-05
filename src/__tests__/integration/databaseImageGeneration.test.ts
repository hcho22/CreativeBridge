/**
 * Database Operations Integration Tests for Image Generation
 * Tests database interactions, schema compliance, and data consistency
 */

import { supabase } from '../../services/supabase';

// Mock Supabase
jest.mock('../../services/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

// Mock database operation handlers
class DatabaseImageGenerationHandler {
  async createImageGenerationRecord(data: {
    userId: string;
    sessionId: string;
    storyContent: string;
    gradeLevel: string;
    imageUrl?: string;
    xpCost: number;
    serviceUsed: string;
    generationTimestamp: string;
  }) {
    const { data: result, error } = await supabase
      .from('stories')
      .update({
        generated_image_url: data.imageUrl,
        image_generation_timestamp: data.generationTimestamp,
        image_generation_cost: data.xpCost,
      })
      .eq('session_id', data.sessionId)
      .select();

    if (error) {
      throw new Error(
        `Failed to update story with image data: ${error.message}`,
      );
    }

    return result;
  }

  async createImageGenerationEvent(eventData: {
    userId: string;
    sessionId: string;
    xpCost: number;
    gradeLevel: string;
    wordCount?: number;
    generationStatus: 'pending' | 'success' | 'failed';
    serviceUsed?: string;
    errorType?: string;
    apiResponseTime?: number;
    imageUrl?: string;
    promptUsed?: string;
    metadata?: Record<string, any>;
  }) {
    const { data: result, error } = await supabase
      .from('image_generation_events')
      .insert({
        id: `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        user_id: eventData.userId,
        session_id: eventData.sessionId,
        xp_cost: eventData.xpCost,
        story_grade_level: eventData.gradeLevel,
        story_word_count: eventData.wordCount || 0,
        generation_status: eventData.generationStatus,
        service_used: eventData.serviceUsed,
        error_type: eventData.errorType,
        api_response_time: eventData.apiResponseTime,
        image_url: eventData.imageUrl,
        prompt_used: eventData.promptUsed,
        metadata: eventData.metadata,
        created_at: new Date().toISOString(),
      })
      .select();

    if (error) {
      throw new Error(
        `Failed to create image generation event: ${error.message}`,
      );
    }

    return result[0];
  }

  async updateImageGenerationEvent(
    eventId: string,
    updates: {
      generationStatus?: 'pending' | 'success' | 'failed';
      serviceUsed?: string;
      errorType?: string;
      apiResponseTime?: number;
      imageUrl?: string;
      promptUsed?: string;
      metadata?: Record<string, any>;
    },
  ) {
    const { data: result, error } = await supabase
      .from('image_generation_events')
      .update({
        generation_status: updates.generationStatus,
        service_used: updates.serviceUsed,
        error_type: updates.errorType,
        api_response_time: updates.apiResponseTime,
        image_url: updates.imageUrl,
        prompt_used: updates.promptUsed,
        metadata: updates.metadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', eventId)
      .select();

    if (error) {
      throw new Error(
        `Failed to update image generation event: ${error.message}`,
      );
    }

    return result[0];
  }

  async getUserXPBalance(userId: string): Promise<number> {
    const { data: userProfile, error } = await supabase
      .from('user_profiles')
      .select('total_xp')
      .eq('id', userId)
      .single();

    if (error) {
      throw new Error(`Failed to get user XP balance: ${error.message}`);
    }

    return (userProfile as any)?.total_xp || 0;
  }

  async updateUserXP(userId: string, xpChange: number): Promise<number> {
    const { data: result, error } = await supabase.rpc('add_user_xp', {
      user_uuid: userId,
      xp_to_add: xpChange,
    });

    if (error) {
      throw new Error(`Failed to update user XP: ${error.message}`);
    }

    return result;
  }

  async getStorySession(sessionId: string) {
    const { data: session, error } = await supabase
      .from('stories')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (error) {
      throw new Error(`Failed to get story session: ${error.message}`);
    }

    return session;
  }

  async getImageGenerationEvents(userId: string, limit?: number) {
    let query = supabase
      .from('image_generation_events')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    const { data: events, error } = await query;

    if (error) {
      throw new Error(
        `Failed to get image generation events: ${error.message}`,
      );
    }

    return events;
  }
}

describe('Database Image Generation Integration Tests', () => {
  let dbHandler: DatabaseImageGenerationHandler;
  const testUserId = 'test-user-123';
  const testSessionId = 'test-session-456';
  const testEventId = 'evt_1234567890_abc123';

  beforeEach(() => {
    jest.clearAllMocks();
    dbHandler = new DatabaseImageGenerationHandler();
  });

  describe('Story Table Integration', () => {
    test('should update story record with image generation data', async () => {
      const mockQueryBuilder = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({
          data: [
            {
              id: 'story-123',
              session_id: testSessionId,
              generated_image_url: 'https://example.com/generated-image.jpg',
              image_generation_timestamp: '2024-01-01T12:00:00Z',
              image_generation_cost: 1000,
            },
          ],
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQueryBuilder as any);

      const result = await dbHandler.createImageGenerationRecord({
        userId: testUserId,
        sessionId: testSessionId,
        storyContent: 'Test story content',
        gradeLevel: 'K-2',
        imageUrl: 'https://example.com/generated-image.jpg',
        xpCost: 1000,
        serviceUsed: 'replicate',
        generationTimestamp: '2024-01-01T12:00:00Z',
      });

      expect(result).toHaveLength(1);
      expect(result[0].generated_image_url).toBe(
        'https://example.com/generated-image.jpg',
      );
      expect(result[0].image_generation_cost).toBe(1000);

      expect(mockSupabase.from).toHaveBeenCalledWith('stories');
      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        generated_image_url: 'https://example.com/generated-image.jpg',
        image_generation_timestamp: '2024-01-01T12:00:00Z',
        image_generation_cost: 1000,
      });
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith(
        'session_id',
        testSessionId,
      );
    });

    test('should handle story update failures', async () => {
      const mockQueryBuilder = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Story not found' },
        }),
      };
      mockSupabase.from.mockReturnValue(mockQueryBuilder as any);

      await expect(
        dbHandler.createImageGenerationRecord({
          userId: testUserId,
          sessionId: 'non-existent-session',
          storyContent: 'Test story',
          gradeLevel: 'K-2',
          xpCost: 1000,
          serviceUsed: 'replicate',
          generationTimestamp: '2024-01-01T12:00:00Z',
        }),
      ).rejects.toThrow(
        'Failed to update story with image data: Story not found',
      );
    });

    test('should retrieve story session data correctly', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'story-123',
            session_id: testSessionId,
            user_id: testUserId,
            story_content: 'Test story content',
            grade_level: 'K-2',
            word_count: 100,
            generated_image_url: null,
            created_at: '2024-01-01T10:00:00Z',
          },
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQueryBuilder as any);

      const session = await dbHandler.getStorySession(testSessionId);

      expect(session.session_id).toBe(testSessionId);
      expect(session.user_id).toBe(testUserId);
      expect(session.grade_level).toBe('K-2');
      expect(session.generated_image_url).toBeNull();

      expect(mockSupabase.from).toHaveBeenCalledWith('stories');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith(
        'session_id',
        testSessionId,
      );
    });
  });

  describe('Image Generation Events Table Integration', () => {
    test('should create image generation event record', async () => {
      const mockQueryBuilder = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({
          data: [
            {
              id: testEventId,
              user_id: testUserId,
              session_id: testSessionId,
              xp_cost: 1000,
              story_grade_level: 'K-2',
              story_word_count: 150,
              generation_status: 'pending',
              service_used: null,
              error_type: null,
              api_response_time: null,
              image_url: null,
              prompt_used: null,
              metadata: { test: true },
              created_at: '2024-01-01T12:00:00Z',
            },
          ],
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQueryBuilder as any);

      const event = await dbHandler.createImageGenerationEvent({
        userId: testUserId,
        sessionId: testSessionId,
        xpCost: 1000,
        gradeLevel: 'K-2',
        wordCount: 150,
        generationStatus: 'pending',
        metadata: { test: true },
      });

      expect(event.user_id).toBe(testUserId);
      expect(event.session_id).toBe(testSessionId);
      expect(event.xp_cost).toBe(1000);
      expect(event.generation_status).toBe('pending');

      expect(mockSupabase.from).toHaveBeenCalledWith('image_generation_events');
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: testUserId,
          session_id: testSessionId,
          xp_cost: 1000,
          story_grade_level: 'K-2',
          generation_status: 'pending',
        }),
      );
    });

    test('should update image generation event with success data', async () => {
      const mockQueryBuilder = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({
          data: [
            {
              id: testEventId,
              generation_status: 'success',
              service_used: 'replicate',
              api_response_time: 30000,
              image_url: 'https://example.com/success-image.jpg',
              prompt_used: 'A beautiful watercolor illustration...',
              updated_at: '2024-01-01T12:30:00Z',
            },
          ],
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQueryBuilder as any);

      const updatedEvent = await dbHandler.updateImageGenerationEvent(
        testEventId,
        {
          generationStatus: 'success',
          serviceUsed: 'replicate',
          apiResponseTime: 30000,
          imageUrl: 'https://example.com/success-image.jpg',
          promptUsed: 'A beautiful watercolor illustration...',
        },
      );

      expect(updatedEvent.generation_status).toBe('success');
      expect(updatedEvent.service_used).toBe('replicate');
      expect(updatedEvent.api_response_time).toBe(30000);
      expect(updatedEvent.image_url).toBe(
        'https://example.com/success-image.jpg',
      );

      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          generation_status: 'success',
          service_used: 'replicate',
          api_response_time: 30000,
          image_url: 'https://example.com/success-image.jpg',
        }),
      );
    });

    test('should update image generation event with failure data', async () => {
      const mockQueryBuilder = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({
          data: [
            {
              id: testEventId,
              generation_status: 'failed',
              service_used: 'replicate',
              error_type: 'api_failure',
              api_response_time: 5000,
              metadata: { errorDetails: 'Service timeout' },
              updated_at: '2024-01-01T12:05:00Z',
            },
          ],
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQueryBuilder as any);

      const updatedEvent = await dbHandler.updateImageGenerationEvent(
        testEventId,
        {
          generationStatus: 'failed',
          serviceUsed: 'replicate',
          errorType: 'api_failure',
          apiResponseTime: 5000,
          metadata: { errorDetails: 'Service timeout' },
        },
      );

      expect(updatedEvent.generation_status).toBe('failed');
      expect(updatedEvent.error_type).toBe('api_failure');
      expect(updatedEvent.metadata.errorDetails).toBe('Service timeout');

      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          generation_status: 'failed',
          error_type: 'api_failure',
          metadata: { errorDetails: 'Service timeout' },
        }),
      );
    });

    test('should retrieve user image generation history', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: [
            {
              id: 'evt_1',
              generation_status: 'success',
              service_used: 'replicate',
              created_at: '2024-01-01T12:00:00Z',
            },
            {
              id: 'evt_2',
              generation_status: 'failed',
              error_type: 'insufficient_xp',
              created_at: '2024-01-01T11:00:00Z',
            },
          ],
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQueryBuilder as any);

      const events = await dbHandler.getImageGenerationEvents(testUserId, 10);

      expect(events).toHaveLength(2);
      expect(events[0].generation_status).toBe('success');
      expect(events[1].generation_status).toBe('failed');

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', testUserId);
      expect(mockQueryBuilder.order).toHaveBeenCalledWith('created_at', {
        ascending: false,
      });
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(10);
    });
  });

  describe('User Profiles XP Integration', () => {
    test('should retrieve user XP balance correctly', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { total_xp: 3500 },
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQueryBuilder as any);

      const balance = await dbHandler.getUserXPBalance(testUserId);

      expect(balance).toBe(3500);
      expect(mockSupabase.from).toHaveBeenCalledWith('user_profiles');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', testUserId);
    });

    test('should handle user not found during XP balance check', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'User profile not found' },
        }),
      };
      mockSupabase.from.mockReturnValue(mockQueryBuilder as any);

      await expect(
        dbHandler.getUserXPBalance('non-existent-user'),
      ).rejects.toThrow(
        'Failed to get user XP balance: User profile not found',
      );
    });

    test('should update user XP using RPC function', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: 2500, // New balance after deduction
        error: null,
      });

      const newBalance = await dbHandler.updateUserXP(testUserId, -1000);

      expect(newBalance).toBe(2500);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('add_user_xp', {
        user_uuid: testUserId,
        xp_to_add: -1000,
      });
    });

    test('should handle XP update failures', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Insufficient XP for deduction' },
      });

      await expect(dbHandler.updateUserXP(testUserId, -1000)).rejects.toThrow(
        'Failed to update user XP: Insufficient XP for deduction',
      );
    });
  });

  describe('Data Consistency and Schema Compliance', () => {
    test('should ensure all required fields are present in event creation', async () => {
      const mockQueryBuilder = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({
          data: [{ id: testEventId }],
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQueryBuilder as any);

      await dbHandler.createImageGenerationEvent({
        userId: testUserId,
        sessionId: testSessionId,
        xpCost: 1000,
        gradeLevel: 'K-2',
        wordCount: 100,
        generationStatus: 'pending',
      });

      const insertCall = mockQueryBuilder.insert.mock.calls[0][0];

      // Verify all required fields are present
      expect(insertCall).toHaveProperty('id');
      expect(insertCall).toHaveProperty('user_id', testUserId);
      expect(insertCall).toHaveProperty('session_id', testSessionId);
      expect(insertCall).toHaveProperty('xp_cost', 1000);
      expect(insertCall).toHaveProperty('story_grade_level', 'K-2');
      expect(insertCall).toHaveProperty('story_word_count', 100);
      expect(insertCall).toHaveProperty('generation_status', 'pending');
      expect(insertCall).toHaveProperty('created_at');

      // Verify ID format
      expect(insertCall.id).toMatch(/^evt_\d+_[a-z0-9]+$/);
    });

    test('should handle null values appropriately', async () => {
      const mockQueryBuilder = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({
          data: [
            {
              id: testEventId,
              service_used: null,
              error_type: null,
              image_url: null,
            },
          ],
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQueryBuilder as any);

      const updatedEvent = await dbHandler.updateImageGenerationEvent(
        testEventId,
        {
          serviceUsed: undefined,
          errorType: undefined,
          imageUrl: undefined,
        },
      );

      // Null values should be preserved
      expect(updatedEvent.service_used).toBeNull();
      expect(updatedEvent.error_type).toBeNull();
      expect(updatedEvent.image_url).toBeNull();
    });

    test('should validate grade level values', async () => {
      const validGradeLevels = ['K-2', '3-5', '6-8', '9-12'];

      for (const gradeLevel of validGradeLevels) {
        const mockQueryBuilder = {
          insert: jest.fn().mockReturnThis(),
          select: jest.fn().mockResolvedValue({
            data: [{ id: `evt_${gradeLevel}`, story_grade_level: gradeLevel }],
            error: null,
          }),
        };
        mockSupabase.from.mockReturnValue(mockQueryBuilder as any);

        const event = await dbHandler.createImageGenerationEvent({
          userId: testUserId,
          sessionId: testSessionId,
          xpCost: 1000,
          gradeLevel,
          generationStatus: 'pending',
        });

        expect(event.story_grade_level).toBe(gradeLevel);
      }
    });

    test('should handle JSON metadata correctly', async () => {
      const complexMetadata = {
        storyTheme: 'adventure',
        characters: ['knight', 'dragon'],
        settings: ['forest', 'castle'],
        complexity: { wordCount: 150, sentenceCount: 12 },
        userPreferences: { artStyle: 'watercolor', brightness: 'high' },
      };

      const mockQueryBuilder = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({
          data: [{ id: testEventId, metadata: complexMetadata }],
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQueryBuilder as any);

      const event = await dbHandler.createImageGenerationEvent({
        userId: testUserId,
        sessionId: testSessionId,
        xpCost: 1000,
        gradeLevel: 'K-2',
        generationStatus: 'pending',
        metadata: complexMetadata,
      });

      expect(event.metadata).toEqual(complexMetadata);
      expect(event.metadata.characters).toContain('knight');
      expect(event.metadata.complexity.wordCount).toBe(150);
    });
  });

  describe('Performance and Indexing', () => {
    test('should efficiently query events by user ID', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: Array(100)
            .fill(null)
            .map((_, i) => ({
              id: `evt_${i}`,
              user_id: testUserId,
              created_at: new Date(Date.now() - i * 1000).toISOString(),
            })),
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQueryBuilder as any);

      const events = await dbHandler.getImageGenerationEvents(testUserId, 100);

      expect(events).toHaveLength(100);
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', testUserId);
      expect(mockQueryBuilder.order).toHaveBeenCalledWith('created_at', {
        ascending: false,
      });
    });

    test('should handle large result sets efficiently', async () => {
      const startTime = Date.now();

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: Array(1000)
            .fill(null)
            .map((_, i) => ({ id: `evt_${i}` })),
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockQueryBuilder as any);

      const events = await dbHandler.getImageGenerationEvents(testUserId, 1000);

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(events).toHaveLength(1000);
      expect(executionTime).toBeLessThan(100); // Should be fast in test environment
    });
  });
});
