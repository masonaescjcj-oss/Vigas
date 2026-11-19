/**
 * scripts/check-release-config.ts
 * ---------------------------------------------------------------------------
 * Everything that has to be right before an Android build is worth making.
 *
 * A release build bakes its configuration in and then goes to a store, where a
 * mistake costs a review cycle rather than a redeploy. This is the list of
 * things that are silently wrong until a user hits them.
 *
 * It exists because one of them already was: eas.json pointed every build at a
 * Supabase project that is not this one, and carried no anon key at all. An APK
 * from it would have installed, opened, and failed on the first request, with
 * nothing in the build output to suggest why.
 *
 *   npx deno run --allow-all --env-file=.env scripts/check-release-config.ts
 * ---------------------------------------------------------------------------
 */

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n      ${String(typeof detail === "string" ? detail : JSON.stringify(detail)).slice(0, 400)}`}`);
  if (!ok) failures += 1;
}

const eas = JSON.parse(await Deno.readTextFile("eas.json"));
const app = JSON.parse(await Deno.readTextFile("app.json")).expo;

const liveUrl = Deno.env.get("EXPO_PUBLIC_SUPABASE_URL");
const liveAnon = Deno.env.get("EXPO_PUBLIC_SUPABASE_ANON_KEY");
const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

console.log("── backend the build will talk to ──\n");

for (const profile of ["development", "preview", "production"]) {
  const env = eas.build?.[profile]?.env ?? {};

  check(
    `${profile}: points at the live Supabase project`,
    env.EXPO_PUBLIC_SUPABASE_URL === liveUrl,
    { configured: env.EXPO_PUBLIC_SUPABASE_URL, live: liveUrl },
  );
  check(
    `${profile}: carries an anon key`,
    typeof env.EXPO_PUBLIC_SUPABASE_ANON_KEY === "string" && env.EXPO_PUBLIC_SUPABASE_ANON_KEY.length > 20,
    "without it every request is unauthenticated and the app is dead on open",
  );
  check(
    `${profile}: the anon key matches the live project`,
    env.EXPO_PUBLIC_SUPABASE_ANON_KEY === liveAnon,
    "a key from another project authenticates against nothing",
  );

  // The one that would be catastrophic rather than merely broken.
  const values = JSON.stringify(env);
  check(
    `${profile}: no service-role key is baked into the build`,
    !(serviceRole && values.includes(serviceRole)) && !/service_role/i.test(values),
    "every install would carry full database access",
  );
  check(
    `${profile}: no localhost backend`,
    !/localhost|127\.0\.0\.1/.test(values),
    "a device is not the machine that built it",
  );
}

console.log("\n── store rules ──\n");

check(
  "the production build declares the Play channel",
  eas.build?.production?.env?.EXPO_PUBLIC_DISTRIBUTION === "play",
  {
    configured: eas.build?.production?.env?.EXPO_PUBLIC_DISTRIBUTION,
    why: "decides whether the app may link out to a purchase page",
  },
);
check(
  "production builds an app bundle, which is what Play accepts",
  eas.build?.production?.android?.buildType === "app-bundle",
  eas.build?.production?.android,
);

// Selling is off for launch; a payment surface reaching review is the risk.
const billing = await Deno.readTextFile("src/config/billing.ts");
check(
  "billing is switched off, so no purchase surface ships",
  /export const BILLING_ENABLED = false/.test(billing),
  "a paywall in review is the most likely reason to be rejected",
);

console.log("\n── identity and assets ──\n");

check("the app has an Android package name", typeof app.android?.package === "string", app.android);
check(
  "package and iOS bundle id agree",
  app.android?.package === app.ios?.bundleIdentifier,
  { android: app.android?.package, ios: app.ios?.bundleIdentifier },
);
check("versionCode is an integer", Number.isInteger(app.android?.versionCode), app.android?.versionCode);
check("a user-visible version is set", typeof app.version === "string", app.version);

/** PNG dimensions, read from the IHDR chunk rather than trusting the filename. */
async function pngSize(path: string): Promise<{ w: number; h: number } | null> {
  try {
    const bytes = await Deno.readFile(path);
    if (bytes.length < 24) return null;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { w: view.getUint32(16), h: view.getUint32(20) };
  } catch {
    return null;
  }
}

for (const [label, path, min] of [
  ["icon", app.icon, 1024],
  ["adaptive icon foreground", app.android?.adaptiveIcon?.foregroundImage, 1024],
  ["splash", app.splash?.image, 200],
] as Array<[string, string, number]>) {
  const size = path ? await pngSize(path.replace(/^\.\//, "")) : null;
  check(
    `${label} exists and is at least ${min}px square (${size ? `${size.w}x${size.h}` : "missing"})`,
    !!size && size.w >= min && size.h >= min && size.w === size.h,
    { path, size },
  );
}

console.log("\n── permissions ──\n");

const permissions: string[] = app.android?.permissions ?? [];
check(
  `only permissions the app uses are requested (${permissions.join(", ")})`,
  permissions.every((p) => /INTERNET|POST_NOTIFICATIONS/.test(p)),
  permissions,
);
check(
  "camera, microphone and location are explicitly blocked",
  ["RECORD_AUDIO", "CAMERA", "ACCESS_FINE_LOCATION"].every((p) =>
    (app.android?.blockedPermissions ?? []).some((b: string) => b.includes(p))
  ),
  app.android?.blockedPermissions,
);

console.log(
  failures === 0
    ? "\nReady to build.\n"
    : `\n${failures} thing(s) would ship wrong. Fix before building.\n`,
);
Deno.exitCode = failures === 0 ? 0 : 1;
