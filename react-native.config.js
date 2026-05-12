const path = require('path');

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
    // whisper.rn declares "exports" in its package.json, which breaks RN
    // codegen autolinking: `require.resolve('whisper.rn/package.json')` fails,
    // so the library is silently skipped and the iOS build fails with
    //   'RNWhisperSpec/RNWhisperSpec.h' file not found
    // Explicit `root` override tells the autolinker where the library lives.
    // Reference: https://github.com/mybigday/whisper.rn/issues/301
    // Rationale documented in: src/services/CLAUDE.md
    'whisper.rn': {
      root: path.join(__dirname, 'node_modules/whisper.rn'),
    },
  },
};
