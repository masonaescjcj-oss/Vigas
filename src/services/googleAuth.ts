/**
 * frontend/src/services/googleAuth.ts
 * ---------------------------------------------------------------------------
 * "Continue with Google", on web and on the phone.
 *
 * One Google OAuth client (type Web application) serves both, because both go
 * through Supabase's hosted flow: Google's page opens, Google hands the user
 * to https://<ref>.supabase.co/auth/v1/callback, and Supabase sends them on
 * to the redirect named here with the session in the URL. The setup, and the
 * allow-list those redirects must be on, is scripts/setup-google-auth.ts.
 *
 * Web leaves the page and comes back to /app, where usePasswordRecovery reads
 * the tokens like any other auth redirect. The phone opens Google in an
 * in-app browser session that returns the final URL here, so it is read here.
 * ---------------------------------------------------------------------------
 */

import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "./supabase";
import { parseAuthRedirect } from "./authRedirect";

/**
 * Where Google's page hands the phone app back: the app's own scheme (app.json
 * "scheme"). usePasswordRecovery leaves URLs on this path alone, because the
 * browser session below is already reading them.
 */
export const NATIVE_GOOGLE_REDIRECT = "issac://auth-callback";

export type GoogleSignInResult =
  /** Web: the page is on its way to Google and will come back signed in. */
  | { status: "redirecting" }
  | { status: "signed-in" }
  | { status: "cancelled" }
  | { status: "failed"; message: string };

export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  if (Platform.OS === "web") {
    const origin = (globalThis as { location?: { origin?: string } }).location?.origin ?? "";
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${origin}/app` },
    });
    return error ? { status: "failed", message: error.message } : { status: "redirecting" };
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: NATIVE_GOOGLE_REDIRECT, skipBrowserRedirect: true },
  });
  if (error || !data?.url) {
    return { status: "failed", message: error?.message ?? "Google sign-in could not start." };
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, NATIVE_GOOGLE_REDIRECT);
  if (result.type !== "success") return { status: "cancelled" };

  const redirect = parseAuthRedirect(result.url);
  if (!redirect) return { status: "failed", message: "Google did not send a sign-in back. Try again." };
  if (redirect.kind === "error") {
    // Backing out of Google's page arrives as access_denied: a choice, not a fault.
    return redirect.code === "access_denied" ? { status: "cancelled" } : { status: "failed", message: redirect.description };
  }

  const { error: sessionError } =
    redirect.kind === "session"
      ? await supabase.auth.setSession({ access_token: redirect.accessToken, refresh_token: redirect.refreshToken })
      : await supabase.auth.exchangeCodeForSession(redirect.code);
  return sessionError ? { status: "failed", message: sessionError.message } : { status: "signed-in" };
}
