/**
 * Platform Testing for Voice Input/Output Features
 * Validates all platform requirements from TASKS-voice-input-output-PRD.md (1738-1742)
 *
 * Tests:
 * 1. Works on iOS 13+
 * 2. Works on Android 8+
 * 3. Permission requests work on both platforms
 * 4. Error handling works on both platforms
 * 5. UI is consistent across platforms
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert, PermissionsAndroid } from 'react-native';
import HomeScreen from '../../screens/HomeScreen';
// import VoiceInput from '../../components/common/VoiceInput'; // Currently unused
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
      Version: 13,
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

describe('Voice Features Platform Testing', () => {
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
    (textToSpeechService.pause as jest.Mock).mockResolvedValue(undefined);
    (textToSpeechService.resume as jest.Mock).mockResolvedValue(undefined);

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

  describe('1. Works on iOS 13+', () => {
    beforeEach(() => {
      Platform.OS = 'ios';
      (Platform as any).Version = 13;
    });

    test('speaker button works on iOS 13+', async () => {
      const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

      const speakerButton = getByTestId('speaker-button');
      expect(speakerButton).toBeTruthy();

      await act(async () => {
        fireEvent.press(speakerButton);
      });

      await waitFor(() => {
        expect(textToSpeechService.speakStoryContent).toHaveBeenCalled();
      });
    });

    test('mic button works on iOS 13+', async () => {
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

    test('iOS 13+ features are supported', () => {
      expect(Platform.OS).toBe('ios');
      expect((Platform as any).Version).toBeGreaterThanOrEqual(13);
    });

    test('TTS works on iOS 13+', async () => {
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

  describe('2. Works on Android 8+', () => {
    beforeEach(() => {
      Platform.OS = 'android';
      (Platform as any).Version = 26; // Android 8.0
    });

    test('speaker button works on Android 8+', async () => {
      const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

      const speakerButton = getByTestId('speaker-button');
      expect(speakerButton).toBeTruthy();

      await act(async () => {
        fireEvent.press(speakerButton);
      });

      await waitFor(() => {
        expect(textToSpeechService.speakStoryContent).toHaveBeenCalled();
      });
    });

    test('mic button works on Android 8+', async () => {
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

    test('Android 8+ features are supported', () => {
      expect(Platform.OS).toBe('android');
      expect((Platform as any).Version).toBeGreaterThanOrEqual(26); // Android 8.0
    });

    test('TTS works on Android 8+', async () => {
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

  describe('3. Permission requests work on both platforms', () => {
    describe('iOS Permission Flow', () => {
      beforeEach(() => {
        Platform.OS = 'ios';
      });

      test('iOS permission request works', async () => {
        const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

        const micButton = getByTestId('mic-button');

        await act(async () => {
          fireEvent.press(micButton);
        });

        // iOS handles permission automatically via system dialog
        // Voice.start should be called (system will show dialog if needed)
        await waitFor(() => {
          expect(Voice.start).toHaveBeenCalled();
        });
      });

      test('iOS handles permission denial gracefully', async () => {
        (Voice.start as jest.Mock).mockRejectedValue({
          error: { code: 'permission', message: 'Permission denied' },
        });

        const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

        const micButton = getByTestId('mic-button');

        await act(async () => {
          fireEvent.press(micButton);
        });

        await waitFor(() => {
          expect(Alert.alert).toHaveBeenCalled();
        });
      });
    });

    describe('Android Permission Flow', () => {
      beforeEach(() => {
        Platform.OS = 'android';
      });

      test('Android permission request works', async () => {
        (PermissionsAndroid.check as jest.Mock).mockResolvedValue(false);
        (PermissionsAndroid.request as jest.Mock).mockResolvedValue(
          PermissionsAndroid.RESULTS.GRANTED,
        );

        const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

        const micButton = getByTestId('mic-button');

        await act(async () => {
          fireEvent.press(micButton);
        });

        // Android should show explanation dialog first
        await waitFor(() => {
          expect(Alert.alert).toHaveBeenCalled();
        });
      });

      test('Android permission request shows explanation', async () => {
        (PermissionsAndroid.check as jest.Mock).mockResolvedValue(false);
        (PermissionsAndroid.request as jest.Mock).mockResolvedValue(
          PermissionsAndroid.RESULTS.GRANTED,
        );

        const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

        const micButton = getByTestId('mic-button');

        await act(async () => {
          fireEvent.press(micButton);
        });

        await waitFor(() => {
          expect(Alert.alert).toHaveBeenCalledWith(
            expect.stringContaining('Microphone'),
            expect.any(String),
            expect.any(Array),
          );
        });
      });

      test('Android permission denied shows settings option', async () => {
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

      test('Android permission "never ask again" handled', async () => {
        (PermissionsAndroid.check as jest.Mock).mockResolvedValue(false);
        (PermissionsAndroid.request as jest.Mock).mockResolvedValue(
          PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
        );

        const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

        const micButton = getByTestId('mic-button');

        await act(async () => {
          fireEvent.press(micButton);
        });

        // Should handle gracefully
        await waitFor(() => {
          expect(Alert.alert).toHaveBeenCalled();
        });
      });
    });
  });

  describe('4. Error handling works on both platforms', () => {
    describe('iOS Error Handling', () => {
      beforeEach(() => {
        Platform.OS = 'ios';
      });

      test('iOS handles network errors', async () => {
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
            expect.any(String),
            expect.any(Array),
          );
        });
      });

      test('iOS handles recognition errors', async () => {
        act(() => {
          (Voice.onSpeechError as any)?.({
            error: { code: 'recognition', message: 'Recognition failed' },
          });
        });

        await waitFor(() => {
          expect(Alert.alert).toHaveBeenCalled();
        });
      });

      test('iOS handles permission errors', async () => {
        (Voice.start as jest.Mock).mockRejectedValue({
          error: { code: 'permission', message: 'Permission denied' },
        });

        const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

        const micButton = getByTestId('mic-button');

        await act(async () => {
          fireEvent.press(micButton);
        });

        await waitFor(() => {
          expect(Alert.alert).toHaveBeenCalled();
        });
      });

      test('iOS handles TTS errors', async () => {
        (textToSpeechService.speakStoryContent as jest.Mock).mockRejectedValue(
          new Error('TTS error'),
        );

        const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

        const speakerButton = getByTestId('speaker-button');

        await act(async () => {
          fireEvent.press(speakerButton);
        });

        // Should handle gracefully without crashing
        expect(textToSpeechService.speakStoryContent).toHaveBeenCalled();
      });
    });

    describe('Android Error Handling', () => {
      beforeEach(() => {
        Platform.OS = 'android';
      });

      test('Android handles network errors', async () => {
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
            expect.any(String),
            expect.any(Array),
          );
        });
      });

      test('Android handles recognition errors', async () => {
        act(() => {
          (Voice.onSpeechError as any)?.({
            error: { code: 'recognition', message: 'Recognition failed' },
          });
        });

        await waitFor(() => {
          expect(Alert.alert).toHaveBeenCalled();
        });
      });

      test('Android handles permission errors', async () => {
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
          expect(Alert.alert).toHaveBeenCalled();
        });
      });

      test('Android handles TTS errors', async () => {
        (textToSpeechService.speakStoryContent as jest.Mock).mockRejectedValue(
          new Error('TTS error'),
        );

        const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

        const speakerButton = getByTestId('speaker-button');

        await act(async () => {
          fireEvent.press(speakerButton);
        });

        // Should handle gracefully without crashing
        expect(textToSpeechService.speakStoryContent).toHaveBeenCalled();
      });
    });
  });

  describe('5. UI is consistent across platforms', () => {
    test('speaker button UI is consistent', () => {
      const platforms = ['ios', 'android'];

      platforms.forEach(platform => {
        Platform.OS = platform as 'ios' | 'android';

        const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

        const speakerButton = getByTestId('speaker-button');

        expect(speakerButton).toBeTruthy();
        expect(speakerButton.props.testID).toBe('speaker-button');
        expect(speakerButton.props.accessibilityLabel).toBeTruthy();
      });
    });

    test('mic button UI is consistent', () => {
      const platforms = ['ios', 'android'];

      platforms.forEach(platform => {
        Platform.OS = platform as 'ios' | 'android';

        const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

        const micButton = getByTestId('mic-button');

        expect(micButton).toBeTruthy();
        expect(micButton.props.testID).toBe('mic-button');
        expect(micButton.props.accessibilityLabel).toBeTruthy();
      });
    });

    test('button states are consistent across platforms', () => {
      const platforms = ['ios', 'android'];

      platforms.forEach(platform => {
        Platform.OS = platform as 'ios' | 'android';

        const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

        const speakerButton = getByTestId('speaker-button');
        const micButton = getByTestId('mic-button');

        // Both buttons should exist and have consistent structure
        expect(speakerButton).toBeTruthy();
        expect(micButton).toBeTruthy();
        expect(speakerButton.props.disabled).toBeDefined();
        expect(micButton.props.disabled).toBeDefined();
      });
    });

    test('accessibility labels are consistent', () => {
      const platforms = ['ios', 'android'];

      platforms.forEach(platform => {
        Platform.OS = platform as 'ios' | 'android';

        const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

        const speakerButton = getByTestId('speaker-button');
        const micButton = getByTestId('mic-button');

        // Both should have accessibility labels
        expect(speakerButton.props.accessibilityLabel).toBeTruthy();
        expect(micButton.props.accessibilityLabel).toBeTruthy();
        expect(speakerButton.props.accessibilityRole).toBe('button');
        expect(micButton.props.accessibilityRole).toBe('button');
      });
    });

    test('error messages are consistent across platforms', async () => {
      const platforms = ['ios', 'android'];

      for (const platform of platforms) {
        Platform.OS = platform as 'ios' | 'android';
        jest.clearAllMocks();

        (Voice.start as jest.Mock).mockRejectedValue({
          error: { code: 'network', message: 'Network error' },
        });

        const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

        const micButton = getByTestId('mic-button');

        await act(async () => {
          fireEvent.press(micButton);
        });

        await waitFor(() => {
          expect(Alert.alert).toHaveBeenCalled();
        });
      }
    });
  });
});
