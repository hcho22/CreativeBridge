/**
 * AdaptiveGlassBackground (US-003)
 *
 * Renders the best available glass effect for the current platform:
 * - iOS 26+: Native Liquid Glass via GlassView (expo-glass-effect)
 * - iOS < 26: Gaussian blur via BlurView (expo-blur)
 * - Android: Semi-transparent solid View
 */

import React from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { BlurView, type BlurTint } from 'expo-blur';
import type { GlassStyle } from 'expo-glass-effect';

export interface AdaptiveGlassBackgroundProps {
  /** Glass effect style for iOS 26+ Liquid Glass. */
  glassStyle?: GlassStyle;
  /** Whether the glass responds to touch (iOS 26+ only). Mount-only — cannot change dynamically. */
  isInteractive?: boolean;
  /** Blur intensity for iOS < 26 fallback (1–100). */
  fallbackBlurIntensity?: number;
  /** Blur tint for iOS < 26 fallback. */
  fallbackBlurTint?: BlurTint;
  /** Background color for Android fallback. */
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
  if (isLiquidGlassAvailable()) {
    return (
      <GlassView
        glassEffectStyle={glassStyle}
        isInteractive={isInteractive}
        tintColor={tintColor}
        style={[styles.base, style]}
      >
        {children}
      </GlassView>
    );
  }

  // iOS < 26: Gaussian blur fallback
  return (
    <BlurView
      tint={fallbackBlurTint}
      intensity={fallbackBlurIntensity}
      style={[styles.base, styles.blurOverflow, style]}
    >
      {children}
    </BlurView>
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
