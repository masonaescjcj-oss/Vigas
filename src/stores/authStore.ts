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
  /** A token that is valid now, refreshing first if the stored one has expired. */
  getAccessToken: () => Promise<string | undefined>;
  /** Force a refresh. True when a new token was obtained. */
  refreshAccessToken: () => Promise<boolean>;
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

  /**
   * Session handling lives here rather than in functionsClient because this is
   * already the module that owns the Supabase client. Keeping it that way means
   * the network layer stays free of auth plumbing — and testable without
   * standing up React Native's whole module graph.
   *
   * `getSession()` refreshes an expired session before returning it, which the
   * stored snapshot cannot do: after the app has been backgrounded past expiry,
   * `session` here is simply out of date.
   */
  getAccessToken: async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) {
        // Keep the store in step, so anything reading `session` directly sees
        // the refreshed token too.
        if (data.session.access_token !== get().session?.access_token) {
          set({ session: data.session, user: data.session.user });
        }
        return data.session.access_token;
      }
    } catch {
      /* fall through to the last known token */
    }
    return get().session?.access_token;
  },

  refreshAccessToken: async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error || !data.session?.access_token) return false;
      set({ session: data.session, user: data.session.user });
      return true;
    } catch {
      return false;
    }
  },
}));
