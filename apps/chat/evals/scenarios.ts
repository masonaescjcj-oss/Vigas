/**
 * evals/scenarios.ts
 * ---------------------------------------------------------------------------
 * Mini-eval scenarios for the agent runtime. Each scenario seeds a clean
 * workspace, sends one prompt, then checks the resulting files / final text
 * programmatically. Keep checks deterministic — no LLM judging.
 * ---------------------------------------------------------------------------
 */

export interface EvalScenario {
  id: string;
  prompt: string;
  seed?: Record<string, string>;
  /** Returns null on pass, otherwise a short failure reason. */
  check: (files: Record<string, string>, finalText: string) => string | null;
}

const SEED_INDEX = `<!doctype html>
<html><head><meta charset="utf-8"><title>Seed</title></head>
<body><h1>Old Title</h1><p>Hello.</p></body></html>`;

const SEED_POSTS_JS = `const posts = [
  { id: 1, title: "First post", body: "Hello world" },
  { id: 2, title: "Second post", body: "More words" }
];
`;

export const SCENARIOS: EvalScenario[] = [
  {
    id: "create-exact-file",
    prompt: 'Create a file named hello.txt containing exactly this text: Hello Eval',
    check: (f) =>
      f["hello.txt"]?.trim() === "Hello Eval" ? null : `hello.txt = ${JSON.stringify(f["hello.txt"])}`,
  },
  {
    id: "edit-heading",
    prompt: 'In index.html, change the h1 heading text from "Old Title" to "New Shiny Title". Change nothing else.',
    seed: { "index.html": SEED_INDEX },
    check: (f) => {
      const html = f["index.html"] ?? "";
      if (!html.includes("New Shiny Title")) return "new title missing";
      if (html.includes("Old Title")) return "old title still present";
      return null;
    },
  },
  {
    id: "add-css-and-link",
    prompt: 'Create styles.css that sets the body background to #222233, and add a <link> to it in the head of index.html.',
    seed: { "index.html": SEED_INDEX },
    check: (f) => {
      const css = (f["styles.css"] ?? "").toLowerCase();
      if (!css.includes("#222233")) return "styles.css missing #222233";
      if (!(f["index.html"] ?? "").includes("styles.css")) return "index.html not linked";
      return null;
    },
  },
  {
    id: "counter-app",
    prompt: "Create counter.html: a page with a button and a number starting at 0 that increments each time the button is clicked. Plain JavaScript only (inline <script> is fine).",
    check: (f) => {
      const html = f["counter.html"] ?? "";
      if (!html) return "counter.html missing";
      const js = html + (f["counter.js"] ?? "") + (f["app.js"] ?? "");
      if (!/<button/i.test(html)) return "no button";
      if (!/(addEventListener|onclick)/i.test(js)) return "no click handler";
      return null;
    },
  },
  {
    id: "read-only-answer",
    prompt: "Read notes.txt and tell me the launch code. Do not create or modify any files.",
    seed: { "notes.txt": "Reminder: water the plants.\nThe launch code is 7431.\nBuy milk." },
    check: (f, finalText) => {
      if (!finalText.includes("7431")) return "final text lacks 7431";
      if (Object.keys(f).some((k) => k !== "notes.txt")) return "unexpected files created";
      return null;
    },
  },
  {
    id: "extend-data-array",
    prompt: 'In app.js, add a third post to the posts array with title "Eval Day" and any short body. Keep the existing posts unchanged.',
    seed: { "app.js": SEED_POSTS_JS },
    check: (f) => {
      const js = f["app.js"] ?? "";
      if (!js.includes("Eval Day")) return "new post missing";
      if (!js.includes("First post") || !js.includes("Second post")) return "existing posts damaged";
      return null;
    },
  },
  {
    id: "emoji-precision-edit",
    prompt: 'In index.html change the heading text "Quick Quiz" to "Retro Quiz Night" but keep the emoji in place.',
    seed: { "index.html": SEED_INDEX.replace("<h1>Old Title</h1>", "<h1>🧠 Quick Quiz</h1>") },
    check: (f) => {
      const html = f["index.html"] ?? "";
      if (!html.includes("🧠")) return "emoji lost";
      if (!html.includes("Retro Quiz Night")) return "new heading missing";
      return null;
    },
  },
  {
    id: "valid-json-config",
    prompt: 'Create config.json — valid JSON with exactly two keys: "appName" set to "Retro" and "version" set to "1.0.0".',
    check: (f) => {
      try {
        const parsed = JSON.parse(f["config.json"] ?? "");
        if (parsed.appName !== "Retro") return "appName wrong";
        if (parsed.version !== "1.0.0") return "version wrong";
        return null;
      } catch {
        return "config.json is not valid JSON";
      }
    },
  },
  {
    id: "count-files",
    prompt: "How many .txt files does this project contain? Answer with the number. Do not create or modify any files.",
    seed: { "a.txt": "alpha", "b.txt": "beta", "c.txt": "gamma", "index.html": SEED_INDEX },
    check: (f, finalText) => {
      if (!/\b3\b|\bthree\b/i.test(finalText)) return `final text lacks the count: ${finalText.slice(0, 80)}`;
      return null;
    },
  },
  {
    id: "targeted-css-change",
    prompt: "In styles.css, change the body text color from red to #00ff88. Change nothing else.",
    seed: {
      "index.html": SEED_INDEX,
      "styles.css": "body { color: red; font-size: 16px; }\nh1 { margin: 0; }\n",
    },
    check: (f) => {
      const css = (f["styles.css"] ?? "").toLowerCase();
      if (!css.includes("#00ff88")) return "new color missing";
      if (/color:\s*red/.test(css)) return "old color still present";
      if (!css.includes("font-size: 16px")) return "unrelated rule damaged";
      return null;
    },
  },
  {
    id: "two-file-feature",
    prompt: 'Create about.html (a short About page with an h1 "About Us") and add a link to it ( <a href="about.html"> ) inside the body of index.html.',
    seed: { "index.html": SEED_INDEX },
    check: (f) => {
      if (!/<h1>[^<]*About Us[^<]*<\/h1>/i.test(f["about.html"] ?? "")) return "about.html h1 missing";
      if (!(f["index.html"] ?? "").includes('about.html')) return "index.html link missing";
      return null;
    },
  },
];
