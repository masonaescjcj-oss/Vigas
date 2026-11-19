#!/usr/bin/env node
/**
 * Builds the Expo Web bundle in `apps/chat` and syncs its static assets
 * into `apps/web/public/` so `apps/web` serves the integrated chat app natively
 * at `/chat` and `/chat/*`.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHAT_DIR = join(ROOT, 'apps', 'chat');
const DIST_DIR = join(CHAT_DIR, 'dist');
const WEB_PUBLIC = join(ROOT, 'apps', 'web', 'public');

const DEFAULT_SUPABASE_URL = 'https://jasgepmskcsyvqoesocc.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_m-HAN3dCgDJpgQ_L3WO1hQ_y1CWihK9';

const env = {
  ...process.env,
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY,
  EXPO_PUBLIC_DISTRIBUTION: process.env.EXPO_PUBLIC_DISTRIBUTION || 'direct',
  EXPO_TELEMETRY_DISABLED: '1',
  CI: '1',
};

if (!existsSync(join(CHAT_DIR, 'node_modules'))) {
  console.log('Installing apps/chat dependencies...');
  execFileSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: CHAT_DIR, stdio: 'inherit', env });
}

rmSync(DIST_DIR, { recursive: true, force: true });

console.log('Exporting Expo Web bundle from apps/chat...');
execFileSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', 'dist'], {
  cwd: CHAT_DIR,
  stdio: 'inherit',
  env,
});

// Move assets/node_modules -> assets/pkg so Vercel / git never drops package fonts.
const bundleDir = join(DIST_DIR, '_expo', 'static', 'js', 'web');
const PKG_FROM = '/assets/node_modules/';
const PKG_TO = '/assets/pkg/';

if (existsSync(join(DIST_DIR, 'assets', 'node_modules'))) {
  const from = join(DIST_DIR, 'assets', 'node_modules');
  const to = join(DIST_DIR, 'assets', 'pkg');
  try {
    renameSync(from, to);
  } catch (err) {
    if (err.code !== 'EPERM' && err.code !== 'EBUSY') throw err;
    cpSync(from, to, { recursive: true });
    rmSync(from, { recursive: true, force: true });
  }

  const renamed = [];
  for (const file of readdirSync(bundleDir).filter((f) => f.endsWith('.js'))) {
    const source = readFileSync(join(bundleDir, file), 'utf8');
    if (!source.includes(PKG_FROM)) continue;
    const rewritten = source.split(PKG_FROM).join(PKG_TO);
    const hash = createHash('md5').update(rewritten).digest('hex');
    const next = file.replace(/-[0-9a-f]{32}\.js$/, `-${hash}.js`);
    writeFileSync(join(bundleDir, next), rewritten);
    if (next !== file) unlinkSync(join(bundleDir, file));
    renamed.push([file, next]);
  }

  const referrers = [join(DIST_DIR, 'index.html'), ...readdirSync(bundleDir).map((f) => join(bundleDir, f))];
  for (const refPath of referrers) {
    const text = readFileSync(refPath, 'utf8');
    const updated = renamed.reduce((acc, [fromName, toName]) => acc.split(fromName).join(toName), text);
    if (updated !== text) writeFileSync(refPath, updated);
  }
  console.log(`Moved package assets to ${PKG_TO} (${renamed.length} bundle file(s) updated)`);
}

// Parse exported CSS & JS references from Expo's dist/index.html (normalizing backslashes).
const rawHtml = readFileSync(join(DIST_DIR, 'index.html'), 'utf8').replace(/\/_expo\\static\\/g, '/_expo/static/').replace(/\\/g, '/');

const cssMatches = [...rawHtml.matchAll(/<link[^>]+href="(\/_expo\/static\/css\/[^"]+)"[^>]*>/g)].map((m) => m[1]);
const cssUnique = [...new Set(cssMatches)];
const scriptMatches = [...rawHtml.matchAll(/<script[^>]+src="(\/_expo\/static\/js\/[^"]+)"[^>]*><\/script>/g)].map((m) => m[1]);
const scriptUnique = [...new Set(scriptMatches)];

if (scriptUnique.length === 0) {
  throw new Error('Expo web export produced no JS bundle script tags in dist/index.html');
}

const cssTags = cssUnique
  .map((href) => `  <link rel="preload" href="${href}" as="style" />\n  <link rel="stylesheet" href="${href}" />`)
  .join('\n');
const scriptTags = scriptUnique.map((src) => `  <script src="${src}" defer></script>`).join('\n');

const chatShellHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
  <title>Vigas Chat — AI Chat &amp; App Builder</title>
  <meta name="description" content="Chat with frontier AI models or build, run, and preview full web apps live in Vigas Chat — integrated with Vigas API, Arena leaderboards, and tools." />
  <link rel="canonical" href="https://vigas.app/chat" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Vigas" />
  <meta property="og:title" content="Vigas Chat — AI Chat &amp; App Builder" />
  <meta property="og:description" content="Chat with frontier AI models or build, run, and preview full web apps live in Vigas Chat." />
  <meta property="og:url" content="https://vigas.app/chat" />
  <meta property="og:image" content="https://vigas.app/opengraph-image" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Vigas Chat — AI Chat &amp; App Builder" />
  <meta name="twitter:description" content="Chat with frontier AI models or build, run, and preview full web apps live in Vigas Chat." />
  <meta name="twitter:image" content="https://vigas.app/opengraph-image" />
  <link rel="icon" href="/favicon.ico" sizes="48x48 32x32 16x16" type="image/x-icon" />
  <link rel="shortcut icon" href="/favicon.ico" />
  <link rel="icon" href="/icons/icon-48.png" sizes="48x48" type="image/png" />
  <link rel="icon" href="/icons/icon-96.png" sizes="96x96" type="image/png" />
  <link rel="icon" href="/icons/icon-192.png" sizes="192x192" type="image/png" />
  <link rel="icon" href="/icons/icon.svg" sizes="any" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
  <link rel="manifest" href="/manifest.webmanifest" />
  <meta name="theme-color" content="#171614" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="Vigas Chat" />
  <style id="expo-reset">
    html, body { height: 100%; margin: 0; background: #171614; color: #EFEAE1; }
    body { overflow: hidden; }
    #root { display: flex; height: 100%; flex: 1; }
  </style>
${cssTags}
</head>
<body>
  <noscript>
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:64px auto;padding:24px;color:#EFEAE1;">
      <h1>Vigas Chat</h1>
      <p>JavaScript is required to run the interactive Vigas AI Chat &amp; App Builder workspace.</p>
      <p><a href="/" style="color:#FF6A1A;">Back to Vigas home</a> · <a href="/models" style="color:#FF6A1A;">Models &amp; API pricing</a></p>
    </div>
  </noscript>
  <div id="root"></div>
${scriptTags}
</body>
</html>
`;

// Sync static chat assets cleanly into apps/web/public/
mkdirSync(WEB_PUBLIC, { recursive: true });
rmSync(join(WEB_PUBLIC, '_expo'), { recursive: true, force: true });
rmSync(join(WEB_PUBLIC, 'assets'), { recursive: true, force: true });

cpSync(join(DIST_DIR, '_expo'), join(WEB_PUBLIC, '_expo'), { recursive: true });
if (existsSync(join(DIST_DIR, 'assets'))) {
  cpSync(join(DIST_DIR, 'assets'), join(WEB_PUBLIC, 'assets'), { recursive: true });
}
writeFileSync(join(WEB_PUBLIC, 'chat-shell.html'), chatShellHtml);

// Clean up intermediate dist/ to keep apps/chat tidy.
rmSync(DIST_DIR, { recursive: true, force: true });

console.log('Synced Vigas Chat web bundle into apps/web/public/:');
console.log('  - apps/web/public/chat-shell.html');
console.log(`  - apps/web/public/_expo (${cssUnique.length} CSS, ${scriptUnique.length} JS)`);
console.log('  - apps/web/public/assets');
