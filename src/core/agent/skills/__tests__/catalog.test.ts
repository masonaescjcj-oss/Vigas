/**
 * A skill's text is appended to the system prompt of an agent that can write files
 * and run commands, so the ids the client sends are untrusted input. The rest is
 * about the prompt staying honest: a skill must not be able to override what the
 * user actually asked for, and it must not tell the agent to invent content.
 */
import { describe, expect, it } from "vitest";
import { SKILLS, SKILL_IDS, skillPromptFor, skillsById } from "../catalog";

describe("the catalog itself", () => {
  it("has no duplicate ids, since one id must map to one skill", () => {
    expect(new Set(SKILL_IDS).size).toBe(SKILLS.length);
  });

  it("gives every skill something to show in the picker", () => {
    for (const skill of SKILLS) {
      expect(skill.name.length, skill.id).toBeGreaterThan(2);
      expect(skill.description.length, skill.id).toBeGreaterThan(10);
      expect(skill.icon.length, skill.id).toBeGreaterThan(1);
      expect(skill.prompt.trim().length, skill.id).toBeGreaterThan(80);
    }
  });

  it("keeps each skill short enough to not bury the user's request", () => {
    // A skill competes for attention with the actual prompt. Roughly 400 words is
    // the ceiling where it still reads as guidance rather than a spec.
    for (const skill of SKILLS) {
      const words = skill.prompt.trim().split(/\s+/).length;
      expect(words, `${skill.id} is ${words} words`).toBeLessThan(400);
    }
  });

  it("uses only icons the app can actually render", () => {
    // A missing icon name renders as nothing, so the picker row would look broken.
    const available = [
      "globe", "sparkles", "mobile", "cloud", "edit", "drive", "type",
      "code", "zap", "layers", "shield", "puzzle", "file-text",
    ];
    for (const skill of SKILLS) {
      expect(available, skill.id).toContain(skill.icon);
    }
  });
});

describe("skillsById", () => {
  it("returns the requested skills", () => {
    expect(skillsById(["landing-page"]).map((s) => s.id)).toEqual(["landing-page"]);
  });

  it("ignores an id it does not know", () => {
    // The ids arrive from a client. An unknown one must be dropped, never used to
    // reach anything else.
    expect(skillsById(["landing-page", "not-a-skill"]).map((s) => s.id)).toEqual(["landing-page"]);
    expect(skillsById(["../../etc/passwd"])).toEqual([]);
    expect(skillsById(["__proto__"])).toEqual([]);
  });

  it("returns nothing for nothing", () => {
    expect(skillsById([])).toEqual([]);
    expect(skillsById(undefined)).toEqual([]);
  });

  it("returns catalog order, not the order asked for", () => {
    // So two clients requesting the same set produce the same prompt, which keeps
    // the provider's prompt cache useful.
    const a = skillsById(["visual-polish", "landing-page"]).map((s) => s.id);
    const b = skillsById(["landing-page", "visual-polish"]).map((s) => s.id);
    expect(a).toEqual(b);
  });
});

describe("skillPromptFor", () => {
  it("adds nothing at all when no skill is chosen", () => {
    // Every request pays for this string, so it must be empty rather than a header
    // with nothing under it.
    expect(skillPromptFor([])).toBe("");
    expect(skillPromptFor(undefined)).toBe("");
    expect(skillPromptFor(["nope"])).toBe("");
  });

  it("includes the chosen skill's text", () => {
    const prompt = skillPromptFor(["landing-page"]);
    expect(prompt).toContain("Landing page");
    expect(prompt).toContain("one action");
  });

  it("keeps the user's request above the skill", () => {
    // Without this a skill silently overrides what was asked for.
    const prompt = skillPromptFor(["landing-page"]);
    expect(prompt).toMatch(/do what the user asked/i);
  });

  it("only includes what was chosen", () => {
    const prompt = skillPromptFor(["rtl-persian"]);
    expect(prompt).toMatch(/right-to-left/i);
    // And nothing the user did not ask for: every unchosen skill is tokens they
    // would be paying for on every turn.
    expect(prompt).not.toContain("Deployable anywhere");
    expect(prompt).not.toContain("Landing page");
  });

  it("combines several skills without losing any", () => {
    const prompt = skillPromptFor(["landing-page", "mobile-first", "visual-polish"]);
    for (const name of ["Landing page", "Mobile first", "Make it look good"]) {
      expect(prompt).toContain(name);
    }
  });
});

describe("what the skills tell the agent", () => {
  /**
   * The prompts are hard-wrapped for readability, so a phrase can straddle a line
   * break. These assertions are about meaning, not layout.
   */
  const said = (id: string) => SKILLS.find((s) => s.id === id)!.prompt.replace(/\s+/g, " ");

  it("never tells it to invent proof or numbers", () => {
    // The de-faking sweep removed invented testimonials and metrics from our own
    // UI; a skill must not put them back into what users ship.
    expect(said("landing-page")).toMatch(/never invent/i);
  });

  it("refuses a service role key rather than placing it in a page", () => {
    expect(said("supabase-backend")).toMatch(/service role key must never appear/i);
    // And says the anon key alone is not security, which is the mistake that
    // actually leaks people's data.
    expect(said("supabase-backend")).toMatch(/anon key alone is not security/i);
  });

  it("tells the agent to say when a form is not connected", () => {
    expect(said("form-that-works")).toMatch(/not connected rather than faking/i);
  });
});
