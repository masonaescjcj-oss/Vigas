/**
 * frontend/src/services/checkoutService.ts
 * ---------------------------------------------------------------------------
 * Sending someone to the browser to pay.
 *
 * The handoff carries a reference, not a session. The app is already
 * authenticated when it asks the backend for a checkout, so the URL it gets
 * back needs to identify a *payment*, not a *person* — nothing in it can be
 * used to reach the account.
 *
 * Opening it externally rather than in a WebView is deliberate. A payment page
 * inside an app is where users are taught not to type card details, the
 * provider's own anti-fraud treats an embedded browser worse, and on iOS an
 * in-app purchase flow in a WebView is the thing the store rules are actually
 * about.
 * ---------------------------------------------------------------------------
 */

import { Linking, Platform } from "react-native";
import { invokeFunction } from "./functionsClient";
import { notify } from "./notify";

export interface CheckoutStart {
  url: string;
  reference: string;
  planId: string;
  amountCents: number;
}

export async function createCheckout(planId: string): Promise<CheckoutStart> {
  return await invokeFunction<CheckoutStart>("checkout-create", { body: { planId } });
}

/**
 * Start a purchase: ask the backend for a URL, then hand it to the browser.
 *
 * Returns the reference so a caller can poll for the result. It deliberately
 * does not wait for anything — the user is gone into another app, and a crypto
 * payment can confirm minutes later or never.
 */
export async function startCheckout(planId: string): Promise<string | null> {
  let started: CheckoutStart;
  try {
    started = await createCheckout(planId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    notify("Could not start the payment", `${message}\n\nNothing was charged.`);
    return null;
  }

  try {
    if (Platform.OS === "web") {
      // A named target rather than _blank: a popup blocker is likelier to
      // allow a user-initiated navigation it can attribute to this click.
      // Cast because globalThis has no `open` in the React Native lib types,
      // even though this branch only runs on web where it does.
      (globalThis as { open?: (url: string, target?: string, features?: string) => unknown })
        .open?.(started.url, "_blank", "noopener,noreferrer");
      return started.reference;
    }
    const canOpen = await Linking.canOpenURL(started.url);
    if (!canOpen) throw new Error("No browser is available to open the payment page.");
    await Linking.openURL(started.url);
    return started.reference;
  } catch (error) {
    // The session exists and will expire on its own; the user simply never
    // reached the page. Give them the link rather than a dead end.
    notify(
      "Could not open the payment page",
      `${error instanceof Error ? error.message : String(error)}\n\nOpen this link in your browser:\n${started.url}`,
    );
    return started.reference;
  }
}
