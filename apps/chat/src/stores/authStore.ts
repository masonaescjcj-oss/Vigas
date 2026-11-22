/**
 * frontend/src/stores/authStore.ts
 * ---------------------------------------------------------------------------
 * Zustand store to manage user authentication state and profiles in React Native.
 * ---------------------------------------------------------------------------
 */

import { create } from "zustand";
import { type User, type Session } from "@supabase/supabase-js";
import { supabase } from "../services/supabase";
import { setAnalyticsUser, track } from "../services/analytics";

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
  /**
   * Whose profile has been fetched this session, whether or not a row came back.
   *
   * Needed because `profile` alone cannot tell "not looked up yet" from "looked
   * up, no row" — and conflating them made every auth event refetch forever for
   * any account without a row.
   */
  profileLoadedFor: string | null;
  initialized: boolean;
  /**
   * True while the user is here from a password-reset link.
   *
   * A recovery link produces a real session, which would otherwise drop them
   * straight into the app — past the screen where they were supposed to choose a
   * new password. This keeps the auth stack in front until they have.
   */
  passwordRecovery: boolean;
  /** Why a recovery link was refused, if it was. Shown on the reset screen. */
  recoveryError: string | null;
  setPasswordRecovery: (active: boolean, error?: string | null) => void;
  setSession: (session: Session | null) => Promise<void>;
  loadProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  /** A token that is valid now, refreshing first if the stored one has expired. */
  getAccessToken: () => Promise<string | undefined>;
  /** Force a refresh. True when a new token was obtained. */
  refreshAccessToken: () => Promise<boolean>;
}

let lastMirroredToken: string | null = null;

function isSameOriginChatWeb(): boolean {
  const loc = (globalThis as { location?: { pathname?: string } }).location;
  return typeof fetch === "function" && Boolean(loc?.pathname?.startsWith("/chat"));
}

function syncWebSignedInCookie(signedIn: boolean): void {
  const doc = (globalThis as { document?: { cookie?: string } }).document;
  const loc = (globalThis as { location?: { protocol?: string } }).location;
  if (!doc || typeof doc.cookie !== "string") return;
  const secure = loc?.protocol === "https:" ? "; Secure" : "";
  doc.cookie = signedIn
    ? `vigas_signed_in=1; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax${secure}`
    : `vigas_signed_in=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  profileLoadedFor: null,
  initialized: false,
  passwordRecovery: false,
  recoveryError: null,

  setPasswordRecovery: (active, error = null) =>
    set({ passwordRecovery: active, recoveryError: error }),

  setSession: async (session) => {
    const user = session?.user ?? null;
    const previous = get();
    set({ session, user, initialized: true });

    if (!user) {
      lastMirroredToken = null;
      if (isSameOriginChatWeb()) syncWebSignedInCookie(false);
      setAnalyticsUser(null);
      set({ profile: null, profileLoadedFor: null });
      return;
    }
    setAnalyticsUser(user.id);
    if (isSameOriginChatWeb()) {
      syncWebSignedInCookie(true);
    }
    if (session?.access_token && isSameOriginChatWeb() && lastMirroredToken !== session.access_token) {
      lastMirroredToken = session.access_token;
      void fetch("/api/auth/exchange", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ accessToken: session.access_token }),
      }).catch(() => {
        if (lastMirroredToken === session.access_token) lastMirroredToken = null;
      });
    }
    // Only on a genuine change of user, not on every token refresh — the same
    // guard the profile fetch uses, for the same reason.
    if (previous.user?.id !== user.id) track("signed_in");

    // Only when it could have changed. supabase-js emits an auth event on every
    // token refresh and, on web, on every tab focus — and this used to refetch the
    // whole profile row each time. Measured in the running app: a full
    // `profiles?select=*` every six seconds alongside nothing else happening.
    //
    // Keyed on who was *looked up*, not on the row that came back: an account
    // whose profile row is missing has no profile.id to compare, so keying on
    // that refetched on every auth event forever — the very polling this guard
    // exists to stop.
    if (previous.profileLoadedFor === user.id) return;

    await get().loadProfile();
  },

  loadProfile: async () => {
    const user = get().user;
    if (!user) return;

    try {
      // maybeSingle, not single: no row is a real state, not a failure. The
      // handle_new_user trigger creates the profile, so there is a window right
      // after signup where the session exists and the row does not — and
      // single() turned that into a thrown PGRST116 that logged as if the app
      // had broken, four times per sign-in, drowning out actual errors.
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;
      // Left null when there is no row. The screens fall back to the session's
      // own email, so the account still reads correctly while the row catches up.
      set({ profile: (data as UserProfile | null) ?? null, profileLoadedFor: user.id });
    } catch (e) {
      // Deliberately *not* marked as attempted. "No row" above is a definitive
      // answer worth remembering; a thrown error is not — it may be a dropped
      // connection, and remembering it would leave the account without its
      // profile for the rest of the session. This retries on the next auth event.
      console.error("Failed to load user profile:", e);
    }
  },

  signOut: async () => {
    lastMirroredToken = null;
    await supabase.auth.signOut();
    if (isSameOriginChatWeb()) {
      syncWebSignedInCookie(false);
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => undefined);
    }
    // Recovery is cleared too: leaving it set would pin the app to the reset
    // screen after the very sign-out that ends the flow.
    set({ user: null, session: null, profile: null, passwordRecovery: false, recoveryError: null });
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
