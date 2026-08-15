/**
 * supabase/functions/agent-ask/index.ts
 * ---------------------------------------------------------------------------
 * The incognito path: answer a question and store nothing.
 *
 * Every other agent endpoint writes — a session row, a transcript, task rows,
 * files in Storage. This one deliberately writes none of that. It asks the
 * model directly and returns the answer in the response body, so the only copy
 * of an incognito conversation is the one on the user's screen.
 *
 * Consequences, which the UI states plainly:
 *   - no tools and no sandbox, so it cannot read or change project files
 *   - no history, so each request carries whatever context the client sends
 *   - usage is still metered (the tokens are real) and requests are rate
 *     limited per user, because "not stored" must not mean "not accounted for"
 * ---------------------------------------------------------------------------
 */
import { withSentryHandler } from "../../../src/infra/monitoring/sentryConfig.ts";
import { AgentAskSchema } from "../shared/zodSchemas.ts";
import { assertMethod, errorResponse, parseJson } from "../shared/errorHandler.ts";
import { corsHeaders, json, preflight } from "../shared/http.ts";
import { createServiceClient, requireUser } from "../shared/supabase.ts";
import { enforceRateLimit } from "../shared/rateLimit.ts";
import { OpenAIChatModel, resolveRequestedModel } from "../shared/agentRuntime.ts";
import { checkUsage, recordUsage } from "../shared/usage.ts";

const SYSTEM_PROMPT = [
  "You are Issac, a coding assistant, answering in an incognito chat.",
  "Nothing in this conversation is stored, and you have no tools: you cannot read,",
  "write, or run anything. Answer from the message alone.",
  "If a request needs the project's files or a command run, say so and suggest",
  "leaving incognito mode rather than guessing at file contents.",
  "Be direct and concise. Use fenced code blocks for code.",
].join(" ");

export async function handler(req: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const headers = corsHeaders(req);
  const early = preflight(req);
  if (early) return early;
  try {
    assertMethod(req, ["POST"]);
    const { user } = await requireUser(req);
    const input = await parseJson(req, AgentAskSchema);
    const service = createServiceClient();
    await enforceRateLimit(service, "agent-ask", user.id, 20, 60);
    await checkUsage(service, user.id);

    // ChatMessage carries store bookkeeping (id, createdAt) that nothing reads
    // here — there is no store — but the model interface asks for it.
    const turns = [...(input.history ?? []), { role: "user" as const, content: input.prompt }];
    const now = Date.now();
    const model = new OpenAIChatModel(resolveRequestedModel(input.model));
    const result = await model.generate({
      systemPrompt: SYSTEM_PROMPT,
      messages: turns.map((m, index) => ({
        id: `ask-${index}`,
        role: m.role,
        content: m.content,
        createdAt: now + index,
      })),
      tools: [],
    });

    // Token counts are aggregate numbers, not conversation content — metering
    // them keeps quotas honest without recording anything that was said.
    if (result.usage) {
      const tokens = (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0);
      await recordUsage(service, user.id, tokens).catch(() => {});
    }

    return json(
      {
        text: result.text ?? "",
        usage: result.usage ?? null,
        stored: false,
      },
      200,
      headers,
    );
  } catch (error) {
    return errorResponse(error, requestId, headers);
  }
}

if (import.meta.main) {
  Deno.serve(withSentryHandler("agent-ask", handler));
}
