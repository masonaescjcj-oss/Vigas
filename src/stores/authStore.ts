/**
 * frontend/src/stores/authStore.ts
 * ---------------------------------------------------------------------------
 * Zustand store to manage user authentication state and profiles in React Native.
 * ---------------------------------------------------------------------------
 */

import { create } from "zustand";
import { type User, type Session } from "@supabase/supabase-js";
import { supabase } from "../services/supabase";

export interface UserProfile {
  id: string;
  email: string;
  display_name?: string;
  avatar_url?: string;
  subscription_tier: "free" | "pro" | "ultra" | "team";
  /** Opens the admin panel. Set by hand in SQL; the app can only read it. */
  is_admin?: boolean;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  initialized: boolean;
  setSession: (session: Session | null) => Promise<void>;
  loadProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  initialized: false,

  setSession: async (session) => {
    const user = session?.user ?? null;
    set({ session, user, initialized: true });
    if (user) {
      await get().loadProfile();
    } else {
      set({ profile: null });
    }
  },

  loadProfile: async () => {
    const user = get().user;
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      set({ profile: data as UserProfile });
    } catch (e) {
      console.error("Failed to load user profile:", e);
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null, profile: null });
  },
}));
