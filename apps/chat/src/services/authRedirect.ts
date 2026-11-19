/**
 * frontend/src/services/authRedirect.ts
 * ---------------------------------------------------------------------------
 * Reading what Supabase puts in the URL when someone opens an emailed link.
 *
 * This existed nowhere, which meant password reset could not work at all: the
 * reset screen called `updateUser({ password })`, which needs a recovery session,
 * and nothing ever created one. `detectSessionInUrl` is false on the client, so
 * the tokens in the redirect were never consumed on web either. A user who forgot
 * their password stayed locked out permanently, and the error told them to open
 * the link again — which failed identically every time.
 *
 * Parsed here rather than left to the Supabase client so web and native take the
 * same path, and so the shapes below can be tested. There are three of them, and
 * the third is the one that matters most for a person: an expired link needs to
 * say so, not fail generically.
 * ---------------------------------------------------------------------------
 */

export type AuthRedirect =
  /** Implicit flow: the tokens are handed over directly, in the fragment. */
  | { kind: "session"; accessToken: string; refreshToken: string; type: string | null }
  /** PKCE flow: a code to exchange. */
  | { kind: "code"; code: string }
  /** The link was refused — almost always because it expired or was reused. */
  | { kind: "error"; code: string | null; description: string }
  | null;

/**
 * Both halves of a URL carry auth parameters depending on the flow, and the
 * fragment is not part of what a URL parser gives you as a query. So both are
 * read, with the fragment first: when Supabase uses the implicit flow it puts
 * everything there.
 */
function paramsFrom(url: string): URLSearchParams {
  const merged = new URLSearchParams();
  const hashAt = url.indexOf("#");
  const queryAt = url.indexOf("?");

  if (hashAt !== -1) {
    for (const [key, value] of new URLSearchParams(url.slice(hashAt + 1))) merged.set(key, value);
  }
  if (queryAt !== -1) {
    const end = hashAt !== -1 && hashAt > queryAt ? hashAt : undefined;
    for (const [key, value] of new URLSearchParams(url.slice(queryAt + 1, end))) {
      // Fragment wins: it is where the implicit flow puts the real tokens.
      if (!merged.has(key)) merged.set(key, value);
    }
  }
  return merged;
}

export function parseAuthRedirect(url: string | null | undefined): AuthRedirect {
  if (!url) return null;
  const params = paramsFrom(url);

  // Checked first. A link that also carries a stale token must still report the
  // refusal rather than trying to use it.
  const error = params.get("error") ?? params.get("error_code");
  if (error) {
    return {
      kind: "error",
      code: params.get("error_code") ?? params.get("error") ?? null,
      // `+` is a space in a query string, and this text is shown to a person.
      description: (params.get("error_description") ?? "That link is no longer valid.")
        .replace(/\+/g, " "),
    };
  }

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (accessToken && refreshToken) {
    return { kind: "session", accessToken, refreshToken, type: params.get("type") };
  }

  const code = params.get("code");
  if (code) return { kind: "code", code };

  return null;
}

/**
 * Turn a refusal into something worth reading.
 *
 * "otp_expired" is the common case by far — reset links are short-lived, and
 * people open their email later. Telling them to request a new one is the whole
 * of the useful advice.
 */
export function describeAuthError(redirect: { code: string | null; description: string }): string {
  if (redirect.code === "otp_expired" || /expired/i.test(redirect.description)) {
    return "That reset link has expired. Request a new one and open it soon after it arrives.";
  }
  if (redirect.code === "access_denied") {
    return "That reset link has already been used. Request a new one.";
  }
  return redirect.description;
}
