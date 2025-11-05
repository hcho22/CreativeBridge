/**
 * Accessibility and Polish Tests (Task 2.6)
 * Comprehensive test suite for accessibility features and polish
 */

import { accessibilityService } from '../../services/accessibilityService';
import { hapticFeedbackService } from '../../services/hapticFeedbackService';
import downloadAnimations from '../../services/downloadAnimations';
import downloadThemeService from '../../services/downloadThemeService';
import downloadKeyboardNavigation from '../../services/downloadKeyboardNavigation';
import downloadLocalization from '../../services/downloadLocalization';

// Mock React Native modules
jest.mock('react-native', () => ({
  AccessibilityInfo: {
    isScreenReaderEnabled: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    announceForAccessibility: jest.fn(),
  },
  Vibration: {
    vibrate: jest.fn(),
  },
  Platform: {
    OS: 'ios',
  },
  Animated: {
    Value: jest.fn(() => ({
      setValue: jest.fn(),
      interpolate: jest.fn(),
      stopAnimation: jest.fn(),
    })),
    timing: jest.fn(),
    spring: jest.fn(),
    sequence: jest.fn(),
    parallel: jest.fn(),
    loop: jest.fn(),
  },
  Easing: {
    out: jest.fn(),
    in: jest.fn(),
    cubic: jest.fn(),
    linear: jest.fn(),
    inOut: jest.fn(),
  },
  useColorScheme: jest.fn(() => 'light'),
  Alert: {
    alert: jest.fn(),
  },
  NativeModules: {
    SettingsManager: {
      settings: {
        AppleLocale: 'en-US',
      },
    },
  },
}));

describe('Accessibility and Polish Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Accessibility Service', () => {
    beforeEach(async () => {
      await accessibilityService.initialize();
    });

    afterEach(() => {
      accessibilityService.cleanup();
    });

    it('should initialize with proper screen reader detection', async () => {
      expect(accessibilityService.isScreenReaderActive()).toBeDefined();
    });

    it('should provide proper download button labels for all states', () => {
      const states = ['idle', 'downloading', 'completed', 'error'] as const;
      
      states.forEach(state => {
        const labels = accessibilityService.getDownloadButtonLabels(state);
        
        expect(labels.accessibilityLabel).toBeTruthy();
        expect(labels.accessibilityHint).toBeTruthy();
        expect(labels.accessibilityRole).toBe('button');
        
        if (state === 'downloading') {
          expect(labels.accessibilityState?.disabled).toBe(true);
          expect(labels.accessibilityState?.busy).toBe(true);
        }
      });
    });

    it('should provide progress labels with proper accessibility values', () => {
      const progress = 65;
      const stage = 'generating';
      
      const labels = accessibilityService.getProgressLabels(progress, stage);
      
      expect(labels.accessibilityLabel).toContain('65%');
      expect(labels.accessibilityLabel).toContain('generating');
      expect(labels.accessibilityValue?.min).toBe(0);
      expect(labels.accessibilityValue?.max).toBe(100);
      expect(labels.accessibilityValue?.now).toBe(65);
    });

    it('should announce progress at appropriate milestones', async () => {
      const announceProgressSpy = jest.spyOn(accessibilityService, 'announceProgress');
      
      // Should announce at milestones
      await accessibilityService.announceProgress(25, 'generating');
      await accessibilityService.announceProgress(50, 'saving');
      await accessibilityService.announceProgress(75, 'finalizing');
      await accessibilityService.announceProgress(100, 'completed');
      
      expect(announceProgressSpy).toHaveBeenCalledTimes(4);
      
      // Should not announce at non-milestones
      await accessibilityService.announceProgress(30, 'generating');
      await accessibilityService.announceProgress(60, 'saving');
      
      expect(announceProgressSpy).toHaveBeenCalledTimes(6); // Total calls remain the same
    });

    it('should provide proper history item labels', () => {
      const item = {
        fileName: 'Story_110325_143022.txt',
        storyTitle: 'My Adventure',
        downloadDate: '2023-11-03T14:30:22Z',
        fileSize: 1024,
        status: 'success',
      };
      
      const labels = accessibilityService.getHistoryItemLabels(item);
      
      expect(labels.accessibilityLabel).toContain('My Adventure');
      expect(labels.accessibilityLabel).toContain('11/3/2023');
      expect(labels.accessibilityHint).toContain('Double-tap');
      expect(labels.accessibilityRole).toBe('button');
    });

    it('should handle accessibility configuration changes', () => {
      const newConfig = {
        enableVoiceOver: false,
        verboseDescriptions: true,
      };
      
      accessibilityService.setConfig(newConfig);
      const config = accessibilityService.getConfig();
      
      expect(config.enableVoiceOver).toBe(false);
      expect(config.verboseDescriptions).toBe(true);
    });
  });

  describe('Haptic Feedback Service', () => {
    beforeEach(() => {
      hapticFeedbackService.initialize();
    });

    it('should initialize with proper platform support detection', () => {
      expect(hapticFeedbackService.isHapticSupported()).toBeDefined();
    });

    it('should trigger appropriate haptics for download events', () => {
      const vibrateSpy = jest.spyOn(require('react-native').Vibration, 'vibrate');
      
      hapticFeedbackService.downloadStarted();
      expect(vibrateSpy).toHaveBeenCalled();
      
      hapticFeedbackService.downloadCompleted(true);
      expect(vibrateSpy).toHaveBeenCalledTimes(2);
      
      hapticFeedbackService.downloadCompleted(false);
      expect(vibrateSpy).toHaveBeenCalledTimes(3);
    });

    it('should respect haptic configuration settings', () => {
      const vibrateSpy = jest.spyOn(require('react-native').Vibration, 'vibrate');
      
      // Disable haptics
      hapticFeedbackService.setConfig({
        downloadStart: false,
        downloadComplete: false,
      });
      
      hapticFeedbackService.downloadStarted();
      hapticFeedbackService.downloadCompleted(true);
      
      expect(vibrateSpy).not.toHaveBeenCalled();
    });

    it('should handle button press feedback', () => {
      const vibrateSpy = jest.spyOn(require('react-native').Vibration, 'vibrate');
      
      hapticFeedbackService.buttonPressed('primary');
      hapticFeedbackService.buttonPressed('destructive');
      
      expect(vibrateSpy).toHaveBeenCalledTimes(2);
    });

    it('should play predefined sequences correctly', async () => {
      const playSequenceSpy = jest.spyOn(hapticFeedbackService, 'playSequence');
      
      await hapticFeedbackService.playPredefinedSequence('downloadSuccess');
      await hapticFeedbackService.playPredefinedSequence('downloadError');
      
      expect(playSequenceSpy).toHaveBeenCalledTimes(2);
    });

    it('should handle state change haptics', () => {
      const vibrateSpy = jest.spyOn(require('react-native').Vibration, 'vibrate');
      
      hapticFeedbackService.downloadStateChanged('idle', 'downloading');
      hapticFeedbackService.downloadStateChanged('downloading', 'completed');
      hapticFeedbackService.downloadStateChanged('downloading', 'error');
      
      expect(vibrateSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe('Download Animations', () => {
    let animatedValues: any;

    beforeEach(() => {
      animatedValues = downloadAnimations.createAnimatedValues();
    });

    afterEach(() => {
      downloadAnimations.cleanupAnimations(animatedValues);
    });

    it('should create proper animated values', () => {
      expect(animatedValues.opacity).toBeDefined();
      expect(animatedValues.scale).toBeDefined();
      expect(animatedValues.rotation).toBeDefined();
      expect(animatedValues.translateY).toBeDefined();
      expect(animatedValues.progressWidth).toBeDefined();
    });

    it('should handle button press animations', () => {
      const animatingSpy = jest.spyOn(require('react-native').Animated, 'sequence');
      
      downloadAnimations.animateButtonPress(animatedValues);
      
      expect(animatingSpy).toHaveBeenCalled();
    });

    it('should handle download state animations', () => {
      const parallelSpy = jest.spyOn(require('react-native').Animated, 'parallel');
      const sequenceSpy = jest.spyOn(require('react-native').Animated, 'sequence');
      
      downloadAnimations.animateDownloadStart(animatedValues);
      expect(parallelSpy).toHaveBeenCalled();
      
      downloadAnimations.animateDownloadSuccess(animatedValues);
      expect(sequenceSpy).toHaveBeenCalled();
      
      downloadAnimations.animateDownloadError(animatedValues);
      expect(sequenceSpy).toHaveBeenCalledTimes(2);
    });

    it('should handle modal animations', () => {
      const parallelSpy = jest.spyOn(require('react-native').Animated, 'parallel');
      
      downloadAnimations.animateModalEntrance(animatedValues);
      downloadAnimations.animateModalExit(animatedValues);
      
      expect(parallelSpy).toHaveBeenCalledTimes(2);
    });

    it('should handle progress animations', () => {
      const timingSpy = jest.spyOn(require('react-native').Animated, 'timing');
      
      downloadAnimations.animateProgress(animatedValues, 50);
      
      expect(timingSpy).toHaveBeenCalled();
    });

    it('should handle staggered list animations', () => {
      const items = [
        downloadAnimations.createAnimatedValues(),
        downloadAnimations.createAnimatedValues(),
        downloadAnimations.createAnimatedValues(),
      ];
      
      downloadAnimations.animateStaggeredList(items, 100);
      
      // Should create animations for all items
      expect(items.length).toBe(3);
    });

    it('should reset animations properly', () => {
      downloadAnimations.resetAnimations(animatedValues);
      
      expect(animatedValues.opacity.setValue).toHaveBeenCalledWith(1);
      expect(animatedValues.scale.setValue).toHaveBeenCalledWith(1);
      expect(animatedValues.rotation.setValue).toHaveBeenCalledWith(0);
    });
  });

  describe('Theme Service', () => {
    it('should provide proper theme for light mode', () => {
      const lightTheme = downloadThemeService.getTheme('light');
      
      expect(lightTheme.isDark).toBe(false);
      expect(lightTheme.colors.background).toBe('#FFFFFF');
      expect(lightTheme.colors.text).toBe('#1A1A1A');
    });

    it('should provide proper theme for dark mode', () => {
      const darkTheme = downloadThemeService.getTheme('dark');
      
      expect(darkTheme.isDark).toBe(true);
      expect(darkTheme.colors.background).toBe('#000000');
      expect(darkTheme.colors.text).toBe('#FFFFFF');
    });

    it('should provide download button styles for all states', () => {
      const states = ['idle', 'downloading', 'completed', 'error'] as const;
      
      states.forEach(state => {
        const styles = downloadThemeService.getDownloadButtonStyles(state);
        
        expect(styles.borderRadius).toBeDefined();
        expect(styles.paddingHorizontal).toBeDefined();
        expect(styles.paddingVertical).toBeDefined();
        expect(styles.minHeight).toBe(44); // Accessibility requirement
        expect(styles.backgroundColor).toBeDefined();
      });
    });

    it('should provide progress indicator styles', () => {
      const styles = downloadThemeService.getProgressIndicatorStyles();
      
      expect(styles.container).toBeDefined();
      expect(styles.fill).toBeDefined();
      expect(styles.text).toBeDefined();
    });

    it('should provide modal styles', () => {
      const styles = downloadThemeService.getModalStyles();
      
      expect(styles.overlay).toBeDefined();
      expect(styles.container).toBeDefined();
      expect(styles.title).toBeDefined();
      expect(styles.message).toBeDefined();
    });

    it('should provide list item styles', () => {
      const styles = downloadThemeService.getListItemStyles();
      
      expect(styles.container).toBeDefined();
      expect(styles.title).toBeDefined();
      expect(styles.subtitle).toBeDefined();
      expect(styles.metadata).toBeDefined();
    });
  });

  describe('Keyboard Navigation', () => {
    beforeEach(() => {
      downloadKeyboardNavigation.initialize();
    });

    afterEach(() => {
      downloadKeyboardNavigation.cleanup();
    });

    it('should register and manage focusable elements', () => {
      const element = {
        id: 'test-button',
        ref: null,
        order: 1,
        enabled: true,
        onActivate: jest.fn(),
      };
      
      downloadKeyboardNavigation.registerElement(element);
      
      expect(downloadKeyboardNavigation.focusElement('test-button')).toBe(true);
      expect(downloadKeyboardNavigation.getCurrentFocusedElementId()).toBe('test-button');
      
      downloadKeyboardNavigation.unregisterElement('test-button');
      expect(downloadKeyboardNavigation.getCurrentFocusedElementId()).toBeNull();
    });

    it('should handle focus navigation', () => {
      const elements = [
        { id: 'button1', ref: null, order: 1, enabled: true },
        { id: 'button2', ref: null, order: 2, enabled: true },
        { id: 'button3', ref: null, order: 3, enabled: true },
      ];
      
      elements.forEach(el => downloadKeyboardNavigation.registerElement(el));
      
      downloadKeyboardNavigation.focusElement('button1');
      expect(downloadKeyboardNavigation.getCurrentFocusedElementId()).toBe('button1');
      
      downloadKeyboardNavigation.focusNext();
      expect(downloadKeyboardNavigation.getCurrentFocusedElementId()).toBe('button2');
      
      downloadKeyboardNavigation.focusPrevious();
      expect(downloadKeyboardNavigation.getCurrentFocusedElementId()).toBe('button1');
    });

    it('should provide proper accessibility props', () => {
      const props = downloadKeyboardNavigation.getKeyboardAccessibilityProps('test-element');
      
      expect(props.accessible).toBe(true);
      expect(props.accessibilityRole).toBe('button');
      expect(props.focusable).toBeDefined();
    });

    it('should handle download button keyboard props', () => {
      const onPress = jest.fn();
      const props = downloadKeyboardNavigation.getDownloadButtonKeyboardProps(
        'download-btn',
        onPress,
        false
      );
      
      expect(props.accessibilityLabel).toBe('Download Story');
      expect(props.accessibilityHint).toContain('Enter or Space');
    });

    it('should provide keyboard instructions', () => {
      const instructions = downloadKeyboardNavigation.getKeyboardInstructions();
      
      expect(instructions.length).toBeGreaterThan(0);
      expect(instructions.some(inst => inst.includes('Tab'))).toBe(true);
      expect(instructions.some(inst => inst.includes('Enter'))).toBe(true);
    });

    it('should handle configuration changes', () => {
      const newConfig = {
        enableTabNavigation: false,
        enableArrowKeyNavigation: true,
      };
      
      downloadKeyboardNavigation.setConfig(newConfig);
      const config = downloadKeyboardNavigation.getConfig();
      
      expect(config.enableTabNavigation).toBe(false);
      expect(config.enableArrowKeyNavigation).toBe(true);
    });
  });

  describe('Localization Service', () => {
    it('should detect and set language properly', () => {
      expect(downloadLocalization.getCurrentLanguage()).toBeDefined();
      expect(downloadLocalization.getSupportedLanguages()).toContain('en');
      expect(downloadLocalization.getSupportedLanguages()).toContain('es');
    });

    it('should provide localized strings', () => {
      const downloadButton = downloadLocalization.getString('downloadButton.idle');
      expect(downloadButton).toBe('Download Story');
      
      const errorMessage = downloadLocalization.getString('errors.networkError');
      expect(errorMessage).toBe('Network connection error');
    });

    it('should handle string templates with parameters', () => {
      const timeString = downloadLocalization.getStringWithParams('time.minutesRemaining', {
        minutes: 5,
      });
      expect(timeString).toBe('5 minutes remaining');
    });

    it('should format file sizes correctly', () => {
      expect(downloadLocalization.formatFileSize(512)).toBe('512 bytes');
      expect(downloadLocalization.formatFileSize(1024)).toBe('1 KB');
      expect(downloadLocalization.formatFileSize(1024 * 1024)).toBe('1.0 MB');
      expect(downloadLocalization.formatFileSize(1024 * 1024 * 1024)).toBe('1.0 GB');
    });

    it('should format time remaining correctly', () => {
      expect(downloadLocalization.formatTimeRemaining(30)).toContain('30 seconds');
      expect(downloadLocalization.formatTimeRemaining(120)).toContain('2 minutes');
      expect(downloadLocalization.formatTimeRemaining(3600)).toContain('1 hours');
    });

    it('should format relative time correctly', () => {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      
      expect(downloadLocalization.formatRelativeTime(fiveMinutesAgo)).toContain('5 minutes ago');
      expect(downloadLocalization.formatRelativeTime(twoHoursAgo)).toContain('2 hours ago');
    });

    it('should provide error messages with recovery suggestions', () => {
      const errorInfo = downloadLocalization.getErrorWithRecovery(
        'permissionDenied',
        'checkPermissions'
      );
      
      expect(errorInfo.error).toBe('Storage permission denied');
      expect(errorInfo.recovery).toBe('Please check app permissions in Settings');
    });

    it('should handle language switching', () => {
      downloadLocalization.setLanguage('es');
      const downloadButton = downloadLocalization.getString('downloadButton.idle');
      expect(downloadButton).toBe('Descargar Historia');
      
      // Switch back to English
      downloadLocalization.setLanguage('en');
      const downloadButtonEn = downloadLocalization.getString('downloadButton.idle');
      expect(downloadButtonEn).toBe('Download Story');
    });

    it('should detect RTL languages', () => {
      downloadLocalization.setLanguage('ar');
      expect(downloadLocalization.isRTL()).toBe(true);
      
      downloadLocalization.setLanguage('en');
      expect(downloadLocalization.isRTL()).toBe(false);
    });
  });

  describe('Integration Tests', () => {
    it('should work together for complete accessibility experience', async () => {
      // Initialize all services
      await accessibilityService.initialize();
      hapticFeedbackService.initialize();
      downloadKeyboardNavigation.initialize();
      
      // Test download button with full accessibility
      const downloadButtonProps = {
        ...accessibilityService.getDownloadButtonLabels('idle'),
        ...downloadKeyboardNavigation.getDownloadButtonKeyboardProps(
          'main-download-btn',
          () => hapticFeedbackService.buttonPressed('primary'),
          false
        ),
      };
      
      expect(downloadButtonProps.accessibilityLabel).toBe('Download Story');
      expect(downloadButtonProps.accessibilityRole).toBe('button');
      expect(downloadButtonProps.accessible).toBe(true);
      
      // Test theme integration
      const buttonStyles = downloadThemeService.getDownloadButtonStyles('idle');
      expect(buttonStyles.minHeight).toBe(44); // Accessibility touch target
      
      // Test localization integration
      const localizedLabel = downloadLocalization.getString('downloadButton.idle');
      expect(localizedLabel).toBeTruthy();
      
      // Cleanup
      accessibilityService.cleanup();
      downloadKeyboardNavigation.cleanup();
    });

    it('should handle complete download flow with accessibility', async () => {
      const animatedValues = downloadAnimations.createAnimatedValues();
      
      // Start download with haptics and announcements
      hapticFeedbackService.downloadStarted();
      await accessibilityService.announceProgress(0, 'validating');
      downloadAnimations.animateDownloadStart(animatedValues);
      
      // Progress updates
      await accessibilityService.announceProgress(50, 'generating');
      downloadAnimations.animateProgress(animatedValues, 50);
      
      // Completion
      hapticFeedbackService.downloadCompleted(true);
      await accessibilityService.announceDownloadSuccess('Story_110325_143022.txt', 1024);
      downloadAnimations.animateDownloadSuccess(animatedValues);
      
      // Verify no errors were thrown
      expect(true).toBe(true);
      
      downloadAnimations.cleanupAnimations(animatedValues);
    });
  });
});