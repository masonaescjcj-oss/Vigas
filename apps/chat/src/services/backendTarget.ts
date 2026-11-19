/**
 * frontend/src/services/backendTarget.ts
 * ---------------------------------------------------------------------------
 * Storing the user's own Supabase project on the device.
 *
 * Without a backend the agent can build a form but nowhere for the form to send to,
 * which is where "an app" stops and "a page" begins.
 *
 * Kept on the device, never on our servers. The anon key is designed to be public —
 * it ships inside the deployed page either way — so there is nothing here that
 * encryption would protect. What the anon key is *not* is access control, and
 * core/agent/backendContext.ts is loud about that where the model can read it.
 *
 * The values reach the model only when the Supabase skill is on, so a user who never
 * asks for a backend pays no tokens and their project URL never enters a stored
 * transcript.
 *
 * The validators and the prompt text live in core/agent/backendContext.ts, which the
 * edge functions import. This file must stay the only half that touches storage.
 * ---------------------------------------------------------------------------
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { BackendTarget } from "../core/agent/backendContext";

export type { BackendTarget };
export {
  backendContextFor,
  classifySupabaseKey,
  isSupabaseUrl,
} from "../core/agent/backendContext";

const URL_KEY = "retrocode.backend.supabase.url";
const ANON_KEY = "retrocode.backend.supabase.anon";

export async function saveBackendTarget(target: BackendTarget): Promise<void> {
  // Written separately rather than with multiSet, whose typing is not carried
  // through this package's published declarations.
  await AsyncStorage.setItem(URL_KEY, target.url.trim().replace(/\/+$/, ""));
  await AsyncStorage.setItem(ANON_KEY, target.anonKey.trim());
}

export async function loadBackendTarget(): Promise<BackendTarget | null> {
  const url = await AsyncStorage.getItem(URL_KEY);
  const anonKey = await AsyncStorage.getItem(ANON_KEY);
  // Half a target is no target: the agent can do nothing with a URL alone.
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export async function forgetBackendTarget(): Promise<void> {
  await AsyncStorage.removeItem(URL_KEY);
  await AsyncStorage.removeItem(ANON_KEY);
}
