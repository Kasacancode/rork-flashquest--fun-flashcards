import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

import { logger } from '@/utils/logger';

function getRequiredEnv(name: 'EXPO_PUBLIC_SUPABASE_URL' | 'EXPO_PUBLIC_SUPABASE_ANON_KEY'): string {
  const value = process.env[name];

  if (!value) {
    logger.error(`[Supabase] Missing required environment variable: ${name}`);
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

const SUPABASE_URL = getRequiredEnv('EXPO_PUBLIC_SUPABASE_URL');
const SUPABASE_ANON_KEY = getRequiredEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY');

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
