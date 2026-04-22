import React from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import { theme } from '../../../constants/theme';

export interface PaperBackgroundProps {
  children?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
}

// Ported from CSS `.paper-bg` in /tmp/cb_design/styles.css:53-59.
// The source stacks two radial gradients + an SVG noise texture for fiber grain;
// `react-native-svg` can't render feTurbulence efficiently at full-screen size,
// so we ship a flat paper-base surface and let paper-card/paper-cream tints
// layered on top of it carry the warmth. Per PRD §9 "cleaner spread" default.
export const PaperBackground: React.FC<PaperBackgroundProps> = ({
  children,
  style,
}) => <View style={[styles.container, style]}>{children}</View>;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.paper.base,
  },
});

export default PaperBackground;
