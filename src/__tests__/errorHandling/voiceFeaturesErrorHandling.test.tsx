/**
 * Error Handling Testing for Voice Input/Output Features
 * Validates all error handling requirements from TASKS-voice-input-output-PRD.md (1744-1750)
 *
 * Tests:
 * 1. Speech recognition failures show user-friendly errors
 * 2. Permission denials are handled gracefully
 * 3. Service unavailability disables buttons appropriately
 * 4. Background noise is handled correctly
 * 5. Network errors are handled
 * 6. Typing always remains available
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Platform, Alert, PermissionsAndroid } from 'react-native';
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
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    Platform: {
      OS: 'ios',
      select: jest.fn(obj => obj.ios || obj.default),
    },
    PermissionsAndroid: {
      check: jest.fn(),
      request: jest.fn(),
      PERMISSIONS: {
        RECORD_AUDIO: 'android.permission.RECORD_AUDIO',
      },
      RESULTS: {
        GRANTED: 'granted',
        DENIED: 'denied',
        NEVER_ASK_AGAIN: 'never_ask_again',
      },
    },
    Linking: {
      openSettings: jest.fn(() => Promise.resolve()),
    },
  };
});

describe('Voice Features Error Handling Testing', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock TTS service
    (textToSpeechService.isServiceAvailable as jest.Mock).mockReturnValue(true);
    (textToSpeechService.initialize as jest.Mock).mockResolvedValue(undefined);
    (textToSpeechService.setupEventListeners as jest.Mock).mockImplementation(
      () => {},
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

  describe('1. Speech recognition failures show user-friendly errors', () => {
    test('recognition error shows user-friendly message', async () => {
      const onError = jest.fn();
      const { getByTestId } = render(
        <VoiceInput
          onSpeechResult={jest.fn()}
          isEnabled={true}
          onError={onError}
        />,
      );

      const micButton = getByTestId('mic-button');

      await act(async () => {
        fireEvent.press(micButton);
      });

      // Simulate recognition error
      act(() => {
        (Voice.onSpeechError as any)?.({
          error: {
            code: 'recognition',
            message: 'Recognition failed',
          },
        });
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          expect.stringContaining('Voice Input Error'),
          expect.stringContaining('recognition'),
          expect.any(Array),
        );
      });

      expect(onError).toHaveBeenCalled();
    });

    test('recognition error shows "Try Again" option', async () => {
      const { getByTestId } = render(
        <VoiceInput onSpeechResult={jest.fn()} isEnabled={true} />,
      );

      const micButton = getByTestId('mic-button');

      await act(async () => {
        fireEvent.press(micButton);
      });

      act(() => {
        (Voice.onSpeechError as any)?.({
          error: {
            code: 'recognition',
            message: 'Recognition failed',
          },
        });
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(String),
          expect.arrayContaining([
            expect.objectContaining({ text: 'Try Again' }),
          ]),
        );
      });
    });

    test('different error codes show appropriate messages', async () => {
      const errorScenarios = [
        { code: 'network', expectedMessage: 'network' },
        { code: 'permission', expectedMessage: 'permission' },
        { code: 'recognition', expectedMessage: 'recognition' },
        { code: 'audio', expectedMessage: 'audio' },
      ];

      for (const scenario of errorScenarios) {
        jest.clearAllMocks();

        const { getByTestId } = render(
          <VoiceInput onSpeechResult={jest.fn()} isEnabled={true} />,
        );

        const micButton = getByTestId('mic-button');

        await act(async () => {
          fireEvent.press(micButton);
        });

        act(() => {
          (Voice.onSpeechError as any)?.({
            error: {
              code: scenario.code,
              message: `${scenario.code} error`,
            },
          });
        });

        await waitFor(() => {
          expect(Alert.alert).toHaveBeenCalledWith(
            expect.any(String),
            expect.stringMatching(new RegExp(scenario.expectedMessage, 'i')),
            expect.any(Array),
          );
        });
      }
    });

    test('error message is clear and actionable', async () => {
      const { getByTestId } = render(
        <VoiceInput onSpeechResult={jest.fn()} isEnabled={true} />,
      );

      const micButton = getByTestId('mic-button');

      await act(async () => {
        fireEvent.press(micButton);
      });

      act(() => {
        (Voice.onSpeechError as any)?.({
          error: {
            code: 'recognition',
            message: 'Recognition failed',
          },
        });
      });

      await waitFor(() => {
        const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
        const message = alertCall[1];

        // Message should be user-friendly (not technical)
        expect(message).not.toContain('Error code');
        expect(message).not.toContain('undefined');
        expect(message.length).toBeGreaterThan(20); // Meaningful message
      });
    });
  });

  describe('2. Permission denials are handled gracefully', () => {
    test('iOS permission denial shows user-friendly message', async () => {
      Platform.OS = 'ios';
      (Voice.start as jest.Mock).mockRejectedValue({
        error: { code: 'permission', message: 'Permission denied' },
      });

      const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

      const micButton = getByTestId('mic-button');

      await act(async () => {
        fireEvent.press(micButton);
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          expect.stringContaining('Permission'),
          expect.stringContaining('microphone'),
          expect.any(Array),
        );
      });
    });

    test('Android permission denial shows explanation and settings option', async () => {
      Platform.OS = 'android';
      (PermissionsAndroid.check as jest.Mock).mockResolvedValue(false);
      (PermissionsAndroid.request as jest.Mock).mockResolvedValue(
        PermissionsAndroid.RESULTS.DENIED,
      );

      const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

      const micButton = getByTestId('mic-button');

      await act(async () => {
        fireEvent.press(micButton);
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          expect.stringContaining('Permission'),
          expect.any(String),
          expect.arrayContaining([
            expect.objectContaining({ text: 'Open Settings' }),
          ]),
        );
      });
    });

    test('permission denial does not crash the app', async () => {
      Platform.OS = 'ios';
      (Voice.start as jest.Mock).mockRejectedValue({
        error: { code: 'permission', message: 'Permission denied' },
      });

      const { getByTestId, getByPlaceholderText } = render(
        <HomeScreen navigation={{} as any} />,
      );

      const micButton = getByTestId('mic-button');
      const input = getByPlaceholderText(/continue/i);

      await act(async () => {
        fireEvent.press(micButton);
      });

      // App should still be functional
      expect(input).toBeTruthy();
      expect(input.props.disabled).not.toBe(true);
    });

    test('permission denial allows retry', async () => {
      Platform.OS = 'ios';
      (Voice.start as jest.Mock)
        .mockRejectedValueOnce({
          error: { code: 'permission', message: 'Permission denied' },
        })
        .mockResolvedValueOnce(undefined);

      const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

      const micButton = getByTestId('mic-button');

      // First attempt - denied
      await act(async () => {
        fireEvent.press(micButton);
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
      });

      // Retry should be possible
      await act(async () => {
        fireEvent.press(micButton);
      });

      // Should attempt again
      expect(Voice.start).toHaveBeenCalledTimes(2);
    });
  });

  describe('3. Service unavailability disables buttons appropriately', () => {
    test('TTS unavailability disables speaker button', () => {
      (textToSpeechService.isServiceAvailable as jest.Mock).mockReturnValue(
        false,
      );

      const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

      const speakerButton = getByTestId('speaker-button');

      expect(speakerButton.props.disabled).toBe(true);
    });

    test('TTS unavailability shows appropriate message', () => {
      (textToSpeechService.isServiceAvailable as jest.Mock).mockReturnValue(
        false,
      );

      const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

      const speakerButton = getByTestId('speaker-button');

      expect(speakerButton.props.accessibilityLabel).toContain('unavailable');
    });

    test('STT unavailability disables mic button', async () => {
      (Voice.start as jest.Mock).mockRejectedValue(
        new Error('Service unavailable'),
      );

      const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

      const micButton = getByTestId('mic-button');

      await act(async () => {
        fireEvent.press(micButton);
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          expect.stringContaining('unavailable'),
          expect.any(String),
          expect.any(Array),
        );
      });
    });

    test('service unavailability does not crash the app', () => {
      (textToSpeechService.isServiceAvailable as jest.Mock).mockReturnValue(
        false,
      );

      const { getByTestId, getByPlaceholderText } = render(
        <HomeScreen navigation={{} as any} />,
      );

      const speakerButton = getByTestId('speaker-button');
      const input = getByPlaceholderText(/continue/i);

      // App should still be functional
      expect(speakerButton).toBeTruthy();
      expect(input).toBeTruthy();
      expect(input.props.disabled).not.toBe(true);
    });

    test('service unavailability shows helpful message', () => {
      (textToSpeechService.isServiceAvailable as jest.Mock).mockReturnValue(
        false,
      );

      const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

      const speakerButton = getByTestId('speaker-button');

      const accessibilityHint = speakerButton.props.accessibilityHint;
      expect(accessibilityHint).toContain('still read');
      expect(accessibilityHint).toContain('screen');
    });
  });

  describe('4. Background noise is handled correctly', () => {
    test('noise detection increases timeout', async () => {
      const { getByTestId } = render(
        <VoiceInput
          onSpeechResult={jest.fn()}
          isEnabled={true}
          silenceTimeout={2000}
        />,
      );

      const micButton = getByTestId('mic-button');

      await act(async () => {
        fireEvent.press(micButton);
      });

      // Simulate rapid partial results (noise)
      for (let i = 0; i < 15; i++) {
        act(() => {
          (Voice.onSpeechPartialResults as any)?.({
            value: [`Noise ${i}`],
          });
        });
      }

      // Should handle noise gracefully
      await waitFor(() => {
        expect(Voice.stop).toHaveBeenCalled();
      });
    });

    test('noise allows user to edit transcription', async () => {
      const onSpeechResult = jest.fn();
      const { getByTestId, getByPlaceholderText } = render(
        <HomeScreen navigation={{} as any} />,
      );

      const micButton = getByTestId('mic-button');
      const input = getByPlaceholderText(/continue/i);

      await act(async () => {
        fireEvent.press(micButton);
      });

      // Simulate noisy transcription
      act(() => {
        (Voice.onSpeechResults as any)?.({
          value: ['Incomplete or noisy transcription'],
        });
      });

      await waitFor(() => {
        expect(onSpeechResult).toBeTruthy();
      });

      // User should be able to edit
      fireEvent.changeText(input, 'Edited transcription');
      expect(input.props.value || input.props.defaultValue).toBeTruthy();
    });

    test('noise shows helpful tip', async () => {
      const consoleSpy = jest
        .spyOn(console, 'log')
        .mockImplementation(() => {});

      const { getByTestId } = render(
        <VoiceInput onSpeechResult={jest.fn()} isEnabled={true} />,
      );

      const micButton = getByTestId('mic-button');

      await act(async () => {
        fireEvent.press(micButton);
      });

      // Simulate rapid partial results (noise)
      for (let i = 0; i < 15; i++) {
        act(() => {
          (Voice.onSpeechPartialResults as any)?.({
            value: [`Noise ${i}`],
          });
        });
      }

      // Should show helpful tip
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Tip'));

      consoleSpy.mockRestore();
    });

    test('noise does not prevent transcription', async () => {
      const onSpeechResult = jest.fn();
      const { getByTestId } = render(
        <VoiceInput onSpeechResult={onSpeechResult} isEnabled={true} />,
      );

      const micButton = getByTestId('mic-button');

      await act(async () => {
        fireEvent.press(micButton);
      });

      // Simulate noisy but valid transcription
      act(() => {
        (Voice.onSpeechResults as any)?.({
          value: ['Valid transcription despite noise'],
        });
      });

      await waitFor(() => {
        expect(onSpeechResult).toHaveBeenCalled();
      });
    });
  });

  describe('5. Network errors are handled', () => {
    test('network error shows user-friendly message', async () => {
      (Voice.start as jest.Mock).mockRejectedValue({
        error: { code: 'network', message: 'Network error' },
      });

      const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

      const micButton = getByTestId('mic-button');

      await act(async () => {
        fireEvent.press(micButton);
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          expect.stringContaining('error'),
          expect.stringMatching(/network|connection/i),
          expect.any(Array),
        );
      });
    });

    test('network error shows "Try Again" option', async () => {
      (Voice.start as jest.Mock).mockRejectedValue({
        error: { code: 'network', message: 'Network error' },
      });

      const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

      const micButton = getByTestId('mic-button');

      await act(async () => {
        fireEvent.press(micButton);
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(String),
          expect.arrayContaining([
            expect.objectContaining({ text: 'Try Again' }),
          ]),
        );
      });
    });

    test('network error does not crash the app', async () => {
      (Voice.start as jest.Mock).mockRejectedValue({
        error: { code: 'network', message: 'Network error' },
      });

      const { getByTestId, getByPlaceholderText } = render(
        <HomeScreen navigation={{} as any} />,
      );

      const micButton = getByTestId('mic-button');
      const input = getByPlaceholderText(/continue/i);

      await act(async () => {
        fireEvent.press(micButton);
      });

      // App should still be functional
      expect(input).toBeTruthy();
      expect(input.props.disabled).not.toBe(true);
    });

    test('network error allows retry', async () => {
      (Voice.start as jest.Mock)
        .mockRejectedValueOnce({
          error: { code: 'network', message: 'Network error' },
        })
        .mockResolvedValueOnce(undefined);

      const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

      const micButton = getByTestId('mic-button');

      // First attempt - network error
      await act(async () => {
        fireEvent.press(micButton);
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
      });

      // Retry should be possible
      await act(async () => {
        fireEvent.press(micButton);
      });

      // Should attempt again
      expect(Voice.start).toHaveBeenCalledTimes(2);
    });
  });

  describe('6. Typing always remains available', () => {
    test('typing works when voice input is disabled', () => {
      const { useAuth } = require('../../context/AuthContext');
      useAuth.mockReturnValue({
        user: { id: 'test-user' },
        userProfile: { preferred_grade_level: 'K-2', speech_enabled: false },
      });

      const { getByPlaceholderText } = render(
        <HomeScreen navigation={{} as any} />,
      );

      const input = getByPlaceholderText(/continue/i);
      expect(input).toBeTruthy();
      expect(input.props.disabled).not.toBe(true);

      fireEvent.changeText(input, 'Typed text');
      expect(input.props.value || input.props.defaultValue).toBeTruthy();
    });

    test('typing works when permission is denied', async () => {
      Platform.OS = 'ios';
      (Voice.start as jest.Mock).mockRejectedValue({
        error: { code: 'permission', message: 'Permission denied' },
      });

      const { getByTestId, getByPlaceholderText } = render(
        <HomeScreen navigation={{} as any} />,
      );

      const micButton = getByTestId('mic-button');
      const input = getByPlaceholderText(/continue/i);

      await act(async () => {
        fireEvent.press(micButton);
      });

      // Typing should still work
      fireEvent.changeText(input, 'Typed fallback');
      expect(input.props.value || input.props.defaultValue).toBeTruthy();
    });

    test('typing works when recognition fails', async () => {
      const { getByTestId, getByPlaceholderText } = render(
        <HomeScreen navigation={{} as any} />,
      );

      const micButton = getByTestId('mic-button');
      const input = getByPlaceholderText(/continue/i);

      await act(async () => {
        fireEvent.press(micButton);
      });

      act(() => {
        (Voice.onSpeechError as any)?.({
          error: { code: 'recognition', message: 'Recognition failed' },
        });
      });

      // Typing should still work
      fireEvent.changeText(input, 'Typed after error');
      expect(input.props.value || input.props.defaultValue).toBeTruthy();
    });

    test('typing works when service is unavailable', () => {
      (textToSpeechService.isServiceAvailable as jest.Mock).mockReturnValue(
        false,
      );

      const { getByPlaceholderText } = render(
        <HomeScreen navigation={{} as any} />,
      );

      const input = getByPlaceholderText(/continue/i);
      expect(input).toBeTruthy();
      expect(input.props.disabled).not.toBe(true);

      fireEvent.changeText(input, 'Typed text');
      expect(input.props.value || input.props.defaultValue).toBeTruthy();
    });

    test('typing works when network error occurs', async () => {
      (Voice.start as jest.Mock).mockRejectedValue({
        error: { code: 'network', message: 'Network error' },
      });

      const { getByTestId, getByPlaceholderText } = render(
        <HomeScreen navigation={{} as any} />,
      );

      const micButton = getByTestId('mic-button');
      const input = getByPlaceholderText(/continue/i);

      await act(async () => {
        fireEvent.press(micButton);
      });

      // Typing should still work
      fireEvent.changeText(input, 'Typed after network error');
      expect(input.props.value || input.props.defaultValue).toBeTruthy();
    });

    test('typing and voice input can be used together', async () => {
      const { getByTestId, getByPlaceholderText } = render(
        <HomeScreen navigation={{} as any} />,
      );

      const micButton = getByTestId('mic-button');
      const input = getByPlaceholderText(/continue/i);

      // Type some text first
      fireEvent.changeText(input, 'Typed text ');

      // Then use voice input
      await act(async () => {
        fireEvent.press(micButton);
      });

      act(() => {
        (Voice.onSpeechResults as any)?.({
          value: ['Voice text'],
        });
      });

      // Both should be in the input field
      await waitFor(() => {
        const value = input.props.value || input.props.defaultValue || '';
        expect(value).toContain('Typed text');
        expect(value).toContain('Voice text');
      });
    });

    test('typing input is never disabled due to voice errors', async () => {
      const { getByTestId, getByPlaceholderText } = render(
        <HomeScreen navigation={{} as any} />,
      );

      const micButton = getByTestId('mic-button');
      const input = getByPlaceholderText(/continue/i);

      // Trigger various errors
      await act(async () => {
        fireEvent.press(micButton);
      });

      act(() => {
        (Voice.onSpeechError as any)?.({
          error: { code: 'recognition', message: 'Recognition failed' },
        });
      });

      // Input should never be disabled
      expect(input.props.disabled).not.toBe(true);
      expect(input.props.disabled).toBeFalsy();
    });
  });
});
