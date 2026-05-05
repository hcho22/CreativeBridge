module.exports = api => {
  // Skip the react-native-dotenv babel plugin under jest (BABEL_ENV/NODE_ENV='test').
  // Reason: under `--coverage`, babel-plugin-istanbul instruments at Program.enter
  // and wraps every identifier reference in a SequenceExpression before dotenv's
  // ImportDeclaration visitor runs. dotenv's `binding.referencePaths` then fails
  // to substitute the bare `OPENAI_API_KEY` (and friends) inside the wrapped
  // sequence — leaving the literal identifier to throw `ReferenceError` at runtime.
  // In test env we instead let jest's moduleNameMapper redirect `@env` to the
  // runtime mock at src/__tests__/__mocks__/@env.ts.
  const isTest = api.env('test');

  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ...(isTest
        ? []
        : [
            [
              'module:react-native-dotenv',
              {
                envName: 'APP_ENV',
                moduleName: '@env',
                path: '.env',
                allowUndefined: true,
              },
            ],
          ]),
      'react-native-reanimated/plugin', // Must be last for optimal performance
    ],
  };
};
