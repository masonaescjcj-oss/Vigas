import * as SecureStore from 'expo-secure-store';

const KEY = 'vigas.session.token';

/** In-memory copy so every API call doesn't hit the keystore. `undefined` = not read yet. */
let cached: string | null | undefined;

export async function getToken(): Promise<string | null> {
  if (cached === undefined) {
    try {
      cached = await SecureStore.getItemAsync(KEY);
    } catch {
      cached = null;
    }
  }
  return cached;
}

export async function setToken(token: string | null): Promise<void> {
  cached = token;
  try {
    if (token) await SecureStore.setItemAsync(KEY, token);
    else await SecureStore.deleteItemAsync(KEY);
  } catch {
    // Keystore unavailable: the session still works for this launch.
  }
}
