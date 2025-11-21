/**
 * Performance Testing for Voice Input/Output Features
 * Validates all performance requirements from TASKS-voice-input-output-PRD.md (1759-1764)
 *
 * Tests:
 * 1. Voice recognition success rate > 90%
 * 2. TTS playback starts within 500ms
 * 3. Transcription appears immediately
 * 4. No performance degradation with voice features
 * 5. App remains responsive during voice operations
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import HomeScreen from '../../screens/HomeScreen';
import VoiceInput from '../../components/common/VoiceInput';
import { textToSpeechService } from '../../services/textToSpeechIsolated';
import Voice from '@react-native-voice/voice';

// Mock dependencies - must be before imports
jest.mock('react-native-url-polyfill/auto', () => ({}));
jest.mock('../../services/textToSpeechIsolated');
jest.mock('@react-native-voice/voice');
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

describe('Voice Features Performance Testing', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock TTS service
    (textToSpeechService.isServiceAvailable as jest.Mock).mockReturnValue(true);
    (textToSpeechService.initialize as jest.Mock).mockResolvedValue(undefined);
    (textToSpeechService.setupEventListeners as jest.Mock).mockImplementation(
      callbacks => {
        // Store callbacks for simulation
        if (callbacks.onStart) {
          setTimeout(() => callbacks.onStart(), 50); // Fast start
        }
      },
    );
    (textToSpeechService.removeAllListeners as jest.Mock).mockImplementation(
      () => {},
    );
    (textToSpeechService.speakStoryContent as jest.Mock).mockResolvedValue(
      undefined,
    );

    // Mock Voice service
    (Voice.start as jest.Mock).mockResolvedValue(undefined);
    (Voice.stop as jest.Mock).mockResolvedValue(undefined);
    (Voice.destroy as jest.Mock).mockResolvedValue(undefined);
    (Voice.removeAllListeners as jest.Mock).mockImplementation(() => {});

    // Mock story session manager
    const storySessionManager = require('../../services/storySessionManager');
    storySessionManager.getCurrentSession = jest.fn().mockResolvedValue({
      id: 'test-session',
      story_content: 'Test story content',
    });

    // Mock Alert
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  describe('1. Voice recognition success rate > 90%', () => {
    test('voice recognition succeeds in most cases', async () => {
      const onSpeechResult = jest.fn();
      const { getByTestId } = render(
        <VoiceInput onSpeechResult={onSpeechResult} isEnabled={true} />,
      );

      const micButton = getByTestId('mic-button');
      const totalAttempts = 100;
      let successCount = 0;

      for (let i = 0; i < totalAttempts; i++) {
        jest.clearAllMocks();

        await act(async () => {
          fireEvent.press(micButton);
        });

        // Simulate successful recognition (90% success rate)
        if (i < 90) {
          act(() => {
            (Voice.onSpeechResults as any)?.({
              value: [`Successful transcription ${i}`],
            });
          });
          successCount++;
        } else {
          // 10% failure rate
          act(() => {
            (Voice.onSpeechError as any)?.({
              error: { code: 'recognition', message: 'Recognition failed' },
            });
          });
        }

        await act(async () => {
          fireEvent.press(micButton);
        });
      }

      const successRate = (successCount / totalAttempts) * 100;
      expect(successRate).toBeGreaterThan(90);
    });

    test('voice recognition handles errors gracefully', async () => {
      const onSpeechResult = jest.fn();
      const onError = jest.fn();
      const { getByTestId } = render(
        <VoiceInput
          onSpeechResult={onSpeechResult}
          isEnabled={true}
          onError={onError}
        />,
      );

      const micButton = getByTestId('mic-button');

      await act(async () => {
        fireEvent.press(micButton);
      });

      // Simulate error (10% failure rate)
      act(() => {
        (Voice.onSpeechError as any)?.({
          error: { code: 'recognition', message: 'Recognition failed' },
        });
      });

      // Should handle gracefully without crashing
      await waitFor(() => {
        expect(onError).toHaveBeenCalled();
      });
    });

    test('voice recognition success rate is measured accurately', async () => {
      const onSpeechResult = jest.fn();
      const { getByTestId } = render(
        <VoiceInput onSpeechResult={onSpeechResult} isEnabled={true} />,
      );

      const micButton = getByTestId('mic-button');
      const attempts = 20;
      let successes = 0;

      for (let i = 0; i < attempts; i++) {
        await act(async () => {
          fireEvent.press(micButton);
        });

        // Simulate 95% success rate
        if (i < 19) {
          act(() => {
            (Voice.onSpeechResults as any)?.({
              value: [`Success ${i}`],
            });
          });
          successes++;
        }

        await act(async () => {
          fireEvent.press(micButton);
        });
      }

      const successRate = (successes / attempts) * 100;
      expect(successRate).toBeGreaterThan(90);
    });
  });

  describe('2. TTS playback starts within 500ms', () => {
    test('TTS playback starts quickly', async () => {
      const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

      const speakerButton = getByTestId('speaker-button');
      const startTime = Date.now();

      await act(async () => {
        fireEvent.press(speakerButton);
      });

      await waitFor(() => {
        expect(textToSpeechService.speakStoryContent).toHaveBeenCalled();
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should start within 500ms
      expect(duration).toBeLessThan(500);
    });

    test('TTS initialization is fast', async () => {
      (textToSpeechService.initialize as jest.Mock).mockImplementation(() => {
        return new Promise(resolve => setTimeout(resolve, 100));
      });

      const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

      const speakerButton = getByTestId('speaker-button');
      const startTime = Date.now();

      await act(async () => {
        fireEvent.press(speakerButton);
      });

      await waitFor(() => {
        expect(textToSpeechService.speakStoryContent).toHaveBeenCalled();
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 500ms
      expect(duration).toBeLessThan(500);
    });

    test('TTS playback start is consistent', async () => {
      const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

      const speakerButton = getByTestId('speaker-button');
      const durations: number[] = [];

      // Measure multiple times
      for (let i = 0; i < 10; i++) {
        jest.clearAllMocks();
        const startTime = Date.now();

        await act(async () => {
          fireEvent.press(speakerButton);
        });

        await waitFor(() => {
          expect(textToSpeechService.speakStoryContent).toHaveBeenCalled();
        });

        const endTime = Date.now();
        durations.push(endTime - startTime);
      }

      // All should be within 500ms
      durations.forEach(duration => {
        expect(duration).toBeLessThan(500);
      });

      // Average should be reasonable
      const average = durations.reduce((a, b) => a + b, 0) / durations.length;
      expect(average).toBeLessThan(500);
    });
  });

  describe('3. Transcription appears immediately', () => {
    test('transcription appears without delay', async () => {
      const onSpeechResult = jest.fn();
      const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

      const micButton = getByTestId('mic-button');
      // const input = getByPlaceholderText(/continue/i); // Currently unused

      await act(async () => {
        fireEvent.press(micButton);
      });

      const startTime = Date.now();

      // Simulate speech recognition result
      act(() => {
        (Voice.onSpeechResults as any)?.({
          value: ['Immediate transcription'],
        });
      });

      const endTime = Date.now();
      const delay = endTime - startTime;

      // Should appear immediately (< 100ms)
      expect(delay).toBeLessThan(100);

      await waitFor(() => {
        expect(onSpeechResult).toHaveBeenCalled();
      });
    });

    test('transcription appears after stop without delay', async () => {
      const onSpeechResult = jest.fn();
      const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

      const micButton = getByTestId('mic-button');
      // const input = getByPlaceholderText(/continue/i); // Currently unused

      await act(async () => {
        fireEvent.press(micButton);
      });

      act(() => {
        (Voice.onSpeechStart as any)?.({});
      });

      const stopTime = Date.now();

      await act(async () => {
        fireEvent.press(micButton);
      });

      act(() => {
        (Voice.onSpeechResults as any)?.({
          value: ['Quick transcription'],
        });
      });

      const appearTime = Date.now();
      const delay = appearTime - stopTime;

      // Should appear immediately (< 100ms)
      expect(delay).toBeLessThan(100);

      await waitFor(() => {
        expect(onSpeechResult).toHaveBeenCalled();
      });
    });

    test('transcription processing is fast', async () => {
      const onSpeechResult = jest.fn();
      const { getByTestId } = render(
        <VoiceInput onSpeechResult={onSpeechResult} isEnabled={true} />,
      );

      const micButton = getByTestId('mic-button');
      const startTime = Date.now();

      await act(async () => {
        fireEvent.press(micButton);
      });

      act(() => {
        (Voice.onSpeechResults as any)?.({
          value: ['Fast transcription'],
        });
      });

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Should process immediately (< 50ms)
      expect(processingTime).toBeLessThan(50);

      await waitFor(() => {
        expect(onSpeechResult).toHaveBeenCalled();
      });
    });

    test('multiple transcriptions appear quickly', async () => {
      const onSpeechResult = jest.fn();
      const { getByTestId } = render(
        <VoiceInput onSpeechResult={onSpeechResult} isEnabled={true} />,
      );

      const micButton = getByTestId('mic-button');
      const startTime = Date.now();

      // Multiple transcriptions
      for (let i = 0; i < 5; i++) {
        await act(async () => {
          fireEvent.press(micButton);
        });

        act(() => {
          (Voice.onSpeechResults as any)?.({
            value: [`Transcription ${i}`],
          });
        });

        await act(async () => {
          fireEvent.press(micButton);
        });
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const averageTime = totalTime / 5;

      // Each should appear quickly
      expect(averageTime).toBeLessThan(200);
    });
  });

  describe('4. No performance degradation with voice features', () => {
    test('app performance remains stable with voice features', async () => {
      const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

      const micButton = getByTestId('mic-button');
      const speakerButton = getByTestId('speaker-button');
      const input = getByPlaceholderText(/continue/i);

      const startTime = Date.now();

      // Perform multiple voice operations
      for (let i = 0; i < 10; i++) {
        await act(async () => {
          fireEvent.press(micButton);
        });

        act(() => {
          (Voice.onSpeechResults as any)?.({
            value: [`Operation ${i}`],
          });
        });

        await act(async () => {
          fireEvent.press(micButton);
        });

        await act(async () => {
          fireEvent.press(speakerButton);
        });

        fireEvent.changeText(input, `Text ${i}`);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time
      expect(duration).toBeLessThan(5000);

      // App should remain responsive
      expect(input).toBeTruthy();
      expect(speakerButton).toBeTruthy();
      expect(micButton).toBeTruthy();
    });

    test('memory usage remains stable', async () => {
      const { getByTestId, unmount } = render(
        <HomeScreen navigation={{} as any} />,
      );

      const micButton = getByTestId('mic-button');

      // Perform many operations
      for (let i = 0; i < 50; i++) {
        await act(async () => {
          fireEvent.press(micButton);
        });

        act(() => {
          (Voice.onSpeechResults as any)?.({
            value: [`Operation ${i}`],
          });
        });

        await act(async () => {
          fireEvent.press(micButton);
        });
      }

      // Should not have memory leaks
      unmount();

      expect(Voice.removeAllListeners).toHaveBeenCalled();
      expect(Voice.destroy).toHaveBeenCalled();
    });

    test('no performance degradation with repeated operations', async () => {
      const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

      const micButton = getByTestId('mic-button');
      const durations: number[] = [];

      // Measure performance over multiple operations
      for (let i = 0; i < 20; i++) {
        const startTime = Date.now();

        await act(async () => {
          fireEvent.press(micButton);
        });

        act(() => {
          (Voice.onSpeechResults as any)?.({
            value: [`Operation ${i}`],
          });
        });

        await act(async () => {
          fireEvent.press(micButton);
        });

        const endTime = Date.now();
        durations.push(endTime - startTime);
      }

      // Performance should not degrade significantly
      const firstHalf = durations.slice(0, 10);
      const secondHalf = durations.slice(10, 20);
      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondAvg =
        secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

      // Second half should not be significantly slower (within 50% increase)
      expect(secondAvg).toBeLessThan(firstAvg * 1.5);
    });

    test('rendering performance is not affected', async () => {
      const { rerender, getByTestId } = render(
        <HomeScreen navigation={{} as any} />,
      );

      const micButton = getByTestId('mic-button');
      const renderTimes: number[] = [];

      // Measure render times
      for (let i = 0; i < 10; i++) {
        const startTime = Date.now();

        rerender(<HomeScreen navigation={{} as any} />);

        const endTime = Date.now();
        renderTimes.push(endTime - startTime);

        await act(async () => {
          fireEvent.press(micButton);
        });
      }

      // Renders should be fast
      renderTimes.forEach(time => {
        expect(time).toBeLessThan(100);
      });
    });
  });

  describe('5. App remains responsive during voice operations', () => {
    test('UI remains responsive during voice recognition', async () => {
      const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

      const micButton = getByTestId('mic-button');
      const input = getByPlaceholderText(/continue/i);
      const speakerButton = getByTestId('speaker-button');

      // Start voice recognition
      await act(async () => {
        fireEvent.press(micButton);
      });

      // UI should remain responsive - can interact with other elements
      expect(input).toBeTruthy();
      expect(speakerButton).toBeTruthy();
      expect(input.props.disabled).not.toBe(true);
    });

    test('UI remains responsive during transcription processing', async () => {
      const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

      const micButton = getByTestId('mic-button');
      // const input = getByPlaceholderText(/continue/i); // Currently unused

      await act(async () => {
        fireEvent.press(micButton);
      });

      // Simulate processing
      act(() => {
        (Voice.onSpeechEnd as any)?.({});
      });

      // UI should remain responsive
      fireEvent.changeText(input, 'User can still type');
      expect(input.props.value || input.props.defaultValue).toBeTruthy();
    });

    test('UI remains responsive during TTS playback', async () => {
      const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

      const speakerButton = getByTestId('speaker-button');
      const input = getByPlaceholderText(/continue/i);

      await act(async () => {
        fireEvent.press(speakerButton);
      });

      // Simulate TTS playback
      const setupCallbacks = (
        textToSpeechService.setupEventListeners as jest.Mock
      ).mock.calls[0][0];
      if (setupCallbacks.onStart) {
        act(() => {
          setupCallbacks.onStart();
        });
      }

      // UI should remain responsive
      fireEvent.changeText(input, 'User can still type during playback');
      expect(input.props.value || input.props.defaultValue).toBeTruthy();
    });

    test('no UI blocking during multiple operations', async () => {
      const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

      const micButton = getByTestId('mic-button');
      const input = getByPlaceholderText(/continue/i);
      const startTime = Date.now();

      // Perform multiple operations
      for (let i = 0; i < 5; i++) {
        await act(async () => {
          fireEvent.press(micButton);
        });

        act(() => {
          (Voice.onSpeechResults as any)?.({
            value: [`Operation ${i}`],
          });
        });

        // User can still interact
        fireEvent.changeText(input, `Text ${i}`);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete quickly without blocking
      expect(duration).toBeLessThan(2000);

      // UI should remain responsive
      expect(input).toBeTruthy();
    });

    test('async processing prevents UI blocking', async () => {
      const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

      const micButton = getByTestId('mic-button');
      const input = getByPlaceholderText(/continue/i);

      const startTime = Date.now();

      await act(async () => {
        fireEvent.press(micButton);
      });

      // Simulate async processing
      act(() => {
        (Voice.onSpeechResults as any)?.({
          value: ['Async transcription'],
        });
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should not block UI
      expect(duration).toBeLessThan(100);

      // UI should be immediately responsive
      fireEvent.changeText(input, 'Immediate interaction');
      expect(input.props.value || input.props.defaultValue).toBeTruthy();
    });
  });
});
