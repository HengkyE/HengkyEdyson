/**
 * Use the root app's single Supabase client to avoid multiple GoTrueClient instances.
 * Types remain 3Sekawan's Database (sessions, shop_expenses, etc.).
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { supabase as rootSupabase } from '../../lib/supabase';

export const supabase = rootSupabase as ReturnType<typeof createClient<Database>>;
