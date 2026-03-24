/**
 * Default mock for @env (react-native-dotenv virtual module).
 * Individual tests can override with jest.doMock('@env', factory).
 */
module.exports = {
  OPENAI_API_KEY: 'sk-test-mock-key',
  OPENAI_MODEL: '',
  SUPABASE_URL: 'https://mock.supabase.co',
  SUPABASE_ANON_KEY: 'mock-anon-key',
  CLERK_PUBLISHABLE_KEY: '',
  CLERK_SECRET_KEY: '',
  CLERK_JWKS_URL: '',
  CONVEX_URL: '',
  REPLICATE_API_TOKEN: '',
  BACKUP_IMAGE_API_TOKEN: '',
  IMAGE_GENERATION_ENABLED: 'false',
  IMAGE_GENERATION_TIMEOUT_PRIMARY: '60000',
  IMAGE_GENERATION_TIMEOUT_BACKUP: '45000',
  IMAGE_GENERATION_MAX_CONCURRENT: '10',
  IMAGE_GENERATION_XP_COST: '1000',
  APP_NAME: 'CreativeBridge',
  APP_VERSION: '1.0.0',
};
