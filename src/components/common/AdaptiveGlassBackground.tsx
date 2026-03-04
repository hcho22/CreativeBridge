/**
 * AdaptiveGlassBackground (US-003)
 *
 * Renders the best available glass effect for the current platform:
 * - iOS 26+: Native Liquid Glass via GlassView (expo-glass-effect)
 * - iOS < 26: Gaussian blur via BlurView (expo-blur)
 * - Android / fallback: Semi-transparent solid View
 *
 * Both expo-glass-effect and expo-blur require native code compiled into the
 * binary. When the native build is stale or the app runs in Expo Go, the
 * native view managers aren't registered and static imports either crash
 * (glass) or produce non-functional views (blur). All native dependencies
 * are loaded via guarded dynamic require() gated on Platform.OS === 'ios'.
 */

import React from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';

// Local types — avoids importing from packages whose native modules may not exist
type GlassStyle = 'regular' | 'clear' | 'none';
type BlurTint = 'light' | 'dark' | 'default';

// === Native module guards ===
// Only attempt loading on iOS — these packages have no Android native code
// and loading them would emit spurious warnings.
let GlassViewComponent: React.ComponentType<any> | null = null;
let liquidGlassAvailable = false;
let BlurViewComponent: React.ComponentType<any> | null = null;

if (Platform.OS === 'ios') {
  // Tier 1: Liquid Glass (requires iOS 26 SDK / Xcode 26)
  try {
    const glassEffect = require('expo-glass-effect');
    GlassViewComponent = glassEffect.GlassView;
    liquidGlassAvailable =
      typeof glassEffect.isLiquidGlassAvailable === 'function' &&
      glassEffect.isLiquidGlassAvailable();
  } catch {
    // Native module not compiled in — expected on pre-Xcode 26 builds
  }

  // Tier 2: Gaussian blur (any iOS with native module linked)
  try {
    BlurViewComponent = require('expo-blur').BlurView;
  } catch {
    // Native module not compiled in — falls through to solid color
  }
}

export interface AdaptiveGlassBackgroundProps {
  /** Glass effect style for iOS 26+ Liquid Glass. */
  glassStyle?: GlassStyle;
  /** Whether the glass responds to touch (iOS 26+ only). Mount-only — cannot change dynamically. */
  isInteractive?: boolean;
  /** Blur intensity for iOS < 26 fallback (1–100). */
  fallbackBlurIntensity?: number;
  /** Blur tint for iOS < 26 fallback. */
  fallbackBlurTint?: BlurTint;
  /** Background color for Android and solid fallback. */
  androidFallbackColor?: string;
  /** Optional tint color applied to the Liquid Glass (iOS 26+ only). */
  tintColor?: string;
  /** Style applied to the glass container. `borderRadius` is respected on all tiers. */
  style?: ViewStyle;
  children?: React.ReactNode;
}

/**
 * Renders the highest-fidelity glass effect available on the current device.
 *
 * Usage:
 * ```tsx
 * <AdaptiveGlassBackground
 *   glassStyle="regular"
 *   fallbackBlurIntensity={80}
 *   fallbackBlurTint="light"
 *   androidFallbackColor="rgba(252,252,252,0.95)"
 *   style={{ borderRadius: 16 }}
 * >
 *   <Text>Content over glass</Text>
 * </AdaptiveGlassBackground>
 * ```
 */
export function AdaptiveGlassBackground({
  glassStyle = 'regular',
  isInteractive = false,
  fallbackBlurIntensity = 80,
  fallbackBlurTint = 'light',
  androidFallbackColor = 'rgba(252, 252, 252, 0.95)',
  tintColor,
  style,
  children,
}: AdaptiveGlassBackgroundProps) {
  // Android: plain semi-transparent View
  if (Platform.OS === 'android') {
    return (
      <View
        style={[styles.base, style, { backgroundColor: androidFallbackColor }]}
      >
        {children}
      </View>
    );
  }

  // iOS 26+: native Liquid Glass
  if (liquidGlassAvailable && GlassViewComponent) {
    return (
      <GlassViewComponent
        glassEffectStyle={glassStyle}
        isInteractive={isInteractive}
        tintColor={tintColor}
        style={[styles.base, style]}
      >
        {children}
      </GlassViewComponent>
    );
  }

  // iOS < 26: Gaussian blur fallback
  if (BlurViewComponent) {
    return (
      <BlurViewComponent
        tint={fallbackBlurTint}
        intensity={fallbackBlurIntensity}
        style={[styles.base, styles.blurOverflow, style]}
      >
        {children}
      </BlurViewComponent>
    );
  }

  // iOS without native effects (stale build / Expo Go): solid fallback
  return (
    <View
      style={[styles.base, style, { backgroundColor: androidFallbackColor }]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    ...StyleSheet.absoluteFillObject,
  },
  // BlurView requires overflow hidden for borderRadius to clip correctly
  blurOverflow: {
    overflow: 'hidden',
  },
});

export default AdaptiveGlassBackground;
