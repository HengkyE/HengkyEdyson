/**
 * Utility to test Supabase connection and diagnose issues
 */

import { supabase } from '@/lib/supabase';

export async function testSupabaseConnection() {
  console.log('🔍 Testing Supabase connection...');
  
  try {
    // Test 1: Basic connection
    console.log('Test 1: Checking Supabase client...');
    if (!supabase) {
      console.error('❌ Supabase client is not initialized');
      return false;
    }
    console.log('✅ Supabase client initialized');

    // Test 2: Try to fetch from barangs table
    console.log('Test 2: Testing barangs table access...');
    const { data, error, status, statusText } = await supabase
      .from('barangs')
      .select('id')
      .limit(1);

    if (error) {
      console.error('❌ Error fetching from barangs:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        status,
        statusText,
      });
      
      // Common error solutions
      if (error.code === 'PGRST301' || status === 406) {
        console.error('💡 This might be an RLS (Row Level Security) issue.');
        console.error('💡 Check your Supabase dashboard:');
        console.error('   1. Go to Authentication > Policies');
        console.error('   2. Ensure barangs table has policies allowing SELECT for anon role');
        console.error('   3. Or temporarily disable RLS for testing');
      }
      
      return false;
    }

    console.log('✅ Successfully connected to barangs table');
    console.log('📊 Sample data:', data);
    return true;
  } catch (error: any) {
    console.error('❌ Connection test failed:', error);
    return false;
  }
}

export async function testBarangById(id: string) {
  console.log(`🔍 Testing fetch for barcode: ${id}`);
  
  try {
    const { data, error, status, statusText } = await supabase
      .from('barangs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('❌ Error fetching barang:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        status,
        statusText,
      });
      return null;
    }

    console.log('✅ Successfully fetched barang:', data);
    return data;
  } catch (error: any) {
    console.error('❌ Fetch test failed:', error);
    return null;
  }
}

