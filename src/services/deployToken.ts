/**
 * frontend/src/services/deployToken.ts
 * ---------------------------------------------------------------------------
 * Where a hosting provider's token is kept.
 *
 * On the device and nowhere else. Neither provider's token is ever sent to our
 * backend — both APIs answer browser origins, so the only party that sees a token is
 * the service that issued it. There is no row to encrypt and no dump that could
 * contain one.
 *
 * On a phone that means the OS keychain/keystore via expo-secure-store. On web there
 * is no equivalent, so it falls back to local storage, which any script on the origin
 * could read. That is a real difference, and `tokenStorageIsSecure()` exists so the
 * UI can say so rather than implying the same protection everywhere.
 * ---------------------------------------------------------------------------
 */

import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type DeployProvider = "netlify" | "vercel";

/** Namespaced per provider so connecting one never disturbs the other. */
function keyFor(provider: DeployProvider): string {
  return `retrocode.deploy.${provider}.token`;
}

/** False on web, where the browser offers no protected store. */
export function tokenStorageIsSecure(): boolean {
  return Platform.OS !== "web";
}

async function secureStore() {
  // Imported lazily: it is a native module, and on web it is never wanted.
  return await import("expo-secure-store");
}

export async function saveDeployToken(provider: DeployProvider, token: string): Promise<void> {
  const key = keyFor(provider);
  const value = token.trim();
  if (Platform.OS !== "web") {
    try {
      const SecureStore = await secureStore();
      await SecureStore.setItemAsync(key, value);
      return;
    } catch {
      // A device with no keystore available should still be able to deploy.
    }
  }
  await AsyncStorage.setItem(key, value);
}

export async function loadDeployToken(provider: DeployProvider): Promise<string | null> {
  const key = keyFor(provider);
  if (Platform.OS !== "web") {
    try {
      const SecureStore = await secureStore();
      const stored = await SecureStore.getItemAsync(key);
      if (stored) return stored;
    } catch {
      // Fall through to the plain store, which is where the fallback above wrote.
    }
  }
  return await AsyncStorage.getItem(key);
}

/** Both stores are cleared: the token may have been written to either. */
export async function forgetDeployToken(provider: DeployProvider): Promise<void> {
  const key = keyFor(provider);
  if (Platform.OS !== "web") {
    try {
      const SecureStore = await secureStore();
      await SecureStore.deleteItemAsync(key);
    } catch { /* nothing stored there */ }
  }
  await AsyncStorage.removeItem(key);
}

/* --------------------------------------------------------------------------
 * Netlify-named wrappers, kept because the Netlify path shipped first and its
 * storage key must not change — renaming it would silently disconnect everyone
 * who had already connected an account.
 * -------------------------------------------------------------------------- */

export const saveNetlifyToken = (token: string) => saveDeployToken("netlify", token);
export const loadNetlifyToken = () => loadDeployToken("netlify");
export const forgetNetlifyToken = () => forgetDeployToken("netlify");
