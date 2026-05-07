module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // Allow `_`-prefixed identifiers across all positions (args, locals,
    // destructured props/elements, caught errors). Matches the convention
    // already permitted for args by the @react-native preset and used
    // throughout US-019 batches 1-7 for intentionally-unused bindings.
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        args: 'after-used',
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      },
    ],
    'no-bitwise': 'warn',
    'no-control-regex': 'warn',
    '@typescript-eslint/no-shadow': 'warn',
    'react-hooks/exhaustive-deps': 'warn',
    'react-hooks/rules-of-hooks': 'warn',
    // Deprecated by ESLint (legacy IE8 rule, not applicable to modern engines).
    // Forced 'off' because @react-native preset still enables it.
    'no-catch-shadow': 'off',
    'no-unreachable': 'warn',

    // COPPA US-012: Prevent PII from leaking into logs.
    // Do not log variables named email, userEmail, parentEmail, password,
    // token, apiKey, userId, userName, userPhone, ssn, or similar identifiers.
    'no-restricted-syntax': [
      'warn',
      {
        selector:
          "CallExpression[callee.object.name='console'] Identifier[name=/^(email|userEmail|parentEmail|password|token|apiKey|userId|userName|userPhone|ssn)$/]",
        message:
          'Do not log PII (email, userId, password, token, etc.). Redact or remove before logging. See COPPA US-012.',
      },
    ],
  },
  overrides: [
    {
      files: [
        '**/*.test.{js,jsx,ts,tsx}',
        '**/__tests__/**',
        '**/*.setup.{js,ts}',
        'jest.*.{js,ts}',
        'jest.config.{js,ts}',
      ],
      env: { jest: true, node: true },
    },
    {
      files: ['scripts/**'],
      env: { node: true },
    },
  ],
};
