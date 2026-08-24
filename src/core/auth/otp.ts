/**
 * frontend/src/core/auth/otp.ts
 * ---------------------------------------------------------------------------
 * The rules around a one-time code, away from React so they can be tested.
 *
 * The emails send a six digit code instead of a link. A link has to open a
 * browser, land on a page, and hand the session back to the app — three
 * context switches on a phone, and a chance to lose the person at each one. It
 * also broke outright while the project's site_url still pointed at localhost:
 * every confirmation email led somewhere that did not exist.
 *
 * A code is typed where the user already is, and it fails in ways they can see.
 * ---------------------------------------------------------------------------
 */

/** Matches mailer_otp_length on the project. */
export const OTP_LENGTH = 6;

/** How long the server will accept it, mirrored here only to say so. */
export const OTP_TTL_SECONDS = 3600;

/** Seconds before another code may be requested. */
export const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Keep only what a code can contain.
 *
 * Applied on every keystroke, so pasting "Your code is 123456" from an email
 * leaves 123456 rather than being rejected — the paste is the common case on a
 * phone, and rejecting it teaches people to retype what they just copied.
 */
export function normaliseOtp(input: string): string {
  return (input ?? "").replace(/\D+/g, "").slice(0, OTP_LENGTH);
}

export function isCompleteOtp(input: string): boolean {
  return normaliseOtp(input).length === OTP_LENGTH;
}

/**
 * Turn a Supabase auth error into something worth showing.
 *
 * The raw messages are written for developers: "Token has expired or is
 * invalid" is one string for two situations a user would act on differently.
 * Splitting them is the difference between "try again" and "get a new code".
 */
export function describeOtpError(message: unknown): string {
  const raw = String(message ?? "").toLowerCase();

  if (raw.includes("expired")) {
    return "That code has expired. Send a new one and try again.";
  }
  if (raw.includes("invalid") || raw.includes("token")) {
    return "That code is not right. Check the email and try again.";
  }
  if (raw.includes("rate") || raw.includes("too many") || raw.includes("limit")) {
    return "Too many attempts. Wait a minute before trying again.";
  }
  if (raw.includes("network") || raw.includes("fetch")) {
    return "Could not reach the server. Check your connection and try again.";
  }
  return "Could not verify that code. Please try again.";
}

/** mm:ss for the resend countdown. */
export function formatCooldown(seconds: number): string {
  const safe = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return minutes > 0 ? `${minutes}:${String(rest).padStart(2, "0")}` : `${rest}s`;
}

/**
 * Hide most of an address while leaving it recognisable.
 *
 * The screen has to say which inbox to look in, and it is reached from a link
 * that may be open on a shared screen. Enough to recognise, not enough to
 * copy down.
 */
export function maskEmail(email: string): string {
  const at = (email ?? "").indexOf("@");
  if (at < 1) return email ?? "";
  const name = email.slice(0, at);
  const domain = email.slice(at);
  if (name.length <= 2) return `${name[0]}***${domain}`;
  return `${name.slice(0, 2)}***${name.slice(-1)}${domain}`;
}
