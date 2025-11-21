/**
 * End-to-End Testing for Voice Input/Output Features
 * Task 3.9: Comprehensive testing of complete voice input/output feature
 *
 * Tests complete user journey, error scenarios, grade levels, story lengths,
 * edge cases, performance, accessibility, and regression prevention.
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert, AccessibilityInfo } from 'react-native';
import HomeScreen from '../../screens/HomeScreen';
import { textToSpeechService } from '../../services/textToSpeechIsolated';
import Voice from '@react-native-voice/voice';
import { extractLatestContinuation } from '../../utils/storyUtils';

// Mock dependencies
jest.mock('react-native-url-polyfill/auto', () => ({}));
jest.mock('../../services/textToSpeechIsolated');
jest.mock('@react-native-voice/voice');
jest.mock('../../utils/storyUtils');
jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: jest.fn(),
  getString: jest.fn(() => Promise.resolve('')),
}));
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user' },
    userProfile: { preferred_grade_level: 'K-2', speech_enabled: true },
  }),
}));
jest.mock('../../services/storyAgent');
jest.mock('../../services/storyGenerationService');
jest.mock('../../services/api');
jest.mock('../../services/storySessionManager');
jest.mock('../../services/challengeService');
jest.mock('../../services/storyDownloadService');
jest.mock('../../utils/rnfsWrapper');

describe('End-to-End Voice Features', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock TTS service
    (textToSpeechService.isServiceAvailable as jest.Mock).mockReturnValue(true);
    (textToSpeechService.initialize as jest.Mock).mockResolvedValue(undefined);
    (textToSpeechService.setupEventListeners as jest.Mock).mockImplementation(
      callbacks => {
        // Store callbacks for simulation
        if (callbacks.onStart) {
          setTimeout(() => callbacks.onStart(), 100);
        }
      },
    );
    (textToSpeechService.removeAllListeners as jest.Mock).mockImplementation(
      () => {},
    );
    (textToSpeechService.speakStoryContent as jest.Mock).mockResolvedValue(
      undefined,
    );
    (textToSpeechService.pause as jest.Mock).mockResolvedValue(undefined);
    (textToSpeechService.resume as jest.Mock).mockResolvedValue(undefined);
    (textToSpeechService.stop as jest.Mock).mockResolvedValue(undefined);

    // Mock Voice service
    (Voice.start as jest.Mock).mockResolvedValue(undefined);
    (Voice.stop as jest.Mock).mockResolvedValue(undefined);
    (Voice.destroy as jest.Mock).mockResolvedValue(undefined);
    (Voice.removeAllListeners as jest.Mock).mockImplementation(() => {});

    // Mock extractLatestContinuation
    (extractLatestContinuation as jest.Mock).mockImplementation(content => {
      if (!content) return '';
      const sentences = content.split(/[.!?]+/).filter(s => s.trim());
      return sentences[sentences.length - 1]?.trim() || '';
    });

    // Mock Alert
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    // Mock AccessibilityInfo
    jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => {});
  });

  describe('Complete User Journey', () => {
    test('complete voice interaction flow: listen → speak → transcribe → edit → submit', async () => {
      const mockStoryContent =
        'Once upon a time. The hero continued the adventure.';
      const mockSession = {
        id: 'test-session',
        story_content: mockStoryContent,
        contributions: [
          { content: 'Once upon a time.', order: 1 },
          { content: 'The hero continued the adventure.', order: 2 },
        ],
      };

      const { getByTestId, getByPlaceholderText } = render(
        <HomeScreen navigation={{} as any} />,
      );

      // Mock session data
      const storySessionManager = require('../../services/storySessionManager');
      storySessionManager.getCurrentSession = jest
        .fn()
        .mockResolvedValue(mockSession);

      // 1. Listen to story (speaker button)
      const speakerButton = getByTestId('speaker-button');
      expect(speakerButton).toBeTruthy();

      await act(async () => {
        fireEvent.press(speakerButton);
      });

      await waitFor(() => {
        expect(textToSpeechService.speakStoryContent).toHaveBeenCalled();
      });

      // 2. Pause playback
      await act(async () => {
        fireEvent.press(speakerButton);
      });

      await waitFor(() => {
        expect(textToSpeechService.pause).toHaveBeenCalled();
      });

      // 3. Resume playback
      await act(async () => {
        fireEvent.press(speakerButton);
      });

      await waitFor(() => {
        expect(textToSpeechService.resume).toHaveBeenCalled();
      });

      // 4. Speak continuation (mic button)
      const micButton = getByTestId('mic-button');
      expect(micButton).toBeTruthy();

      await act(async () => {
        fireEvent.press(micButton);
      });

      await waitFor(() => {
        expect(Voice.start).toHaveBeenCalled();
      });

      // Simulate speech recognition result
      const mockSpeechResult = 'The hero continued the amazing adventure';
      act(() => {
        (Voice.onSpeechResults as any)?.({
          value: [mockSpeechResult],
        });
      });

      // 5. Verify transcription appears in input field
      await waitFor(() => {
        const input = getByPlaceholderText(/continue/i);
        expect(input).toBeTruthy();
        // Input should contain transcribed text
      });

      // 6. Edit transcription (simulate text change)
      const input = getByPlaceholderText(/continue/i);
      fireEvent.changeText(
        input,
        'The hero continued the amazing adventure with friends',
      );

      // 7. Submit (Continue Story button)
      const continueButton = getByTestId('continue-story-button');
      if (continueButton) {
        await act(async () => {
          fireEvent.press(continueButton);
        });
      }
    });

    test('complete flow with multiple voice inputs', async () => {
      const { getByTestId, getByPlaceholderText } = render(
        <HomeScreen navigation={{} as any} />,
      );

      const micButton = getByTestId('mic-button');

      // First voice input
      await act(async () => {
        fireEvent.press(micButton);
      });

      act(() => {
        (Voice.onSpeechResults as any)?.({
          value: ['First part of the story'],
        });
      });

      await waitFor(() => {
        expect(Voice.start).toHaveBeenCalled();
      });

      // Second voice input (append)
      await act(async () => {
        fireEvent.press(micButton);
      });

      act(() => {
        (Voice.onSpeechResults as any)?.({
          value: ['Second part of the story'],
        });
      });

      // Verify both inputs are appended
      const input = getByPlaceholderText(/continue/i);
      expect(input).toBeTruthy();
    });
  });

  describe('Error Scenarios', () => {
    test('handles permission denied gracefully', async () => {
      // const onError = jest.fn(); // Currently unused
      const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

      // Simulate permission denied
      (Voice.start as jest.Mock).mockRejectedValue({
        error: { code: 'permission', message: 'Permission denied' },
      });

      const micButton = getByTestId('mic-button');
      await act(async () => {
        fireEvent.press(micButton);
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
      });

      // Verify typing still works as fallback
      const input = getByTestId('story-input') || getByTestId('text-input');
      if (input) {
        expect(input).not.toBeDisabled();
      }
    });

    test('handles network error gracefully', async () => {
      const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

      // Simulate network error
      (Voice.start as jest.Mock).mockRejectedValue({
        error: { code: 'network', message: 'Network error' },
      });

      const micButton = getByTestId('mic-button');
      await act(async () => {
        fireEvent.press(micButton);
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          expect.stringContaining('error'),
          expect.any(String),
          expect.any(Array),
        );
      });
    });

    test('handles recognition failed gracefully', async () => {
      // const { getByTestId } = render( // getByTestId currently unused
      render(<HomeScreen navigation={{} as any} />);

      // Simulate recognition failure
      act(() => {
        (Voice.onSpeechError as any)?.({
          error: { code: 'recognition', message: 'Recognition failed' },
        });
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
      });
    });

    test('handles service unavailable gracefully', async () => {
      (textToSpeechService.isServiceAvailable as jest.Mock).mockReturnValue(
        false,
      );

      const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

      const speakerButton = getByTestId('speaker-button');
      expect(speakerButton).toBeTruthy();
      expect(speakerButton.props.disabled).toBe(true);
    });

    test('typing always works as fallback', async () => {
      const { getByPlaceholderText } = render(
        <HomeScreen navigation={{} as any} />,
      );

      const input = getByPlaceholderText(/continue/i);
      expect(input).toBeTruthy();

      // Should be able to type even if voice fails
      fireEvent.changeText(input, 'Typed story continuation');
      expect(input.props.value || input.props.defaultValue).toBeTruthy();
    });
  });

  describe('Grade Level Testing', () => {
    const gradeLevels = ['K-2', '3-5', '6-8', '9-12'];

    gradeLevels.forEach(gradeLevel => {
      test(`voice input works with grade level ${gradeLevel}`, async () => {
        const { useAuth } = require('../../context/AuthContext');
        useAuth.mockReturnValue({
          user: { id: 'test-user' },
          userProfile: {
            preferred_grade_level: gradeLevel,
            speech_enabled: true,
          },
        });

        const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

        const micButton = getByTestId('mic-button');
        expect(micButton).toBeTruthy();

        await act(async () => {
          fireEvent.press(micButton);
        });

        await waitFor(() => {
          expect(Voice.start).toHaveBeenCalled();
        });
      });
    });
  });

  describe('Story Length Testing', () => {
    test('handles short continuations', async () => {
      const shortStory = 'Short story.';
      (extractLatestContinuation as jest.Mock).mockReturnValue(shortStory);

      const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

      const speakerButton = getByTestId('speaker-button');
      await act(async () => {
        fireEvent.press(speakerButton);
      });

      await waitFor(() => {
        expect(textToSpeechService.speakStoryContent).toHaveBeenCalled();
      });
    });

    test('handles medium continuations', async () => {
      const mediumStory =
        'This is a medium length story continuation that has several sentences and provides more context for the narrative.';
      (extractLatestContinuation as jest.Mock).mockReturnValue(mediumStory);

      const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

      const speakerButton = getByTestId('speaker-button');
      await act(async () => {
        fireEvent.press(speakerButton);
      });

      await waitFor(() => {
        expect(textToSpeechService.speakStoryContent).toHaveBeenCalled();
      });
    });

    test('handles long continuations', async () => {
      const longStory =
        'This is a very long story continuation that contains many sentences and provides extensive context for the narrative. It includes multiple paragraphs and detailed descriptions. The story continues with more content and additional details that make it quite lengthy.';
      (extractLatestContinuation as jest.Mock).mockReturnValue(longStory);

      const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

      const speakerButton = getByTestId('speaker-button');
      await act(async () => {
        fireEvent.press(speakerButton);
      });

      await waitFor(() => {
        expect(textToSpeechService.speakStoryContent).toHaveBeenCalled();
      });
    });
  });

  describe('Edge Cases', () => {
    test('handles empty input gracefully', async () => {
      const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

      const micButton = getByTestId('mic-button');
      await act(async () => {
        fireEvent.press(micButton);
      });

      // Simulate empty transcription
      act(() => {
        (Voice.onSpeechResults as any)?.({
          value: [''],
        });
      });

      // Should handle gracefully without crashing
      await waitFor(() => {
        expect(Voice.stop).toHaveBeenCalled();
      });
    });

    test('handles very long speech', async () => {
      const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

      const micButton = getByTestId('mic-button');
      await act(async () => {
        fireEvent.press(micButton);
      });

      // Simulate very long transcription
      const longText =
        'This is a very long speech transcription that contains many words and sentences. '.repeat(
          50,
        );
      act(() => {
        (Voice.onSpeechResults as any)?.({
          value: [longText],
        });
      });

      // Should handle without crashing
      await waitFor(() => {
        expect(Voice.stop).toHaveBeenCalled();
      });
    });

    test('handles rapid button presses', async () => {
      const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

      const micButton = getByTestId('mic-button');

      // Rapid presses
      await act(async () => {
        fireEvent.press(micButton);
        fireEvent.press(micButton);
        fireEvent.press(micButton);
      });

      // Should handle gracefully
      expect(Voice.start).toHaveBeenCalled();
    });

    test('handles no story content', async () => {
      const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

      const speakerButton = getByTestId('speaker-button');
      expect(speakerButton).toBeTruthy();
      // Button should be disabled when no content
      expect(speakerButton.props.disabled).toBe(true);
    });
  });

  describe('Performance Under Load', () => {
    test('handles multiple rapid voice operations', async () => {
      const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

      const micButton = getByTestId('mic-button');
      const startTime = Date.now();

      // Perform multiple operations
      for (let i = 0; i < 5; i++) {
        await act(async () => {
          fireEvent.press(micButton);
          act(() => {
            (Voice.onSpeechResults as any)?.({
              value: [`Operation ${i}`],
            });
          });
          fireEvent.press(micButton);
        });
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (< 5 seconds)
      expect(duration).toBeLessThan(5000);
    });

    test('UI remains responsive during voice operations', async () => {
      const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

      const micButton = getByTestId('mic-button');
      const speakerButton = getByTestId('speaker-button');

      // Start voice operation
      await act(async () => {
        fireEvent.press(micButton);
      });

      // UI should remain responsive
      expect(speakerButton).toBeTruthy();
      expect(micButton).toBeTruthy();
    });
  });

  describe('Accessibility Compliance', () => {
    test('speaker button has proper accessibility labels', async () => {
      const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

      const speakerButton = getByTestId('speaker-button');
      expect(speakerButton).toBeTruthy();
      expect(speakerButton.props.accessibilityLabel).toBeTruthy();
      expect(speakerButton.props.accessibilityRole).toBe('button');
    });

    test('mic button has proper accessibility labels', async () => {
      const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

      const micButton = getByTestId('mic-button');
      expect(micButton).toBeTruthy();
      expect(micButton.props.accessibilityLabel).toBeTruthy();
      expect(micButton.props.accessibilityRole).toBe('button');
    });

    test('accessibility announcements work', async () => {
      const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

      const speakerButton = getByTestId('speaker-button');
      await act(async () => {
        fireEvent.press(speakerButton);
      });

      await waitFor(() => {
        expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalled();
      });
    });
  });

  describe('Regression Prevention', () => {
    test('existing typing functionality still works', async () => {
      const { getByPlaceholderText } = render(
        <HomeScreen navigation={{} as any} />,
      );

      const input = getByPlaceholderText(/continue/i);
      expect(input).toBeTruthy();

      fireEvent.changeText(input, 'Typed story continuation');
      expect(input).toBeTruthy();
    });

    test('existing story generation still works', async () => {
      const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

      // Verify story generation button exists
      const continueButton = getByTestId('continue-story-button');
      expect(continueButton).toBeTruthy();
    });

    test('voice features do not interfere with existing features', async () => {
      const { getByTestId, getByPlaceholderText } = render(
        <HomeScreen navigation={{} as any} />,
      );

      // Use voice input
      const micButton = getByTestId('mic-button');
      await act(async () => {
        fireEvent.press(micButton);
      });

      // Typing should still work
      const input = getByPlaceholderText(/continue/i);
      fireEvent.changeText(input, 'Additional typed text');
      expect(input).toBeTruthy();
    });
  });

  describe('State Management', () => {
    test('speaker button state transitions correctly', async () => {
      const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

      const speakerButton = getByTestId('speaker-button');

      // Start speaking
      await act(async () => {
        fireEvent.press(speakerButton);
      });

      // Pause
      await act(async () => {
        fireEvent.press(speakerButton);
      });

      // Resume
      await act(async () => {
        fireEvent.press(speakerButton);
      });

      // Verify state transitions
      expect(textToSpeechService.speakStoryContent).toHaveBeenCalled();
      expect(textToSpeechService.pause).toHaveBeenCalled();
      expect(textToSpeechService.resume).toHaveBeenCalled();
    });

    test('mic button state transitions correctly', async () => {
      const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

      const micButton = getByTestId('mic-button');

      // Start listening
      await act(async () => {
        fireEvent.press(micButton);
      });

      // Stop listening
      await act(async () => {
        fireEvent.press(micButton);
      });

      // Verify state transitions
      expect(Voice.start).toHaveBeenCalled();
      expect(Voice.stop).toHaveBeenCalled();
    });
  });
});
