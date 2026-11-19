/**
 * shared/templates.ts
 * ---------------------------------------------------------------------------
 * Starter project templates, seeded into the project's Storage prefix by
 * projects-create.
 *
 * Two kinds, and the split is deliberate:
 *
 *   - `expo` is a real React Native project — the output that becomes an app in
 *     the stores, which is what this product is for.
 *   - the rest are plain HTML/CSS/JS, which need no bundling at all and give the
 *     agent small readable files to edit rather than a framework to scaffold
 *     (fewer tokens, more stable output). Right for a page, wrong for an app.
 *
 * Both preview through the same pipeline: previewBuilder compiles JSX/TS and
 * maps "react-native" to react-native-web on the CDN, the same substitution
 * Expo's own web target makes.
 * ---------------------------------------------------------------------------
 */

export interface ProjectTemplate {
  name: string;
  description: string;
  files: Record<string, string>;
}

const BASE_CSS = `:root{--bg:#0f1115;--card:#181b22;--ink:#f4f4f5;--muted:#9ca3af;--accent:#8b5cf6;--accent2:#38bdf8;--radius:16px}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:var(--bg);color:var(--ink);line-height:1.6;min-height:100vh}
a{color:var(--accent2);text-decoration:none}
.container{max-width:960px;margin:0 auto;padding:24px}
.card{background:var(--card);border-radius:var(--radius);padding:20px}
.btn{display:inline-block;background:var(--accent);color:#fff;border:0;border-radius:12px;padding:12px 22px;font-size:15px;font-weight:600;cursor:pointer}
.btn:hover{filter:brightness(1.1)}
.muted{color:var(--muted)}`;

/**
 * The Expo starter.
 *
 * A real React Native project, not a web page pretending to be one: the same
 * App.tsx, app.json and package.json `npx create-expo-app` produces, so it can
 * be exported and built with EAS without being rewritten first.
 *
 * It previews without Metro, a device or a build. React Native code imports its
 * primitives from "react-native", which previewBuilder maps to
 * react-native-web on the CDN — the same substitution Expo's own web target
 * makes. Verified in the running app: View/Text/Pressable render, StyleSheet
 * styles apply, and state updates on press.
 *
 * The limit is honest and worth knowing: anything needing a native module
 * (camera, notifications, filesystem) has no web implementation and will not
 * appear in the preview. It still ships in the exported project.
 */
const EXPO_APP_TSX = `import { useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.title}>Your app</Text>
        <Text style={styles.subtitle}>
          Tell the agent what to change and watch it happen here.
        </Text>

        <Text style={styles.count}>{count}</Text>
        <Pressable style={styles.button} onPress={() => setCount(count + 1)}>
          <Text style={styles.buttonText}>Tap me</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0f1115", alignItems: "center", justifyContent: "center", padding: 24 },
  card: { width: "100%", maxWidth: 420, backgroundColor: "#181b22", borderRadius: 16, padding: 24, alignItems: "center" },
  title: { color: "#f4f4f5", fontSize: 24, fontWeight: "700" },
  subtitle: { color: "#9ca3af", fontSize: 14, textAlign: "center", marginTop: 8, lineHeight: 20 },
  count: { color: "#38bdf8", fontSize: 48, fontWeight: "800", marginTop: 20 },
  button: { backgroundColor: "#8b5cf6", borderRadius: 12, paddingVertical: 12, paddingHorizontal: 28, marginTop: 16 },
  buttonText: { color: "#ffffff", fontSize: 15, fontWeight: "600" },
});
`;

export const PROJECT_TEMPLATES: Record<string, ProjectTemplate> = {
  expo: {
    name: "Mobile App (Expo)",
    description: "A real iOS and Android app in React Native. Previews here, builds with EAS.",
    files: {
      "App.tsx": EXPO_APP_TSX,
      "app.json": JSON.stringify(
        {
          expo: {
            name: "My App",
            slug: "my-app",
            version: "1.0.0",
            orientation: "portrait",
            userInterfaceStyle: "automatic",
            newArchEnabled: true,
            splash: { resizeMode: "contain", backgroundColor: "#0f1115" },
            ios: { supportsTablet: true },
            android: { adaptiveIcon: { backgroundColor: "#0f1115" } },
            web: { bundler: "metro" },
          },
        },
        null,
        2,
      ) + "\n",
      "package.json": JSON.stringify(
        {
          name: "my-app",
          version: "1.0.0",
          main: "expo/AppEntry.js",
          scripts: { start: "expo start", android: "expo start --android", ios: "expo start --ios", web: "expo start --web" },
          dependencies: {
            expo: "~51.0.0",
            react: "18.2.0",
            "react-native": "0.74.5",
          },
          private: true,
        },
        null,
        2,
      ) + "\n",
      "README.md": `# My App

A React Native app made with Expo.

The preview in RetroAI renders this with react-native-web, which is how Expo
renders for the web. Components that need a native module — camera, push
notifications, the filesystem — have no web equivalent and will not show up
there, but they are still in the project you export.

To run it on your own machine:

\`\`\`bash
npm install
npx expo start
\`\`\`
`,
    },
  },
  landing: {
    name: "Landing Page",
    description: "Product landing page with hero, features, and call to action",
    files: {
      "index.html": `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>My Product</title>
<link rel="stylesheet" href="styles.css">
</head>
<body>
<header class="container hero">
  <span class="pill">NEW</span>
  <h1>Launch your idea<br><em>today</em></h1>
  <p class="muted">A crisp one-page site for your next product. Edit me by chatting with the agent.</p>
  <button class="btn" onclick="document.getElementById('cta').scrollIntoView({behavior:'smooth'})">Get Started</button>
</header>
<section class="container grid">
  <div class="card"><h3>⚡ Fast</h3><p class="muted">Loads instantly, no framework required.</p></div>
  <div class="card"><h3>🎨 Beautiful</h3><p class="muted">Modern dark design out of the box.</p></div>
  <div class="card"><h3>🤖 Agent-ready</h3><p class="muted">Ask the agent to add sections, forms, anything.</p></div>
</section>
<section class="container" id="cta">
  <div class="card center">
    <h2>Ready to begin?</h2>
    <p class="muted">Join the waitlist and be the first to know.</p>
    <button class="btn" onclick="alert('Thanks for your interest! 🎉')">Join Waitlist</button>
  </div>
</section>
<footer class="container muted center small">Built with RetroAI</footer>
</body>
</html>`,
      "styles.css": `${BASE_CSS}
.hero{padding-top:72px;padding-bottom:48px;text-align:center}
.hero h1{font-size:44px;line-height:1.15;margin:16px 0}
.hero em{color:var(--accent)}
.hero p{max-width:460px;margin:0 auto 24px}
.pill{background:rgba(139,92,246,.15);color:var(--accent);padding:4px 12px;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:.08em}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;padding-bottom:32px}
.center{text-align:center}
.small{font-size:12px;padding:24px}`,
    },
  },

  todo: {
    name: "Todo App",
    description: "Task list with add/complete/delete, saved in localStorage",
    files: {
      "index.html": `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>My Tasks</title>
<link rel="stylesheet" href="styles.css">
</head>
<body>
<main class="container narrow">
  <h1>✅ My Tasks</h1>
  <p class="muted" id="counter"></p>
  <form id="form" class="row">
    <input id="input" placeholder="What needs doing?" autocomplete="off">
    <button class="btn" type="submit">Add</button>
  </form>
  <ul id="list"></ul>
</main>
<script src="app.js"></script>
</body>
</html>`,
      "styles.css": `${BASE_CSS}
.narrow{max-width:520px;padding-top:56px}
h1{margin-bottom:4px}
.row{display:flex;gap:10px;margin:20px 0}
input{flex:1;background:var(--card);border:1px solid #2a2e37;border-radius:12px;padding:12px 14px;color:var(--ink);font-size:15px}
ul{list-style:none;display:flex;flex-direction:column;gap:10px}
li{display:flex;align-items:center;gap:12px;background:var(--card);border-radius:12px;padding:12px 14px}
li.done span{text-decoration:line-through;color:var(--muted)}
li span{flex:1;cursor:pointer}
li button{background:none;border:0;color:var(--muted);cursor:pointer;font-size:16px}`,
      "app.js": `const KEY = "retro-todos";
let todos = JSON.parse(localStorage.getItem(KEY) || "[]");
const list = document.getElementById("list");
const counter = document.getElementById("counter");
const form = document.getElementById("form");
const input = document.getElementById("input");

function save() { localStorage.setItem(KEY, JSON.stringify(todos)); }
function render() {
  list.innerHTML = "";
  counter.textContent = todos.filter(t => !t.done).length + " task(s) remaining";
  for (const t of todos) {
    const li = document.createElement("li");
    if (t.done) li.className = "done";
    const span = document.createElement("span");
    span.textContent = t.text;
    span.onclick = () => { t.done = !t.done; save(); render(); };
    const del = document.createElement("button");
    del.textContent = "✕";
    del.onclick = () => { todos = todos.filter(x => x !== t); save(); render(); };
    li.append(span, del);
    list.append(li);
  }
}
form.onsubmit = (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  todos.unshift({ text, done: false });
  input.value = "";
  save(); render();
};
render();`,
    },
  },

  gallery: {
    name: "Photo Gallery",
    description: "Responsive image grid with lightbox view",
    files: {
      "index.html": `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Gallery</title>
<link rel="stylesheet" href="styles.css">
</head>
<body>
<main class="container">
  <h1>🖼️ Gallery</h1>
  <p class="muted">Tap any tile to view. Ask the agent to plug in real photos.</p>
  <div class="grid" id="grid"></div>
</main>
<div class="lightbox" id="lightbox"><span id="lb-label"></span></div>
<script src="app.js"></script>
</body>
</html>`,
      "styles.css": `${BASE_CSS}
h1{padding-top:32px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-top:20px}
.tile{aspect-ratio:1;border-radius:14px;display:flex;align-items:end;padding:10px;font-size:13px;font-weight:600;cursor:pointer;transition:transform .15s}
.tile:hover{transform:scale(1.03)}
.lightbox{position:fixed;inset:0;background:rgba(0,0,0,.85);display:none;align-items:center;justify-content:center;font-size:28px;font-weight:700;cursor:zoom-out}
.lightbox.open{display:flex}`,
      "app.js": `const palettes = [
  ["#f472b6","#8b5cf6"],["#38bdf8","#22d3ee"],["#34d399","#a3e635"],
  ["#fbbf24","#fb923c"],["#f87171","#f472b6"],["#a78bfa","#38bdf8"],
  ["#4ade80","#22d3ee"],["#fb7185","#fbbf24"],["#60a5fa","#a78bfa"]
];
const grid = document.getElementById("grid");
const lightbox = document.getElementById("lightbox");
const label = document.getElementById("lb-label");
palettes.forEach((p, i) => {
  const tile = document.createElement("div");
  tile.className = "tile";
  tile.style.background = "linear-gradient(135deg," + p[0] + "," + p[1] + ")";
  tile.textContent = "Photo " + (i + 1);
  tile.onclick = () => {
    label.textContent = "Photo " + (i + 1);
    lightbox.style.background = "linear-gradient(135deg," + p[0] + "," + p[1] + ")";
    lightbox.classList.add("open");
  };
  grid.append(tile);
});
lightbox.onclick = () => lightbox.classList.remove("open");`,
    },
  },

  blog: {
    name: "Blog",
    description: "Minimal blog: post list and reading view from a JS data file",
    files: {
      "index.html": `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>My Blog</title>
<link rel="stylesheet" href="styles.css">
</head>
<body>
<main class="container narrow">
  <h1>📝 My Blog</h1>
  <p class="muted">Thoughts, notes, and ideas.</p>
  <div id="app"></div>
</main>
<script src="app.js"></script>
</body>
</html>`,
      "styles.css": `${BASE_CSS}
.narrow{max-width:640px;padding-top:48px}
.post{margin:16px 0;cursor:pointer}
.post h2{font-size:20px}
.post .date{font-size:12px;color:var(--muted)}
.reader h2{margin-bottom:4px}
.reader .body{margin-top:16px;white-space:pre-line}
.back{display:inline-block;margin-bottom:16px;cursor:pointer}`,
      "app.js": `const posts = [
  { id: 1, title: "Hello, world", date: "2026-08-01", body: "Welcome to my new blog!\\n\\nThis site is fully editable by the RetroAI agent. Ask it to add a post, change the design, or build an about page." },
  { id: 2, title: "Why I build in public", date: "2026-08-07", body: "Sharing progress keeps me honest and moving.\\n\\nEvery week I will post one small win and one lesson learned." },
  { id: 3, title: "Tools I love", date: "2026-08-12", body: "A running list of tools that spark joy:\\n\\n1. A good todo app\\n2. Dark mode everywhere\\n3. AI agents that write the boring parts" }
];
const app = document.getElementById("app");
function showList() {
  app.innerHTML = "";
  for (const p of posts) {
    const el = document.createElement("div");
    el.className = "post card";
    el.innerHTML = "<h2>" + p.title + "</h2><div class='date'>" + p.date + "</div>";
    el.onclick = () => showPost(p);
    app.append(el);
  }
}
function showPost(p) {
  app.innerHTML = "";
  const el = document.createElement("div");
  el.className = "reader card";
  const back = document.createElement("a");
  back.className = "back";
  back.textContent = "← All posts";
  back.onclick = showList;
  el.append(back);
  el.insertAdjacentHTML("beforeend", "<h2>" + p.title + "</h2><div class='date'>" + p.date + "</div><div class='body'>" + p.body + "</div>");
  app.append(el);
}
showList();`,
    },
  },

  quiz: {
    name: "Quiz App",
    description: "Multiple-choice quiz with score and progress",
    files: {
      "index.html": `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Quick Quiz</title>
<link rel="stylesheet" href="styles.css">
</head>
<body>
<main class="container narrow">
  <h1>🧠 Quick Quiz</h1>
  <div class="bar"><div id="progress"></div></div>
  <div id="app" class="card"></div>
</main>
<script src="app.js"></script>
</body>
</html>`,
      "styles.css": `${BASE_CSS}
.narrow{max-width:520px;padding-top:48px}
.bar{height:6px;background:var(--card);border-radius:999px;margin:16px 0;overflow:hidden}
#progress{height:100%;width:0;background:linear-gradient(90deg,var(--accent),var(--accent2));transition:width .3s}
.option{display:block;width:100%;text-align:left;background:#20242d;border:1px solid #2a2e37;border-radius:12px;padding:12px 14px;color:var(--ink);font-size:15px;cursor:pointer;margin-top:10px}
.option:hover{border-color:var(--accent)}
.option.correct{border-color:#34d399;background:rgba(52,211,153,.12)}
.option.wrong{border-color:#f87171;background:rgba(248,113,113,.12)}
.score{text-align:center;padding:24px 0}
.score b{font-size:40px;display:block;margin-bottom:8px}`,
      "app.js": `const questions = [
  { q: "What language runs in every web browser?", options: ["Python", "JavaScript", "C++", "Rust"], answer: 1 },
  { q: "What does CSS stand for?", options: ["Creative Style System", "Cascading Style Sheets", "Computer Styled Sections", "Colorful Style Syntax"], answer: 1 },
  { q: "Which HTML tag makes the largest heading?", options: ["<h6>", "<head>", "<h1>", "<title>"], answer: 2 },
  { q: "What year was JavaScript created?", options: ["1989", "1995", "2001", "2010"], answer: 1 }
];
let index = 0, score = 0, locked = false;
const app = document.getElementById("app");
const progress = document.getElementById("progress");
function render() {
  progress.style.width = (index / questions.length * 100) + "%";
  if (index >= questions.length) {
    app.innerHTML = "<div class='score'><b>" + score + " / " + questions.length + "</b>" +
      (score === questions.length ? "Perfect! 🏆" : "Nice try — play again?") +
      "<br><br><button class='btn' onclick='location.reload()'>Restart</button></div>";
    progress.style.width = "100%";
    return;
  }
  const item = questions[index];
  locked = false;
  app.innerHTML = "<p class='muted'>Question " + (index + 1) + " of " + questions.length + "</p><h2>" + item.q + "</h2>";
  item.options.forEach((opt, i) => {
    const b = document.createElement("button");
    b.className = "option";
    b.textContent = opt;
    b.onclick = () => {
      if (locked) return;
      locked = true;
      if (i === item.answer) { b.classList.add("correct"); score++; }
      else { b.classList.add("wrong"); app.children[2 + item.answer].classList.add("correct"); }
      setTimeout(() => { index++; render(); }, 900);
    };
    app.append(b);
  });
}
render();`,
    },
  },
};

export function templateContentType(path: string): string {
  if (path.endsWith(".html") || path.endsWith(".htm")) return "text/html; charset=utf-8";
  if (path.endsWith(".css")) return "text/css; charset=utf-8";
  if (path.endsWith(".js") || path.endsWith(".mjs")) return "text/javascript; charset=utf-8";
  if (path.endsWith(".json")) return "application/json; charset=utf-8";
  if (path.endsWith(".md")) return "text/markdown; charset=utf-8";
  if (path.endsWith(".svg")) return "image/svg+xml";
  return "text/plain; charset=utf-8";
}
