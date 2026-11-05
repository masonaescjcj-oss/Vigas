import type { WalletResponse } from '@vigas/core';
import { useEffect } from 'react';

import { api, isUnauthorized } from './api';
import { useRemote } from './remote';
import { useSession } from './session';

export const WALLET_KEY = 'wallet';

/** The signed-in user's wallet. Disabled (no request) when signed out; a 401 ends the session. */
export function useWallet() {
  const session = useSession();
  const wallet = useRemote<WalletResponse>(session.token ? WALLET_KEY : null, () => api.wallet());
  const { expire } = session;
  useEffect(() => {
    if (isUnauthorized(wallet.cause)) expire();
  }, [wallet.cause, expire]);
  return wallet;
}
