import { useMemo } from 'react';
import { Platform } from 'react-native';
import { isLiquidGlassAvailable } from 'expo-glass-effect';

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
      isLiquidGlass: isIOS && isLiquidGlassAvailable(),
      isBlurAvailable: isIOS,
      isAndroid: Platform.OS === 'android',
    };
  }, []);
}
