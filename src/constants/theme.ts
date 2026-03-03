// Colors, typography, spacing, shadows
export const theme = {
  colors: {
    primary: '#4CAF50', // Story_Quest green
    secondary: '#2196F3', // Blue accent
    error: '#f44336', // Error red
    warning: '#ff9800', // Warning orange
    success: '#4CAF50', // Success green (same as primary)
    info: '#2196F3', // Info blue (same as secondary)
    background: '#fcfcfc', // Light gray background
    surface: '#ffffff', // White cards/surfaces
    text: '#333333', // Dark text
    textSecondary: '#666666', // Secondary text
    textDisabled: '#999999', // Disabled text
    border: '#e0e0e0', // Light border
    borderFocus: '#4CAF50', // Focused border
    disabled: '#cccccc', // Disabled elements
    accent: '#4CAF50', // Accent color (same as primary)

    // Semantic colors for specific contexts
    tabActive: '#4CAF50',
    tabInactive: '#8E8E93',
    headerBackground: '#4CAF50',
    headerText: '#ffffff',

    // Input states
    inputBackground: '#f8f9fa',
    inputBorder: '#e0e0e0',
    inputBorderError: '#ff4444',
    inputBorderWarning: '#ffaa00',
    inputBorderValid: '#44aa44',
    inputBackgroundError: '#fff5f5',
    inputBackgroundWarning: '#fffaf0',
    inputBackgroundValid: '#f0fff0',
  },

  typography: {
    // Font sizes
    fontSize: {
      xs: 10,
      sm: 12,
      base: 14,
      md: 16,
      lg: 18,
      xl: 20,
      xxl: 24,
      xxxl: 32,
    },

    // Font weights
    fontWeight: {
      light: '300' as const,
      normal: '400' as const,
      medium: '500' as const,
      semibold: '600' as const,
      bold: '700' as const,
      heavy: '800' as const,
    },

    // Line heights
    lineHeight: {
      tight: 1.2,
      normal: 1.4,
      relaxed: 1.6,
      loose: 1.8,
    },

    // Common text styles
    textStyles: {
      h1: {
        fontSize: 32,
        fontWeight: 'bold' as const,
        lineHeight: 1.2,
      },
      h2: {
        fontSize: 24,
        fontWeight: 'bold' as const,
        lineHeight: 1.3,
      },
      h3: {
        fontSize: 20,
        fontWeight: '600' as const,
        lineHeight: 1.4,
      },
      h4: {
        fontSize: 18,
        fontWeight: '600' as const,
        lineHeight: 1.4,
      },
      body: {
        fontSize: 16,
        fontWeight: '400' as const,
        lineHeight: 1.5,
      },
      bodySmall: {
        fontSize: 14,
        fontWeight: '400' as const,
        lineHeight: 1.4,
      },
      caption: {
        fontSize: 12,
        fontWeight: '400' as const,
        lineHeight: 1.3,
      },
      button: {
        fontSize: 16,
        fontWeight: '600' as const,
        lineHeight: 1.2,
      },
    },
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    base: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
    xxxl: 40,
    huge: 48,

    // Common spacing patterns
    component: 16,
    section: 24,
    screen: 20,
    card: 15,
    input: 12,
  },

  borderRadius: {
    none: 0,
    sm: 4,
    base: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999,

    // Component-specific radii
    button: 8,
    card: 12,
    input: 8,
    modal: 12,
    image: 8,
  },

  shadows: {
    none: {
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    base: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 6,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
      elevation: 5,
    },
    xl: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.25,
      shadowRadius: 16,
      elevation: 6,
    },
  },

  // Layout constants
  layout: {
    headerHeight: 60,
    tabBarHeight: 60,
    borderWidth: 1,
    borderWidthThick: 2,
    maxContentWidth: 400,
  },

  // Animation durations
  animation: {
    fast: 150,
    normal: 300,
    slow: 500,
  },

  // Liquid Glass / blur / solid fallback configuration
  // iOS 26+: native Liquid Glass via expo-glass-effect
  // iOS < 26: Gaussian blur via expo-blur
  // Android: semi-transparent solid View
  glass: {
    // Default glass effect styles
    styles: {
      regular: 'regular' as const,
      clear: 'clear' as const,
      none: 'none' as const,
    },

    // Fallback blur settings (iOS < 26)
    fallback: {
      blur: {
        intensity: 80,
        tint: 'light' as const,
      },
    },

    // Android solid-color fallback
    android: {
      fallbackColor: 'rgba(252, 252, 252, 0.95)',
      fallbackColorDark: 'rgba(0, 0, 0, 0.5)',
    },

    // Per-surface configuration — consumed by AdaptiveGlassBackground
    surfaces: {
      tabBar: {
        glassStyle: 'regular' as const,
        fallbackBlurIntensity: 80,
        fallbackBlurTint: 'light' as const,
        androidFallbackColor: 'rgba(252, 252, 252, 0.95)',
      },
      floatingInputBar: {
        glassStyle: 'regular' as const,
        isInteractive: true,
        fallbackBlurIntensity: 90,
        fallbackBlurTint: 'light' as const,
        androidFallbackColor: 'rgba(255, 255, 255, 0.95)',
      },
      modalBackdrop: {
        glassStyle: 'clear' as const,
        fallbackBlurIntensity: 20,
        fallbackBlurTint: 'dark' as const,
        androidFallbackColor: 'rgba(0, 0, 0, 0.5)',
      },
      navigationHeader: {
        glassStyle: 'regular' as const,
        fallbackBlurIntensity: 80,
        fallbackBlurTint: 'light' as const,
        androidFallbackColor: 'rgba(252, 252, 252, 0.95)',
      },
    },
  },
};

// Type definitions for theme
export type Theme = typeof theme;
export type ThemeColors = typeof theme.colors;
export type ThemeSpacing = typeof theme.spacing;
export type ThemeTypography = typeof theme.typography;
export type ThemeBorderRadius = typeof theme.borderRadius;
export type ThemeShadows = typeof theme.shadows;
export type ThemeGlass = typeof theme.glass;
export type ThemeGlassSurface =
  (typeof theme.glass.surfaces)[keyof typeof theme.glass.surfaces];
