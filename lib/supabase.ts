/**
 * Supabase has been removed; this app uses Neon only.
 * This stub exists for any code that still imports supabase (e.g. 3Sekawan).
 * Set EXPO_PUBLIC_NEON_DATA_API_URL and EXPO_PUBLIC_NEON_AUTH_URL in .env.
 */

const noop = () => {};
const emptySession = { data: { session: null }, error: null };
const emptySub = { data: { subscription: { unsubscribe: noop } } };
const emptyData = { data: [], error: null };
const emptySingle = { data: null, error: null };

const chain = (result: any) => ({
  order: () => Promise.resolve(result),
  eq: () => Promise.resolve(result),
  single: () => Promise.resolve(emptySingle),
  maybeSingle: () => Promise.resolve(emptySingle),
  limit: () => ({ single: () => Promise.resolve(emptySingle) }),
  then: (resolve: (v: any) => void) => Promise.resolve(result).then(resolve),
  catch: (fn: (e: any) => void) => Promise.resolve(result).catch(fn),
});

export const supabase = {
  auth: {
    getSession: () => Promise.resolve(emptySession),
    onAuthStateChange: (_: any, __: any) => emptySub,
    signInWithPassword: () => Promise.resolve({ data: null, error: { message: "Use Neon Auth. Set EXPO_PUBLIC_NEON_AUTH_URL." } }),
    signOut: () => Promise.resolve({ error: null }),
    getUser: () => Promise.resolve({ data: { user: null }, error: null }),
  },
  from: (_: string) => ({
    select: (..._args: any[]) => chain(emptyData),
    insert: (_row: any) => ({ select: () => Promise.resolve(emptyData), single: () => Promise.resolve(emptySingle) }),
    update: (_row: any) => ({ eq: () => ({ select: () => chain(emptySingle), single: () => Promise.resolve(emptySingle) }) }),
    delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
    rpc: () => Promise.resolve({ data: [], error: null }),
  }),
};

export async function testSupabaseConnection(): Promise<boolean> {
  return false;
}

export async function testBarangById(_id: string): Promise<null> {
  return null;
}
