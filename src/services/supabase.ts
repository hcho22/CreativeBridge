import 'react-native-url-polyfill/auto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from './environment';

// Helper to safely get AsyncStorage with fallback (no import at module level)
const getAsyncStorage = () => {
  // In-memory storage implementation as fallback
  const memoryStorage: { [key: string]: string } = {};
  const fallbackStorage = {
    getItem: async (key: string) => {
      return memoryStorage[key] || null;
    },
    setItem: async (key: string, value: string) => {
      memoryStorage[key] = value;
    },
    removeItem: async (key: string) => {
      delete memoryStorage[key];
    },
    getAllKeys: async () => {
      return Object.keys(memoryStorage);
    },
    clear: async () => {
      Object.keys(memoryStorage).forEach(key => delete memoryStorage[key]);
    },
  };

  try {
    // Try to dynamically require AsyncStorage (not import)
    const AsyncStorageModule = require('@react-native-async-storage/async-storage');
    if (AsyncStorageModule?.default) {
      console.log('✅ Using native AsyncStorage for Supabase');
      return AsyncStorageModule.default;
    }
  } catch (error) {
    console.warn(
      '⚠️ AsyncStorage native module not available, using in-memory fallback for Supabase',
    );
  }

  return fallbackStorage;
};

// Supabase configuration
// Use environment service to load configuration (works in both dev and production)
const supabaseUrl = env.SUPABASE_URL;

const supabaseAnonKey = env.SUPABASE_ANON_KEY;

// Validate that we have proper Supabase configuration
if (!supabaseUrl || !supabaseUrl.startsWith('http')) {
  console.error('Invalid Supabase URL configuration');
}

if (!supabaseAnonKey) {
  console.error('Missing Supabase Anon Key configuration');
}

// Import and re-export for backward compatibility and new image generation types
import type {
  Database,
  UserProfile,
  GameSession,
  GradeLevel,
  // Image generation types (Task 2.1 & 2.2)
  ImageGenerationEvent,
  ImageGenerationEventInsert,
  ImageGenerationEventUpdate,
  ImageGenerationAnalytics,
  UserImageGenerationEvent,
  StoryWithImage,
  ImageGenerationStats,
  GenerationStatus,
  ErrorType,
  ServiceUsed,
} from '../types/database';

export type {
  // Core types
  UserProfile,
  GameSession,
  Database,
  GradeLevel,
  // Image generation types (Task 2.1 & 2.2)
  ImageGenerationEvent,
  ImageGenerationEventInsert,
  ImageGenerationEventUpdate,
  ImageGenerationAnalytics,
  UserImageGenerationEvent,
  StoryWithImage,
  ImageGenerationStats,
  GenerationStatus,
  ErrorType,
  ServiceUsed,
};

export const supabase: SupabaseClient<Database> = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      storage: getAsyncStorage(),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
