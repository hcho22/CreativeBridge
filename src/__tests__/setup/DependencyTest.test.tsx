import React from 'react';
import { render } from '@testing-library/react-native';

// Simple imports test for our new dependencies
describe('Dependency Installation Tests', () => {
  it('should import react-native-gesture-handler without errors', () => {
    expect(() => {
      const {
        PanGestureHandler,
        PinchGestureHandler,
      } = require('react-native-gesture-handler');
      expect(PanGestureHandler).toBeDefined();
      expect(PinchGestureHandler).toBeDefined();
    }).not.toThrow();
  });

  it('should import react-native-reanimated v3 without errors', () => {
    expect(() => {
      const Animated = require('react-native-reanimated');
      const { useSharedValue, useAnimatedStyle, withSpring } = Animated;
      expect(Animated).toBeDefined();
      expect(useSharedValue).toBeDefined();
      expect(useAnimatedStyle).toBeDefined();
      expect(withSpring).toBeDefined();
    }).not.toThrow();
  });

  it('should import react-native-image-zoom-viewer without errors', () => {
    expect(() => {
      const ImageViewer = require('react-native-image-zoom-viewer');
      expect(ImageViewer).toBeDefined();
    }).not.toThrow();
  });

  it('should verify React Native Reanimated version is v3', () => {
    const packageJson = require('react-native-reanimated/package.json');
    expect(packageJson.version).toMatch(/^3\./);
  });
});
