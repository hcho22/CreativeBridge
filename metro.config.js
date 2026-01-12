const { getDefaultConfig } = require('@expo/metro-config');
const path = require('path');

/**
 * Metro configuration for Expo
 * https://docs.expo.dev/guides/customizing-metro
 *
 * @type {import('@expo/metro-config').MetroConfig}
 */
const config = getDefaultConfig(__dirname);

// Configure resolver to use react-dom stub for React Native
// react-dom is web-only and not available in React Native
config.resolver = {
  ...config.resolver,
  extraNodeModules: {
    ...config.resolver.extraNodeModules,
    'react-dom': path.resolve(__dirname, 'react-dom-stub.js'),
  },
};

module.exports = config;
