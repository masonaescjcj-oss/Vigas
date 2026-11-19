/**
 * frontend/src/services/supabase.ts
 * ---------------------------------------------------------------------------
 * Supabase client initialization for the mobile client.
 * Uses AsyncStorage for persistent React Native auth sessions.
 * ---------------------------------------------------------------------------
 */

import { createClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL || "https://jasgepmskcsyvqoesocc.supabase.co";
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_m-HAN3dCgDJpgQ_L3WO1hQ_y1CWihK9";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/**
 * Tie token refreshing to the app being in the foreground.
 *
 * `autoRefreshToken` alone is a JS timer, and a JS timer does not run while a
 * phone app is backgrounded. Without this the session simply expires in the
 * background: the user comes back after lunch, taps Build, and gets "the token
 * is invalid or expired" — which reads like the app is broken, because from
 * where they are sitting it is.
 *
 * Supabase's React Native guidance is explicit about needing this. On web the
 * client already watches page visibility, so it would be redundant there.
 */
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") void supabase.auth.startAutoRefresh();
    else void supabase.auth.stopAutoRefresh();
  });
  // The app is already active when this module first loads.
  void supabase.auth.startAutoRefresh();
}
