import { NextResponse } from 'next/server';
import { z } from 'zod';
import { costMicros as computeTokenCostMicros } from '@vigas/core';
import { getRequestAuth } from '@/lib/auth';
import { apiError, rateLimit, readJson } from '@/lib/http';
import {
  debitPromoWallet,
  readPromoWalletFromRequest,
  setPromoWalletCookie,
  verifySupabaseBearerUser,
} from '@/lib/welcome-wallet';

const turnSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(32_000),
});

const requestSchema = z.object({
  prompt: z.string().trim().min(1).max(32_000),
  model: z.string().trim().min(1).max(160).optional(),
  history: z.array(turnSchema).max(24).optional(),
  skills: z.array(z.string().max(64)).max(12).optional(),
});

interface DirectModelSpec {
  id: string;
  provider: 'google' | 'sevenapi';
  upstreamModel: string;
  fallbackUpstreamModels?: readonly string[];
  inputPerMillionMicros: number;
  outputPerMillionMicros: number;
  free: boolean;
}

const DIRECT_MODELS: Record<string, DirectModelSpec> = {
  'google/gemini-4-hydrogen:free': {
    id: 'google/gemini-4-hydrogen:free',
    provider: 'google',
    upstreamModel: 'gemini-4-hydrogen',
    fallbackUpstreamModels: ['gemini-3.5-flash', 'gemini-2.5-flash'],
    inputPerMillionMicros: 0,
    outputPerMillionMicros: 0,
    free: true,
  },
  'google/gemini-4-hydrogen': {
    id: 'google/gemini-4-hydrogen',
    provider: 'google',
    upstreamModel: 'gemini-4-hydrogen',
    fallbackUpstreamModels: ['gemini-3.5-flash', 'gemini-2.5-flash'],
    inputPerMillionMicros: 1_500_000,
    outputPerMillionMicros: 7_500_000,
    free: false,
  },
  'google/gemini-4-carbon': {
    id: 'google/gemini-4-carbon',
    provider: 'sevenapi',
    upstreamModel: 'gemini-4-carbon',
    inputPerMillionMicros: 2_000_000,
    outputPerMillionMicros: 10_000_000,
    free: false,
  },
  'google/gemini-4-neon': {
    id: 'google/gemini-4-neon',
    provider: 'sevenapi',
    upstreamModel: 'gemini-4-neon',
    inputPerMillionMicros: 500_000,
    outputPerMillionMicros: 500_000,
    free: false,
  },
  'google/gemini-4-argon': {
    id: 'google/gemini-4-argon',
    provider: 'sevenapi',
    upstreamModel: 'gemini-4-argon',
    inputPerMillionMicros: 2_000_000,
    outputPerMillionMicros: 10_000_000,
    free: false,
  },
  'anthropic/claude-sonnet-5.5': {
    id: 'anthropic/claude-sonnet-5.5',
    provider: 'sevenapi',
    upstreamModel: 'claude-sonnet-5-5',
    inputPerMillionMicros: 3_000_000,
    outputPerMillionMicros: 15_000_000,
    free: false,
  },
};

const FOLLOW_UP_MARKER = '###FOLLOWUPS###';

const SYSTEM_PROMPT = [
  'You are Vigas AI, a fast, helpful general and coding assistant.',
  'Reply in the same language the user writes in (Persian/Farsi if they write in Persian).',
  'Be clear, direct, and concise. Use fenced code blocks for code.',
  `After your answer, output the line ${FOLLOW_UP_MARKER} and then up to 3 short follow-up questions the user might ask next, one per line, no bullets or numbering.`,
].join(' ');

function splitFollowUps(raw: string): { text: string; followUps: string[] } {
  const at = raw.indexOf(FOLLOW_UP_MARKER);
  if (at === -1) return { text: raw.trim(), followUps: [] };
  const text = raw.slice(0, at).trim();
  const followUps = raw
    .slice(at + FOLLOW_UP_MARKER.length)
    .split('\n')
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter((line) => line.length > 0 && line.length <= 120)
    .slice(0, 3);
  return { text: text || raw.trim(), followUps };
}

function parseKeyList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[\n,;/\s]+/)
    .map((k) => k.trim())
    .filter(Boolean);
}

// Sticky key cursor & per-key cooldown within the warm serverless instance.
let googleStickyIdx = 0;
const keyCooldownUntil = new Map<string, number>();

async function callGoogleGeminiPool(
  upstreamModel: string,
  fallbackModels: readonly string[] | undefined,
  turns: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<{ text: string; inputTokens: number; outputTokens: number; usedModel: string }> {
  const keys = parseKeyList(process.env.GOOGLE_API_KEYS || process.env.GEMINI_API_KEYS);
  if (keys.length === 0) {
    throw new Error('Google Hydrogen API pool is not configured on the server yet.');
  }

  const contents = turns.map((t) => ({
    role: t.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: t.content }],
  }));

  const payload = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents,
    generationConfig: {
      maxOutputTokens: 2048,
      temperature: 0.7,
    },
  };

  const candidates = [upstreamModel, ...(fallbackModels ?? []).filter((m) => m !== upstreamModel)];
  let lastStatus = 502;
  let lastMessage = 'Upstream model temporarily unavailable.';

  for (const modelName of candidates) {
    const now = Date.now();
    const order: number[] = [];
    for (let offset = 0; offset < keys.length; offset += 1) {
      const idx = (googleStickyIdx + offset) % keys.length;
      const until = keyCooldownUntil.get(keys[idx]!) ?? 0;
      if (until <= now) order.push(idx);
    }
    if (order.length === 0) {
      for (let i = 0; i < keys.length; i += 1) order.push((googleStickyIdx + i) % keys.length);
    }

    for (const idx of order) {
      const apiKey = keys[idx]!;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent`;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 35_000);
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify(payload),
          signal: ctrl.signal,
          cache: 'no-store',
        });

        if (res.ok) {
          googleStickyIdx = idx;
          const data = (await res.json()) as {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
            usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
          };
          const parts = data.candidates?.[0]?.content?.parts ?? [];
          const text = parts
            .filter((p) => typeof p.text === 'string' && !p.thought)
            .map((p) => p.text ?? '')
            .join('')
            .trim();
          if (text) {
            return {
              text,
              inputTokens: Number(data.usageMetadata?.promptTokenCount ?? 0),
              outputTokens: Number(data.usageMetadata?.candidatesTokenCount ?? 0),
              usedModel: modelName,
            };
          }
          lastMessage = 'Model returned an empty response.';
          continue;
        }

        lastStatus = res.status;
        const errBody = await res.text().catch(() => '');
        try {
          const parsed = JSON.parse(errBody) as { error?: { message?: string } };
          if (parsed?.error?.message) lastMessage = parsed.error.message;
        } catch {
          if (errBody) lastMessage = errBody.slice(0, 200);
        }

        if (res.status === 429) {
          const daily = /PerDay|GenerateRequestsPerDay/i.test(errBody);
          keyCooldownUntil.set(apiKey, Date.now() + (daily ? 4 * 60 * 60_000 : 60_000));
          googleStickyIdx = (idx + 1) % keys.length;
          continue;
        }
        if (res.status === 401 || res.status === 403) {
          keyCooldownUntil.set(apiKey, Date.now() + 15 * 60_000);
          googleStickyIdx = (idx + 1) % keys.length;
          continue;
        }
        if (res.status === 503 || res.status === 500) {
          // High demand on this model — move quickly to fallback model instead of stalling across all 5 keys.
          break;
        }
        break;
      } catch (err) {
        lastMessage = err instanceof Error ? err.message : 'Upstream timeout.';
      } finally {
        clearTimeout(timer);
      }
    }
  }

  throw new Error(`HTTP ${lastStatus}: ${lastMessage}`);
}

async function callSevenApi(
  upstreamModel: string,
  turns: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<{ text: string; inputTokens: number; outputTokens: number; usedModel: string }> {
  const apiKey = (process.env.SEVENAPI_API_KEY ?? '').trim();
  if (!apiKey) {
    throw new Error('Paid relay pool is not configured yet.');
  }
  const baseUrl = (process.env.SEVENAPI_BASE_URL || 'https://7api.st/v1').replace(/\/+$/, '');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45_000);
  try {
    const res = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: upstreamModel,
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: turns.map((t) => ({ role: t.role, content: t.content })),
      }),
      signal: ctrl.signal,
      cache: 'no-store',
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Model relay returned HTTP ${res.status}${errBody ? `: ${errBody.slice(0, 140)}` : ''}`);
    }
    const data = (await res.json()) as {
      content?: Array<{ type?: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const text = (data.content ?? [])
      .filter((c) => c.type === 'text' && typeof c.text === 'string')
      .map((c) => c.text ?? '')
      .join('')
      .trim();
    return {
      text: text || '(empty reply)',
      inputTokens: Number(data.usage?.input_tokens ?? 0),
      outputTokens: Number(data.usage?.output_tokens ?? 0),
      usedModel: upstreamModel,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Direct chat completion endpoint used by `/chat` for Vigas native models
 * (`google/gemini-4-hydrogen:free`, `google/gemini-4-hydrogen`, `google/gemini-4-carbon`,
 * `anthropic/claude-sonnet-5.5`) backed by the user's $5.00 welcome credit and pooled keys.
 */
export async function POST(req: Request) {
  const pgAuth = await getRequestAuth(req).catch(() => null);
  const supaUser = pgAuth ? null : await verifySupabaseBearerUser(req);
  const userId = pgAuth?.user.id ?? supaUser?.id ?? null;
  if (!userId) {
    return apiError(401, 'unauthorized', 'Please sign in to chat with Vigas models.');
  }

  const limited = rateLimit(`chat-ask:${userId}`, 30, 60_000);
  if (limited) return limited;

  const parsed = await readJson(req, requestSchema);
  if (!parsed.ok) return parsed.res;

  const requestedId = (parsed.data.model ?? 'google/gemini-4-hydrogen:free').trim();
  const spec = DIRECT_MODELS[requestedId] ?? DIRECT_MODELS['google/gemini-4-hydrogen:free']!;

  const walletState = readPromoWalletFromRequest(req, userId);
  if (!spec.free && walletState.bal <= 0) {
    return apiError(
      402,
      'insufficient_credits',
      'Your $5.00 welcome credit has been used. Add credits in Wallet or switch to Gemini 4 Hydrogen (Free).',
    );
  }

  const turns: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...(parsed.data.history ?? []).slice(-16),
    { role: 'user', content: parsed.data.prompt },
  ];

  try {
    const out =
      spec.provider === 'google'
        ? await callGoogleGeminiPool(spec.upstreamModel, spec.fallbackUpstreamModels, turns)
        : await callSevenApi(spec.upstreamModel, turns);

    const { text, followUps } = splitFollowUps(out.text);
    const costMicros = spec.free
      ? 0
      : computeTokenCostMicros(
          {
            promptTokens: out.inputTokens || Math.ceil(parsed.data.prompt.length / 4),
            completionTokens: out.outputTokens || Math.ceil(text.length / 4),
          },
          {
            inputPerMillionMicros: spec.inputPerMillionMicros,
            outputPerMillionMicros: spec.outputPerMillionMicros,
          },
        );

    const nextWallet = costMicros > 0 ? debitPromoWallet(walletState, costMicros) : walletState;
    const res = NextResponse.json(
      {
        text,
        follow_ups: followUps,
        stored: false,
        session_id: null,
        context_turns: turns.length,
        model: spec.id,
        upstream_model: out.usedModel,
        cost_micros: costMicros,
        balance_micros: nextWallet.bal,
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
    setPromoWalletCookie(res, nextWallet);
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Model request failed.';
    return apiError(502, 'upstream_error', message);
  }
}
