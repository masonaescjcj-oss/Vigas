/**
 * supabase/functions/agent-ask/index.ts
 * ---------------------------------------------------------------------------
 * Answering a question, as opposed to running the agent.
 *
 * Nothing here touches the job queue, the cron worker, or a sandbox. Those
 * exist so the agent can write files and run commands over minutes; a question
 * needs none of it, and routing one through them costs a poll cycle and a
 * container to say "yes, that's a race condition". The answer comes back in
 * the response.
 *
 * Two shapes, one path:
 *   - Chat: `projectId` (and `sessionId` after the first turn). The
 *     conversation is stored, and the recent history is read back here so the
 *     client never has to resend it.
 *   - Incognito: `history` from the client, nothing stored, no session row.
 *
 * Either way there are no tools, so this cannot read or change project files —
 * that is what Build mode is for. Usage is metered in both cases, because
 * "answered without the agent" must not mean "answered for free".
 * ---------------------------------------------------------------------------
 */
import { withSentryHandler } from "../shared/sentry.ts";
import { ASK_HISTORY_TURNS, AgentAskSchema } from "../shared/zodSchemas.ts";
import { AppError, assertMethod, errorResponse, parseJson } from "../shared/errorHandler.ts";
import { corsHeaders, json, preflight } from "../shared/http.ts";
import { skillPromptFor } from "../../../src/core/agent/skills/catalog.ts";
import { createServiceClient, requireUser } from "../shared/supabase.ts";
import { enforceRateLimit } from "../shared/rateLimit.ts";
import { OpenAIChatModel, assertProjectOwner, resolveRequestedModel } from "../shared/agentRuntime.ts";
import { recordUsage } from "../shared/usage.ts";
import { resolveProvider } from "../shared/resolveProvider.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

interface Turn {
  role: "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT = [
  "You are Issac, a coding assistant, answering a question in chat.",
  "You have no tools in this mode: you cannot read, write, or run anything.",
  "Answer from the conversation alone.",
  "If a request needs the project's files or a command run, say so and suggest",
  "switching to Build mode rather than guessing at file contents.",
  "Be direct and concise. Use fenced code blocks for code.",
].join(" ");

/**
 * Follow-up suggestions cost one line of prompt and a handful of output
 * tokens, because they come back with the answer instead of in a second call.
 * The model already has the conversation in front of it — that is the whole
 * "algorithm".
 */
const FOLLOW_UP_MARKER = "###FOLLOWUPS###";
const FOLLOW_UP_PROMPT = [
  `After your answer, output the line ${FOLLOW_UP_MARKER} and then up to 3`,
  "follow-up questions the user is most likely to ask next, one per line,",
  "no numbering or bullets. Each under 60 characters, phrased as the user",
  "would type them. Omit the marker entirely if none would genuinely help.",
].join(" ");

/** Split the answer from the suggestions, tolerating a model that skips them. */
export function splitFollowUps(raw: string): { text: string; followUps: string[] } {
  const at = raw.indexOf(FOLLOW_UP_MARKER);
  if (at === -1) return { text: raw.trim(), followUps: [] };

  const text = raw.slice(0, at).trim();
  const followUps = raw
    .slice(at + FOLLOW_UP_MARKER.length)
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter((line) => line.length > 0 && line.length <= 120)
    .slice(0, 3);

  // A model that emitted the marker and nothing usable must not leave the
  // answer truncated to nothing.
  return { text: text || raw.trim(), followUps };
}

const INCOGNITO_NOTE =
  "This conversation is not stored anywhere, so you have only the messages in this request.";

/** Only the plain user/assistant turns; tool rows are not conversation. */
function conversationTurns(transcript: unknown): Turn[] {
  if (!Array.isArray(transcript)) return [];
  return transcript
    .filter((m): m is Turn =>
      !!m && typeof m === "object" &&
      ((m as Turn).role === "user" || (m as Turn).role === "assistant") &&
      typeof (m as Turn).content === "string" && (m as Turn).content.length > 0)
    .map((m) => ({ role: m.role, content: m.content }));
}

/**
 * Load the chat, or start one. Returns the session id and the recent turns —
 * the window is applied here so a long chat cannot quietly grow the cost of
 * every message.
 */
async function loadChat(
  service: SupabaseClient,
  userId: string,
  projectId: string,
  sessionId: string | undefined,
  title: string | undefined,
): Promise<{ sessionId: string; history: Turn[] }> {
  if (!sessionId) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const { error } = await service.from("agent_sessions").insert({
      id,
      project_id: projectId,
      user_id: userId,
      status: "active",
      model_provider: "openai",
      profile: "readonly", // no tools reach this path, and the row should say so
      title: title ?? null,
      transcript: [],
      created_at: now,
      updated_at: now,
    });
    if (error) throw error;
    return { sessionId: id, history: [] };
  }

  const { data, error } = await service
    .from("agent_sessions")
    .select("id,transcript")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new AppError(404, "SESSION_NOT_FOUND", "Chat was not found.");

  return {
    sessionId: data.id,
    history: conversationTurns(data.transcript).slice(-ASK_HISTORY_TURNS),
  };
}

/** Append the exchange. The transcript is the whole chat; only context is windowed. */
async function appendTurns(
  service: SupabaseClient,
  sessionId: string,
  prompt: string,
  answer: string,
): Promise<void> {
  const { data, error } = await service
    .from("agent_sessions").select("transcript").eq("id", sessionId).maybeSingle();
  if (error) throw error;
  const now = Date.now();
  const transcript = [
    ...(Array.isArray(data?.transcript) ? data!.transcript : []),
    { id: `ask-u-${now}`, role: "user", content: prompt, createdAt: now },
    { id: `ask-a-${now}`, role: "assistant", content: answer, createdAt: now + 1 },
  ];
  const { error: saveError } = await service
    .from("agent_sessions")
    .update({ transcript, status: "active", updated_at: new Date().toISOString() })
    .eq("id", sessionId);
  if (saveError) throw saveError;
}

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
    // Questions are unmetered on purpose: they cost tokens and nothing else,
    // and a chat that stops mid-thought is a worse product than a cheap one.

    const stored = !!input.projectId;
    let sessionId: string | null = null;
    let history: Turn[];

    if (input.projectId) {
      await assertProjectOwner(service, user.id, input.projectId);
      const chat = await loadChat(service, user.id, input.projectId, input.sessionId, input.title);
      sessionId = chat.sessionId;
      history = chat.history;
    } else {
      history = (input.history ?? []).slice(-ASK_HISTORY_TURNS);
    }

    // ChatMessage carries store bookkeeping (id, createdAt) that nothing reads
    // here, but the model interface asks for it.
    const turns: Turn[] = [...history, { role: "user", content: input.prompt }];
    const stamp = Date.now();
    // A user who brought their own provider pays for their own tokens, so
    // theirs is used. The key is decrypted here and never leaves this scope.
    const credentials = await resolveProvider(service, user.id);
    const model = new OpenAIChatModel(resolveRequestedModel(input.model), credentials);
    const result = await model.generate({
      systemPrompt: [
        SYSTEM_PROMPT,
        stored ? "" : INCOGNITO_NOTE,
        FOLLOW_UP_PROMPT,
        // Chat gets skills too: "how should this landing page be laid out" is the
        // same question whether or not files end up written.
        skillPromptFor(input.skills),
      ].filter(Boolean).join(" "),
      messages: turns.map((m, index) => ({
        id: `ask-${index}`,
        role: m.role,
        content: m.content,
        createdAt: stamp + index,
      })),
      tools: [],
    });
    // The suggestions are not part of the answer: they are stripped before the
    // transcript is written, so a later turn never sees the marker block.
    const { text, followUps } = splitFollowUps(result.text ?? "");

    if (sessionId) await appendTurns(service, sessionId, input.prompt, text);

    // Token counts are aggregate numbers, not conversation content — metering
    // them keeps quotas honest without recording anything that was said.
    if (result.usage) {
      const tokens = (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0);
      await recordUsage(service, user.id, tokens).catch(() => {});
    }

    return json(
      {
        text,
        follow_ups: followUps,
        usage: result.usage ?? null,
        stored,
        // Which credentials answered, so the UI can show it. Never the key.
        provider: credentials.label ?? null,
        session_id: sessionId,
        // How many past turns the model actually saw, so the UI can be honest
        // about the memory window instead of implying it is unlimited.
        context_turns: history.length,
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
