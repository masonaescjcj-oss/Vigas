/**
 * Two things here decide whether bring-your-own-key is safe to ship: the URL
 * guard, which is all that stands between "call the user's endpoint" and
 * server-side request forgery, and the encryption, which is what makes a
 * database leak not a billing leak.
 */
import { assertEquals, assertNotEquals, assertRejects, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { checkProviderUrl } from "../shared/providerGuard.ts";
import { lastFour, openSecret, resetEncryptionKey, sealSecret } from "../shared/secretBox.ts";
import { FREE_BUILD_RUNS_PER_DAY, evaluateBuildQuota } from "../shared/usage.ts";

Deno.test("the guard accepts any real provider, famous or not", () => {
  for (const url of [
    "https://api.openai.com/v1",
    "https://api.anthropic.com",
    "https://openrouter.ai/api/v1",
    "https://api.apimaster.ai/v1",
    "https://some-brand-new-llm-startup.dev/v1",
    "https://llm.a-company.co.uk:8443/v1",
  ]) {
    const verdict = checkProviderUrl(url);
    assertEquals(verdict.ok, true, `${url} should be allowed: ${verdict.reason}`);
  }
});

Deno.test("the guard normalises a trailing slash so one endpoint is one row", () => {
  assertEquals(checkProviderUrl("https://api.example.com/v1/").normalised, "https://api.example.com/v1");
});

Deno.test("plaintext http is refused — a key sent over it is readable in transit", () => {
  const verdict = checkProviderUrl("http://api.example.com/v1");
  assertEquals(verdict.ok, false);
  assertStringIncludes(verdict.reason!, "https");
});

Deno.test("cloud metadata and loopback are refused", () => {
  for (const url of [
    "https://169.254.169.254/latest/meta-data/",
    "https://metadata.google.internal/",
    "https://localhost/v1",
    "https://127.0.0.1/v1",
    "https://[::1]/v1",
  ]) {
    assertEquals(checkProviderUrl(url).ok, false, `${url} must be refused`);
  }
});

Deno.test("private network ranges are refused", () => {
  for (const host of ["10.0.0.5", "172.16.4.1", "172.31.255.1", "192.168.1.1", "100.64.0.1", "0.0.0.0"]) {
    assertEquals(checkProviderUrl(`https://${host}/v1`).ok, false, `${host} must be refused`);
  }
});

Deno.test("a public IP is still refused, because a provider has a hostname", () => {
  const verdict = checkProviderUrl("https://8.8.8.8/v1");
  assertEquals(verdict.ok, false);
  assertStringIncludes(verdict.reason!, "hostname");
});

Deno.test("internal-looking suffixes and bare names are refused", () => {
  for (const url of ["https://vault.internal/v1", "https://printer.local/v1", "https://intranet/v1"]) {
    assertEquals(checkProviderUrl(url).ok, false, `${url} must be refused`);
  }
});

Deno.test("credentials in the URL are refused", () => {
  const verdict = checkProviderUrl("https://user:pass@api.example.com/v1");
  assertEquals(verdict.ok, false);
  assertStringIncludes(verdict.reason!, "API key field");
});

Deno.test("nonsense is refused rather than thrown", () => {
  assertEquals(checkProviderUrl("not a url").ok, false);
  assertEquals(checkProviderUrl("").ok, false);
});

Deno.test("a sealed key round-trips", async () => {
  Deno.env.set("PROVIDER_KEY_SECRET", "a".repeat(40));
  resetEncryptionKey();
  const secret = "sk-test-abcdef123456";
  assertEquals(await openSecret(await sealSecret(secret)), secret);
});

Deno.test("the ciphertext does not contain the key, and differs every time", async () => {
  Deno.env.set("PROVIDER_KEY_SECRET", "a".repeat(40));
  resetEncryptionKey();
  const secret = "sk-test-abcdef123456";
  const first = await sealSecret(secret);
  const second = await sealSecret(secret);
  assertEquals(first.includes(secret), false);
  // A fresh nonce each time: identical plaintext must not produce identical
  // ciphertext, or the store leaks which users share a key.
  assertNotEquals(first, second);
});

Deno.test("a different secret cannot open it", async () => {
  Deno.env.set("PROVIDER_KEY_SECRET", "a".repeat(40));
  resetEncryptionKey();
  const sealed = await sealSecret("sk-test-abcdef123456");

  Deno.env.set("PROVIDER_KEY_SECRET", "b".repeat(40));
  resetEncryptionKey();
  await assertRejects(() => openSecret(sealed));
});

Deno.test("a tampered ciphertext is rejected, not silently mangled", async () => {
  Deno.env.set("PROVIDER_KEY_SECRET", "a".repeat(40));
  resetEncryptionKey();
  const sealed = await sealSecret("sk-test-abcdef123456");
  const flipped = sealed.slice(0, -2) + (sealed.endsWith("A=") ? "B=" : "A=");
  await assertRejects(() => openSecret(flipped));
});

Deno.test("a missing or weak secret refuses to encrypt at all", async () => {
  Deno.env.set("PROVIDER_KEY_SECRET", "tooshort");
  resetEncryptionKey();
  await assertRejects(() => sealSecret("sk-test"));
  Deno.env.delete("PROVIDER_KEY_SECRET");
  resetEncryptionKey();
  await assertRejects(() => sealSecret("sk-test"));
});

Deno.test("lastFour identifies a key without revealing it", () => {
  assertEquals(lastFour("sk-proj-verylongkey9876"), "9876");
  assertEquals(lastFour("ab"), "ab");
});

/**
 * The quota split the product asks for: questions are free and unmetered,
 * builds are limited because they occupy a worker and a sandbox — infrastructure
 * we pay for no matter whose API key produced the tokens.
 */
Deno.test("a free account gets four builds a day", () => {
  assertEquals(evaluateBuildQuota("free", 0), { allowed: true, remaining: 4 });
  assertEquals(evaluateBuildQuota("free", 3), { allowed: true, remaining: 1 });
  assertEquals(evaluateBuildQuota("free", 4).allowed, false);
  assertEquals(evaluateBuildQuota("free", 99).remaining, 0);
});

Deno.test("a paid account is not limited on builds", () => {
  assertEquals(evaluateBuildQuota("pro", 500).allowed, true);
  assertEquals(evaluateBuildQuota("team", 500).allowed, true);
});

Deno.test("the free build allowance matches the number the UI promises", () => {
  assertEquals(FREE_BUILD_RUNS_PER_DAY, 4);
});
