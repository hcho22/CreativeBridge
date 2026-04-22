import React from 'react';
import {
  Pressable,
  Text,
  View,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp,
  GestureResponderEvent,
} from 'react-native';
import { theme } from '../../../constants/theme';

export type InkButtonVariant =
  | 'primary'
  | 'foxglove'
  | 'moss'
  | 'ghost'
  | 'paper';

export interface InkButtonProps {
  children: React.ReactNode;
  variant?: InkButtonVariant;
  onPress?: (event: GestureResponderEvent) => void;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

// Ported from /tmp/cb_design/components/shared.jsx:242-285.
// Five variants cover the primary CTAs across the storybook design:
//   primary  — dark-ink button, used for high-emphasis confirmations.
//   foxglove — adventure red, used for "begin" / "start" actions.
//   moss     — quill green, used for success / sign-in flows.
//   ghost    — transparent with ink-faint border, for tertiary actions.
//   paper    — card-tinted with paper-edge border, for secondary cards.
// All variants dip translateY(1) on press to mimic a quill touching paper.

interface VariantStyle {
  container: ViewStyle;
  label: TextStyle;
}

const buildVariantStyles = (): Record<InkButtonVariant, VariantStyle> => ({
  primary: {
    container: {
      backgroundColor: theme.colors.ink.base,
      ...theme.shadows.card,
    },
    label: { color: theme.colors.paper.cream },
  },
  foxglove: {
    container: {
      backgroundColor: theme.colors.accents.foxglove,
      ...theme.shadows.card,
    },
    label: { color: theme.colors.paper.cream },
  },
  moss: {
    container: {
      backgroundColor: theme.colors.accents.moss,
      ...theme.shadows.card,
    },
    label: { color: theme.colors.paper.cream },
  },
  ghost: {
    container: {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: theme.colors.ink.faint,
    },
    label: { color: theme.colors.ink.base },
  },
  paper: {
    container: {
      backgroundColor: theme.colors.paper.card,
      borderWidth: 1,
      borderColor: theme.colors.paper.edge,
      ...theme.shadows.paper,
    },
    label: { color: theme.colors.ink.base },
  },
});

const VARIANT_STYLES = buildVariantStyles();

export const InkButton: React.FC<InkButtonProps> = ({
  children,
  variant = 'primary',
  onPress,
  disabled = false,
  icon,
  style,
  textStyle,
  accessibilityLabel,
  testID,
}) => {
  const variantStyle = VARIANT_STYLES[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        variantStyle.container,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
      {typeof children === 'string' ? (
        <Text style={[styles.label, variantStyle.label, textStyle]}>
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
  },
  label: {
    fontFamily: theme.typography.fontFamily.uiSemibold,
    fontSize: 17,
    letterSpacing: -0.2,
  },
  iconWrap: {
    marginRight: 10,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    transform: [{ translateY: 1 }],
  },
});

export default InkButton;
