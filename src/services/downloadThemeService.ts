/**
 * Download Theme Service (Task 2.6.4)
 * Provides dark mode support for download components
 */

import { Appearance } from 'react-native';

export interface ThemeColors {
  // Background colors
  background: string;
  surface: string;
  card: string;
  modal: string;

  // Content colors
  text: string;
  textSecondary: string;
  textMuted: string;

  // Interactive colors
  primary: string;
  primaryText: string;
  secondary: string;
  secondaryText: string;

  // Status colors
  success: string;
  successText: string;
  warning: string;
  warningText: string;
  error: string;
  errorText: string;

  // Progress colors
  progress: string;
  progressBackground: string;

  // Border colors
  border: string;
  borderLight: string;

  // Shadow colors
  shadow: string;

  // Overlay colors
  overlay: string;
  modalOverlay: string;
}

export interface DownloadTheme {
  colors: ThemeColors;
  isDark: boolean;
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
  };
  typography: {
    fontSize: {
      xs: number;
      sm: number;
      md: number;
      lg: number;
      xl: number;
    };
    fontWeight: {
      normal: string;
      medium: string;
      semibold: string;
      bold: string;
    };
    lineHeight: {
      tight: number;
      normal: number;
      relaxed: number;
    };
  };
  borderRadius: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  shadows: {
    sm: any;
    md: any;
    lg: any;
  };
}

export class DownloadThemeService {
  private lightTheme: DownloadTheme;
  private darkTheme: DownloadTheme;

  constructor() {
    this.lightTheme = this.createLightTheme();
    this.darkTheme = this.createDarkTheme();
  }

  /**
   * Get current theme based on system preference.
   * Uses Appearance.getColorScheme() (non-hook imperative API) because this
   * method is called from class instances / non-component contexts; hooks
   * are illegal outside function components (rules-of-hooks).
   */
  getCurrentTheme(): DownloadTheme {
    const colorScheme = Appearance.getColorScheme();
    return colorScheme === 'dark' ? this.darkTheme : this.lightTheme;
  }

  /**
   * Get theme for specific mode
   */
  getTheme(mode: 'light' | 'dark'): DownloadTheme {
    return mode === 'dark' ? this.darkTheme : this.lightTheme;
  }

  /**
   * Get download button styles for current theme
   */
  getDownloadButtonStyles(
    state: 'idle' | 'downloading' | 'completed' | 'error',
  ): any {
    const theme = this.getCurrentTheme();

    const baseStyles = {
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      minHeight: 44, // Accessibility requirement
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      ...theme.shadows.sm,
    };

    switch (state) {
      case 'idle':
        return {
          ...baseStyles,
          backgroundColor: theme.colors.primary,
        };

      case 'downloading':
        return {
          ...baseStyles,
          backgroundColor: theme.colors.secondary,
          opacity: 0.8,
        };

      case 'completed':
        return {
          ...baseStyles,
          backgroundColor: theme.colors.success,
        };

      case 'error':
        return {
          ...baseStyles,
          backgroundColor: theme.colors.error,
        };

      default:
        return baseStyles;
    }
  }

  /**
   * Get download button text styles
   */
  getDownloadButtonTextStyles(
    state: 'idle' | 'downloading' | 'completed' | 'error',
  ): any {
    const theme = this.getCurrentTheme();

    const baseStyles = {
      fontSize: theme.typography.fontSize.md,
      fontWeight: theme.typography.fontWeight.semibold,
      textAlign: 'center',
    };

    switch (state) {
      case 'idle':
        return {
          ...baseStyles,
          color: theme.colors.primaryText,
        };

      case 'downloading':
        return {
          ...baseStyles,
          color: theme.colors.secondaryText,
        };

      case 'completed':
        return {
          ...baseStyles,
          color: theme.colors.successText,
        };

      case 'error':
        return {
          ...baseStyles,
          color: theme.colors.errorText,
        };

      default:
        return baseStyles;
    }
  }

  /**
   * Get progress indicator styles
   */
  getProgressIndicatorStyles(): any {
    const theme = this.getCurrentTheme();

    return {
      container: {
        backgroundColor: theme.colors.progressBackground,
        borderRadius: theme.borderRadius.lg,
        height: 8,
        overflow: 'hidden',
        marginVertical: theme.spacing.sm,
      },
      fill: {
        backgroundColor: theme.colors.progress,
        height: '100%',
        borderRadius: theme.borderRadius.lg,
      },
      text: {
        fontSize: theme.typography.fontSize.sm,
        color: theme.colors.textSecondary,
        textAlign: 'center',
        marginTop: theme.spacing.xs,
      },
    };
  }

  /**
   * Get modal styles
   */
  getModalStyles(): any {
    const theme = this.getCurrentTheme();

    return {
      overlay: {
        flex: 1,
        backgroundColor: theme.colors.modalOverlay,
        justifyContent: 'center',
        alignItems: 'center',
      },
      container: {
        backgroundColor: theme.colors.modal,
        borderRadius: theme.borderRadius.xl,
        margin: theme.spacing.lg,
        padding: theme.spacing.xl,
        minWidth: 300,
        maxWidth: '90%',
        ...theme.shadows.lg,
      },
      title: {
        fontSize: theme.typography.fontSize.lg,
        fontWeight: theme.typography.fontWeight.bold,
        color: theme.colors.text,
        textAlign: 'center',
        marginBottom: theme.spacing.md,
      },
      message: {
        fontSize: theme.typography.fontSize.md,
        color: theme.colors.textSecondary,
        textAlign: 'center',
        lineHeight: theme.typography.lineHeight.relaxed,
        marginBottom: theme.spacing.lg,
      },
    };
  }

  /**
   * Get list item styles for download history
   */
  getListItemStyles(): any {
    const theme = this.getCurrentTheme();

    return {
      container: {
        backgroundColor: theme.colors.card,
        borderRadius: theme.borderRadius.md,
        padding: theme.spacing.md,
        marginVertical: theme.spacing.xs,
        marginHorizontal: theme.spacing.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        ...theme.shadows.sm,
      },
      title: {
        fontSize: theme.typography.fontSize.md,
        fontWeight: theme.typography.fontWeight.semibold,
        color: theme.colors.text,
        marginBottom: theme.spacing.xs,
      },
      subtitle: {
        fontSize: theme.typography.fontSize.sm,
        color: theme.colors.textSecondary,
        marginBottom: theme.spacing.xs,
      },
      metadata: {
        fontSize: theme.typography.fontSize.xs,
        color: theme.colors.textMuted,
      },
      separator: {
        height: 1,
        backgroundColor: theme.colors.borderLight,
        marginVertical: theme.spacing.sm,
      },
    };
  }

  /**
   * Get error recovery modal styles
   */
  getErrorRecoveryStyles(): any {
    const theme = this.getCurrentTheme();

    return {
      ...this.getModalStyles(),
      errorIcon: {
        fontSize: 50,
        color: theme.colors.error,
        textAlign: 'center',
        marginBottom: theme.spacing.md,
      },
      optionButton: {
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.md,
        padding: theme.spacing.md,
        marginVertical: theme.spacing.xs,
        borderWidth: 1,
        borderColor: theme.colors.border,
      },
      optionButtonPressed: {
        backgroundColor: theme.colors.primary,
      },
      optionText: {
        fontSize: theme.typography.fontSize.md,
        color: theme.colors.text,
        fontWeight: theme.typography.fontWeight.medium,
      },
      optionDescription: {
        fontSize: theme.typography.fontSize.sm,
        color: theme.colors.textSecondary,
        marginTop: theme.spacing.xs,
      },
    };
  }

  // Private methods to create theme configurations

  private createLightTheme(): DownloadTheme {
    return {
      colors: {
        // Background colors
        background: '#FFFFFF',
        surface: '#F8F9FA',
        card: '#FFFFFF',
        modal: '#FFFFFF',

        // Content colors
        text: '#1A1A1A',
        textSecondary: '#6B6B6B',
        textMuted: '#9CA3AF',

        // Interactive colors
        primary: '#007AFF',
        primaryText: '#FFFFFF',
        secondary: '#34C759',
        secondaryText: '#FFFFFF',

        // Status colors
        success: '#34C759',
        successText: '#FFFFFF',
        warning: '#FF9500',
        warningText: '#FFFFFF',
        error: '#FF3B30',
        errorText: '#FFFFFF',

        // Progress colors
        progress: '#007AFF',
        progressBackground: '#E5E5E7',

        // Border colors
        border: '#E5E5E7',
        borderLight: '#F2F2F7',

        // Shadow colors
        shadow: '#000000',

        // Overlay colors
        overlay: 'rgba(0, 0, 0, 0.1)',
        modalOverlay: 'rgba(0, 0, 0, 0.5)',
      },
      isDark: false,
      ...this.getCommonThemeProperties(),
    };
  }

  private createDarkTheme(): DownloadTheme {
    return {
      colors: {
        // Background colors
        background: '#000000',
        surface: '#1C1C1E',
        card: '#2C2C2E',
        modal: '#1C1C1E',

        // Content colors
        text: '#FFFFFF',
        textSecondary: '#AEAEB2',
        textMuted: '#6D6D70',

        // Interactive colors
        primary: '#0A84FF',
        primaryText: '#FFFFFF',
        secondary: '#30D158',
        secondaryText: '#000000',

        // Status colors
        success: '#30D158',
        successText: '#000000',
        warning: '#FF9F0A',
        warningText: '#000000',
        error: '#FF453A',
        errorText: '#FFFFFF',

        // Progress colors
        progress: '#0A84FF',
        progressBackground: '#3A3A3C',

        // Border colors
        border: '#3A3A3C',
        borderLight: '#2C2C2E',

        // Shadow colors
        shadow: '#000000',

        // Overlay colors
        overlay: 'rgba(255, 255, 255, 0.1)',
        modalOverlay: 'rgba(0, 0, 0, 0.8)',
      },
      isDark: true,
      ...this.getCommonThemeProperties(),
    };
  }

  private getCommonThemeProperties() {
    return {
      spacing: {
        xs: 4,
        sm: 8,
        md: 16,
        lg: 24,
        xl: 32,
        xxl: 48,
      },
      typography: {
        fontSize: {
          xs: 14,
          sm: 16,
          md: 18,
          lg: 20,
          xl: 26,
        },
        fontWeight: {
          normal: '400',
          medium: '500',
          semibold: '600',
          bold: '700',
        },
        lineHeight: {
          tight: 1.2,
          normal: 1.4,
          relaxed: 1.6,
        },
      },
      borderRadius: {
        sm: 4,
        md: 8,
        lg: 12,
        xl: 16,
      },
      shadows: {
        sm: {
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
          elevation: 2,
        },
        md: {
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 4,
          elevation: 4,
        },
        lg: {
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
          elevation: 8,
        },
      },
    };
  }
}

// Export singleton instance
export const downloadThemeService = new DownloadThemeService();
export default downloadThemeService;
