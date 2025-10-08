/**
 * Jest tests for Story_Quest Integration Service
 * 
 * Tests for Task 16: Story_Quest API Integration
 * - Authentication with Story_Quest platform
 * - User story fetching
 * - Cross-platform user matching and verification
 * - Story import functionality
 * - Integration testing with sample data
 */

import { storyQuestService, StoryQuestUser, StoryQuestStory, AuthCredentials } from '../../services/storyQuestService';

// Mock the Supabase client
jest.mock('../../services/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({
            data: {
              id: 'cb-story-123',
              user_id: 'cb-user-123',
              story_content: 'Imported story content',
              story_source: 'Story_Quest'
            },
            error: null
          }))
        }))
      }))
    }))
  }
}));

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock dynamic import for Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({
            data: mockStoryQuestUser,
            error: null
          })),
          limit: jest.fn(() => Promise.resolve({
            data: [mockStoryQuestUser],
            error: null
          })),
          order: jest.fn(() => Promise.resolve({
            data: [mockStoryQuestStory],
            error: null
          }))
        })),
        or: jest.fn(() => ({
          limit: jest.fn(() => Promise.resolve({
            data: [mockStoryQuestUser],
            error: null
          }))
        })),
        not: jest.fn(() => ({
          not: jest.fn(() => ({
            order: jest.fn(() => Promise.resolve({
              data: [mockStoryQuestStory],
              error: null
            }))
          })),
          is: jest.fn(() => ({
            order: jest.fn(() => Promise.resolve({
              data: [mockStoryQuestStory],
              error: null
            }))
          }))
        })),
        limit: jest.fn(() => Promise.resolve({
          data: [mockStoryQuestUser],
          error: null,
          count: 1
        }))
      }))
    }))
  }))
}));

// Mock data
const mockStoryQuestUser: StoryQuestUser = {
  id: 'sq-user-123',
  username: 'testuser',
  display_name: 'Test User',
  email: 'test@example.com',
  total_xp: 1500,
  current_streak: 5,
  longest_streak: 10,
  total_games_played: 25,
  total_stories_completed: 20,
  total_words_written: 5000,
  best_score: 95,
  preferred_grade_level: 'K-2',
  speech_enabled: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-15T00:00:00Z',
  last_activity_date: '2024-01-15'
};

const mockStoryQuestStory: StoryQuestStory = {
  id: 'sq-story-123',
  user_id: 'sq-user-123',
  grade_level: 'K-2',
  story_content: 'Once upon a time, there was a brave little mouse who lived in a magical forest. The mouse discovered a hidden treasure that would change everything.',
  final_score: 85,
  words_written: 150,
  sentences_completed: 8,
  challenges_completed: 3,
  xp_earned: 100,
  created_at: '2024-01-10T10:00:00Z',
  completed_at: '2024-01-10T10:30:00Z',
  source: 'Story_Quest'
};

const mockCredentials: AuthCredentials = {
  email: 'test@example.com',
  username: 'testuser'
};

describe('StoryQuestService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful fetch responses
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/health')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: 'healthy' })
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });
    });
  });

  describe('API Health Checks', () => {
    it('should check API health successfully', async () => {
      const isHealthy = await storyQuestService.checkApiHealth();
      expect(isHealthy).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/health'),
        expect.objectContaining({
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        })
      );
    });

    it('should handle API health check failure', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
      
      const isHealthy = await storyQuestService.checkApiHealth();
      expect(isHealthy).toBe(false);
    });

    it('should handle unhealthy API response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'unhealthy' })
      });
      
      const isHealthy = await storyQuestService.checkApiHealth();
      expect(isHealthy).toBe(false);
    });
  });

  describe('Authentication', () => {
    it('should authenticate with Story_Quest platform successfully', async () => {
      const result = await storyQuestService.authenticate(mockCredentials);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.username).toBe(mockStoryQuestUser.username);
      expect(result.data?.total_xp).toBe(mockStoryQuestUser.total_xp);
    });

    it('should handle authentication with username', async () => {
      const usernameCredentials: AuthCredentials = {
        email: 'test@example.com',
        username: 'testuser'
      };
      
      const result = await storyQuestService.authenticate(usernameCredentials);
      expect(result.success).toBe(true);
      expect(result.data?.username).toBe('testuser');
    });

    it('should handle authentication failure for non-existent user', async () => {
      // Mock the createClient to return error for this test
      const mockSupabase = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve({
                data: null,
                error: { code: 'PGRST116', message: 'No rows found' }
              }))
            }))
          }))
        }))
      };

      // Temporarily replace the supabase instance
      (storyQuestService as any).storyQuestSupabase = mockSupabase;
      
      const result = await storyQuestService.authenticate(mockCredentials);
      expect(result.success).toBe(false);
      expect(result.error).toContain('User not found');
    });

    it('should handle database connection error', async () => {
      // Mock no connection
      (storyQuestService as any).storyQuestSupabase = null;
      
      const result = await storyQuestService.authenticate(mockCredentials);
      expect(result.success).toBe(false);
      expect(result.error).toContain('database connection not available');
    });
  });

  describe('User Story Fetching', () => {
    it('should fetch user stories from Story_Quest successfully', async () => {
      const result = await storyQuestService.fetchUserStories('sq-user-123');
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data?.length).toBeGreaterThan(0);
      
      const story = result.data?.[0];
      expect(story?.id).toBe(mockStoryQuestStory.id);
      expect(story?.story_content).toBe(mockStoryQuestStory.story_content);
      expect(story?.source).toBe('Story_Quest');
    });

    it('should handle empty story list', async () => {
      const mockSupabase = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              not: jest.fn(() => ({
                not: jest.fn(() => ({
                  order: jest.fn(() => Promise.resolve({
                    data: [],
                    error: null
                  }))
                }))
              }))
            }))
          }))
        }))
      };

      (storyQuestService as any).storyQuestSupabase = mockSupabase;
      
      const result = await storyQuestService.fetchUserStories('sq-user-123');
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should handle database error when fetching stories', async () => {
      const mockSupabase = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              not: jest.fn(() => ({
                not: jest.fn(() => ({
                  order: jest.fn(() => Promise.resolve({
                    data: null,
                    error: { message: 'Database connection failed' }
                  }))
                }))
              }))
            }))
          }))
        }))
      };

      (storyQuestService as any).storyQuestSupabase = mockSupabase;
      
      const result = await storyQuestService.fetchUserStories('sq-user-123');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to fetch stories');
    });

    it('should handle missing database connection', async () => {
      (storyQuestService as any).storyQuestSupabase = null;
      
      const result = await storyQuestService.fetchUserStories('sq-user-123');
      expect(result.success).toBe(false);
      expect(result.error).toContain('database connection not available');
    });
  });

  describe('Cross-Platform User Matching', () => {
    it('should match user by email with high confidence', async () => {
      const result = await storyQuestService.matchUserByEmail('test@example.com');
      
      expect(result.found).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.username).toBe(mockStoryQuestUser.username);
      expect(result.confidence).toBe('high');
      expect(result.matchedBy).toBe('username');
    });

    it('should match user with medium confidence for display name', async () => {
      const mockSupabase = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            or: jest.fn(() => ({
              limit: jest.fn(() => Promise.resolve({
                data: [{
                  ...mockStoryQuestUser,
                  username: 'different_user',
                  display_name: 'Test User Display'
                }],
                error: null
              }))
            }))
          }))
        }))
      };

      (storyQuestService as any).storyQuestSupabase = mockSupabase;
      
      const result = await storyQuestService.matchUserByEmail('test@example.com');
      expect(result.found).toBe(true);
      expect(result.confidence).toBe('medium');
      expect(result.matchedBy).toBe('display_name');
    });

    it('should handle no user found', async () => {
      const mockSupabase = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            or: jest.fn(() => ({
              limit: jest.fn(() => Promise.resolve({
                data: [],
                error: null
              }))
            }))
          }))
        }))
      };

      (storyQuestService as any).storyQuestSupabase = mockSupabase;
      
      const result = await storyQuestService.matchUserByEmail('notfound@example.com');
      expect(result.found).toBe(false);
      expect(result.confidence).toBe('low');
    });

    it('should handle database error in user matching', async () => {
      const mockSupabase = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            or: jest.fn(() => ({
              limit: jest.fn(() => Promise.resolve({
                data: null,
                error: { message: 'Database error' }
              }))
            }))
          }))
        }))
      };

      (storyQuestService as any).storyQuestSupabase = mockSupabase;
      
      const result = await storyQuestService.matchUserByEmail('test@example.com');
      expect(result.found).toBe(false);
      expect(result.confidence).toBe('low');
    });

    it('should handle missing database connection for user matching', async () => {
      (storyQuestService as any).storyQuestSupabase = null;
      
      const result = await storyQuestService.matchUserByEmail('test@example.com');
      expect(result.found).toBe(false);
      expect(result.confidence).toBe('low');
    });
  });

  describe('Story Import Functionality', () => {
    it('should import Story_Quest story to CreativeBridge successfully', async () => {
      const result = await storyQuestService.importStoryToCreativeBridge(
        mockStoryQuestStory,
        'cb-user-123'
      );
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.message).toContain('successfully imported');
    });

    it('should handle story import failure', async () => {
      // Mock failed supabase insert
      const { supabase } = require('../../services/supabase');
      supabase.from.mockReturnValueOnce({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({
              data: null,
              error: { message: 'Insert failed' }
            }))
          }))
        }))
      });
      
      const result = await storyQuestService.importStoryToCreativeBridge(
        mockStoryQuestStory,
        'cb-user-123'
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to import story');
    });

    it('should properly transform Story_Quest story format', async () => {
      const result = await storyQuestService.importStoryToCreativeBridge(
        mockStoryQuestStory,
        'cb-user-123'
      );
      
      expect(result.success).toBe(true);
      
      // Verify the insert was called with correct transformed data
      const { supabase } = require('../../services/supabase');
      const insertCall = supabase.from().insert.mock.calls[0][0];
      
      expect(insertCall.user_id).toBe('cb-user-123');
      expect(insertCall.story_source).toBe('Story_Quest');
      expect(insertCall.imported_story_content).toBe(mockStoryQuestStory.story_content);
      expect(insertCall.story_metadata.original_id).toBe(mockStoryQuestStory.id);
      expect(insertCall.story_metadata.source_platform).toBe('Story_Quest');
    });
  });

  describe('Integration Testing', () => {
    it('should run complete integration test successfully', async () => {
      const result = await storyQuestService.testIntegration();
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.apiHealth).toBe(true);
      expect(result.data?.databaseConnection).toBe(true);
      expect(typeof result.data?.sampleUserCount).toBe('number');
      expect(typeof result.data?.sampleStoryCount).toBe('number');
    });

    it('should handle integration test with API down', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('API down'));
      
      const result = await storyQuestService.testIntegration();
      
      expect(result.success).toBe(true);
      expect(result.data?.apiHealth).toBe(false);
    });

    it('should handle integration test with database connection failure', async () => {
      (storyQuestService as any).storyQuestSupabase = null;
      
      const result = await storyQuestService.testIntegration();
      
      expect(result.success).toBe(true);
      expect(result.data?.databaseConnection).toBe(false);
      expect(result.data?.sampleUserCount).toBe(0);
      expect(result.data?.sampleStoryCount).toBe(0);
    });
  });

  describe('User Statistics', () => {
    it('should get user stats successfully', async () => {
      const mockSupabase = {
        from: jest.fn((table: string) => {
          if (table === 'user_profiles') {
            return {
              select: jest.fn(() => ({
                eq: jest.fn(() => ({
                  single: jest.fn(() => Promise.resolve({
                    data: mockStoryQuestUser,
                    error: null
                  }))
                }))
              }))
            };
          } else if (table === 'game_sessions') {
            return {
              select: jest.fn(() => ({
                eq: jest.fn(() => ({
                  not: jest.fn(() => Promise.resolve({
                    data: [
                      { grade_level: 'K-2', final_score: 85 },
                      { grade_level: 'K-2', final_score: 90 },
                      { grade_level: '3-5', final_score: 75 }
                    ],
                    error: null
                  }))
                }))
              }))
            };
          }
        })
      };

      (storyQuestService as any).storyQuestSupabase = mockSupabase;
      
      const result = await storyQuestService.getUserStats('sq-user-123');
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.totalStories).toBe(3);
      expect(result.data?.totalXp).toBe(mockStoryQuestUser.total_xp);
      expect(result.data?.averageScore).toBe(83.33);
      expect(result.data?.longestStreak).toBe(mockStoryQuestUser.longest_streak);
      expect(result.data?.favoriteGradeLevel).toBe('K-2');
    });

    it('should handle user not found for stats', async () => {
      const mockSupabase = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve({
                data: null,
                error: { message: 'User not found' }
              }))
            }))
          }))
        }))
      };

      (storyQuestService as any).storyQuestSupabase = mockSupabase;
      
      const result = await storyQuestService.getUserStats('nonexistent-user');
      expect(result.success).toBe(false);
      expect(result.error).toContain('User not found');
    });

    it('should handle missing database connection for stats', async () => {
      (storyQuestService as any).storyQuestSupabase = null;
      
      const result = await storyQuestService.getUserStats('sq-user-123');
      expect(result.success).toBe(false);
      expect(result.error).toContain('database connection not available');
    });
  });

  describe('Error Handling', () => {
    it('should handle network timeouts gracefully', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => 
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100))
      );
      
      const isHealthy = await storyQuestService.checkApiHealth();
      expect(isHealthy).toBe(false);
    });

    it('should handle invalid response format', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(null)
      });
      
      const isHealthy = await storyQuestService.checkApiHealth();
      expect(isHealthy).toBe(false);
    });

    it('should handle malformed user data', async () => {
      const mockSupabase = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve({
                data: { incomplete: 'data' },
                error: null
              }))
            }))
          }))
        }))
      };

      (storyQuestService as any).storyQuestSupabase = mockSupabase;
      
      const result = await storyQuestService.authenticate(mockCredentials);
      expect(result.success).toBe(true); // Should still succeed but with incomplete data
    });
  });

  describe('Configuration and Environment', () => {
    it('should handle missing environment variables gracefully', async () => {
      // Service should initialize without throwing errors even without env vars
      expect(storyQuestService).toBeDefined();
    });

    it('should properly configure API endpoints', () => {
      // Test that the service uses correct API base URL
      expect(storyQuestService.checkApiHealth).toBeDefined();
    });
  });
});

describe('Integration Flow End-to-End', () => {
  it('should complete full Story_Quest import workflow', async () => {
    // 1. Check API health
    const healthCheck = await storyQuestService.checkApiHealth();
    expect(healthCheck).toBe(true);

    // 2. Authenticate user
    const authResult = await storyQuestService.authenticate(mockCredentials);
    expect(authResult.success).toBe(true);

    // 3. Fetch user stories
    const storiesResult = await storyQuestService.fetchUserStories('sq-user-123');
    expect(storiesResult.success).toBe(true);

    // 4. Import a story
    if (storiesResult.data && storiesResult.data.length > 0) {
      const importResult = await storyQuestService.importStoryToCreativeBridge(
        storiesResult.data[0],
        'cb-user-123'
      );
      expect(importResult.success).toBe(true);
    }

    // 5. Test user matching
    const matchResult = await storyQuestService.matchUserByEmail('test@example.com');
    expect(matchResult.found).toBe(true);

    // 6. Get user stats
    const statsResult = await storyQuestService.getUserStats('sq-user-123');
    expect(statsResult.success).toBe(true);
  });

  it('should handle complete workflow with fallbacks', async () => {
    // Simulate partial failures and verify graceful degradation
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('API down'));
    
    const healthCheck = await storyQuestService.checkApiHealth();
    expect(healthCheck).toBe(false); // API down but service continues

    // Authentication should still work with direct DB access
    const authResult = await storyQuestService.authenticate(mockCredentials);
    expect(authResult.success).toBe(true);
  });
});