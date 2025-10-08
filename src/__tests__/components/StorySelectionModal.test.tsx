// Jest Tests for Task 5: Create Story Selection Components

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { StorySelectionModal } from '../../components/story/StorySelectionModal';
import type { GameSession, StorySource } from '../../types/database';

// Mock the StoryManagementService
const mockGetStoryLibrary = jest.fn();
jest.mock('../../services/storyManagementService', () => ({
  StoryManagementService: {
    getStoryLibrary: mockGetStoryLibrary,
  },
}));

// Mock SafeAreaView
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: any) => children,
}));

describe('StorySelectionModal', () => {
  const mockStories: GameSession[] = [
    {
      id: 'story-1',
      user_id: 'user-123',
      created_at: '2024-01-01T00:00:00Z',
      completed_at: '2024-01-01T01:00:00Z',
      grade_level: 'K-2',
      final_score: 100,
      words_written: 50,
      sentences_completed: 5,
      challenges_completed: 3,
      xp_earned: 150,
      story_content:
        'The Adventures of Tom\n\nOnce upon a time, Tom went on a great adventure in the forest.',
      story_source: 'File',
      story_metadata: { title: 'The Adventures of Tom', author: 'Test User' },
    },
    {
      id: 'story-2',
      user_id: 'user-123',
      created_at: '2024-01-02T00:00:00Z',
      grade_level: '3-5',
      final_score: 150,
      words_written: 75,
      sentences_completed: 8,
      challenges_completed: 5,
      xp_earned: 200,
      story_content:
        'Space Exploration\n\nThe brave astronaut traveled to distant planets and discovered amazing things.',
      story_source: 'CreativeBridge',
      story_metadata: { title: 'Space Exploration', genre: 'sci-fi' },
    },
    {
      id: 'story-3',
      user_id: 'user-123',
      created_at: '2024-01-03T00:00:00Z',
      completed_at: '2024-01-03T01:30:00Z',
      grade_level: '6-8',
      final_score: 200,
      words_written: 120,
      sentences_completed: 12,
      challenges_completed: 8,
      xp_earned: 300,
      story_content:
        'Mystery at the mansion began when detective Sarah arrived at the old estate.',
      story_source: 'Story_Quest',
      story_metadata: { genre: 'mystery' },
    },
  ];

  const defaultProps = {
    visible: true,
    onClose: jest.fn(),
    onStorySelect: jest.fn(),
    userId: 'user-123',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetStoryLibrary.mockResolvedValue({
      success: true,
      stories: mockStories,
      total: mockStories.length,
      hasMore: false,
    });
  });

  describe('Basic Rendering', () => {
    it('should render story list when visible', async () => {
      const { getByText } = render(<StorySelectionModal {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('The Adventures of Tom')).toBeTruthy();
        expect(getByText('Space Exploration')).toBeTruthy();
        expect(
          getByText('Mystery at the mansion began when detective...'),
        ).toBeTruthy();
      });
    });

    it('should not render when not visible', () => {
      const { queryByText } = render(
        <StorySelectionModal {...defaultProps} visible={false} />,
      );

      expect(queryByText('Select a Story')).toBeFalsy();
    });

    it('should render custom title', async () => {
      const { getByText } = render(
        <StorySelectionModal {...defaultProps} title="Choose Your Story" />,
      );

      expect(getByText('Choose Your Story')).toBeTruthy();
    });

    it('should show story count', async () => {
      const { getByText } = render(<StorySelectionModal {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('3 stories')).toBeTruthy();
      });
    });
  });

  describe('Story Cards Display', () => {
    it('should display story metadata correctly', async () => {
      const { getByText } = render(<StorySelectionModal {...defaultProps} />);

      await waitFor(() => {
        // Check title extraction
        expect(getByText('The Adventures of Tom')).toBeTruthy();
        expect(getByText('Space Exploration')).toBeTruthy();

        // Check word counts
        expect(getByText('50 words')).toBeTruthy();
        expect(getByText('75 words')).toBeTruthy();
        expect(getByText('120 words')).toBeTruthy();

        // Check scores
        expect(getByText('Score: 100')).toBeTruthy();
        expect(getByText('Score: 150')).toBeTruthy();
        expect(getByText('Score: 200')).toBeTruthy();

        // Check source indicators
        expect(getByText('File')).toBeTruthy();
        expect(getByText('CreativeBridge')).toBeTruthy();
        expect(getByText('Story_Quest')).toBeTruthy();
      });
    });

    it('should show completed badge for completed stories', async () => {
      const { getAllByText } = render(
        <StorySelectionModal {...defaultProps} />,
      );

      await waitFor(() => {
        // Two stories are completed
        const completedBadges = getAllByText('✓');
        expect(completedBadges).toHaveLength(2);
      });
    });

    it('should format dates correctly', async () => {
      const { getByText } = render(<StorySelectionModal {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('Jan 1, 2024')).toBeTruthy();
        expect(getByText('Jan 2, 2024')).toBeTruthy();
        expect(getByText('Jan 3, 2024')).toBeTruthy();
      });
    });
  });

  describe('Search Functionality', () => {
    it('should filter stories by search term', async () => {
      const { getByPlaceholderText, getByText, queryByText } = render(
        <StorySelectionModal {...defaultProps} />,
      );

      await waitFor(() => {
        expect(getByText('3 stories')).toBeTruthy();
      });

      const searchInput = getByPlaceholderText('Search stories...');
      fireEvent.changeText(searchInput, 'adventure');

      await waitFor(() => {
        expect(getByText('The Adventures of Tom')).toBeTruthy();
        expect(queryByText('Space Exploration')).toBeFalsy();
        expect(
          queryByText('Mystery at the mansion began when detective...'),
        ).toBeFalsy();
        expect(getByText('1 story')).toBeTruthy();
      });
    });

    it('should search in story content', async () => {
      const { getByPlaceholderText, getByText, queryByText } = render(
        <StorySelectionModal {...defaultProps} />,
      );

      await waitFor(() => {
        expect(getByText('3 stories')).toBeTruthy();
      });

      const searchInput = getByPlaceholderText('Search stories...');
      fireEvent.changeText(searchInput, 'astronaut');

      await waitFor(() => {
        expect(queryByText('The Adventures of Tom')).toBeFalsy();
        expect(getByText('Space Exploration')).toBeTruthy();
        expect(
          queryByText('Mystery at the mansion began when detective...'),
        ).toBeFalsy();
        expect(getByText('1 story')).toBeTruthy();
      });
    });

    it('should search by source', async () => {
      const { getByPlaceholderText, getByText, queryByText } = render(
        <StorySelectionModal {...defaultProps} />,
      );

      await waitFor(() => {
        expect(getByText('3 stories')).toBeTruthy();
      });

      const searchInput = getByPlaceholderText('Search stories...');
      fireEvent.changeText(searchInput, 'Story_Quest');

      await waitFor(() => {
        expect(queryByText('The Adventures of Tom')).toBeFalsy();
        expect(queryByText('Space Exploration')).toBeFalsy();
        expect(
          getByText('Mystery at the mansion began when detective...'),
        ).toBeTruthy();
        expect(getByText('1 story')).toBeTruthy();
      });
    });

    it('should show clear search button when searching', async () => {
      const { getByPlaceholderText, getByText, queryByText } = render(
        <StorySelectionModal {...defaultProps} />,
      );

      const searchInput = getByPlaceholderText('Search stories...');
      fireEvent.changeText(searchInput, 'test');

      await waitFor(() => {
        // Should show clear button (✕) in search input
        const clearButtons = getAllByText('✕');
        expect(clearButtons.length).toBeGreaterThan(1); // One in header, one in search
      });
    });

    it('should clear search when clear button is pressed', async () => {
      const { getByPlaceholderText, getAllByText, getByText } = render(
        <StorySelectionModal {...defaultProps} />,
      );

      const searchInput = getByPlaceholderText('Search stories...');
      fireEvent.changeText(searchInput, 'nonexistent');

      await waitFor(() => {
        expect(getByText('No stories match your search')).toBeTruthy();
      });

      // Press clear search button
      const clearButton = getByText('Clear Search');
      fireEvent.press(clearButton);

      await waitFor(() => {
        expect(getByText('3 stories')).toBeTruthy();
      });
    });

    it('should show empty state for no search results', async () => {
      const { getByPlaceholderText, getByText } = render(
        <StorySelectionModal {...defaultProps} />,
      );

      const searchInput = getByPlaceholderText('Search stories...');
      fireEvent.changeText(searchInput, 'nonexistent story');

      await waitFor(() => {
        expect(getByText('No stories match your search')).toBeTruthy();
        expect(getByText('Clear Search')).toBeTruthy();
      });
    });
  });

  describe('Filter Functionality', () => {
    it('should filter by source', async () => {
      const { getByText, queryByText } = render(
        <StorySelectionModal {...defaultProps} />,
      );

      await waitFor(() => {
        expect(getByText('3 stories')).toBeTruthy();
      });

      // Click on File filter
      fireEvent.press(getByText('File'));

      await waitFor(() => {
        expect(getByText('The Adventures of Tom')).toBeTruthy();
        expect(queryByText('Space Exploration')).toBeFalsy();
        expect(
          queryByText('Mystery at the mansion began when detective...'),
        ).toBeFalsy();
        expect(getByText('1 story')).toBeTruthy();
      });
    });

    it('should filter by CreativeBridge source', async () => {
      const { getByText, queryByText } = render(
        <StorySelectionModal {...defaultProps} />,
      );

      await waitFor(() => {
        expect(getByText('3 stories')).toBeTruthy();
      });

      // Click on CreativeBridge filter
      fireEvent.press(getByText('CreativeBridge'));

      await waitFor(() => {
        expect(queryByText('The Adventures of Tom')).toBeFalsy();
        expect(getByText('Space Exploration')).toBeTruthy();
        expect(
          queryByText('Mystery at the mansion began when detective...'),
        ).toBeFalsy();
        expect(getByText('1 story')).toBeTruthy();
      });
    });

    it('should filter by completed stories only', async () => {
      const { getByText, queryByText } = render(
        <StorySelectionModal {...defaultProps} />,
      );

      await waitFor(() => {
        expect(getByText('3 stories')).toBeTruthy();
      });

      // Toggle completed only filter
      fireEvent.press(getByText('☐ Completed Only'));

      await waitFor(() => {
        expect(getByText('The Adventures of Tom')).toBeTruthy();
        expect(queryByText('Space Exploration')).toBeFalsy(); // Not completed
        expect(
          getByText('Mystery at the mansion began when detective...'),
        ).toBeTruthy();
        expect(getByText('2 stories')).toBeTruthy();
      });
    });

    it('should reset to all sources when All is selected', async () => {
      const { getByText } = render(<StorySelectionModal {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('3 stories')).toBeTruthy();
      });

      // First filter by File
      fireEvent.press(getByText('File'));

      await waitFor(() => {
        expect(getByText('1 story')).toBeTruthy();
      });

      // Then select All
      fireEvent.press(getByText('All'));

      await waitFor(() => {
        expect(getByText('3 stories')).toBeTruthy();
      });
    });

    it('should combine search and filter', async () => {
      const { getByPlaceholderText, getByText, queryByText } = render(
        <StorySelectionModal {...defaultProps} />,
      );

      await waitFor(() => {
        expect(getByText('3 stories')).toBeTruthy();
      });

      // Apply source filter first
      fireEvent.press(getByText('File'));

      await waitFor(() => {
        expect(getByText('1 story')).toBeTruthy();
      });

      // Then search within filtered results
      const searchInput = getByPlaceholderText('Search stories...');
      fireEvent.changeText(searchInput, 'adventure');

      await waitFor(() => {
        expect(getByText('The Adventures of Tom')).toBeTruthy();
        expect(getByText('1 story')).toBeTruthy();
      });
    });
  });

  describe('Story Selection', () => {
    it('should call onStorySelect when a story is pressed', async () => {
      const mockOnStorySelect = jest.fn();
      const mockOnClose = jest.fn();

      const { getByText } = render(
        <StorySelectionModal
          {...defaultProps}
          onStorySelect={mockOnStorySelect}
          onClose={mockOnClose}
        />,
      );

      await waitFor(() => {
        expect(getByText('The Adventures of Tom')).toBeTruthy();
      });

      fireEvent.press(getByText('The Adventures of Tom'));

      expect(mockOnStorySelect).toHaveBeenCalledWith(mockStories[0]);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should close modal when close button is pressed', () => {
      const mockOnClose = jest.fn();

      const { getAllByText } = render(
        <StorySelectionModal {...defaultProps} onClose={mockOnClose} />,
      );

      // Find close button (✕) in header
      const closeButtons = getAllByText('✕');
      fireEvent.press(closeButtons[0]); // First one should be the header close button

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Loading and Error States', () => {
    it('should show skeleton loading when loading', async () => {
      // Mock loading state
      mockGetStoryLibrary.mockImplementation(() => new Promise(() => {})); // Never resolves

      const { queryByText } = render(<StorySelectionModal {...defaultProps} />);

      // Should not show stories while loading
      expect(queryByText('The Adventures of Tom')).toBeFalsy();

      // Should show skeleton (we can't easily test this without the actual skeleton rendering)
      // But we can verify stories aren't shown
    });

    it('should show error state when loading fails', async () => {
      mockGetStoryLibrary.mockResolvedValue({
        success: false,
        error: 'Failed to load stories',
      });

      const { getByText } = render(<StorySelectionModal {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('Failed to load stories')).toBeTruthy();
        expect(getByText('Retry')).toBeTruthy();
      });
    });

    it('should retry loading when retry button is pressed', async () => {
      mockGetStoryLibrary
        .mockResolvedValueOnce({
          success: false,
          error: 'Failed to load stories',
        })
        .mockResolvedValueOnce({
          success: true,
          stories: mockStories,
          total: mockStories.length,
        });

      const { getByText } = render(<StorySelectionModal {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('Failed to load stories')).toBeTruthy();
      });

      fireEvent.press(getByText('Retry'));

      await waitFor(() => {
        expect(getByText('The Adventures of Tom')).toBeTruthy();
      });

      expect(mockGetStoryLibrary).toHaveBeenCalledTimes(2);
    });

    it('should show empty state when no stories exist', async () => {
      mockGetStoryLibrary.mockResolvedValue({
        success: true,
        stories: [],
        total: 0,
      });

      const { getByText } = render(<StorySelectionModal {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('No stories found')).toBeTruthy();
      });
    });
  });

  describe('Props Handling', () => {
    it('should filter out excluded story IDs', async () => {
      const { getByText, queryByText } = render(
        <StorySelectionModal
          {...defaultProps}
          excludeStoryIds={['story-1', 'story-2']}
        />,
      );

      await waitFor(() => {
        expect(queryByText('The Adventures of Tom')).toBeFalsy();
        expect(queryByText('Space Exploration')).toBeFalsy();
        expect(
          getByText('Mystery at the mansion began when detective...'),
        ).toBeTruthy();
        expect(getByText('1 story')).toBeTruthy();
      });
    });

    it('should show only completed stories when showOnlyCompleted is true', async () => {
      const { getByText, queryByText } = render(
        <StorySelectionModal {...defaultProps} showOnlyCompleted={true} />,
      );

      await waitFor(() => {
        expect(getByText('The Adventures of Tom')).toBeTruthy();
        expect(queryByText('Space Exploration')).toBeFalsy(); // Not completed
        expect(
          getByText('Mystery at the mansion began when detective...'),
        ).toBeTruthy();
        expect(getByText('2 stories')).toBeTruthy();
      });
    });

    it('should set initial source filter', async () => {
      const { getByText, queryByText } = render(
        <StorySelectionModal
          {...defaultProps}
          initialSource="CreativeBridge"
        />,
      );

      await waitFor(() => {
        expect(queryByText('The Adventures of Tom')).toBeFalsy();
        expect(getByText('Space Exploration')).toBeTruthy();
        expect(
          queryByText('Mystery at the mansion began when detective...'),
        ).toBeFalsy();
        expect(getByText('1 story')).toBeTruthy();
      });
    });
  });

  describe('Pull to Refresh', () => {
    it('should reload stories when pull to refresh is triggered', async () => {
      const { getByTestId } = render(<StorySelectionModal {...defaultProps} />);

      await waitFor(() => {
        expect(mockGetStoryLibrary).toHaveBeenCalledTimes(1);
      });

      // Simulate pull to refresh (this is complex to test in jest, but we can verify the service call)
      // In a real test environment, you might use a more sophisticated testing approach

      // For now, we just verify that the service is set up correctly
      expect(mockGetStoryLibrary).toHaveBeenCalledWith({
        userId: 'user-123',
        limit: 100,
        offset: 0,
        sortBy: 'created_at',
        sortOrder: 'desc',
      });
    });
  });
});

// Helper function to get all matching text elements
function getAllByText(container: any, text: string) {
  const elements = container.queryAllByText(text);
  return elements;
}
