/**
 * frontend/src/core/agent/clarify.ts
 * ---------------------------------------------------------------------------
 * Asking the user something before building, instead of guessing.
 *
 * On a phone the prompt is short — "make me a shop app" — because typing a
 * paragraph on a touch keyboard is miserable. Guessing the rest is the single
 * biggest cause of a build that comes back wrong, and the cost of being wrong
 * is a whole run.
 *
 * So the agent may stop and ask. Tapping three options is *easier* on a phone
 * than typing, which makes this one of the few places where the small screen is
 * an advantage rather than something to work around.
 *
 * Pure: the shapes and the validation, no runtime and no React, so both the
 * agent tool and the chat UI can depend on it and it can be tested directly.
 * ---------------------------------------------------------------------------
 */

/** How many questions one round may contain. More than this is an interrogation. */
export const MAX_QUESTIONS = 3;
/** Options the agent supplies, before "something else" is appended. */
export const MAX_OPTIONS = 4;
export const MIN_OPTIONS = 2;

export interface ClarifyOption {
  label: string;
  /** What choosing it means. Shown under the label; keeps labels short. */
  description?: string;
}

export interface ClarifyQuestion {
  /** A word or two for the chip above the question, e.g. "Style". */
  header: string;
  question: string;
  options: ClarifyOption[];
}

export interface ClarifyRequest {
  questions: ClarifyQuestion[];
}

/**
 * The escape hatch, appended to every question.
 *
 * Three options are a guess at the answer space, and the user's actual answer is
 * routinely outside it. Without this the choice is between a wrong option and
 * abandoning the flow — so it is added here rather than left to the agent to
 * remember, and it cannot be turned off.
 */
export const OTHER_OPTION: ClarifyOption = {
  label: "Something else",
  description: "Say it in your own words",
};

export interface ClarifyAnswer {
  header: string;
  question: string;
  /** The chosen label, or whatever the user typed for "Something else". */
  answer: string;
}

function trimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Check and normalise what the model asked for.
 *
 * Returns a reason instead of throwing: a malformed tool call should come back
 * to the model as a correctable message, not fail the user's whole run.
 */
export function parseClarifyRequest(
  input: unknown,
): { ok: true; request: ClarifyRequest } | { ok: false; reason: string } {
  const raw = (input as { questions?: unknown })?.questions;
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, reason: "Provide a `questions` array with at least one question." };
  }
  if (raw.length > MAX_QUESTIONS) {
    return {
      ok: false,
      reason: `Ask at most ${MAX_QUESTIONS} questions at once. Ask the rest after these are answered.`,
    };
  }

  const questions: ClarifyQuestion[] = [];
  for (const [index, entry] of raw.entries()) {
    const question = trimmed((entry as ClarifyQuestion)?.question);
    const header = trimmed((entry as ClarifyQuestion)?.header) || `Question ${index + 1}`;
    if (!question) return { ok: false, reason: `Question ${index + 1} has no text.` };

    const rawOptions = (entry as ClarifyQuestion)?.options;
    if (!Array.isArray(rawOptions)) {
      return { ok: false, reason: `Question ${index + 1} has no options array.` };
    }

    // Deduplicated by label: two identical choices read as a bug to the user,
    // and a model repeating itself is exactly how that happens.
    const seen = new Set<string>();
    const options: ClarifyOption[] = [];
    for (const option of rawOptions) {
      const label = trimmed((option as ClarifyOption)?.label);
      if (!label) continue;
      const key = label.toLowerCase();
      if (seen.has(key) || key === OTHER_OPTION.label.toLowerCase()) continue;
      seen.add(key);
      options.push({ label, description: trimmed((option as ClarifyOption)?.description) || undefined });
    }

    if (options.length < MIN_OPTIONS) {
      return {
        ok: false,
        reason: `Question ${index + 1} needs at least ${MIN_OPTIONS} distinct options.`,
      };
    }
    questions.push({ header, question, options: options.slice(0, MAX_OPTIONS) });
  }

  return { ok: true, request: { questions } };
}

/** The options as shown, with the escape hatch last. */
export function optionsFor(question: ClarifyQuestion): ClarifyOption[] {
  return [...question.options, OTHER_OPTION];
}

/**
 * Turn the answers into the message that continues the run.
 *
 * Sent as the next user turn, so the agent sees the answers as something the
 * user said rather than as tool output it might argue with. Questions the user
 * skipped are named as skipped instead of dropped — silence and "no preference"
 * are different, and the agent should know which it got.
 */
export function formatAnswers(request: ClarifyRequest, answers: ClarifyAnswer[]): string {
  const byQuestion = new Map(answers.map((entry) => [entry.question, entry.answer]));
  const lines = request.questions.map((question) => {
    const answer = trimmed(byQuestion.get(question.question));
    return `- ${question.header}: ${answer || "(skipped — decide for me)"}`;
  });
  return `Answers to your questions:\n${lines.join("\n")}\n\nGo ahead and build it.`;
}
