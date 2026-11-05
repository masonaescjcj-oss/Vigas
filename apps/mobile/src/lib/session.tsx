import type { PublicUser } from '@vigas/core';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';

import { api, isUnauthorized, withTimeout } from './api';
import { invalidate } from './remote';
import { getToken, setToken } from './token';

export interface Session {
  /** False until the stored token has been read from SecureStore. */
  ready: boolean;
  token: string | null;
  user: PublicUser | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
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

  const signIn = async (email: string, password: string) => {
    const res = await withTimeout(api.login({ email, password }), 15000);
    await setToken(res.token);
    clearPrivate();
    setUser(res.user);
    setTokenState(res.token);
  };

  const signUp = async (email: string, password: string, name?: string) => {
    const res = await withTimeout(api.signup({ email, password, name: name || undefined }), 15000);
    await setToken(res.token);
    clearPrivate();
    setUser(res.user);
    setTokenState(res.token);
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
    <SessionContext value={{ ready, token, user, signIn, signUp, signOut, expire }}>{children}</SessionContext>
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
