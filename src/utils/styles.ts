import { StyleSheet, TextStyle, ViewStyle } from 'react-native';
import { theme as appTheme } from '../constants/theme';

type AppTheme = typeof appTheme;

// Styled component helper functions
export const createThemedStyles = <T extends StyleSheet.NamedStyles<T>>(
  styleFactory: (theme: AppTheme) => T,
): T => {
  return StyleSheet.create(styleFactory(appTheme));
};

const theme = appTheme;

// Common styled components using theme
export const commonStyles = StyleSheet.create({
  // Container styles
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: theme.spacing.screen,
  },

  content: {
    maxWidth: theme.layout.maxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },

  // Card styles
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.card,
    padding: theme.spacing.card,
    marginBottom: theme.spacing.lg,
    ...theme.shadows.base,
  },

  cardHeader: {
    marginBottom: theme.spacing.md,
  },

  // Button styles
  primaryButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.card,
    borderRadius: theme.borderRadius.button,
    alignItems: 'center',
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.base,
    ...theme.shadows.sm,
  },

  secondaryButton: {
    backgroundColor: theme.colors.surface,
    paddingVertical: theme.spacing.card,
    borderRadius: theme.borderRadius.button,
    alignItems: 'center',
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.base,
    borderWidth: theme.layout.borderWidth,
    borderColor: theme.colors.border,
  },

  disabledButton: {
    backgroundColor: theme.colors.disabled,
  },

  // Text styles
  primaryButtonText: {
    color: theme.colors.surface,
    ...theme.typography.textStyles.button,
  },

  secondaryButtonText: {
    color: theme.colors.primary,
    ...theme.typography.textStyles.button,
  },

  // Input styles
  input: {
    borderWidth: theme.layout.borderWidth,
    borderColor: theme.colors.inputBorder,
    borderRadius: theme.borderRadius.input,
    paddingHorizontal: theme.spacing.card,
    paddingVertical: theme.spacing.input,
    fontSize: theme.typography.fontSize.md,
    backgroundColor: theme.colors.inputBackground,
  },

  inputError: {
    borderColor: theme.colors.inputBorderError,
    borderWidth: theme.layout.borderWidthThick,
    backgroundColor: theme.colors.inputBackgroundError,
  },

  inputWarning: {
    borderColor: theme.colors.inputBorderWarning,
    borderWidth: theme.layout.borderWidthThick,
    backgroundColor: theme.colors.inputBackgroundWarning,
  },

  inputValid: {
    borderColor: theme.colors.inputBorderValid,
    borderWidth: theme.layout.borderWidthThick,
    backgroundColor: theme.colors.inputBackgroundValid,
  },

  // Text styles
  heading1: {
    ...theme.typography.textStyles.h1,
    color: theme.colors.text,
  },

  heading2: {
    ...theme.typography.textStyles.h2,
    color: theme.colors.text,
  },

  heading3: {
    ...theme.typography.textStyles.h3,
    color: theme.colors.text,
  },

  heading4: {
    ...theme.typography.textStyles.h4,
    color: theme.colors.text,
  },

  bodyText: {
    ...theme.typography.textStyles.body,
    color: theme.colors.text,
  },

  bodyTextSmall: {
    ...theme.typography.textStyles.bodySmall,
    color: theme.colors.textSecondary,
  },

  captionText: {
    ...theme.typography.textStyles.caption,
    color: theme.colors.textSecondary,
  },

  errorText: {
    ...theme.typography.textStyles.caption,
    color: theme.colors.error,
  },

  successText: {
    ...theme.typography.textStyles.caption,
    color: theme.colors.success,
  },

  warningText: {
    ...theme.typography.textStyles.caption,
    color: theme.colors.warning,
  },

  // Layout helpers
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  column: {
    flexDirection: 'column',
  },

  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Spacing utilities
  mt_xs: { marginTop: theme.spacing.xs },
  mt_sm: { marginTop: theme.spacing.sm },
  mt_md: { marginTop: theme.spacing.md },
  mt_base: { marginTop: theme.spacing.base },
  mt_lg: { marginTop: theme.spacing.lg },
  mt_xl: { marginTop: theme.spacing.xl },

  mb_xs: { marginBottom: theme.spacing.xs },
  mb_sm: { marginBottom: theme.spacing.sm },
  mb_md: { marginBottom: theme.spacing.md },
  mb_base: { marginBottom: theme.spacing.base },
  mb_lg: { marginBottom: theme.spacing.lg },
  mb_xl: { marginBottom: theme.spacing.xl },

  mx_xs: { marginHorizontal: theme.spacing.xs },
  mx_sm: { marginHorizontal: theme.spacing.sm },
  mx_md: { marginHorizontal: theme.spacing.md },
  mx_base: { marginHorizontal: theme.spacing.base },
  mx_lg: { marginHorizontal: theme.spacing.lg },
  mx_xl: { marginHorizontal: theme.spacing.xl },

  my_xs: { marginVertical: theme.spacing.xs },
  my_sm: { marginVertical: theme.spacing.sm },
  my_md: { marginVertical: theme.spacing.md },
  my_base: { marginVertical: theme.spacing.base },
  my_lg: { marginVertical: theme.spacing.lg },
  my_xl: { marginVertical: theme.spacing.xl },

  p_xs: { padding: theme.spacing.xs },
  p_sm: { padding: theme.spacing.sm },
  p_md: { padding: theme.spacing.md },
  p_base: { padding: theme.spacing.base },
  p_lg: { padding: theme.spacing.lg },
  p_xl: { padding: theme.spacing.xl },
});

// Helper functions for creating themed styles
export const createButtonStyle = (
  variant: 'primary' | 'secondary' | 'error' = 'primary',
  disabled = false,
): ViewStyle => ({
  backgroundColor: disabled
    ? theme.colors.disabled
    : variant === 'primary'
    ? theme.colors.primary
    : variant === 'error'
    ? theme.colors.error
    : theme.colors.surface,
  borderColor: variant === 'secondary' ? theme.colors.border : 'transparent',
  borderWidth: variant === 'secondary' ? theme.layout.borderWidth : 0,
  paddingVertical: theme.spacing.card,
  borderRadius: theme.borderRadius.button,
  alignItems: 'center',
  marginVertical: theme.spacing.sm,
  ...theme.shadows.sm,
});

export const createButtonTextStyle = (
  variant: 'primary' | 'secondary' | 'error' = 'primary',
  disabled = false,
): TextStyle => ({
  color: disabled
    ? theme.colors.textDisabled
    : variant === 'primary' || variant === 'error'
    ? theme.colors.surface
    : theme.colors.primary,
  ...theme.typography.textStyles.button,
});

export const createInputStyle = (
  state: 'default' | 'error' | 'warning' | 'valid' = 'default',
): TextStyle => ({
  borderWidth:
    state === 'default'
      ? theme.layout.borderWidth
      : theme.layout.borderWidthThick,
  borderColor:
    state === 'error'
      ? theme.colors.inputBorderError
      : state === 'warning'
      ? theme.colors.inputBorderWarning
      : state === 'valid'
      ? theme.colors.inputBorderValid
      : theme.colors.inputBorder,
  backgroundColor:
    state === 'error'
      ? theme.colors.inputBackgroundError
      : state === 'warning'
      ? theme.colors.inputBackgroundWarning
      : state === 'valid'
      ? theme.colors.inputBackgroundValid
      : theme.colors.inputBackground,
  borderRadius: theme.borderRadius.input,
  paddingHorizontal: theme.spacing.card,
  paddingVertical: theme.spacing.input,
  fontSize: theme.typography.fontSize.md,
});

// Export theme for direct access
export { theme };
