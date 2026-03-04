import { useMemo } from 'react';
import { Platform } from 'react-native';

// expo-glass-effect requires Xcode 26 / iOS 26 native binaries.
// Guard with Platform check + dynamic require() so the module is never
// loaded on Android (no native code) and doesn't crash on iOS when the
// native module isn't compiled in (e.g. older Xcode, Expo Go).
let liquidGlassAvailable = false;
if (Platform.OS === 'ios') {
  try {
    const glassEffect = require('expo-glass-effect');
    liquidGlassAvailable =
      typeof glassEffect.isLiquidGlassAvailable === 'function' &&
      glassEffect.isLiquidGlassAvailable();
  } catch {
    // Native module not available
  }
}

interface GlassAvailability {
  /** True when running on iOS 26+ with Liquid Glass APIs available */
  isLiquidGlass: boolean;
  /** True on any iOS version (BlurView is always available on iOS) */
  isBlurAvailable: boolean;
  /** True on Android (solid fallback tier) */
  isAndroid: boolean;
}

/**
 * Detects the current device's glass effect capability tier:
 * - **Tier 1** (iOS 26+): Native Liquid Glass via `expo-glass-effect`
 * - **Tier 2** (iOS < 26): Gaussian blur via `expo-blur`
 * - **Tier 3** (Android): Semi-transparent solid background
 */
export function useGlassAvailability(): GlassAvailability {
  return useMemo(() => {
    const isIOS = Platform.OS === 'ios';

    return {
      isLiquidGlass: isIOS && liquidGlassAvailable,
      isBlurAvailable: isIOS,
      isAndroid: Platform.OS === 'android',
    };
  }, []);
}
