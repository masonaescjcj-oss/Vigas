/**
 * frontend/src/hooks/usePasswordRecovery.ts
 * ---------------------------------------------------------------------------
 * Turning an emailed reset link into a session the reset screen can use.
 *
 * Without this the whole flow was dead: the reset screen called
 * `updateUser({ password })`, which needs a session, and nothing created one.
 * `detectSessionInUrl` is false on the client, so even on web the tokens in the
 * redirect were dropped on the floor.
 *
 * Two signals are used, because neither is sufficient alone. The URL is what
 * actually carries the tokens, so it has to be parsed. The `PASSWORD_RECOVERY`
 * event is what fires when the Supabase client establishes the session by some
 * other route, and it is the more reliable marker of intent.
 * ---------------------------------------------------------------------------
 */

import { useEffect } from "react";
import { Linking, Platform } from "react-native";
import { supabase } from "../services/supabase";
import { useAuthStore } from "../stores/authStore";
import { describeAuthError, parseAuthRedirect } from "../services/authRedirect";

/**
 * Our own redirect target. A bare code carries no type, so the path is the only
 * hint that an exchange belongs to a password reset rather than a magic link.
 */
const RECOVERY_PATH = /reset-password/i;

export function usePasswordRecovery(): void {
  useEffect(() => {
    let cancelled = false;
    const setRecovery = useAuthStore.getState().setPasswordRecovery;

    const consume = async (url: string | null) => {
      const redirect = parseAuthRedirect(url);
      if (!redirect || cancelled) return;

      if (redirect.kind === "error") {
        // Flagged as recovery on purpose: the user came from a reset link and
        // needs to be told why it did not work, not silently left on Login.
        setRecovery(true, describeAuthError(redirect));
        return;
      }

      if (redirect.kind === "session") {
        // Set before establishing the session. `setSession` fires
        // onAuthStateChange, which flips `user` — and if the flag were not
        // already up, the navigator would swap to the main app in that same
        // render and unmount the screen we are trying to reach.
        if (redirect.type === "recovery" || RECOVERY_PATH.test(url ?? "")) setRecovery(true);
        const { error } = await supabase.auth.setSession({
          access_token: redirect.accessToken,
          refresh_token: redirect.refreshToken,
        });
        if (error && !cancelled) setRecovery(true, error.message);
        return;
      }

      // PKCE. Only treated as a reset when it arrived at the reset path.
      if (!RECOVERY_PATH.test(url ?? "")) return;
      setRecovery(true);
      const { error } = await supabase.auth.exchangeCodeForSession(redirect.code);
      if (error && !cancelled) setRecovery(true, error.message);
    };

    // Typed here because React Native's lib has no DOM, so globalThis carries
    // neither `location` nor `addEventListener`.
    const web = globalThis as unknown as {
      location?: { href?: string };
      addEventListener?: (type: string, listener: () => void) => void;
      removeEventListener?: (type: string, listener: () => void) => void;
    };

    // A cold start from a tapped link: the URL is waiting rather than delivered.
    if (Platform.OS === "web") {
      void consume(web.location?.href ?? null);
    } else {
      void Linking.getInitialURL().then((url) => consume(url));
    }

    const linkSub = Linking.addEventListener("url", ({ url }) => { void consume(url); });

    // On web the tokens arrive in the fragment, and a fragment change does not
    // reload the page — so a link opened while the app is already running would
    // otherwise never be read. Found by testing it: navigating to the link left
    // the previous attempt's state on screen.
    const onUrlChange = () => { void consume(web.location?.href ?? null); };
    if (Platform.OS === "web" && web.addEventListener) {
      web.addEventListener("hashchange", onUrlChange);
      web.addEventListener("popstate", onUrlChange);
    }

    const { data: authSub } = supabase.auth.onAuthStateChange((event) => {
      if (cancelled) return;
      // Fires when the client establishes a recovery session itself. Harmless if
      // the URL parse already set the flag.
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });

    return () => {
      cancelled = true;
      linkSub.remove();
      authSub.subscription.unsubscribe();
      if (Platform.OS === "web" && web.removeEventListener) {
        web.removeEventListener("hashchange", onUrlChange);
        web.removeEventListener("popstate", onUrlChange);
      }
    };
  }, []);
}
