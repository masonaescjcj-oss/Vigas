/**
 * scripts/check-skills.ts
 * ---------------------------------------------------------------------------
 * A skill is text appended to the system prompt of an agent with write and bash
 * tools, so two things have to be true and neither is visible from the code alone:
 *
 *   - a skill the user chose actually changes the answer
 *   - an id the user did not choose contributes nothing, and an id nobody defined
 *     contributes nothing at all
 *
 * Asks the real provider twice with the same question, once with a skill and once
 * without, and compares. Costs a few hundred tokens.
 *
 *   npx deno run --allow-all --env-file=.env scripts/check-skills.ts
 * ---------------------------------------------------------------------------
 */
import { SKILLS, skillPromptFor, skillsById } from "../src/core/agent/skills/catalog.ts";

const BASE = (Deno.env.get("OPENAI_BASE_URL") ?? "https://api.openai.com/v1").replace(/\/+$/, "");
const KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const MODEL = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o";

function check(label: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n      ${String(detail).slice(0, 400)}`}`);
  if (!ok) Deno.exitCode = 1;
}

// ── The parts that need no network.
check(`the catalog is populated (${SKILLS.length} skills)`, SKILLS.length >= 5);
check("an unknown id contributes nothing", skillPromptFor(["totally-made-up"]) === "");
check("an id nobody chose is absent", !skillPromptFor(["rtl-persian"]).includes("Deployable anywhere"));
check("choosing nothing costs nothing", skillPromptFor([]) === "");

const rtl = skillsById(["rtl-persian"])[0];
check("a chosen skill resolves to its own text", rtl?.prompt.includes("dir=\"rtl\""), rtl?.id);

if (!KEY) {
  console.log("SKIP  the model half (OPENAI_API_KEY is not set)");
  Deno.exit(Deno.exitCode ?? 0);
}

async function ask(systemPrompt: string, prompt: string): Promise<string> {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      // Bounded on purpose: a whole page takes long enough to time out, and the
      // opening tags are where the skill's effect is observable anyway.
      max_tokens: 220,
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(120_000),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
  return String(data?.choices?.[0]?.message?.content ?? "");
}

const BASE_PROMPT = "You write single-file web pages. Reply with only code, no prose.";
/**
 * Deliberately English. An earlier version asked for a *Persian* bakery, and the
 * control answer then contained dir="rtl" all on its own — the question was doing
 * the work the skill was being credited for. The script failed itself and said so,
 * which is the only reason it is written this way now.
 */
const QUESTION =
  "For a bakery called Sangak: give only the doctype, the <html> tag with its " +
  "attributes, and the <head> contents. Stop after </head>.";

const SKILL_SET = ["rtl-persian", "mobile-first"];

const withSkill = await ask(BASE_PROMPT + skillPromptFor(SKILL_SET), QUESTION);
const withoutSkill = await ask(BASE_PROMPT, QUESTION);

check(`the model answered with the skills on (${withSkill.length} chars)`, withSkill.length > 40, withSkill.slice(0, 200));
check(`and without (${withoutSkill.length} chars)`, withoutSkill.length > 40, withoutSkill.slice(0, 200));

/**
 * The load-bearing assertion, and the only one that does not depend on the model
 * behaving a particular way: same model, same question, temperature 0. If the two
 * answers are identical then the skill text never reached the provider, which is
 * exactly the wiring failure worth catching.
 */
check(
  "the same question answers differently once a skill is added, so the text reaches the model",
  withSkill.trim() !== withoutSkill.trim(),
  "identical answers: the skill prompt is not arriving",
);

// Supporting evidence: the skills asked for two specific, checkable things.
const rtlOn = /dir\s*=\s*["']rtl["']/i.test(withSkill);
const viewportOn = /name\s*=\s*["']viewport["']/i.test(withSkill);
check('the rtl skill asked for dir="rtl" and got it', rtlOn, withSkill.slice(0, 300));
check("the mobile-first skill's viewport meta is present", viewportOn, withSkill.slice(0, 300));

// Reported, not asserted. A well-behaved model may do the right thing unprompted,
// and that is not a failure — but pretending it proves the skill would be.
const rtlControl = /dir\s*=\s*["']rtl["']/i.test(withoutSkill);
const viewportControl = /name\s*=\s*["']viewport["']/i.test(withoutSkill);
console.log(`
      control (no skills) already had: rtl=${rtlControl}, viewport=${viewportControl}`);
console.log("      Where a control matches, that check is weak evidence on its own —");
console.log("      the difference assertion above is what proves the wiring.");
