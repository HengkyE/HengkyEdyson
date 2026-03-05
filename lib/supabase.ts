/**
 * Supabase client configuration
 * 
 * Note: Replace these values with your actual Supabase project credentials
 * You can find these in your Supabase project settings under API
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Use placeholder values during build if env vars are not available
// This prevents build failures - the app will show errors at runtime if not configured
const buildSafeUrl = supabaseUrl || 'https://placeholder.supabase.co';
const buildSafeKey = supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

if (!supabaseUrl || !supabaseAnonKey) {
  if (typeof window !== 'undefined') {
    // Only log error in browser, not during build
    console.error(
      '⚠️ Supabase credentials not configured. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your environment variables.'
    );
  }
}

export const supabase = createClient<Database>(buildSafeUrl, buildSafeKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false, // Not needed for React Native
  },
  db: {
    schema: 'public',
  },
  global: {
    headers: {
      'apikey': buildSafeKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  },
});

// Test connection function
export async function testSupabaseConnection(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('barangs')
      .select('id')
      .limit(1);
    
    if (error) {
      console.error('Supabase connection test failed:', error);
      return false;
    }
    console.log('✅ Supabase connection successful');
    return true;
  } catch (error) {
    console.error('Supabase connection test error:', error);
    return false;
  }
}

