import type {
  AppError,
  ArenaBattleResponse,
  ArenaVote,
  ArenaVoteResponse,
  Article,
  AuthResponse,
  ChatCompletionChunk,
  ChatMessage,
  CreatedApiKey,
  HomeFeed,
  LeaderboardCategory,
  LeaderboardResponse,
  ModelListItem,
  NewsCategory,
  NewsListItem,
  PublicUser,
  ToolCategory,
  ToolItem,
  TopupResponse,
  WalletResponse,
} from '@vigas/core';

/**
 * Typed client for the Vigas app API (`/api/app/*` and `/api/auth/*` on the website).
 * Used by the Android app and by client components on the web.
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface VigasApiOptions {
  /** e.g. "https://vigas.ai". Empty string means same origin (web). */
  baseUrl: string;
  /** Bearer token for the Android app. The web relies on the session cookie instead. */
  getToken?: () => string | null | undefined | Promise<string | null | undefined>;
  /** Fetch implementation. On Android pass `fetch` from "expo/fetch" so chat can stream. */
  fetch?: FetchLike;
}

export interface ChatStreamHandlers {
  onDelta?: (text: string) => void;
  onChunk?: (chunk: ChatCompletionChunk) => void;
  signal?: AbortSignal;
}

export interface ChatResult {
  content: string;
  model: string | null;
  provider: string | null;
  promptTokens: number;
  completionTokens: number;
  costUsd: number | null;
}

const qs = (params: Record<string, string | number | null | undefined>) => {
  const s = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return s ? `?${s}` : '';
};

/** Reads an SSE body and calls `onData` with each `data:` payload (excluding "[DONE]"). */
export async function readSse(body: ReadableStream<Uint8Array>, onData: (data: string) => void): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf('\n\n')) >= 0) {
      const event = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const data = event
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trimStart())
        .join('\n');
      if (data && data !== '[DONE]') onData(data);
    }
  }
}

export class VigasApi {
  private readonly f: FetchLike;

  constructor(private readonly opts: VigasApiOptions) {
    // Always call fetch as a plain function: window.fetch rejects being called with the client as `this`.
    const custom = opts.fetch;
    this.f = custom ? (input, init) => custom(input, init) : (input, init) => fetch(input, init);
  }

  private async headers(json: boolean): Promise<Record<string, string>> {
    const h: Record<string, string> = { Accept: 'application/json' };
    if (json) h['Content-Type'] = 'application/json';
    const token = await this.opts.getToken?.();
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.f(`${this.opts.baseUrl}${path}`, {
      method,
      headers: await this.headers(body !== undefined),
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'include',
    });
    if (!res.ok) throw await toApiError(res);
    return (await res.json()) as T;
  }

  // Content
  home = () => this.request<HomeFeed>('GET', '/api/app/home');
  news = (p: { category?: NewsCategory | null; limit?: number; offset?: number } = {}) =>
    this.request<{ items: NewsListItem[]; total: number }>('GET', `/api/app/news${qs(p)}`);
  article = (slug: string) => this.request<Article>('GET', `/api/app/news/${encodeURIComponent(slug)}`);
  tools = (p: { category?: ToolCategory | null; q?: string; sort?: 'votes' | 'rating' | 'new' } = {}) =>
    this.request<{ items: ToolItem[] }>('GET', `/api/app/tools${qs(p)}`);
  voteTool = (slug: string) => this.request<{ voted: boolean; votes: number }>('POST', `/api/app/tools/${encodeURIComponent(slug)}/vote`, {});
  leaderboard = (category: LeaderboardCategory = 'overall') =>
    this.request<LeaderboardResponse>('GET', `/api/app/leaderboard${qs({ category })}`);
  models = () => this.request<{ items: ModelListItem[] }>('GET', '/api/app/models');

  // Auth
  signup = (b: { email: string; password: string; name?: string }) => this.request<AuthResponse>('POST', '/api/auth/signup', b);
  login = (b: { email: string; password: string }) => this.request<AuthResponse>('POST', '/api/auth/login', b);
  logout = () => this.request<{ ok: true }>('POST', '/api/auth/logout', {});
  me = () => this.request<{ user: PublicUser }>('GET', '/api/auth/me');

  // Wallet & keys
  wallet = () => this.request<WalletResponse>('GET', '/api/app/wallet');
  topup = (amountMicros: number) => this.request<TopupResponse>('POST', '/api/app/wallet/topup', { amountMicros });
  createKey = (name: string) => this.request<CreatedApiKey>('POST', '/api/app/keys', { name });
  revokeKey = (id: string) => this.request<{ ok: true }>('DELETE', `/api/app/keys/${encodeURIComponent(id)}`);

  // Arena
  arenaBattle = (prompt: string) => this.request<ArenaBattleResponse>('POST', '/api/app/arena', { prompt });
  arenaVote = (battleId: string, vote: ArenaVote) =>
    this.request<ArenaVoteResponse>('POST', `/api/app/arena/${encodeURIComponent(battleId)}/vote`, { vote });

  /** Streams a chat completion through the signed-in user's credits. */
  async chat(body: { model: string; messages: ChatMessage[] }, handlers: ChatStreamHandlers = {}): Promise<ChatResult> {
    const res = await this.f(`${this.opts.baseUrl}/api/app/chat`, {
      method: 'POST',
      headers: { ...(await this.headers(true)), Accept: 'text/event-stream' },
      body: JSON.stringify({ ...body, stream: true }),
      credentials: 'include',
      signal: handlers.signal,
    });
    if (!res.ok || !res.body) throw await toApiError(res);
    const out: ChatResult = { content: '', model: null, provider: null, promptTokens: 0, completionTokens: 0, costUsd: null };
    await readSse(res.body, (data) => {
      let chunk: ChatCompletionChunk;
      try {
        chunk = JSON.parse(data) as ChatCompletionChunk;
      } catch {
        return;
      }
      out.model ??= chunk.model;
      out.provider ??= chunk.provider ?? null;
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        out.content += delta;
        handlers.onDelta?.(delta);
      }
      if (chunk.usage) {
        out.promptTokens = chunk.usage.prompt_tokens;
        out.completionTokens = chunk.usage.completion_tokens;
        out.costUsd = chunk.usage.cost ?? null;
      }
      handlers.onChunk?.(chunk);
    });
    return out;
  }
}

async function toApiError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as Partial<AppError> & { error?: { code?: string; message?: string; type?: string } };
    return new ApiError(res.status, body.error?.code ?? body.error?.type ?? 'error', body.error?.message ?? res.statusText);
  } catch {
    return new ApiError(res.status, 'error', res.statusText || `HTTP ${res.status}`);
  }
}
