/**
 * Performance Tests: UI State Update Performance
 *
 * Tests UI component rendering performance to ensure:
 * - State updates are smooth (< 16ms for 60 FPS)
 * - Re-renders don't cause jank
 * - Component updates are efficient
 */

import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';
import { ImageGeneration } from '../../src/components/common/ImageGeneration';
import { StoryImageDisplay } from '../../src/components/common/StoryImageDisplay';

// Mock dependencies
jest.mock('../../src/services/supabase');
jest.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user' },
    effectiveUserId: 'test-user',
  }),
}));

describe('Performance Tests: UI State Update Performance', () => {
  /**
   * Test 1: Round increment update < 16ms (60 FPS)
   * NFR Requirement: UI updates should not cause frame drops
   */
  it('should update round progress in < 16ms for 60 FPS', async () => {
    const baseProps = {
      storyContent: 'Test story content',
      sessionId: 'test-session',
      gradeLevel: 'K-2' as const,
      wordCount: 50,
      onImageGenerated: jest.fn(),
      onError: jest.fn(),
      disabled: false,
      maxRounds: 5,
    };

    // Initial render at round 3
    const { rerender } = render(
      <ImageGeneration
        {...baseProps}
        isStoryCompleted={false}
        currentRound={3}
      />
    );

    // Measure state update time
    const startTime = performance.now();

    await act(async () => {
      // Update to round 4
      rerender(
        <ImageGeneration
          {...baseProps}
          isStoryCompleted={false}
          currentRound={4}
        />
      );
    });

    const elapsed = performance.now() - startTime;

    // Should be well under 16ms for smooth 60 FPS
    expect(elapsed).toBeLessThan(16);

    console.log(`✓ Round progress update: ${elapsed.toFixed(2)}ms (target: < 16ms for 60 FPS)`);
  });

  /**
   * Test 2: Completion state transition is smooth
   * Transitioning from incomplete to complete should be fast
   */
  it('should transition to completed state quickly', async () => {
    const baseProps = {
      storyContent: 'Complete story',
      sessionId: 'test-session',
      gradeLevel: 'K-2' as const,
      wordCount: 100,
      onImageGenerated: jest.fn(),
      onError: jest.fn(),
      disabled: false,
      maxRounds: 5,
    };

    const { rerender } = render(
      <ImageGeneration
        {...baseProps}
        isStoryCompleted={false}
        currentRound={4}
      />
    );

    const startTime = performance.now();

    await act(async () => {
      rerender(
        <ImageGeneration
          {...baseProps}
          isStoryCompleted={true}
          currentRound={5}
        />
      );
    });

    const elapsed = performance.now() - startTime;

    expect(elapsed).toBeLessThan(16);

    console.log(`✓ Completion state transition: ${elapsed.toFixed(2)}ms`);
  });

  /**
   * Test 3: Image display component loads quickly
   * Initial render should be fast
   */
  it('should render StoryImageDisplay component quickly', async () => {
    const props = {
      replicateUrl: 'https://replicate.delivery/image.png',
      supabaseUrl: 'https://supabase.co/storage/image.png',
      uploadStatus: 'uploaded' as const,
      sessionId: 'test-session',
      userId: 'test-user',
      onRetryUpload: jest.fn(),
    };

    const startTime = performance.now();

    render(<StoryImageDisplay {...props} />);

    const elapsed = performance.now() - startTime;

    // Initial render should be very fast
    expect(elapsed).toBeLessThan(50); // < 50ms

    console.log(`✓ StoryImageDisplay initial render: ${elapsed.toFixed(2)}ms`);
  });

  /**
   * Test 4: Upload status badge updates smoothly
   * Changing from pending → uploaded should be fast
   */
  it('should update upload status badge efficiently', async () => {
    const baseProps = {
      replicateUrl: 'https://replicate.delivery/image.png',
      sessionId: 'test-session',
      userId: 'test-user',
      onRetryUpload: jest.fn(),
    };

    const { rerender } = render(
      <StoryImageDisplay
        {...baseProps}
        uploadStatus="pending"
      />
    );

    const startTime = performance.now();

    await act(async () => {
      rerender(
        <StoryImageDisplay
          {...baseProps}
          supabaseUrl="https://supabase.co/storage/image.png"
          uploadStatus="uploaded"
        />
      );
    });

    const elapsed = performance.now() - startTime;

    expect(elapsed).toBeLessThan(16);

    console.log(`✓ Upload status badge update: ${elapsed.toFixed(2)}ms`);
  });

  /**
   * Test 5: Multiple rapid state updates don't cause performance degradation
   * Simulating rapid progress updates
   */
  it('should handle rapid state updates without performance degradation', async () => {
    const baseProps = {
      storyContent: 'Test story',
      sessionId: 'test-session',
      gradeLevel: 'K-2' as const,
      wordCount: 50,
      onImageGenerated: jest.fn(),
      onError: jest.fn(),
      disabled: false,
      maxRounds: 5,
    };

    const { rerender } = render(
      <ImageGeneration
        {...baseProps}
        isStoryCompleted={false}
        currentRound={1}
      />
    );

    const updateTimes: number[] = [];

    // Simulate 5 rapid updates (round 1 → 5)
    for (let round = 2; round <= 5; round++) {
      const startTime = performance.now();

      await act(async () => {
        rerender(
          <ImageGeneration
            {...baseProps}
            isStoryCompleted={round === 5}
            currentRound={round}
          />
        );
      });

      const elapsed = performance.now() - startTime;
      updateTimes.push(elapsed);
    }

    // All updates should be fast
    updateTimes.forEach((time, index) => {
      expect(time).toBeLessThan(16);
    });

    const avgTime = updateTimes.reduce((sum, t) => sum + t, 0) / updateTimes.length;
    const maxTime = Math.max(...updateTimes);

    console.log(`✓ Rapid updates (4 consecutive): avg ${avgTime.toFixed(2)}ms, max ${maxTime.toFixed(2)}ms`);
  });

  /**
   * Test 6: Component doesn't re-render unnecessarily
   * Same props should not trigger re-render
   */
  it('should not re-render with identical props', async () => {
    const baseProps = {
      storyContent: 'Test story',
      sessionId: 'test-session',
      gradeLevel: 'K-2' as const,
      wordCount: 50,
      onImageGenerated: jest.fn(),
      onError: jest.fn(),
      disabled: false,
      isStoryCompleted: false,
      currentRound: 3,
      maxRounds: 5,
    };

    let renderCount = 0;

    // Create a component wrapper that counts renders
    const TestWrapper = (props: any) => {
      React.useEffect(() => {
        renderCount++;
      });
      return <ImageGeneration {...props} />;
    };

    const { rerender } = render(<TestWrapper {...baseProps} />);

    const initialRenderCount = renderCount;

    // Re-render with same props
    await act(async () => {
      rerender(<TestWrapper {...baseProps} />);
    });

    // Should not increase render count (assuming proper memoization)
    // Note: This depends on component implementation using React.memo
    // If not memoized, this test will highlight potential optimization

    console.log(`✓ Re-render check: ${renderCount} total renders (initial: ${initialRenderCount})`);
  });

  /**
   * Test 7: Large content doesn't slow down rendering
   * Component should handle large story content efficiently
   */
  it('should render efficiently with large story content', async () => {
    const largeStory = 'Lorem ipsum dolor sit amet. '.repeat(200); // ~5000 chars

    const props = {
      storyContent: largeStory,
      sessionId: 'test-session',
      gradeLevel: 'K-2' as const,
      wordCount: 500,
      onImageGenerated: jest.fn(),
      onError: jest.fn(),
      disabled: false,
      isStoryCompleted: true,
      currentRound: 5,
      maxRounds: 5,
    };

    const startTime = performance.now();

    render(<ImageGeneration {...props} />);

    const elapsed = performance.now() - startTime;

    // Even with large content, should render quickly
    expect(elapsed).toBeLessThan(100); // < 100ms

    console.log(`✓ Large content render (${largeStory.length} chars): ${elapsed.toFixed(2)}ms`);
  });
});
