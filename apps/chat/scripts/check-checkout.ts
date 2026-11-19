/**
 * scripts/check-checkout.ts
 * ---------------------------------------------------------------------------
 * Does a paid plan actually arrive, and can anyone get one without paying?
 *
 * The webhook is public — the payment provider is not an Auth user — so this
 * endpoint is the only thing between a stranger's POST and a free
 * subscription. It is worth driving against a real backend rather than trusting
 * unit tests, because the pieces that fail in production are the ones that only
 * exist there: the row lookup, the tier write, the second delivery of the same
 * event.
 *
 * No provider account is needed. The webhook half only requires the shared IPN
 * secret, so this signs its own payloads and exercises the whole path.
 *
 *   PROVIDER_API_URL=http://localhost:54321/functions/v1 \
 *     npx deno run --allow-all --env-file=.env scripts/check-checkout.ts
 * ---------------------------------------------------------------------------
 */
import { createClient } from "@supabase/supabase-js";
import { sortKeysDeep } from "../supabase/functions/shared/cryptoProvider.ts";
import { generateReference } from "../supabase/functions/shared/checkout.ts";

const SUPABASE_URL = Deno.env.get("EXPO_PUBLIC_SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const API_URL = Deno.env.get("PROVIDER_API_URL") ?? `${SUPABASE_URL}/functions/v1`;
const IPN_SECRET = Deno.env.get("NOWPAYMENTS_IPN_SECRET");

if (!IPN_SECRET) {
  console.error("NOWPAYMENTS_IPN_SECRET must be set — it is what this signs with.");
  Deno.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
const stamp = crypto.randomUUID().slice(0, 8);
const cleanup: Array<() => Promise<unknown>> = [];

function check(label: string, ok: boolean, detail?: unknown) {
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label}` +
      (ok ? "" : `\n      ${String(typeof detail === "string" ? detail : JSON.stringify(detail)).slice(0, 400)}`),
  );
  if (!ok) Deno.exitCode = 1;
}

/** Sign a payload the way NOWPayments does: HMAC-SHA512 over the sorted form. */
async function sign(payload: Record<string, unknown>, secret = IPN_SECRET!): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC", key, new TextEncoder().encode(JSON.stringify(sortKeysDeep(payload))),
  );
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const post = (body: unknown, signature?: string) =>
  fetch(`${API_URL}/crypto-webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(signature ? { "x-nowpayments-sig": signature } : {}),
    },
    body: JSON.stringify(body),
  });

try {
  // ── An account to buy for.
  const email = `checkout-${stamp}@example.com`;
  const { data: created, error } = await admin.auth.admin.createUser({
    email, password: `Co-${crypto.randomUUID()}`, email_confirm: true,
  });
  if (error) throw error;
  const userId = created.user!.id;
  cleanup.push(() => admin.auth.admin.deleteUser(userId));

  // From the real generator. Hand-rolling one produced a 21-character string
  // containing hex digits the alphabet deliberately excludes, and isReference
  // rejected it — correctly, but it looked like a broken webhook.
  const reference = generateReference();
  await admin.from("checkout_sessions").insert({
    reference, user_id: userId, plan_id: "pro_yearly", amount_cents: 9600, provider: "nowpayments",
  });
  cleanup.push(async () => { await admin.from("checkout_sessions").delete().eq("reference", reference); });
  cleanup.push(async () => { await admin.from("subscriptions").delete().eq("user_id", userId); });

  const paid = {
    payment_id: 900000 + Math.floor(Math.random() * 99999),
    payment_status: "finished",
    order_id: reference,
    order_description: "pro_yearly",
    price_amount: 96,
    price_currency: "usd",
  };

  const tierOf = async () => {
    const { data } = await admin.from("profiles").select("subscription_tier").eq("id", userId).maybeSingle();
    return String(data?.subscription_tier ?? "?");
  };

  check(`the account starts free (${await tierOf()})`, (await tierOf()) === "free");

  // ── Everything that must NOT grant a plan.
  const unsigned = await post(paid);
  check(`an unsigned webhook is refused (${unsigned.status})`, unsigned.status === 401);

  const wrongSecret = await post(paid, await sign(paid, "not-the-secret"));
  check(`a webhook signed with the wrong secret is refused (${wrongSecret.status})`, wrongSecret.status === 401);

  // A valid signature over a cheap payment, replayed onto an expensive one.
  const cheapSig = await sign({ ...paid, price_amount: 1 });
  const swapped = await post(paid, cheapSig);
  check(`a signature lifted from another payload is refused (${swapped.status})`, swapped.status === 401);

  const unknownRef = { ...paid, order_id: "zzzzzzzzzzzzzzzzzzzzzz" };
  const unknown = await post(unknownRef, await sign(unknownRef));
  check(`a signed event for an unknown reference is refused (${unknown.status})`, unknown.status === 404);

  check(`none of that granted anything (${await tierOf()})`, (await tierOf()) === "free");

  // ── Underpayment: correctly signed, genuinely paid, but not enough.
  const short = { ...paid, price_amount: 5 };
  const shortRes = await post(short, await sign(short));
  const shortBody = await shortRes.json().catch(() => ({}));
  check(
    `a real but short payment is recorded, not granted (${shortRes.status} granted=${shortBody?.granted})`,
    shortRes.ok && shortBody?.granted === false,
    shortBody,
  );
  check(`still free after underpaying (${await tierOf()})`, (await tierOf()) === "free");

  // Reset the row: the short payment marked it failed, and a real provider
  // would be sending these against a still-pending invoice.
  await admin.from("checkout_sessions")
    .update({ status: "pending", last_event_id: null }).eq("reference", reference);

  // ── The payment that should work.
  const good = await post(paid, await sign(paid));
  const goodBody = await good.json().catch(() => ({}));
  check(`a correctly signed full payment is granted (${good.status})`, good.ok && goodBody?.granted === true, goodBody);
  check(`the account is now pro (${await tierOf()})`, (await tierOf()) === "pro");

  const { data: sub } = await admin
    .from("subscriptions").select("status,plan_id,current_period_end").eq("user_id", userId).maybeSingle();
  check(`a subscription row exists and is active (${sub?.status})`, sub?.status === "active", sub);
  const endsIn = sub?.current_period_end
    ? Math.round((new Date(sub.current_period_end).getTime() - Date.now()) / 86_400_000)
    : 0;
  check(`it runs about a year (${endsIn} days)`, endsIn > 350 && endsIn < 380, sub);

  // ── The same event again. Providers retry until they get a 2xx.
  const replay = await post(paid, await sign(paid));
  const replayBody = await replay.json().catch(() => ({}));
  check(`a replay is a no-op, not another year (${replay.status} duplicate=${replayBody?.duplicate})`,
    replay.ok && replayBody?.duplicate === true, replayBody);
  const { data: after } = await admin
    .from("subscriptions").select("current_period_end").eq("user_id", userId).maybeSingle();
  check("the period did not move on the replay", after?.current_period_end === sub?.current_period_end,
    { before: sub?.current_period_end, after: after?.current_period_end });

  // ── A team account must not be demoted by buying Pro.
  await admin.from("profiles").update({ subscription_tier: "team" }).eq("id", userId);
  await admin.from("checkout_sessions")
    .update({ status: "pending", last_event_id: null }).eq("reference", reference);
  const teamPaid = { ...paid, payment_id: paid.payment_id + 1 };
  await post(teamPaid, await sign(teamPaid));
  check(`buying pro does not demote a team account (${await tierOf()})`, (await tierOf()) === "team");
} catch (error) {
  console.error("ERROR", error);
  Deno.exitCode = 1;
} finally {
  for (const step of cleanup.reverse()) await Promise.resolve(step()).catch(() => {});
}
