import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const SUPABASE_URL = 'https://jzmijoxkcunyjkdpohvj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_VMGcr1fDD4rl7lP8VnYwEg___4uGMLP';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});
