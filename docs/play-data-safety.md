# Google Play — Data safety answers

Every answer here was read out of the code, with the file that decides it named
beside it. Play requires this form to match the privacy policy, and a mismatch
is itself a policy violation — so if any of this changes, change the policy in
`src/core/legal/documents.ts` in the same commit.

Nothing below is a guess. Where the honest answer is "it depends on the
provider we do not control", it says so.

---

## Does your app collect or share any of the required user data types?

**Yes.**

## Is all of the user data collected by your app encrypted in transit?

**Yes.** Every call goes to Supabase or the model gateway over HTTPS; there is
no plaintext endpoint in the app (`src/services/functionsClient.ts` builds every
URL from `EXPO_PUBLIC_SUPABASE_URL`, which is https).

## Do you provide a way for users to request that their data be deleted?

**Yes.** Settings → Account → delete account (`supabase/functions/user-delete`).
It removes the profile, projects, files and conversations. The policy also
gives an address to write to.

---

## Data types

### Personal info → Email address

| | |
|---|---|
| Collected | Yes |
| Shared | No |
| Processed ephemerally | No |
| Required or optional | Required — it is how you sign in |
| Purpose | Account management |

Where: Supabase Auth. The password is hashed by the auth provider and never
reaches our code.

### App activity → Other user-generated content

*The projects, the files the agent writes, and the conversation.*

| | |
|---|---|
| Collected | Yes |
| **Shared** | **Yes** |
| Processed ephemerally | No |
| Required or optional | Required to use the product at all |
| Purpose | App functionality |

**This is the answer that matters.** To answer a prompt, the prompt and the
part of the project being worked on are sent to a third-party model provider
(`supabase/functions/shared/resolveProvider.ts` → the configured gateway). Play
counts that as *sharing*, and saying otherwise would be the kind of mismatch
that gets an app removed.

We do not control that provider's retention. The policy says so in the same
words.

### App activity → App interactions

*Which feature was used, not what was written.*

| | |
|---|---|
| Collected | Yes |
| Shared | No |
| Processed ephemerally | No |
| Required or optional | Required |
| Purpose | Analytics, App functionality |

Where: `src/services/analytics.ts`, allow-listed by `EVENT_SCHEMA` in
`src/core/analytics/events.ts`. An event carries the account id, the platform
and the app version. A property that is not on the fixed list is dropped rather
than sent, so free text cannot leak through it.

### App info and performance → Crash logs

**Not collected.** The app has no crash reporter — `Sentry.init` appears
nowhere in `src/`. Errors are recorded on the server
(`supabase/functions/shared/sentry.ts`), which is a different thing and is
disclosed in the policy as such.

Do not tick this box because it sounds prudent. Over-declaring is still a
mismatch with the policy.

### App info and performance → Diagnostics

**Not collected** beyond the app-version and platform fields already declared
under App interactions.

### Device or other IDs

| | |
|---|---|
| Collected | Yes — only if the user turns notifications on |
| Shared | No |
| Required or optional | **Optional** |
| Purpose | App functionality (sending the "your build finished" notice) |

Where: `src/services/pushService.ts` asks for permission first, then registers
an Expo push token through `supabase/functions/push-register`. It identifies a
device, not a person, and it is removed on sign-out or account deletion.

### Financial info

**Not collected.** There is nothing to buy — `BILLING_ENABLED` is `false` in
`src/config/billing.ts`, and no purchase surface is reachable in this build.

**When paid plans arrive this section changes**, and the policy has to change
with it in the same commit.

### Location, Contacts, Photos, Audio, Files on device, Health, Messages

**Not collected.** `app.json` requests only `INTERNET` and
`POST_NOTIFICATIONS`, and explicitly blocks camera, microphone and location.
`scripts/check-release-config.ts` fails the build if that stops being true.

---

## Content rating questionnaire

- No violence, sexual content, profanity, gambling or drugs in the app itself.
- **User-generated content: yes.** People write prompts and can share a page
  publicly with a link. Say so; a share link is content one user can show
  another.
- Moderation: shares can be revoked by their owner, and the terms forbid
  unlawful use.

## Target audience

Not directed at children. The policy states no knowing collection under 13.

## Ads

None. No advertising SDK is present in `package.json`.
