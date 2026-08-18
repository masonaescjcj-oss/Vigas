/**
 * frontend/src/services/deployToken.ts
 * ---------------------------------------------------------------------------
 * Where the user's Netlify token is kept.
 *
 * It is kept on the device and nowhere else. It is never sent to our backend, so
 * there is no row to encrypt and no dump that could contain it — the only party
 * that ever sees it is Netlify, which issued it.
 *
 * On a phone that means the OS keychain/keystore via expo-secure-store. On web
 * there is no equivalent, so it falls back to local storage, which any script on
 * the origin could read. That is a real difference and `tokenStorageIsSecure()`
 * exists so the UI can say so rather than implying the same protection everywhere.
 * ---------------------------------------------------------------------------
 */

import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "retrocode.deploy.netlify.token";

/** False on web, where the browser offers no protected store. */
export function tokenStorageIsSecure(): boolean {
  return Platform.OS !== "web";
}

async function secureStore() {
  // Imported lazily: it is a native module, and on web it is never wanted.
  return await import("expo-secure-store");
}

export async function saveNetlifyToken(token: string): Promise<void> {
  const value = token.trim();
  if (Platform.OS !== "web") {
    try {
      const SecureStore = await secureStore();
      await SecureStore.setItemAsync(KEY, value);
      return;
    } catch {
      // A device with no keystore available should still be able to deploy.
    }
  }
  await AsyncStorage.setItem(KEY, value);
}

export async function loadNetlifyToken(): Promise<string | null> {
  if (Platform.OS !== "web") {
    try {
      const SecureStore = await secureStore();
      const stored = await SecureStore.getItemAsync(KEY);
      if (stored) return stored;
    } catch {
      // Fall through to the plain store, which is where the fallback above wrote.
    }
  }
  return await AsyncStorage.getItem(KEY);
}

/** Both stores are cleared: the token may have been written to either. */
export async function forgetNetlifyToken(): Promise<void> {
  if (Platform.OS !== "web") {
    try {
      const SecureStore = await secureStore();
      await SecureStore.deleteItemAsync(KEY);
    } catch { /* nothing stored there */ }
  }
  await AsyncStorage.removeItem(KEY);
}
