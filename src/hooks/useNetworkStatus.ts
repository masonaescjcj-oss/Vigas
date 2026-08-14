/**
 * frontend/src/hooks/useNetworkStatus.ts
 * ---------------------------------------------------------------------------
 * Hook to listen to internet connection availability changes.
 * ---------------------------------------------------------------------------
 */

import { useState, useEffect } from "react";
import { AppState, type AppStateStatus } from "react-native";

export const useNetworkStatus = () => {
  const [isConnected, setIsConnected] = useState<boolean>(true);

  // Monitor connectivity updates
  useEffect(() => {
    // Check initial connectivity using a quick ping
    const checkConnection = async () => {
      try {
        const response = await fetch("https://www.google.com", { method: "HEAD", mode: "no-cors" });
        setIsConnected(true);
      } catch (e) {
        setIsConnected(false);
      }
    };

    void checkConnection();

    // Recheck when AppState changes back to active
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === "active") {
        void checkConnection();
      }
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);

    // Set up a periodic check interval every 15 seconds
    const interval = setInterval(checkConnection, 15000);

    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, []);

  return { isConnected };
};
