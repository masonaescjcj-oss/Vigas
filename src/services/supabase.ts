/**
 * frontend/src/services/supabase.ts
 * ---------------------------------------------------------------------------
 * Supabase client initialization for the mobile client.
 * Uses AsyncStorage for persistent React Native auth sessions.
 * ---------------------------------------------------------------------------
 */

import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

const supabaseUrl = "https://qnrsiukutehcqjhmpuze.supabase.co";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
