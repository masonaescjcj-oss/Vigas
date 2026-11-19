import type { PublicUser } from '@vigas/core';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';

import { api, apiConfigured, isUnauthorized, SUPABASE_ANON_KEY, SUPABASE_URL, withTimeout } from './api';
import { invalidate } from './remote';
import { getToken, setToken } from './token';

export class EmailVerificationRequiredError extends Error {
  constructor(
    readonly email: string,
    message = 'Enter the 6-digit verification code sent to your email.',
  ) {
    super(message);
    this.name = 'EmailVerificationRequiredError';
  }
}

interface SupabaseAuthPayload {
  access_token?: string;
  msg?: string;
  error_description?: string;
  message?: string;
  user?: { id?: string; email?: string };
}

async function supabaseAuthRequest(path: string, body: Record<string, unknown>): Promise<Response> {
  return withTimeout(
    fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    }),
    15_000,
  );
}

export interface Session {
  /** False until the stored token has been read from SecureStore. */
  ready: boolean;
  token: string | null;
  user: PublicUser | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  verifyEmailOtp: (email: string, code: string) => Promise<void>;
  resendSignUpOtp: (email: string) => Promise<void>;
  exchangeAccessToken: (accessToken: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  resetPasswordWithOtp: (email: string, code: string, newPassword: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Clears a token the server rejected (401). */
  expire: () => void;
}

const SessionContext = createContext<Session | null>(null);

/** Keys of cached data that belong to the signed-in user. */
const PRIVATE_PREFIXES = ['wallet'];

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<PublicUser | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const stored = await getToken();
      if (!alive) return;
      setTokenState(stored);
      setReady(true);
      if (!stored) return;
      try {
        const me = await withTimeout(api.me());
        if (alive) setUser(me.user);
      } catch (e) {
        if (alive && isUnauthorized(e)) {
          await setToken(null);
          setTokenState(null);
        }
        // Offline: keep the token and try again on the next launch.
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const clearPrivate = () => PRIVATE_PREFIXES.forEach(invalidate);

  const commitAuth = async (res: { token: string; user: PublicUser }) => {
    await setToken(res.token);
    clearPrivate();
    setUser(res.user);
    setTokenState(res.token);
  };

  const signIn = async (email: string, password: string) => {
    const cleanEmail = email.trim().toLowerCase();
    let supaErrMsg: string | null = null;

    if (apiConfigured && SUPABASE_URL && SUPABASE_ANON_KEY) {
      try {
        const supaRes = await supabaseAuthRequest('token?grant_type=password', {
          email: cleanEmail,
          password,
        });
        const payload = (await supaRes.json().catch(() => null)) as SupabaseAuthPayload | null;
        if (supaRes.ok && payload?.access_token) {
          const exchanged = await withTimeout(api.exchange(payload.access_token), 15_000);
          await commitAuth(exchanged);
          return;
        }
        const msg = payload?.error_description || payload?.msg || payload?.message || '';
        if (msg.toLowerCase().includes('email not confirmed')) {
          await supabaseAuthRequest('resend', { type: 'signup', email: cleanEmail }).catch(() => undefined);
          throw new EmailVerificationRequiredError(cleanEmail, 'Confirm your email with the 6-digit code we just sent.');
        }
        supaErrMsg = msg || null;
      } catch (e) {
        if (e instanceof EmailVerificationRequiredError) throw e;
        // Fall through to legacy Vigas password login fallback below.
      }
    }

    try {
      const res = await withTimeout(api.login({ email: cleanEmail, password }), 15_000);
      await commitAuth(res);
    } catch (e) {
      if (supaErrMsg && !apiConfigured) throw new Error(supaErrMsg);
      throw e;
    }
  };

  const signUp = async (email: string, password: string, name?: string) => {
    const cleanEmail = email.trim().toLowerCase();
    if (apiConfigured && SUPABASE_URL && SUPABASE_ANON_KEY) {
      const supaRes = await supabaseAuthRequest('signup', {
        email: cleanEmail,
        password,
        ...(name?.trim() ? { data: { full_name: name.trim(), name: name.trim() } } : {}),
      });
      const payload = (await supaRes.json().catch(() => null)) as SupabaseAuthPayload | null;
      if (supaRes.ok && payload?.access_token) {
        const exchanged = await withTimeout(api.exchange(payload.access_token), 15_000);
        await commitAuth(exchanged);
        return;
      }
      if (supaRes.ok && payload?.user) {
        throw new EmailVerificationRequiredError(cleanEmail);
      }
      const msg = payload?.error_description || payload?.msg || payload?.message;
      if (supaRes.status >= 400 && supaRes.status < 500 && msg) {
        throw new Error(msg);
      }
    }

    const res = await withTimeout(api.signup({ email: cleanEmail, password, name: name?.trim() || undefined }), 15_000);
    await commitAuth(res);
  };

  const verifyEmailOtp = async (email: string, code: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const res = await supabaseAuthRequest('verify', {
      email: cleanEmail,
      token: code.replace(/\s+/g, ''),
      type: 'signup',
    });
    const payload = (await res.json().catch(() => null)) as SupabaseAuthPayload | null;
    if (!res.ok || !payload?.access_token) {
      throw new Error(payload?.error_description || payload?.msg || payload?.message || 'Invalid or expired code.');
    }
    const exchanged = await withTimeout(api.exchange(payload.access_token), 15_000);
    await commitAuth(exchanged);
  };

  const resendSignUpOtp = async (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const res = await supabaseAuthRequest('resend', { type: 'signup', email: cleanEmail });
    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as SupabaseAuthPayload | null;
      throw new Error(payload?.error_description || payload?.msg || payload?.message || 'Could not resend verification code.');
    }
  };

  const exchangeAccessToken = async (accessToken: string) => {
    const exchanged = await withTimeout(api.exchange(accessToken), 15_000);
    await commitAuth(exchanged);
  };

  const requestPasswordReset = async (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const res = await supabaseAuthRequest('recover', { email: cleanEmail });
    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as SupabaseAuthPayload | null;
      throw new Error(payload?.error_description || payload?.msg || payload?.message || 'Could not send reset code.');
    }
  };

  const resetPasswordWithOtp = async (email: string, code: string, newPassword: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const verifyRes = await supabaseAuthRequest('verify', {
      email: cleanEmail,
      token: code.replace(/\s+/g, ''),
      type: 'recovery',
    });
    const verifyPayload = (await verifyRes.json().catch(() => null)) as SupabaseAuthPayload | null;
    if (!verifyRes.ok || !verifyPayload?.access_token) {
      throw new Error(
        verifyPayload?.error_description || verifyPayload?.msg || verifyPayload?.message || 'Invalid or expired recovery code.',
      );
    }

    const updateRes = await withTimeout(
      fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: 'PUT',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${verifyPayload.access_token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ password: newPassword }),
      }),
      15_000,
    );
    if (!updateRes.ok) {
      const errPayload = (await updateRes.json().catch(() => null)) as SupabaseAuthPayload | null;
      throw new Error(errPayload?.error_description || errPayload?.msg || errPayload?.message || 'Could not update password.');
    }

    const exchanged = await withTimeout(api.exchange(verifyPayload.access_token), 15_000);
    await commitAuth(exchanged);
  };

  const signOut = async () => {
    try {
      await withTimeout(api.logout(), 4000);
    } catch {
      // The local token is discarded either way.
    }
    await setToken(null);
    clearPrivate();
    setUser(null);
    setTokenState(null);
  };

  const expire = () => {
    void setToken(null);
    clearPrivate();
    setUser(null);
    setTokenState(null);
  };

  return (
    <SessionContext
      value={{
        ready,
        token,
        user,
        signIn,
        signUp,
        verifyEmailOtp,
        resendSignUpOtp,
        exchangeAccessToken,
        requestPasswordReset,
        resetPasswordWithOtp,
        signOut,
        expire,
      }}
    >
      {children}
    </SessionContext>
  );
}

export function useSession(): Session {
  const s = use(SessionContext);
  if (!s) throw new Error('useSession must be used inside <SessionProvider>');
  return s;
}

/** Two-letter avatar text for the signed-in user. */
export function userInitials(user: PublicUser | null): string {
  const source = user?.name?.trim() || user?.email?.split('@')[0] || '';
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? `${parts[0]![0]}${parts[1]![0]}` : source.slice(0, 2);
  return letters.toUpperCase() || 'V';
}
