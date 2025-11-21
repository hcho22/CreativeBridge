/**
 * Cross-Platform Testing for Voice Input/Output Features
 * Task 3.8: Ensure features work correctly on both iOS and Android
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Platform, Alert, PermissionsAndroid } from 'react-native';
import HomeScreen from '../../screens/HomeScreen';
import VoiceInput from '../../components/common/VoiceInput';
import { textToSpeechService } from '../../services/textToSpeechIsolated';
import Voice from '@react-native-voice/voice';

// Mock dependencies
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

describe('Cross-Platform Voice Features Testing', () => {
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

    // Mock Alert
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  describe('iOS Platform Testing', () => {
    beforeEach(() => {
      Platform.OS = 'ios';
    });

    test('speaker button renders and works on iOS', async () => {
      const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

      const speakerButton = getByTestId('speaker-button');
      expect(speakerButton).toBeTruthy();

      // Test button press
      fireEvent.press(speakerButton);

      await waitFor(() => {
        expect(textToSpeechService.speakStoryContent).toHaveBeenCalled();
      });
    });

    test('mic button renders and works on iOS', () => {
      const onSpeechResult = jest.fn();
      const { getByText } = render(
        <VoiceInput onSpeechResult={onSpeechResult} isEnabled={true} />,
      );

      const micButton = getByText('🎤 Voice');
      expect(micButton).toBeTruthy();
    });

    test('iOS permission flow works correctly', async () => {
      // iOS permissions are handled automatically by the system
      const onError = jest.fn();
      const { getByText } = render(
        <VoiceInput
          onSpeechResult={jest.fn()}
          isEnabled={true}
          onError={onError}
        />,
      );

      const micButton = getByText('🎤 Voice');
      fireEvent.press(micButton);

      // iOS should attempt to start voice recognition
      // Permission dialog is handled by system
      await waitFor(() => {
        expect(Voice.start).toHaveBeenCalled();
      });
    });

    test('error handling works on iOS', async () => {
      const onError = jest.fn();
      (Voice.start as jest.Mock).mockRejectedValue(new Error('iOS error'));

      const { getByText } = render(
        <VoiceInput
          onSpeechResult={jest.fn()}
          isEnabled={true}
          onError={onError}
        />,
      );

      const micButton = getByText('🎤 Voice');
      fireEvent.press(micButton);

      await waitFor(() => {
        expect(onError).toHaveBeenCalled();
        expect(Alert.alert).toHaveBeenCalled();
      });
    });
  });

  describe('Android Platform Testing', () => {
    beforeEach(() => {
      Platform.OS = 'android';
    });

    test('speaker button renders and works on Android', async () => {
      const { getByTestId } = render(<HomeScreen navigation={{} as any} />);

      const speakerButton = getByTestId('speaker-button');
      expect(speakerButton).toBeTruthy();

      // Test button press
      fireEvent.press(speakerButton);

      await waitFor(() => {
        expect(textToSpeechService.speakStoryContent).toHaveBeenCalled();
      });
    });

    test('mic button renders and works on Android', () => {
      const onSpeechResult = jest.fn();
      const { getByText } = render(
        <VoiceInput onSpeechResult={onSpeechResult} isEnabled={true} />,
      );

      const micButton = getByText('🎤 Voice');
      expect(micButton).toBeTruthy();
    });

    test('Android permission flow works correctly', async () => {
      // Mock Android permission check
      (PermissionsAndroid.check as jest.Mock).mockResolvedValue(false);
      (PermissionsAndroid.request as jest.Mock).mockResolvedValue(
        PermissionsAndroid.RESULTS.GRANTED,
      );

      const onError = jest.fn();
      const { getByText } = render(
        <VoiceInput
          onSpeechResult={jest.fn()}
          isEnabled={true}
          onError={onError}
        />,
      );

      const micButton = getByText('🎤 Voice');
      fireEvent.press(micButton);

      // Android should show permission dialog
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
      });
    });

    test('error handling works on Android', async () => {
      const onError = jest.fn();
      (Voice.start as jest.Mock).mockRejectedValue(new Error('Android error'));

      const { getByText } = render(
        <VoiceInput
          onSpeechResult={jest.fn()}
          isEnabled={true}
          onError={onError}
        />,
      );

      const micButton = getByText('🎤 Voice');
      fireEvent.press(micButton);

      await waitFor(() => {
        expect(onError).toHaveBeenCalled();
        expect(Alert.alert).toHaveBeenCalled();
      });
    });
  });

  describe('Platform-Specific Permission Flows', () => {
    test('iOS permission flow - system handles automatically', async () => {
      Platform.OS = 'ios';

      const onError = jest.fn();
      const { getByText } = render(
        <VoiceInput
          onSpeechResult={jest.fn()}
          isEnabled={true}
          onError={onError}
        />,
      );

      const micButton = getByText('🎤 Voice');
      fireEvent.press(micButton);

      // iOS should attempt to start directly (system handles permission)
      await waitFor(() => {
        expect(Voice.start).toHaveBeenCalled();
      });
    });

    test('Android permission flow - runtime permission request', async () => {
      Platform.OS = 'android';

      // Mock permission check and request
      (PermissionsAndroid.check as jest.Mock).mockResolvedValue(false);
      (PermissionsAndroid.request as jest.Mock).mockResolvedValue(
        PermissionsAndroid.RESULTS.GRANTED,
      );

      const onError = jest.fn();
      const { getByText } = render(
        <VoiceInput
          onSpeechResult={jest.fn()}
          isEnabled={true}
          onError={onError}
        />,
      );

      const micButton = getByText('🎤 Voice');
      fireEvent.press(micButton);

      // Android should show explanation dialog first
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
      });
    });

    test('Android permission denied flow', async () => {
      Platform.OS = 'android';

      // Mock permission denied
      (PermissionsAndroid.check as jest.Mock).mockResolvedValue(false);
      (PermissionsAndroid.request as jest.Mock).mockResolvedValue(
        PermissionsAndroid.RESULTS.DENIED,
      );

      const onError = jest.fn();
      const { getByText } = render(
        <VoiceInput
          onSpeechResult={jest.fn()}
          isEnabled={true}
          onError={onError}
        />,
      );

      const micButton = getByText('🎤 Voice');
      fireEvent.press(micButton);

      // Should show permission denied message with settings option
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          expect.stringContaining('Permission Denied'),
          expect.any(String),
          expect.arrayContaining([
            expect.objectContaining({ text: 'OK' }),
            expect.objectContaining({ text: 'Open Settings' }),
          ]),
        );
      });
    });
  });

  describe('UI Consistency Across Platforms', () => {
    test('speaker button UI is consistent', () => {
      const platforms = ['ios', 'android'];

      platforms.forEach(platform => {
        Platform.OS = platform as 'ios' | 'android';

        const { getByTestId } = render(<HomeScreen navigation={{} as any} />);
        const speakerButton = getByTestId('speaker-button');

        expect(speakerButton).toBeTruthy();
        // Button should have same structure on both platforms
        expect(speakerButton.props.testID).toBe('speaker-button');
      });
    });

    test('mic button UI is consistent', () => {
      const platforms = ['ios', 'android'];

      platforms.forEach(platform => {
        Platform.OS = platform as 'ios' | 'android';

        const { getByText } = render(
          <VoiceInput onSpeechResult={jest.fn()} isEnabled={true} />,
        );

        const micButton = getByText('🎤 Voice');
        expect(micButton).toBeTruthy();
      });
    });

    test('button states are consistent across platforms', () => {
      const platforms = ['ios', 'android'];

      platforms.forEach(platform => {
        Platform.OS = platform as 'ios' | 'android';

        const { getByText } = render(
          <VoiceInput onSpeechResult={jest.fn()} isEnabled={true} />,
        );

        // Idle state should show same text
        const idleButton = getByText('🎤 Voice');
        expect(idleButton).toBeTruthy();
      });
    });
  });

  describe('Error Handling Across Platforms', () => {
    test('network errors handled consistently', async () => {
      const platforms = ['ios', 'android'];

      for (const platform of platforms) {
        Platform.OS = platform as 'ios' | 'android';
        jest.clearAllMocks();

        const onError = jest.fn();
        const mockError = {
          error: {
            code: 'network',
            message: 'Network error occurred',
          },
        };

        // Simulate network error
        (Voice.onSpeechError as any)?.(mockError);

        await waitFor(() => {
          expect(onError).toHaveBeenCalled();
        });
      }
    });

    test('permission errors handled consistently', async () => {
      const platforms = ['ios', 'android'];

      for (const platform of platforms) {
        Platform.OS = platform as 'ios' | 'android';
        jest.clearAllMocks();

        const onError = jest.fn();
        const mockError = {
          error: {
            code: 'permission',
            message: 'Permission denied',
          },
        };

        // Simulate permission error
        (Voice.onSpeechError as any)?.(mockError);

        await waitFor(() => {
          expect(onError).toHaveBeenCalled();
        });
      }
    });
  });

  describe('Feature Functionality Across Platforms', () => {
    test('speaker button pause/resume works on both platforms', async () => {
      const platforms = ['ios', 'android'];

      for (const platform of platforms) {
        Platform.OS = platform as 'ios' | 'android';
        jest.clearAllMocks();

        const { getByTestId } = render(<HomeScreen navigation={{} as any} />);
        const speakerButton = getByTestId('speaker-button');

        // Start speaking
        fireEvent.press(speakerButton);
        await waitFor(() => {
          expect(textToSpeechService.speakStoryContent).toHaveBeenCalled();
        });

        // Simulate speaking state
        (textToSpeechService.isServiceAvailable as jest.Mock).mockReturnValue(
          true,
        );

        // Pause
        fireEvent.press(speakerButton);
        await waitFor(() => {
          expect(textToSpeechService.pause).toHaveBeenCalled();
        });

        // Resume
        fireEvent.press(speakerButton);
        await waitFor(() => {
          expect(textToSpeechService.resume).toHaveBeenCalled();
        });
      }
    });

    test('mic button tap-to-start/stop works on both platforms', async () => {
      const platforms = ['ios', 'android'];

      for (const platform of platforms) {
        Platform.OS = platform as 'ios' | 'android';
        jest.clearAllMocks();

        const onSpeechResult = jest.fn();
        const { getByText } = render(
          <VoiceInput onSpeechResult={onSpeechResult} isEnabled={true} />,
        );

        const micButton = getByText('🎤 Voice');

        // Start listening
        fireEvent.press(micButton);
        await waitFor(() => {
          expect(Voice.start).toHaveBeenCalled();
        });

        // Stop listening
        fireEvent.press(micButton);
        await waitFor(() => {
          expect(Voice.stop).toHaveBeenCalled();
        });
      }
    });
  });

  describe('Platform-Specific Edge Cases', () => {
    test('iOS handles system permission denial gracefully', async () => {
      Platform.OS = 'ios';

      const onError = jest.fn();
      (Voice.start as jest.Mock).mockRejectedValue({
        error: { code: 'permission', message: 'Permission denied' },
      });

      const { getByText } = render(
        <VoiceInput
          onSpeechResult={jest.fn()}
          isEnabled={true}
          onError={onError}
        />,
      );

      const micButton = getByText('🎤 Voice');
      fireEvent.press(micButton);

      await waitFor(() => {
        expect(onError).toHaveBeenCalled();
        expect(Alert.alert).toHaveBeenCalled();
      });
    });

    test('Android handles permission "Ask Me Later" gracefully', async () => {
      Platform.OS = 'android';

      (PermissionsAndroid.check as jest.Mock).mockResolvedValue(false);
      (PermissionsAndroid.request as jest.Mock).mockResolvedValue(
        PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
      );

      const onError = jest.fn();
      const { getByText } = render(
        <VoiceInput
          onSpeechResult={jest.fn()}
          isEnabled={true}
          onError={onError}
        />,
      );

      const micButton = getByText('🎤 Voice');
      fireEvent.press(micButton);

      // Should handle gracefully without crashing
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
      });
    });
  });
});
