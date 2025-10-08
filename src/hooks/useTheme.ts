import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { theme as lightTheme } from '../constants/theme';

// Hook for accessing theme with potential dark mode support
export const useTheme = () => {
  const colorScheme = useColorScheme();

  // For now, always return light theme
  // This can be extended for dark mode support in the future
  const currentTheme = useMemo(() => {
    // In the future, you could return dark theme based on colorScheme
    return lightTheme;
  }, [colorScheme]);

  return {
    theme: currentTheme,
    isDarkMode: colorScheme === 'dark',
    colorScheme,
  };
};

// Hook for creating themed styles with proper typing
export const useThemedStyles = <T>(
  styleFactory: (theme: typeof lightTheme) => T,
): T => {
  const { theme } = useTheme();

  return useMemo(() => styleFactory(theme), [theme, styleFactory]);
};
