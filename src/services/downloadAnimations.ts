/**
 * Download Animations Service (Task 2.6.3)
 * Provides smooth animations for download state transitions
 */

import { Animated, Easing } from 'react-native';

export interface AnimationConfig {
  duration: number;
  easing: any;
  useNativeDriver: boolean;
}

export interface DownloadAnimationState {
  opacity: Animated.Value;
  scale: Animated.Value;
  rotation: Animated.Value;
  translateY: Animated.Value;
  progressWidth: Animated.Value;
}

export class DownloadAnimationsService {
  // Default animation configurations
  private static readonly DEFAULT_DURATION = 300;
  private static readonly QUICK_DURATION = 150;
  private static readonly SLOW_DURATION = 500;

  private static readonly SPRING_CONFIG = {
    tension: 100,
    friction: 8,
    useNativeDriver: true,
  };

  private static readonly TIMING_CONFIG: AnimationConfig = {
    duration: DownloadAnimationsService.DEFAULT_DURATION,
    easing: Easing.out(Easing.cubic),
    useNativeDriver: true,
  };

  /**
   * Create initial animated values for download components
   */
  createAnimatedValues(): DownloadAnimationState {
    return {
      opacity: new Animated.Value(1),
      scale: new Animated.Value(1),
      rotation: new Animated.Value(0),
      translateY: new Animated.Value(0),
      progressWidth: new Animated.Value(0),
    };
  }

  /**
   * Animate button press feedback
   */
  animateButtonPress(
    animatedValues: Pick<DownloadAnimationState, 'scale'>,
    onComplete?: () => void,
  ): void {
    const { scale } = animatedValues;

    Animated.sequence([
      // Press down
      Animated.timing(scale, {
        toValue: 0.95,
        duration: DownloadAnimationsService.QUICK_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      // Release
      Animated.spring(scale, {
        toValue: 1,
        ...DownloadAnimationsService.SPRING_CONFIG,
      }),
    ]).start(onComplete);
  }

  /**
   * Animate download start transition
   */
  animateDownloadStart(
    animatedValues: Pick<
      DownloadAnimationState,
      'opacity' | 'scale' | 'rotation'
    >,
    onComplete?: () => void,
  ): void {
    const { opacity, scale, rotation } = animatedValues;

    // Reset values
    opacity.setValue(1);
    scale.setValue(1);
    rotation.setValue(0);

    Animated.parallel([
      // Subtle scale animation
      Animated.spring(scale, {
        toValue: 1.05,
        ...DownloadAnimationsService.SPRING_CONFIG,
      }),
      // Start rotation for loading indicator
      Animated.loop(
        Animated.timing(rotation, {
          toValue: 1,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ),
    ]).start(onComplete);

    console.log('🎬 Started download animation');
  }

  /**
   * Animate progress updates
   */
  animateProgress(
    animatedValues: Pick<DownloadAnimationState, 'progressWidth'>,
    progress: number,
    onComplete?: () => void,
  ): void {
    const { progressWidth } = animatedValues;

    Animated.timing(progressWidth, {
      toValue: progress,
      duration: DownloadAnimationsService.DEFAULT_DURATION,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // Width animations can't use native driver
    }).start(onComplete);
  }

  /**
   * Animate download completion with success feedback
   */
  animateDownloadSuccess(
    animatedValues: Pick<
      DownloadAnimationState,
      'opacity' | 'scale' | 'rotation'
    >,
    onComplete?: () => void,
  ): void {
    const { opacity: _opacity, scale, rotation } = animatedValues;

    // Stop any ongoing rotation
    rotation.stopAnimation();

    Animated.sequence([
      // Quick scale up for emphasis
      Animated.timing(scale, {
        toValue: 1.1,
        duration: DownloadAnimationsService.QUICK_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      // Settle back to normal
      Animated.spring(scale, {
        toValue: 1,
        ...DownloadAnimationsService.SPRING_CONFIG,
      }),
    ]).start(onComplete);

    console.log('✅ Played download success animation');
  }

  /**
   * Animate download error with attention-getting feedback
   */
  animateDownloadError(
    animatedValues: Pick<
      DownloadAnimationState,
      'opacity' | 'scale' | 'rotation' | 'translateY'
    >,
    onComplete?: () => void,
  ): void {
    const { opacity: _opacity, scale, rotation, translateY } = animatedValues;

    // Stop any ongoing rotation
    rotation.stopAnimation();

    Animated.sequence([
      // Shake animation for error feedback
      Animated.timing(translateY, {
        toValue: -5,
        duration: 100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 5,
        duration: 100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      // Scale emphasis
      Animated.spring(scale, {
        toValue: 1.05,
        ...DownloadAnimationsService.SPRING_CONFIG,
      }),
      Animated.spring(scale, {
        toValue: 1,
        ...DownloadAnimationsService.SPRING_CONFIG,
      }),
    ]).start(onComplete);

    console.log('❌ Played download error animation');
  }

  /**
   * Animate state transition with fade effect
   */
  animateStateTransition(
    animatedValues: Pick<DownloadAnimationState, 'opacity'>,
    onMidpoint: () => void,
    onComplete?: () => void,
  ): void {
    const { opacity } = animatedValues;

    Animated.sequence([
      // Fade out
      Animated.timing(opacity, {
        toValue: 0,
        duration: DownloadAnimationsService.QUICK_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      // Fade in with new state
      Animated.timing(opacity, {
        toValue: 1,
        duration: DownloadAnimationsService.QUICK_DURATION,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(onComplete);

    // Call midpoint callback when fade out completes
    setTimeout(onMidpoint, DownloadAnimationsService.QUICK_DURATION);
  }

  /**
   * Animate modal entrance
   */
  animateModalEntrance(
    animatedValues: Pick<
      DownloadAnimationState,
      'opacity' | 'scale' | 'translateY'
    >,
    onComplete?: () => void,
  ): void {
    const { opacity, scale, translateY } = animatedValues;

    // Set initial values
    opacity.setValue(0);
    scale.setValue(0.8);
    translateY.setValue(50);

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: DownloadAnimationsService.DEFAULT_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        ...DownloadAnimationsService.SPRING_CONFIG,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: DownloadAnimationsService.DEFAULT_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(onComplete);

    console.log('🎭 Animated modal entrance');
  }

  /**
   * Animate modal exit
   */
  animateModalExit(
    animatedValues: Pick<
      DownloadAnimationState,
      'opacity' | 'scale' | 'translateY'
    >,
    onComplete?: () => void,
  ): void {
    const { opacity, scale, translateY } = animatedValues;

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: DownloadAnimationsService.DEFAULT_DURATION,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.8,
        duration: DownloadAnimationsService.DEFAULT_DURATION,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 50,
        duration: DownloadAnimationsService.DEFAULT_DURATION,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(onComplete);

    console.log('🎭 Animated modal exit');
  }

  /**
   * Animate list item appearance
   */
  animateListItemAppearance(
    animatedValues: Pick<DownloadAnimationState, 'opacity' | 'translateY'>,
    delay: number = 0,
    onComplete?: () => void,
  ): void {
    const { opacity, translateY } = animatedValues;

    // Set initial values
    opacity.setValue(0);
    translateY.setValue(20);

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: DownloadAnimationsService.DEFAULT_DURATION,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: DownloadAnimationsService.DEFAULT_DURATION,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(onComplete);
  }

  /**
   * Animate list item removal
   */
  animateListItemRemoval(
    animatedValues: Pick<DownloadAnimationState, 'opacity' | 'scale'>,
    onComplete?: () => void,
  ): void {
    const { opacity, scale } = animatedValues;

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: DownloadAnimationsService.DEFAULT_DURATION,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.8,
        duration: DownloadAnimationsService.DEFAULT_DURATION,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(onComplete);
  }

  /**
   * Create staggered animation for multiple items
   */
  animateStaggeredList(
    items: Array<Pick<DownloadAnimationState, 'opacity' | 'translateY'>>,
    staggerDelay: number = 100,
    onComplete?: () => void,
  ): void {
    const animations = items.map((item, index) => {
      const delay = index * staggerDelay;

      return new Promise<void>(resolve => {
        this.animateListItemAppearance(item, delay, resolve);
      });
    });

    Promise.all(animations).then(onComplete);
    console.log(`🎬 Started staggered animation for ${items.length} items`);
  }

  /**
   * Animate progress indicator pulse
   */
  animateProgressPulse(
    animatedValues: Pick<DownloadAnimationState, 'opacity'>,
    start: boolean = true,
  ): void {
    const { opacity } = animatedValues;

    if (start) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0.5,
            duration: 1000,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      opacity.stopAnimation();
      opacity.setValue(1);
    }
  }

  /**
   * Get rotation interpolation for loading spinners
   */
  getRotationInterpolation(rotationValue: Animated.Value): any {
    return rotationValue.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });
  }

  /**
   * Get progress width interpolation
   */
  getProgressWidthInterpolation(
    progressValue: Animated.Value,
    containerWidth: number,
  ): any {
    return progressValue.interpolate({
      inputRange: [0, 100],
      outputRange: [0, containerWidth],
      extrapolate: 'clamp',
    });
  }

  /**
   * Clean up all animations
   */
  cleanupAnimations(animatedValues: DownloadAnimationState): void {
    Object.values(animatedValues).forEach(animatedValue => {
      animatedValue.stopAnimation();
    });
    console.log('🧹 Cleaned up download animations');
  }

  /**
   * Reset animations to initial state
   */
  resetAnimations(animatedValues: DownloadAnimationState): void {
    animatedValues.opacity.setValue(1);
    animatedValues.scale.setValue(1);
    animatedValues.rotation.setValue(0);
    animatedValues.translateY.setValue(0);
    animatedValues.progressWidth.setValue(0);
    console.log('🔄 Reset download animations');
  }
}

// Export singleton instance
export const downloadAnimations = new DownloadAnimationsService();
export default downloadAnimations;
