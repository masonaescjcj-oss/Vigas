/**
 * frontend/src/core/agent/skills/catalog.ts
 * ---------------------------------------------------------------------------
 * Skills: extra instructions the user can switch on for a run.
 *
 * The agent is general, so on any given prompt it has to guess what "good" means.
 * A skill removes the guess for one kind of work — what a landing page needs, what
 * makes a form usable, how to keep output deployable as static files. It is the
 * cheapest quality lever available: a few hundred tokens, only when chosen.
 *
 * WHY THESE ARE WRITTEN HERE RATHER THAN INSTALLED FROM skills.sh
 *
 * skills.sh is a real registry (1.2M skills, `npx skills add owner/repo`), and the
 * format is just a SKILL.md injected into a system prompt. That is exactly the
 * problem: a skill is arbitrary instructions from a public repo, fed to an agent
 * that holds `write`, `edit` and `bash` over someone's project. Installing one is
 * accepting a prompt injection on purpose. So the built-in set is ours, written and
 * reviewed here, and third-party skills are a separate, opt-in decision — see
 * EXTERNAL_SKILLS below, which links rather than vendors.
 *
 * Shared deliberately: the edge functions import this to build the system prompt
 * and the app imports it to draw the picker, so the list cannot drift between what
 * a user chose and what the agent was told.
 * ---------------------------------------------------------------------------
 */

export interface Skill {
  id: string;
  /** Shown in the picker. */
  name: string;
  /** One line: what turning this on changes about the result. */
  description: string;
  /** An `Icon` name. */
  icon: string;
  /** Appended to the system prompt when chosen. */
  prompt: string;
}

/**
 * Kept short on purpose. A skill competes for the model's attention with the
 * user's actual request, and a thousand words of advice buries it.
 */
export const SKILLS: Skill[] = [
  {
    id: "landing-page",
    name: "Landing page",
    description: "One-page site that leads to a single action.",
    icon: "globe",
    prompt: `The user wants a landing page. Build one page that leads to one action.

- Open with a specific claim, not a slogan. "Track every invoice in one place"
  beats "Welcome to our platform". If the user has not said what the product does,
  use their words rather than inventing marketing language.
- One primary action, repeated at most twice. Every extra button costs the first one.
- Order: what it is, why it helps, proof, the action. Skip any section you have
  nothing real to put in — an empty testimonial block is worse than no testimonials.
- Never invent logos, customer names, review quotes, star ratings or numbers. If a
  section needs content the user has not given, leave a visible placeholder that
  says what belongs there.`,
  },
  {
    id: "visual-polish",
    name: "Make it look good",
    description: "Spacing, type scale and colour that look deliberate.",
    icon: "sparkles",
    prompt: `Treat visual quality as part of the task, not decoration.

- Pick one accent colour and one neutral ramp. Two accents look like an accident.
- Use a spacing scale (4/8/12/16/24/32/48) rather than arbitrary pixel values, and
  give sections room — cramped padding is the most common reason a page looks unfinished.
- Set a type scale with real contrast: a heading should be clearly larger than body,
  not 2px larger. Line height around 1.5 for body text, tighter for headings.
- Limit body text to roughly 60-75 characters per line.
- Respect the reader: sufficient contrast, a visible focus style on anything
  interactive, and no text over a busy image without a scrim.
- Prefer system fonts unless the user asked for something specific; a webfont that
  has not loaded is worse than a system font that has.`,
  },
  {
    id: "mobile-first",
    name: "Mobile first",
    description: "Built for a phone screen, then widened.",
    icon: "mobile",
    prompt: `This will be looked at on a phone first. Design for a 375px-wide screen
and let it widen, not the reverse.

- Start with a single column. Add columns only at a breakpoint where they fit.
- Nothing may cause horizontal page scrolling. Wide things — tables, code, diagrams —
  scroll inside their own container.
- Tap targets at least 44px, with real space between them. A row of small links side
  by side is unusable with a thumb.
- Include <meta name="viewport" content="width=device-width,initial-scale=1">.
- Do not rely on hover to reveal anything; there is no hover on a touch screen.
- Keep the primary action reachable without scrolling on a short screen.`,
  },
  {
    id: "static-deployable",
    name: "Deployable anywhere",
    description: "Plain static files, no build step needed.",
    icon: "cloud",
    prompt: `The result must work as plain static files dropped on any host, because
that is how it gets published.

- index.html at the root. Relative paths only — a leading "/" breaks on a subpath.
- No build step and no bundler. If a library is genuinely needed, load it from a
  CDN with a pinned version.
- Nothing that needs a process running. Data that has to outlive the tab belongs
  in a hosted backend the page calls — Supabase from the browser — not in a
  server you would have to keep up.
- No environment variables and no secrets in the page. A publishable key like a
  Supabase anon key is fine and is meant to be public; anything else is not, so
  do not put it here and do not pretend it is hidden.
- Keep it to a handful of files. Inline small CSS and JS rather than scattering them.
- It must open correctly from a file:// URL as well as over http.`,
  },
  {
    id: "form-that-works",
    name: "Forms that work",
    description: "Real validation, real error messages, keyboard-friendly.",
    icon: "edit",
    prompt: `Build the form so it can actually be completed and submitted.

- A real <form> with a submit button, so Enter works and password managers see it.
- Every field has a <label> tied to it. Placeholder text is not a label; it vanishes.
- Correct types and autocomplete: type="email", inputmode="numeric",
  autocomplete="name" / "email" / "new-password". On a phone this decides which
  keyboard appears.
- Validate on submit, not on every keystroke. Say what is wrong and how to fix it,
  next to the field — "Enter an email address like name@example.com", never "Invalid".
- Show progress on submit and disable the button, so it cannot be pressed twice.
- Say plainly what happens to the data. If there is no backend yet, say the form is
  not connected rather than faking a success message.`,
  },
  {
    id: "supabase-backend",
    name: "Connect Supabase",
    description: "Auth and a table, with the security rules that make it safe.",
    icon: "drive",
    prompt: `Wire the page to Supabase using the browser client.

- Load @supabase/supabase-js from a CDN and create the client with the project URL
  and the anon (publishable) key. The anon key is meant to be public; the service
  role key must never appear in a page — if the user pastes one, refuse it and say why.
- The anon key alone is not security. Every table this touches needs Row Level
  Security enabled and a policy scoped to auth.uid(). Write the SQL for it and show
  it to the user; without it the table is world-readable.
- For sign-in prefer a magic link or OAuth over passwords.
- Handle the three states of every call — loading, empty, failed — and show the real
  error message rather than swallowing it.
- Never invent the project URL or key. Ask for them, or leave clearly marked
  placeholders.`,
  },
  {
    id: "rtl-persian",
    name: "Persian / RTL",
    description: "Right-to-left layout that reads correctly.",
    icon: "type",
    prompt: `The content is Persian or Arabic. Right-to-left is a layout decision, not
just a text direction.

- <html lang="fa" dir="rtl">. Then use logical properties — margin-inline-start,
  padding-inline-end, inset-inline — so the layout mirrors instead of being patched.
- Keep numbers, code, URLs and Latin product names left-to-right inside the flow;
  wrap them in <span dir="ltr"> where they would otherwise scramble punctuation.
- Use a font with real Persian coverage (Vazirmatn is a good default) and give it a
  slightly taller line height than a Latin face needs — Persian ascenders and
  descenders are deeper.
- Mirror anything directional: a "next" arrow points left in RTL.
- Do not mirror clocks, media controls, or logos.`,
  },
];

export const SKILL_IDS = SKILLS.map((skill) => skill.id);

/** Ignores anything unknown, so a stale client cannot inject arbitrary text. */
export function skillsById(ids: readonly string[] | undefined): Skill[] {
  if (!ids?.length) return [];
  const wanted = new Set(ids);
  return SKILLS.filter((skill) => wanted.has(skill.id));
}

/**
 * The chosen skills as one block to append to the system prompt.
 *
 * Framed as guidance rather than orders: the user's actual request has to keep
 * priority, or a skill starts overriding what they asked for.
 */
export function skillPromptFor(ids: readonly string[] | undefined): string {
  const chosen = skillsById(ids);
  if (!chosen.length) return "";
  const sections = chosen.map((skill) => `## ${skill.name}\n${skill.prompt.trim()}`);
  return [
    "",
    "# Skills the user switched on for this request",
    "Apply these where they are relevant. If one conflicts with what the user asked",
    "for, do what the user asked and say why you did not follow the skill.",
    "",
    ...sections,
  ].join("\n");
}

/**
 * Reputable third-party skills, linked rather than vendored.
 *
 * Their text is not copied here: it is someone else's work under someone else's
 * licence, and it would also mean shipping instructions we have not reviewed line
 * by line into an agent with write access. This list exists so the choice is
 * informed — install counts as of August 2026.
 */
export const EXTERNAL_SKILLS = [
  {
    name: "frontend-design",
    author: "anthropics",
    installs: "789K",
    url: "https://www.skills.sh/skills/anthropics/frontend-design",
    why: "The closest external equivalent to our visual-polish skill; worth reading before extending ours.",
  },
  {
    name: "grill-me",
    author: "mattpocock",
    installs: "890K",
    url: "https://www.skills.sh/skills/mattpocock/grill-me",
    why: "Makes an agent interrogate its own assumptions before writing. Interesting for Build mode.",
  },
] as const;
