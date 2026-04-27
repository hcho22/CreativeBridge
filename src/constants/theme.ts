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

    // Storybook paper palette — aged-paper surfaces (US-001)
    // Maps to CSS custom properties --paper, --paper-cream, --paper-deep, --paper-edge,
    // plus --card and --card-warm warm tints used behind prompt/round cards.
    paper: {
      base: '#F6EFE1',
      cream: '#FBF5E6',
      deep: '#EEE3C8',
      edge: '#E3D5B2',
      card: '#FDF9EC',
      cardWarm: '#F9F0D8',
    },

    // Storybook ink hierarchy — warm-brown text cascade (US-001)
    // Primary body copy uses `base`; secondary labels `soft`; tertiary/disabled `faint`.
    ink: {
      base: '#2B1D14',
      soft: '#5C4432',
      faint: '#8A7256',
    },

    // Storybook accent palette — adventure red, quill green, and mood tints (US-001)
    // Note (plural "accents"): the legacy top-level `accent: '#4CAF50'` string is
    // preserved untouched per FR-12; this new object lives alongside it to avoid
    // rename/remove of an existing token. Downstream storybook screens should
    // consume `theme.colors.accents.foxglove`, etc.
    accents: {
      foxglove: '#C2410C', // adventure red — primary CTAs, active-state pill
      moss: '#3F6A3A', // quill green — secondary success / progress
      inkwell: '#1E3A5F', // navy — information / links
      gold: '#B8860B', // XP gold — reward callouts
      plum: '#7A3B5C', // mystery / rarer badges
      amber: '#D97706', // streak / warm highlights
    },
  },

  typography: {
    // Storybook font-family tokens (US-001)
    // Mirrors CSS --f-serif / --f-hand / --f-ui plus the legacy display faces.
    // The `*Family` entries are comma-separated RN fallback chains; the per-weight
    // entries match the exact module names exported by @expo-google-fonts/* so they
    // resolve directly to the registered fontFamily after App.tsx useFonts loads.
    fontFamily: {
      // Primary display serif — Fraunces
      serif: 'Fraunces_400Regular',
      serifBold: 'Fraunces_700Bold',
      serifItalic: 'Fraunces_700Bold_Italic',
      serifFamily: 'Fraunces, Cochin, Georgia, serif',

      // Handwritten accent — Caveat
      hand: 'Caveat_400Regular',
      handBold: 'Caveat_700Bold',
      handFamily: "Caveat, 'Bradley Hand', cursive",

      // UI / body sans — Inter
      uiRegular: 'Inter_400Regular',
      uiMedium: 'Inter_500Medium',
      uiSemibold: 'Inter_600SemiBold',
      uiBold: 'Inter_700Bold',
      uiFamily: 'Inter, -apple-system, system-ui, sans-serif',

      // Existing display faces preserved for current consumers (AuthScreen etc.)
      kaushan: 'KaushanScript_400Regular',
      architectsDaughter: 'ArchitectsDaughter_400Regular',
    },

    // Font sizes
    fontSize: {
      xs: 12,
      sm: 14,
      base: 16,
      md: 18,
      lg: 20,
      xl: 22,
      xxl: 26,
      xxxl: 34,
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
        fontSize: 34,
        fontWeight: 'bold' as const,
        lineHeight: 1.2,
      },
      h2: {
        fontSize: 26,
        fontWeight: 'bold' as const,
        lineHeight: 1.3,
      },
      h3: {
        fontSize: 22,
        fontWeight: '600' as const,
        lineHeight: 1.4,
      },
      h4: {
        fontSize: 20,
        fontWeight: '600' as const,
        lineHeight: 1.4,
      },
      body: {
        fontSize: 18,
        fontWeight: '400' as const,
        lineHeight: 1.5,
      },
      bodySmall: {
        fontSize: 16,
        fontWeight: '400' as const,
        lineHeight: 1.4,
      },
      caption: {
        fontSize: 14,
        fontWeight: '400' as const,
        lineHeight: 1.3,
      },
      button: {
        fontSize: 18,
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

    // Storybook warm-ink shadows (US-001)
    // RN supports one shadow per view; CSS --shadow-* tokens stack two layers.
    // We keep the dominant ambient layer and tint the shadow color warm-brown
    // (#2B1D14 == ink.base) so elevation reads as parchment, not neutral grey.
    paper: {
      shadowColor: '#2B1D14',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 2,
    },
    card: {
      shadowColor: '#2B1D14',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.1,
      shadowRadius: 28,
      elevation: 5,
    },
    lift: {
      shadowColor: '#2B1D14',
      shadowOffset: { width: 0, height: 20 },
      shadowOpacity: 0.2,
      shadowRadius: 60,
      elevation: 12,
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

  // Voice-First Input Bar tokens (see PRD: Voice-First Input Bar, US-001)
  // Two distinct button sizes express the Speak-is-primary hierarchy:
  // primary (Speak, center) is strictly larger than secondary (Listen, Keyboard).
  // Colors intentionally omitted — consumers reference theme.colors.primary /
  // theme.colors.disabled directly at the style callsite to avoid duplication.
  voiceFirst: {
    primaryButtonSize: 96,
    // US-006: bumped 64 → 78 per /tmp/cb_design/components/screens-app.jsx:319
    // (DockButton secondary size). Speak-vs-rest hierarchy preserved (96 > 78).
    secondaryButtonSize: 78,
    primaryButtonRadius: 48,
    secondaryButtonRadius: 39,
    idleElevation: 4,
    activeElevation: 8,
    labelFontSize: 14,
    primaryLabelFontSize: 14,
    labelMarginTop: 6,
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
        // US-004: Android fallback color bumped to paper-cream to match the
        // storybook tab-bar chrome (paper-cream background + paper-edge top border).
        glassStyle: 'regular' as const,
        fallbackBlurIntensity: 80,
        fallbackBlurTint: 'light' as const,
        androidFallbackColor: 'rgba(251, 245, 230, 0.96)',
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
      challengeBox: {
        glassStyle: 'regular' as const,
        fallbackBlurIntensity: 80,
        fallbackBlurTint: 'light' as const,
        androidFallbackColor: 'rgba(255, 255, 255, 0.90)',
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
export type ThemeVoiceFirst = typeof theme.voiceFirst;
export type ThemeGlass = typeof theme.glass;
export type ThemeGlassSurface =
  (typeof theme.glass.surfaces)[keyof typeof theme.glass.surfaces];
