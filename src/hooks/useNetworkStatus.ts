/**
 * frontend/src/hooks/useNetworkStatus.ts
 * ---------------------------------------------------------------------------
 * Whether the app can reach its own backend.
 *
 * See services/connectivity.ts for why this no longer pings google.com. The
 * behaviour here is the other half of that fix: browser events instead of a
 * timer where they exist, a slow timer where they do not, and a fast one only
 * while actually offline.
 * ---------------------------------------------------------------------------
 */

import { useEffect, useRef, useState } from "react";
import { AppState, Platform, type AppStateStatus } from "react-native";
import {
  countFailure,
  isOffline,
  nextProbeDelay,
  probeOnce,
  probeTarget,
} from "../services/connectivity";

export const useNetworkStatus = () => {
  // Starts optimistic. A red banner on the first frame, before anything has been
  // measured, would be a guess presented as a fact.
  const [isConnected, setIsConnected] = useState(true);
  const failures = useRef(0);

  useEffect(() => {
    const target = probeTarget(process.env.EXPO_PUBLIC_SUPABASE_URL);
    // Without a configured backend there is nothing meaningful to probe, and a
    // permanent banner would be the same false alarm in a new costume.
    if (!target) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = (delay: number) => {
      if (cancelled) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(run, delay);
    };

    const run = async () => {
      if (cancelled) return;
      const reachable = await probeOnce(target);
      if (cancelled) return;

      failures.current = countFailure(failures.current, reachable);
      setIsConnected(!isOffline(failures.current));

      // Any pending failure gets chased to a conclusion, on every platform. The
      // first version skipped this on web whenever the app still *believed* it
      // was online, which meant a single failed probe left it stuck believing
      // that forever — no timer, no event, no second opinion.
      const delay = nextProbeDelay(failures.current, Platform.OS === "web");
      if (delay !== null) schedule(delay);
    };

    void run();

    // Coming back to the app is the moment a user most wants the truth.
    const appState = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next === "active") void run();
    });

    // The browser knows about the network interface for free. It is not
    // authoritative — "online" only means a link exists, not that anything is
    // reachable through it — so it triggers a probe rather than setting state.
    const events = globalThis as {
      addEventListener?: (type: string, listener: () => void) => void;
      removeEventListener?: (type: string, listener: () => void) => void;
    };
    const onNetworkEvent = () => { void run(); };
    if (Platform.OS === "web" && events.addEventListener) {
      events.addEventListener("online", onNetworkEvent);
      events.addEventListener("offline", onNetworkEvent);
    }

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      appState.remove();
      if (Platform.OS === "web" && events.removeEventListener) {
        events.removeEventListener("online", onNetworkEvent);
        events.removeEventListener("offline", onNetworkEvent);
      }
    };
  }, []);

  return { isConnected };
};
