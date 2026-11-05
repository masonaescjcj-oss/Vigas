# Vigas for Android

React Native + Expo (SDK 58) app for Vigas: Home, Explore (news and tools), Vigas Chat with Arena, Ranks and Wallet.
The visual spec is `design/premium/Android*.dc.html`.

## Run

```bash
cp .env.example .env        # EXPO_PUBLIC_API_URL=http://10.0.2.2:3000 (the host machine, seen from the emulator)
npx expo start              # press "a" for Android; press "s" to switch between a dev build and Expo Go
```

The app talks to the website's `/api/app/*` and `/api/auth/*` routes (`apps/web`) through `@vigas/api-client`.
Every screen falls back to the demo data in `@vigas/core/seed` when the server is unreachable or
`EXPO_PUBLIC_API_URL` is empty, so the app always renders. Signing in, chat, Arena, tool votes and the wallet
need the server.

## Checks

```bash
npx tsc --noEmit
npx expo lint
npx expo-doctor
npx expo export --platform android --output-dir /tmp/vigas-android-export   # proves Metro can bundle the monorepo
```

## Build (EAS)

`eas.json` has three profiles: `development` (dev client APK, API on `10.0.2.2:3000`), `preview` (internal APK)
and `production` (Play Store AAB, version code auto-incremented remotely). Run from this folder:

```bash
npx eas-cli@latest build --platform android --profile preview
```

`preview` and `production` point `EXPO_PUBLIC_API_URL` at `https://vigas.ai`; change it in `eas.json` if the API lives elsewhere.

## Layout

- `src/app` — routes: `(tabs)/` (index, explore, chat, ranks, wallet), `news/[slug]` (article), `sign-in`.
- `src/components` — design-system pieces: text, icons (SVG paths from the design files), key buttons, chips,
  segmented control, fluted pillars and podium, typographic news covers, sheet, skeletons, tab bar.
- `src/lib` — API client and session (token in SecureStore), keyed data store with seed fallback, haptics, formatting.

## Known gaps

- Saved stories are kept in memory only.
- No clipboard module is installed, so keys and replies are shared through the Android share sheet (the new key is
  also selectable text).
- Voice input and attachments from the design are not implemented.
- Icons are still the Expo template images.
