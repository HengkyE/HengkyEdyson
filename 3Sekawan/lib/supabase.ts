/**
 * Re-export root app's client. Supabase was removed; root exports a Neon-only stub.
 */

import { supabase as rootSupabase } from "../../lib/supabase";

export const supabase = rootSupabase;
