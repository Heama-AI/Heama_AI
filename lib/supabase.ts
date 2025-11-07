import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

function createFallbackClient(): SupabaseClient {
  let hasWarned = false;
  const warn = () => {
    const message =
      'Supabase 환경 변수가 설정되지 않았습니다. EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY 값을 확인해주세요.';
    if (__DEV__ && !hasWarned) {
      console.warn(message);
      hasWarned = true;
    }
    return new Error(message);
  };

  const noopSubscription = { unsubscribe() {} };

  return {
    auth: {
      getSession: async () => ({ data: { session: null }, error: warn() }),
      onAuthStateChange: () => ({ data: { subscription: noopSubscription } }),
      getUser: async () => ({ data: { user: null }, error: warn() }),
      signOut: async () => ({ error: warn() }),
      signInWithPassword: async () => ({ data: { user: null, session: null }, error: warn() }),
      signUp: async () => ({ data: { user: null, session: null }, error: warn() }),
    },
  } as unknown as SupabaseClient;
}

export const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : createFallbackClient();
