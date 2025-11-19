module.exports = {
  dependencies: {
    // Temporarily exclude RNReanimated to isolate standard library header issues
    'react-native-reanimated': {
      platforms: {
        android: {
          sourceDir: '../node_modules/react-native-reanimated/android',
          packageImportPath: 'import io.realm.react.RealmReactPackage;',
        },
        ios: null, // exclude iOS platform, Android will still work
      },
    },
  },
};