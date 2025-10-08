import 'react-native-url-polyfill/auto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Supabase configuration
// For development: Replace these with your actual Supabase credentials
// For production: Use environment variables or a secure config service
const supabaseUrl = __DEV__
  ? 'https://dzwcqfnvcaempqgkzkuz.supabase.co'
  : process.env.SUPABASE_URL || 'https://dzwcqfnvcaempqgkzkuz.supabase.co';

const supabaseAnonKey = __DEV__
  ? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6d2NxZm52Y2FlbXBxZ2t6a3V6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc3NzAxMzgsImV4cCI6MjA2MzM0NjEzOH0.a4TidZN02D6AAj88W08BdumMQv_LLihRqyYu4b_3TEo'
  : process.env.SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6d2NxZm52Y2FlbXBxZ2t6a3V6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc3NzAxMzgsImV4cCI6MjA2MzM0NjEzOH0.a4TidZN02D6AAj88W08BdumMQv_LLihRqyYu4b_3TEo';

// Validate that we have proper Supabase configuration
if (!supabaseUrl || !supabaseUrl.startsWith('http')) {
  console.error('Invalid Supabase URL configuration');
}

if (!supabaseAnonKey) {
  console.error('Missing Supabase Anon Key configuration');
}

// Import and re-export for backward compatibility
import type {
  Database,
  UserProfile,
  GameSession,
  GradeLevel,
} from '../types/database';
export type { UserProfile, GameSession, Database, GradeLevel };

export const supabase: SupabaseClient<Database> = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
