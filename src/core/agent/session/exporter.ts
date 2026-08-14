/**
 * session/exporter.ts
 * ---------------------------------------------------------------------------
 * Export a session to a stable, frontend-friendly JSON shape for the
 * "project history" screen. Decouples the internal transcript representation
 * from what the client renders, and redacts nothing except raw secret values
 * that may have been captured in tool inputs.
 * ---------------------------------------------------------------------------
 */

import type { AgentSession, ChatMessage } from "./sessionStore.ts";

export interface ExportedToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ExportedMessage {
  id: string;
  role: ChatMessage["role"];
  text: string;
  toolCalls?: ExportedToolCall[];
  answersToolCallId?: string;
  isError?: boolean;
  at: number;
}

export interface ExportedSession {
  schemaVersion: 1;
  id: string;
  title?: string;
  parentId?: string;
  forkedFromIndex?: number;
  profile: string;
  status: string;
  createdAt: number;
  updatedAt: number;
  usage: AgentSession["usage"];
  messageCount: number;
  messages: ExportedMessage[];
}

const SECRETISH_KEYS = /(token|secret|password|api[_-]?key|authorization|credential)/i;

function redactInput(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    out[k] = SECRETISH_KEYS.test(k) && typeof v === "string" ? "«redacted»" : v;
  }
  return out;
}

export function exportSession(session: AgentSession): ExportedSession {
  return {
    schemaVersion: 1,
    id: session.id,
    title: session.title,
    parentId: session.parentId,
    forkedFromIndex: session.forkedFromIndex,
    profile: session.sandboxProfile,
    status: session.status,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    usage: session.usage,
    messageCount: session.messages.length,
    messages: session.messages.map((m) => ({
      id: m.id,
      role: m.role,
      text: m.content,
      toolCalls: m.toolCalls?.map((tc) => ({ id: tc.id, name: tc.name, input: redactInput(tc.input) })),
      answersToolCallId: m.toolCallId,
      isError: m.isError,
      at: m.createdAt,
    })),
  };
}

export function exportSessionToJson(session: AgentSession, pretty = true): string {
  return JSON.stringify(exportSession(session), null, pretty ? 2 : undefined);
}
