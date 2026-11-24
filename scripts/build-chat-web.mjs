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
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, shrink-to-fit=no" />
  <title>Vigas Chat — AI Chat &amp; App Builder</title>
  <meta name="description" content="Chat with frontier AI models or build, run, and preview full web apps live in Vigas Chat — integrated with Vigas API, live benchmarks, and tools." />
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
    html, body { height: 100%; height: 100dvh; margin: 0; background: #171614; color: #EFEAE1; }
    body { overflow: hidden; display: flex; flex-direction: column; }
    #root { display: flex; flex: 1 1 0; min-height: 0; height: auto; width: 100%; }
    #vg-chat-rail {
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-height: 46px;
      padding: calc(6px + env(safe-area-inset-top, 0px)) 12px 6px;
      background: #12110F;
      border-bottom: 1px solid rgba(239, 234, 225, 0.12);
      font-family: Inter, system-ui, -apple-system, 'Segoe UI', sans-serif;
      z-index: 9999;
      box-sizing: border-box;
    }
    #vg-chat-rail a, #vg-chat-rail button {
      text-decoration: none;
      font: 500 12.5px/1 Inter, system-ui, -apple-system, 'Segoe UI', sans-serif;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      white-space: nowrap;
      box-sizing: border-box;
    }
    .vg-cr-back {
      height: 32px;
      padding: 0 11px 0 9px;
      border-radius: 9px;
      border: 1px solid rgba(239, 234, 225, 0.16);
      background: #1C1B18;
      color: #EFEAE1;
      transition: background .14s, border-color .14s;
    }
    .vg-cr-back:hover { background: #24221F; border-color: rgba(239, 234, 225, 0.28); }
    .vg-cr-pills {
      display: flex;
      align-items: center;
      gap: 5px;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .vg-cr-pills::-webkit-scrollbar { display: none; }
    .vg-cr-pill {
      height: 30px;
      padding: 0 10px;
      border-radius: 999px;
      border: 1px solid rgba(239, 234, 225, 0.1);
      background: #1C1B18;
      color: #A9A298;
      transition: color .14s, border-color .14s, background .14s;
    }
    .vg-cr-pill:hover { color: #EFEAE1; border-color: rgba(239, 234, 225, 0.22); }
    .vg-cr-pill.adm {
      display: none;
      color: #FF8A4C;
      background: rgba(255, 106, 26, 0.14);
      border-color: rgba(255, 106, 26, 0.36);
      font-weight: 600;
    }
  </style>
${cssTags}
</head>
<body>
  <nav id="vg-chat-rail" aria-label="Return to Vigas">
    <button type="button" id="vg-cr-back-btn" class="vg-cr-back" aria-label="Back to Vigas">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>
      <span id="vg-cr-back-lbl">Back</span>
    </button>
    <div class="vg-cr-pills">
      <a href="/dashboard#keys" class="vg-cr-pill" id="vg-cr-keys">Keys</a>
      <a href="/dashboard#credits" class="vg-cr-pill" id="vg-cr-wallet">Wallet</a>
      <a href="/models" class="vg-cr-pill" id="vg-cr-models">Models</a>
      <a href="/admin/providers" class="vg-cr-pill adm" id="vg-cr-admin">Admin</a>
    </div>
  </nav>
  <noscript>
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:64px auto;padding:24px;color:#EFEAE1;">
      <h1>Vigas Chat</h1>
      <p>JavaScript is required to run the interactive Vigas AI Chat &amp; App Builder workspace.</p>
      <p><a href="/" style="color:#FF6A1A;">Back to Vigas home</a> · <a href="/models" style="color:#FF6A1A;">Models &amp; API pricing</a></p>
    </div>
  </noscript>
  <div id="root"></div>
  <script>
    (function(){
      try {
        var backBtn = document.getElementById('vg-cr-back-btn');
        if (backBtn) {
          backBtn.addEventListener('click', function(){
            try {
              if (document.referrer && new URL(document.referrer).origin === location.origin && !new URL(document.referrer).pathname.startsWith('/chat')) {
                location.assign(document.referrer);
                return;
              }
            } catch(_) {}
            location.assign('/dashboard');
          });
        }
        var isAdmin = /(?:^|;\\s*)vigas_is_admin=1(?:;|$)/.test(document.cookie);
        if (!isAdmin) {
          var raw = localStorage.getItem('sb-jasgepmskcsyvqoesocc-auth-token');
          if (raw) {
            var parsed = JSON.parse(raw);
            var email = parsed && parsed.user && parsed.user.email ? String(parsed.user.email).trim().toLowerCase() : '';
            if (email === 'ma.sonaescjcj@gmail.com') isAdmin = true;
          }
        }
        var admLink = document.getElementById('vg-cr-admin');
        if (isAdmin && admLink) admLink.style.display = 'inline-flex';
        var isFa = /(?:^|;\\s*)vg_lang=fa(?:;|$)/.test(document.cookie);
        var walletEl = document.getElementById('vg-cr-wallet');
        var walletBaseLabel = isFa ? 'کیف‌پول' : 'Wallet';
        if (isFa) {
          var b = document.getElementById('vg-cr-back-lbl');
          var k = document.getElementById('vg-cr-keys');
          var m = document.getElementById('vg-cr-models');
          if (b) b.textContent = 'بازگشت';
          if (k) k.textContent = 'کلید API';
          if (walletEl) walletEl.textContent = walletBaseLabel;
          if (m) m.textContent = 'مدل‌ها';
          if (admLink) admLink.textContent = 'ادمین';
        }
        function renderBalance(micros) {
          if (!walletEl || typeof micros !== 'number' || !isFinite(micros)) return;
          var usd = (micros / 1000000).toFixed(2);
          walletEl.textContent = walletBaseLabel + ' · $' + usd;
        }
        window.addEventListener('vigas-balance-updated', function(ev) {
          if (ev && ev.detail && typeof ev.detail.balanceMicros === 'number') {
            renderBalance(ev.detail.balanceMicros);
          }
        });
        try {
          var rawSess = localStorage.getItem('sb-jasgepmskcsyvqoesocc-auth-token');
          var tok = rawSess ? (JSON.parse(rawSess) || {}).access_token : '';
          if (tok) {
            fetch('/api/app/welcome-wallet', {
              credentials: 'include',
              headers: { Authorization: 'Bearer ' + tok, Accept: 'application/json' },
            })
              .then(function(r) { return r.ok ? r.json() : null; })
              .then(function(d) { if (d && typeof d.balanceMicros === 'number') renderBalance(d.balanceMicros); })
              .catch(function() {});
          }
        } catch(_) {}
      } catch(_) {}
    })();
  </script>
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
