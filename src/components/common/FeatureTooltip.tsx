/**
 * Feature Tooltip Component (US-016)
 * Reusable tooltip for feature discovery during onboarding.
 * Positioned relative to a target element with an arrow pointer.
 *
 * Used for:
 * - US-013: Voice input tooltip
 * - US-014: Image generation tooltip
 * - US-015: XP/Challenges tooltip
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  LayoutChangeEvent,
} from 'react-native';
import { theme } from '../../constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Tooltip arrow size
const ARROW_SIZE = 10;
const TOOLTIP_MARGIN = 8;

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

export interface FeatureTooltipProps {
  /** Whether the tooltip is visible */
  visible: boolean;
  /** The tooltip message text */
  text: string;
  /** Position relative to target element (default: 'top') */
  position?: TooltipPosition;
  /** Target element's position and dimensions */
  targetLayout?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Callback when tooltip is dismissed */
  onDismiss: () => void;
  /** Auto-hide delay in milliseconds (default: 5000ms, 0 to disable) */
  autoHideDelay?: number;
  /** Optional emoji/icon to display before text */
  icon?: string;
}

export const FeatureTooltip: React.FC<FeatureTooltipProps> = ({
  visible,
  text,
  position = 'top',
  targetLayout,
  onDismiss,
  autoHideDelay = 5000,
  icon,
}) => {
  const [tooltipLayout, setTooltipLayout] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const autoHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  // Clear auto-hide timer on cleanup
  const clearAutoHideTimer = useCallback(() => {
    if (autoHideTimerRef.current) {
      clearTimeout(autoHideTimerRef.current);
      autoHideTimerRef.current = null;
    }
  }, []);

  // Handle visibility changes
  useEffect(() => {
    if (visible) {
      // Animate in
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: theme.animation.fast,
          useNativeDriver: true,
        }),
      ]).start();

      // Set up auto-hide timer
      if (autoHideDelay > 0) {
        clearAutoHideTimer();
        autoHideTimerRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            onDismiss();
          }
        }, autoHideDelay);
      }
    } else {
      // Animate out
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: theme.animation.fast,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: theme.animation.fast,
          useNativeDriver: true,
        }),
      ]).start();

      clearAutoHideTimer();
    }

    return clearAutoHideTimer;
  }, [
    visible,
    autoHideDelay,
    onDismiss,
    opacityAnim,
    scaleAnim,
    clearAutoHideTimer,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearAutoHideTimer();
    };
  }, [clearAutoHideTimer]);

  // Handle tooltip layout measurement
  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setTooltipLayout({ width, height });
  };

  // Calculate tooltip position based on target element
  const getTooltipPosition = (): { top: number; left: number } => {
    if (!targetLayout || !tooltipLayout) {
      // Default to center of screen if no layout info
      return {
        top: SCREEN_HEIGHT / 2 - 50,
        left: SCREEN_WIDTH / 2 - 100,
      };
    }

    const { x, y, width, height } = targetLayout;
    const tooltipWidth = tooltipLayout.width;
    const tooltipHeight = tooltipLayout.height;

    let top = 0;
    let left = 0;

    switch (position) {
      case 'top':
        top = y - tooltipHeight - ARROW_SIZE - TOOLTIP_MARGIN;
        left = x + width / 2 - tooltipWidth / 2;
        break;
      case 'bottom':
        top = y + height + ARROW_SIZE + TOOLTIP_MARGIN;
        left = x + width / 2 - tooltipWidth / 2;
        break;
      case 'left':
        top = y + height / 2 - tooltipHeight / 2;
        left = x - tooltipWidth - ARROW_SIZE - TOOLTIP_MARGIN;
        break;
      case 'right':
        top = y + height / 2 - tooltipHeight / 2;
        left = x + width + ARROW_SIZE + TOOLTIP_MARGIN;
        break;
    }

    // Ensure tooltip stays within screen bounds
    const padding = 16;
    left = Math.max(
      padding,
      Math.min(left, SCREEN_WIDTH - tooltipWidth - padding),
    );
    top = Math.max(
      padding,
      Math.min(top, SCREEN_HEIGHT - tooltipHeight - padding),
    );

    return { top, left };
  };

  // Get arrow style based on position
  const getArrowStyle = (): object => {
    const baseArrowStyle = {
      position: 'absolute' as const,
      width: 0,
      height: 0,
      backgroundColor: 'transparent',
      borderStyle: 'solid' as const,
    };

    switch (position) {
      case 'top':
        return {
          ...baseArrowStyle,
          bottom: -ARROW_SIZE,
          alignSelf: 'center' as const,
          borderLeftWidth: ARROW_SIZE,
          borderRightWidth: ARROW_SIZE,
          borderTopWidth: ARROW_SIZE,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderTopColor: theme.colors.text,
        };
      case 'bottom':
        return {
          ...baseArrowStyle,
          top: -ARROW_SIZE,
          alignSelf: 'center' as const,
          borderLeftWidth: ARROW_SIZE,
          borderRightWidth: ARROW_SIZE,
          borderBottomWidth: ARROW_SIZE,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: theme.colors.text,
        };
      case 'left':
        return {
          ...baseArrowStyle,
          right: -ARROW_SIZE,
          top: 12,
          borderTopWidth: ARROW_SIZE,
          borderBottomWidth: ARROW_SIZE,
          borderLeftWidth: ARROW_SIZE,
          borderTopColor: 'transparent',
          borderBottomColor: 'transparent',
          borderLeftColor: theme.colors.text,
        };
      case 'right':
      default:
        return {
          ...baseArrowStyle,
          left: -ARROW_SIZE,
          top: 12,
          borderTopWidth: ARROW_SIZE,
          borderBottomWidth: ARROW_SIZE,
          borderRightWidth: ARROW_SIZE,
          borderTopColor: 'transparent',
          borderBottomColor: 'transparent',
          borderRightColor: theme.colors.text,
        };
    }
  };

  if (!visible) {
    return null;
  }

  const tooltipPosition = getTooltipPosition();

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: tooltipPosition.top,
          left: tooltipPosition.left,
          opacity: opacityAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
      onLayout={handleLayout}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        style={styles.tooltip}
        onPress={onDismiss}
        activeOpacity={0.9}
        accessibilityLabel={`Tip: ${text}. Tap to dismiss.`}
        accessibilityRole="button"
        accessibilityHint="Tap anywhere on this tooltip to dismiss it"
      >
        {/* Arrow */}
        <View style={getArrowStyle()} />

        {/* Content */}
        <View style={styles.content}>
          {icon && <Text style={styles.icon}>{icon}</Text>}
          <Text style={styles.text}>{text}</Text>
        </View>

        {/* Dismiss hint */}
        <Text style={styles.dismissHint}>Tap to dismiss</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 9999,
    elevation: 10,
  },
  tooltip: {
    backgroundColor: theme.colors.text,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.base,
    maxWidth: 280,
    minWidth: 150,
    ...theme.shadows.lg,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    fontSize: 18,
    marginRight: theme.spacing.sm,
  },
  text: {
    color: theme.colors.surface,
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium,
    lineHeight: 20,
    flex: 1,
  },
  dismissHint: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: theme.typography.fontSize.xs,
    marginTop: theme.spacing.xs,
    textAlign: 'center',
  },
});

export default FeatureTooltip;
