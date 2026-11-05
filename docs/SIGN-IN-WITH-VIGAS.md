# Sign in with Vigas (for RetroBuild and other apps)

An app sends the user to Vigas, the user approves, and the app receives an API key on the user's
own account. Everything the app does is billed to the user's Vigas credits. It's the same PKCE flow
OpenRouter uses, so existing OpenRouter integrations need only the URLs changed.

## 1. Send the user to Vigas

```ts
const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));          // keep it (e.g. sessionStorage)
const challenge = base64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
location.href =
  `https://vigas.ai/auth?callback_url=${encodeURIComponent('https://retrobuild.space/auth/vigas')}` +
  `&code_challenge=${challenge}&code_challenge_method=S256&app=RetroBuild`;
```

`callback_url` must be `https://…` (or `http://localhost…` during development). An optional
`limit` (USD per month) caps what the issued key can spend.

## 2. Vigas redirects back with a code

`https://retrobuild.space/auth/vigas?code=…` — the code works once and expires after 10 minutes.

## 3. Exchange the code for a key (server side or in the browser)

```ts
const res = await fetch('https://api.vigas.ai/v1/auth/keys', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ code, code_verifier: verifier }),
});
const { key } = await res.json(); // "sk-vg-v1-…"
```

Errors return 403 with `error.code` `invalid_code` (unknown, expired or used) or `invalid_verifier`.
A wrong verifier burns the code.

## 4. Use the key

It's a normal Vigas key: `POST https://api.vigas.ai/v1/chat/completions` with
`Authorization: Bearer <key>`. `GET /v1/key` shows its usage and remaining monthly limit. The user
can see and revoke it in their Vigas dashboard (it's named "RetroBuild (Sign in with Vigas)").

## Status

- Done: code storage and exchange (`packages/db/src/oauth.ts`), `POST /v1/auth/keys` on the gateway, tests.
- To do: the consent page `/auth` on the website (sign in if needed → show app name, callback host
  and limit → Approve calls `createAuthCode` and redirects to `redirectUrl`).
