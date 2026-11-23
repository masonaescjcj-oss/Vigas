import { describe, expect, it } from 'vitest';
import { AnthropicAdapter, toAnthropic } from '../src/providers/anthropic';
import { OpenAICompatibleAdapter } from '../src/providers/openai-compatible';
import { ProviderError, type StreamEvent, type UpstreamRequest } from '../src/providers/types';

const req: UpstreamRequest = {
  upstreamModel: 'upstream-x',
  messages: [
    { role: 'system', content: 'Be brief.' },
    { role: 'user', content: 'Hi' },
  ],
  maxTokens: 100,
  params: { temperature: 0.3 },
};

function sse(events: string[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      const enc = new TextEncoder();
      // Split an event across two chunks to exercise buffering.
      const text = events.map((e) => `data: ${e}\n\n`).join('');
      c.enqueue(enc.encode(text.slice(0, 17)));
      c.enqueue(enc.encode(text.slice(17)));
      c.close();
    },
  });
  return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } });
}

function fakeFetch(handler: (url: string, init: RequestInit) => Response) {
  const calls: Array<{ url: string; init: RequestInit; body: Record<string, unknown> }> = [];
  const f = (async (url: string, init: RequestInit) => {
    calls.push({ url, init, body: JSON.parse(String(init.body)) });
    return handler(url, init);
  }) as unknown as typeof fetch;
  return { f, calls };
}

async function collect(it: AsyncIterable<StreamEvent>) {
  const out: StreamEvent[] = [];
  for await (const e of it) out.push(e);
  return out;
}

describe('OpenAI-compatible adapter', () => {
  it('sends the upstream model and parses a completion', async () => {
    const { f, calls } = fakeFetch(() =>
      Response.json({
        choices: [{ index: 0, message: { role: 'assistant', content: 'Hello!' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 12, completion_tokens: 3, total_tokens: 15 },
      }),
    );
    const a = new OpenAICompatibleAdapter('openai', 'https://api.example.com/v1', 'sk-test', f);
    const r = await a.complete(req, new AbortController().signal);
    expect(r).toEqual({ content: 'Hello!', toolCalls: undefined, finishReason: 'stop', usage: { promptTokens: 12, completionTokens: 3 } });
    expect(calls[0]!.url).toBe('https://api.example.com/v1/chat/completions');
    expect(calls[0]!.body).toMatchObject({ model: 'upstream-x', max_tokens: 100, temperature: 0.3, stream: false });
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test');
  });

  it('streams deltas, finish and usage', async () => {
    const { f, calls } = fakeFetch(() =>
      sse([
        JSON.stringify({ choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }] }),
        JSON.stringify({ choices: [{ index: 0, delta: { content: 'Hel' }, finish_reason: null }] }),
        JSON.stringify({ choices: [{ index: 0, delta: { content: 'lo' }, finish_reason: 'stop' }] }),
        JSON.stringify({ choices: [], usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 } }),
        '[DONE]',
      ]),
    );
    const a = new OpenAICompatibleAdapter('deepseek', 'https://api.example.com/v1', 'k', f);
    const events = await collect(a.stream(req, new AbortController().signal));
    expect(events).toEqual([
      { type: 'delta', content: 'Hel', toolCalls: undefined },
      { type: 'delta', content: 'lo', toolCalls: undefined },
      { type: 'finish', finishReason: 'stop' },
      { type: 'usage', usage: { promptTokens: 5, completionTokens: 2 } },
    ]);
    expect(calls[0]!.body).toMatchObject({ stream: true, stream_options: { include_usage: true } });
  });

  it('maps upstream errors to retryable or final provider errors', async () => {
    const limited = new OpenAICompatibleAdapter('x', 'https://e', 'k', fakeFetch(() => Response.json({ error: { message: 'slow down' } }, { status: 429 })).f);
    const err = await limited.complete(req, new AbortController().signal).catch((e) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err).toMatchObject({ status: 429, retryable: true, code: 'rate_limited' });
    expect(err.message).toContain('slow down');

    const bad = new OpenAICompatibleAdapter('x', 'https://e', 'k', fakeFetch(() => new Response('nope', { status: 400 })).f);
    await expect(bad.complete(req, new AbortController().signal)).rejects.toMatchObject({ status: 400, retryable: false });
  });
});

describe('Anthropic adapter', () => {
  it('converts OpenAI messages: system prompt, images, merged turns', () => {
    const out = toAnthropic([
      { role: 'system', content: 'Rules' },
      { role: 'user', content: 'One' },
      { role: 'user', content: [{ type: 'text', text: 'Two' }, { type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } }] },
      { role: 'assistant', content: 'Reply' },
    ]);
    expect(out.system).toBe('Rules');
    expect(out.messages).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'One' },
          { type: 'text', text: 'Two' },
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAAA' } },
        ],
      },
      { role: 'assistant', content: [{ type: 'text', text: 'Reply' }] },
    ]);
  });

  it('calls the Messages API and parses the response', async () => {
    const { f, calls } = fakeFetch(() =>
      Response.json({ content: [{ type: 'text', text: 'Hi there' }], stop_reason: 'max_tokens', usage: { input_tokens: 9, output_tokens: 4 } }),
    );
    const a = new AnthropicAdapter('anthropic', 'https://api.anthropic.com/v1', 'ak', f);
    const r = await a.complete(req, new AbortController().signal);
    expect(r).toEqual({ content: 'Hi there', finishReason: 'length', usage: { promptTokens: 9, completionTokens: 4 } });
    expect(calls[0]!.url).toBe('https://api.anthropic.com/v1/messages');
    expect(calls[0]!.body).toMatchObject({ model: 'upstream-x', system: 'Be brief.', max_tokens: 100, temperature: 0.3 });
    expect((calls[0]!.init.headers as Record<string, string>)['x-api-key']).toBe('ak');
  });

  it('translates the Anthropic event stream', async () => {
    const { f } = fakeFetch(() =>
      sse([
        JSON.stringify({ type: 'message_start', message: { usage: { input_tokens: 11 } } }),
        JSON.stringify({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }),
        JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hey' } }),
        JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '!' } }),
        JSON.stringify({ type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 2 } }),
        JSON.stringify({ type: 'message_stop' }),
      ]),
    );
    const a = new AnthropicAdapter('anthropic', 'https://api.anthropic.com/v1', 'ak', f);
    expect(await collect(a.stream(req, new AbortController().signal))).toEqual([
      { type: 'delta', content: 'Hey' },
      { type: 'delta', content: '!' },
      { type: 'finish', finishReason: 'stop' },
      { type: 'usage', usage: { promptTokens: 11, completionTokens: 2 } },
    ]);
  });

  it('treats Anthropic overload (529) as retryable and rejects non-function tools', async () => {
    const a = new AnthropicAdapter('anthropic', 'https://e', 'k', fakeFetch(() => Response.json({ error: { message: 'Overloaded' } }, { status: 529 })).f);
    await expect(a.complete(req, new AbortController().signal)).rejects.toMatchObject({ status: 529, retryable: true });
    const tools = new AnthropicAdapter('anthropic', 'https://e', 'k', fakeFetch(() => Response.json({})).f);
    await expect(tools.complete({ ...req, params: { tools: [{ type: 'web_search' }] } }, new AbortController().signal)).rejects.toMatchObject({
      code: 'unsupported_parameter',
      retryable: false,
    });
  });
});

describe('Anthropic tool calling', () => {
  const weatherTool = {
    type: 'function',
    function: { name: 'get_weather', description: 'Weather for a city', parameters: { type: 'object', properties: { city: { type: 'string' } } } },
  };

  it('sends tools and tool_choice, and replays tool calls and results', async () => {
    const { f, calls } = fakeFetch(() => Response.json({ content: [{ type: 'text', text: 'Sunny' }], stop_reason: 'end_turn' }));
    const a = new AnthropicAdapter('anthropic', 'https://e', 'k', f);
    await a.complete(
      {
        ...req,
        messages: [
          { role: 'user', content: 'Weather in Tehran?' },
          { role: 'assistant', content: null, tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'get_weather', arguments: '{"city":"Tehran"}' } }] },
          { role: 'tool', tool_call_id: 'call_1', content: '24°C, clear' },
        ],
        params: { tools: [weatherTool], tool_choice: 'required' },
      },
      new AbortController().signal,
    );
    const body = calls[0]!.body as { tools: unknown; tool_choice: unknown; messages: unknown };
    expect(body.tools).toEqual([{ name: 'get_weather', description: 'Weather for a city', input_schema: weatherTool.function.parameters }]);
    expect(body.tool_choice).toEqual({ type: 'any' });
    expect(body.messages).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'Weather in Tehran?' }] },
      { role: 'assistant', content: [{ type: 'tool_use', id: 'call_1', name: 'get_weather', input: { city: 'Tehran' } }] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'call_1', content: '24°C, clear' }] },
    ]);
  });

  it('returns tool_use blocks as OpenAI tool_calls', async () => {
    const { f } = fakeFetch(() =>
      Response.json({
        content: [{ type: 'tool_use', id: 'toolu_1', name: 'get_weather', input: { city: 'Shiraz' } }],
        stop_reason: 'tool_use',
        usage: { input_tokens: 20, output_tokens: 8 },
      }),
    );
    const r = await new AnthropicAdapter('anthropic', 'https://e', 'k', f).complete({ ...req, params: { tools: [weatherTool] } }, new AbortController().signal);
    expect(r.finishReason).toBe('tool_calls');
    expect(r.content).toBeNull();
    expect(r.toolCalls).toEqual([{ id: 'toolu_1', type: 'function', function: { name: 'get_weather', arguments: '{"city":"Shiraz"}' } }]);
  });

  it('streams tool calls as OpenAI tool_call deltas', async () => {
    const { f } = fakeFetch(() =>
      sse([
        JSON.stringify({ type: 'message_start', message: { usage: { input_tokens: 15 } } }),
        JSON.stringify({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }),
        JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Checking.' } }),
        JSON.stringify({ type: 'content_block_start', index: 1, content_block: { type: 'tool_use', id: 'toolu_9', name: 'get_weather', input: {} } }),
        JSON.stringify({ type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '{"city":' } }),
        JSON.stringify({ type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '"Tabriz"}' } }),
        JSON.stringify({ type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 12 } }),
      ]),
    );
    const events = await collect(new AnthropicAdapter('anthropic', 'https://e', 'k', f).stream({ ...req, params: { tools: [weatherTool] } }, new AbortController().signal));
    expect(events).toEqual([
      { type: 'delta', content: 'Checking.' },
      { type: 'delta', toolCalls: [{ index: 0, id: 'toolu_9', type: 'function', function: { name: 'get_weather', arguments: '' } }] },
      { type: 'delta', toolCalls: [{ index: 0, function: { arguments: '{"city":' } }] },
      { type: 'delta', toolCalls: [{ index: 0, function: { arguments: '"Tabriz"}' } }] },
      { type: 'finish', finishReason: 'tool_calls' },
      { type: 'usage', usage: { promptTokens: 15, completionTokens: 12 } },
    ]);
  });

  it('normalizes https://7api.st to /v1/messages, tracks cached input tokens, and masks upstream host/slug', async () => {
    const { anthropicMessagesUrl } = await import('../src/providers/anthropic');
    expect(anthropicMessagesUrl('https://7api.st')).toBe('https://7api.st/v1/messages');
    expect(anthropicMessagesUrl('https://7api.st/v1')).toBe('https://7api.st/v1/messages');

    const { f, calls } = fakeFetch(() =>
      Response.json({
        content: [{ type: 'text', text: 'Done' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 100, cache_read_input_tokens: 400, output_tokens: 25 },
      }),
    );
    const adapter = new AnthropicAdapter('sevenapi', 'https://7api.st', 'sk-secret', f, 'vigas-edge');
    const r = await adapter.complete({ ...req, upstreamModel: 'claude-opus-5-5-max' }, new AbortController().signal);
    expect(calls[0]!.url).toBe('https://7api.st/v1/messages');
    expect(r.usage).toEqual({ promptTokens: 500, completionTokens: 25, cachedPromptTokens: 400 });

    const errFetch = fakeFetch(() => new Response(JSON.stringify({ error: { message: '7api.st overloaded' } }), { status: 529 }));
    const errAdapter = new AnthropicAdapter('sevenapi', 'https://7api.st', 'sk-secret', errFetch.f, 'vigas-edge');
    await expect(errAdapter.complete(req, new AbortController().signal)).rejects.toThrow('vigas-edge: upstream overloaded');
  });
});

describe('multi-provider config & Anthropic messages translation', () => {
  it('loads sevenapi, dynamic UPSTREAM_PROVIDERS JSON, and PROVIDER_* env pools while masking hidden providers', async () => {
    const { loadConfig, publicProviderLabel } = await import('../src/config');
    const { createAdapterResolver } = await import('../src/providers');
    const cfg = loadConfig({
      NODE_ENV: 'development',
      SEVENAPI_API_KEY: 'sk-test-seven',
      SEVENAPI_BASE_URL: 'https://7api.st',
      UPSTREAM_PROVIDERS: JSON.stringify([
        { slug: 'pool_eu', kind: 'openai', baseUrl: 'https://pool-eu.example.com/v1', apiKey: 'sk-eu' },
      ]),
      PROVIDER_POOL_ASIA_KIND: 'anthropic',
      PROVIDER_POOL_ASIA_BASE_URL: 'https://pool-asia.example.com',
      PROVIDER_POOL_ASIA_API_KEY: 'sk-asia',
    });

    expect(cfg.providers.sevenapi?.apiKey).toBe('sk-test-seven');
    expect(cfg.providers.sevenapi?.hidden).toBe(true);
    expect(cfg.providers.pool_eu?.baseUrl).toBe('https://pool-eu.example.com/v1');
    expect(cfg.providers.pool_asia?.kind).toBe('anthropic');
    expect(publicProviderLabel(cfg, 'sevenapi')).toBe('vigas-edge');
    expect(publicProviderLabel(cfg, 'pool_eu')).toBe('vigas-edge');

    const resolve = createAdapterResolver(cfg);
    expect(resolve('sevenapi')).not.toBeNull();
    expect(resolve('pool_eu')).not.toBeNull();
    expect(resolve('pool_asia')).not.toBeNull();

    // Without SEVENAPI_API_KEY, sevenapi must not fall back to MockAdapter.
    const noKeyCfg = loadConfig({ NODE_ENV: 'development' });
    expect(createAdapterResolver(noKeyCfg)('sevenapi')).toBeNull();
  });

  it('converts Anthropic /v1/messages system, tool_use and tool_result blocks cleanly', async () => {
    const { fromAnthropicMessages } = await import('../src/messages');
    const msgs = fromAnthropicMessages('You are concise.', [
      { role: 'user', content: [{ type: 'text', text: 'Weather in Tehran?' }] },
      { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_1', name: 'get_weather', input: { city: 'Tehran' } }] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: '22C' }] },
    ]);
    expect(msgs).toHaveLength(4);
    expect(msgs[0]).toEqual({ role: 'system', content: 'You are concise.' });
    expect(msgs[2]!.role).toBe('assistant');
    expect(msgs[3]).toEqual({ role: 'tool', tool_call_id: 'toolu_1', content: '22C' });
  });
});

describe('Multi-Key Pool rotation & failover', () => {
  it('supports round_robin, sequential, random, and least_used strategies', async () => {
    const { KeyPool } = await import('../src/providers/key-pool');
    const keys = [
      { key: 'k1', label: 'you-01', budgetMicros: 100_000_000 },
      { key: 'k2', label: 'you-02', budgetMicros: 100_000_000 },
      { key: 'k3', label: 'you-03', budgetMicros: 100_000_000 },
    ];

    // round_robin: 0 -> 1 -> 2 -> 0
    const rr = new KeyPool(keys, { strategy: 'round_robin' });
    const rrOrder = [0, 1, 2, 3].map(() => {
      const lease = rr.acquire()!;
      rr.recordSuccess(lease.index);
      return lease.spec.key;
    });
    expect(rrOrder).toEqual(['k1', 'k2', 'k3', 'k1']);

    // sequential: sticks to k1 until it hits its $100 budget cap, then moves to k2
    const seq = new KeyPool(keys, { strategy: 'sequential' });
    const s1 = seq.acquire()!;
    expect(s1.spec.key).toBe('k1');
    seq.recordSuccess(s1.index, 60_000_000);
    const s2 = seq.acquire()!;
    expect(s2.spec.key).toBe('k1');
    seq.recordSuccess(s2.index, 40_000_000); // k1 now at $100 cap
    const s3 = seq.acquire()!;
    expect(s3.spec.key).toBe('k2');
    seq.recordSuccess(s3.index, 10_000_000);
    expect(seq.snapshot().budgetCapped).toBe(1);

    // random: uses rng across eligible keys
    let step = 0;
    const vals = [0.9, 0.1, 0.5];
    const rnd = new KeyPool(keys, { strategy: 'random', rng: () => vals[step++ % vals.length]! });
    const rndOrder = [0, 1, 2].map(() => {
      const l = rnd.acquire()!;
      rnd.recordSuccess(l.index);
      return l.spec.key;
    });
    expect(rndOrder).toEqual(['k3', 'k1', 'k2']);

    // least_used: balances concurrent inFlight & total uses
    const lu = new KeyPool(keys, { strategy: 'least_used' });
    const a = lu.acquire()!;
    const b = lu.acquire()!;
    const c = lu.acquire()!;
    expect([a.spec.key, b.spec.key, c.spec.key]).toEqual(['k1', 'k2', 'k3']);
    lu.recordSuccess(a.index);
    lu.recordSuccess(b.index);
    lu.recordSuccess(c.index);
  });

  it('transparently rotates to the next key on 402/429 and does NOT burn the pool on 400 client errors', async () => {
    const { KeyPool, MultiKeyAdapter } = await import('../src/providers/key-pool');
    let nowMs = 1_000_000;
    const pool = new KeyPool(
      [
        { key: 'you-key-1', label: 'you-01' },
        { key: 'you-key-2', label: 'you-02' },
        { key: 'you-key-3', label: 'you-03' },
      ],
      { strategy: 'sequential', now: () => nowMs },
    );

    const usedKeys: string[] = [];
    const adapter = new MultiKeyAdapter('you', pool, (apiKey) => ({
      slug: 'you',
      async complete() {
        usedKeys.push(apiKey);
        if (apiKey === 'you-key-1') throw new ProviderError('you: insufficient credit balance', 402, false, 'upstream_rejected');
        if (apiKey === 'you-key-2') throw new ProviderError('you: rate limited', 429, true, 'rate_limited');
        return { content: 'Answered by key 3', finishReason: 'stop', usage: { promptTokens: 10, completionTokens: 5 } };
      },
      async *stream() {
        usedKeys.push(apiKey);
        if (apiKey === 'you-key-1') throw new ProviderError('you: insufficient credit balance', 402, false, 'upstream_rejected');
        yield { type: 'delta', content: `Stream from ${apiKey}` };
        yield { type: 'finish', finishReason: 'stop' };
      },
    }));

    const res = await adapter.complete(req, new AbortController().signal);
    expect(res.content).toBe('Answered by key 3');
    expect(usedKeys).toEqual(['you-key-1', 'you-key-2', 'you-key-3']);

    const snap = pool.snapshot();
    expect(snap.exhausted).toBe(1);
    expect(snap.coolingDown).toBe(1);
    expect(snap.healthy).toBe(1);

    // After 61s, key 2 recovers from 429 cooldown while key 1 stays exhausted (24h).
    nowMs += 61_000;
    const events = await collect(adapter.stream(req, new AbortController().signal));
    expect(events[0]).toEqual({ type: 'delta', content: 'Stream from you-key-2' });

    // A 400 malformed request must NOT rotate across keys or mark the key unhealthy.
    const badPool = new KeyPool([{ key: 'a' }, { key: 'b' }], { strategy: 'round_robin' });
    const badCalls: string[] = [];
    const badAdapter = new MultiKeyAdapter('x', badPool, (k) => ({
      slug: 'x',
      async complete() {
        badCalls.push(k);
        throw new ProviderError('invalid_request: malformed json', 400, false, 'upstream_rejected');
      },
      async *stream() {
        yield { type: 'finish', finishReason: 'stop' };
      },
    }));
    await expect(badAdapter.complete(req, new AbortController().signal)).rejects.toMatchObject({ status: 400 });
    expect(badCalls).toEqual(['a']);
    expect(badPool.snapshot().healthy).toBe(2);
  });
});

describe('You.com adapter & multi-key env config', () => {
  it('calls /v1/agents/runs, maps turns, formats citations, streams deltas, and masks host on error', async () => {
    const { YouComAdapter, toYouComInput, youComRunsUrl } = await import('../src/providers/youcom');
    expect(youComRunsUrl('https://api.you.com')).toBe('https://api.you.com/v1/agents/runs');
    expect(youComRunsUrl('https://api.you.com/v1')).toBe('https://api.you.com/v1/agents/runs');

    expect(
      toYouComInput([
        { role: 'system', content: 'Be terse.' },
        { role: 'user', content: 'First' },
        { role: 'assistant', content: 'Reply' },
        { role: 'user', content: 'Second' },
      ]),
    ).toEqual([
      { role: 'user', content: 'Instructions:\nBe terse.\n\nFirst' },
      { role: 'agent', content: 'Reply' },
      { role: 'user', content: 'Second' },
    ]);

    const { f, calls } = fakeFetch(() =>
      Response.json({
        output: [
          {
            type: 'web_search.results',
            content: [{ url: 'https://vigas.app/models', title: 'Vigas Models' }],
          },
          {
            type: 'message.answer',
            text: 'Vigas routes AI models [[1]](https://vigas.app/models).',
          },
        ],
      }),
    );

    const adapter = new YouComAdapter('you', 'https://api.you.com', 'yk-secret', f, 'vigas-edge');
    const result = await adapter.complete({ ...req, upstreamModel: 'express' }, new AbortController().signal);
    expect(calls[0]!.url).toBe('https://api.you.com/v1/agents/runs');
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe('Bearer yk-secret');
    expect(calls[0]!.body).toMatchObject({ agent: 'express', stream: false, tools: [{ type: 'web_search' }] });
    expect(result.content).toContain('Vigas routes AI models [1].');
    expect(result.content).toContain('[1] Vigas Models — vigas.app');

    const streamEvents = await collect(adapter.stream({ ...req, upstreamModel: 'express' }, new AbortController().signal));
    expect(streamEvents.some((e) => e.type === 'delta')).toBe(true);
    expect(streamEvents.some((e) => e.type === 'finish')).toBe(true);

    const errFetch = fakeFetch(() => new Response('api.you.com quota exceeded', { status: 402 }));
    const errAdapter = new YouComAdapter('you', 'https://api.you.com', 'yk-secret', errFetch.f, 'vigas-edge');
    await expect(errAdapter.complete(req, new AbortController().signal)).rejects.toThrow('vigas-edge: upstream quota exceeded');
  });

  it('loads YOU_API_KEYS, strategy, per-key budget, and returns safe masked poolSnapshots without leaking raw keys', async () => {
    const { loadConfig } = await import('../src/config');
    const { createAdapterResolver } = await import('../src/providers');

    const cfg = loadConfig({
      NODE_ENV: 'production',
      YOU_API_KEYS: 'yk-1, yk-2, yk-3',
      YOU_KEY_STRATEGY: 'random',
      YOU_KEY_BUDGET_USD: '100',
      SEVENAPI_API_KEYS: 'sk-s1\nsk-s2',
      SEVENAPI_KEY_STRATEGY: 'sequential',
    });

    expect(cfg.providers.you?.apiKeys).toHaveLength(3);
    expect(cfg.providers.you?.keyStrategy).toBe('random');
    expect(cfg.providers.you?.apiKeys[0]?.budgetMicros).toBe(100_000_000);
    expect(cfg.providers.sevenapi?.apiKeys).toHaveLength(2);
    expect(cfg.providers.sevenapi?.keyStrategy).toBe('sequential');
    expect(cfg.promoOnlyModelPrefixes).toEqual(['you/', 'google/gemini-4-hydrogen']);

    const resolve = createAdapterResolver(cfg);
    expect(resolve('you')).not.toBeNull();
    const snaps = resolve.poolSnapshots?.() ?? {};
    expect(snaps.you?.total).toBe(3);
    expect(snaps.you?.strategy).toBe('random');
    expect(snaps.you?.keys[0]?.budgetUsd).toBe(100);
    expect(JSON.stringify(snaps)).not.toContain('yk-1');
    expect(JSON.stringify(snaps)).not.toContain('sk-s1');
  });

  it('scopes Google free-tier multi-key pool strictly to Gemini 4 Hydrogen and rotates on API_KEY_INVALID / 429', async () => {
    const { isProviderAllowedForModel, loadConfig } = await import('../src/config');
    const { createAdapterResolver } = await import('../src/providers');

    const cfg = loadConfig({
      NODE_ENV: 'production',
      GOOGLE_API_KEYS: 'AIza-bad-key,AIza-limited-key',
      GEMINI_API_KEYS: 'AIza-good-key',
      GOOGLE_KEY_STRATEGY: 'sequential',
      SEVENAPI_API_KEY: 'sk-seven',
    });

    expect(cfg.providers.google?.apiKeys.map((k) => k.key)).toEqual(['AIza-bad-key', 'AIza-limited-key', 'AIza-good-key']);
    expect(cfg.providers.google?.baseUrl).toBe('https://generativelanguage.googleapis.com/v1beta/openai');
    // Free-tier Google keys must ONLY serve Hydrogen (paid + :free), never Carbon/Neon/Argon.
    expect(isProviderAllowedForModel(cfg, 'google', 'google/gemini-4-hydrogen')).toBe(true);
    expect(isProviderAllowedForModel(cfg, 'google', 'google/gemini-4-hydrogen:free')).toBe(true);
    expect(isProviderAllowedForModel(cfg, 'google', 'google/gemini-4-carbon')).toBe(false);
    expect(isProviderAllowedForModel(cfg, 'google', 'google/gemini-4-neon')).toBe(false);
    expect(isProviderAllowedForModel(cfg, 'google', 'google/gemini-4-argon')).toBe(false);
    // Carbon/Neon/Argon remain allowed on sevenapi.
    expect(isProviderAllowedForModel(cfg, 'sevenapi', 'google/gemini-4-carbon')).toBe(true);

    const seenAuth: string[] = [];
    const { f } = fakeFetch((_url, init) => {
      const auth = (init.headers as Record<string, string>).Authorization ?? '';
      seenAuth.push(auth);
      if (auth.includes('AIza-bad-key')) {
        return new Response(JSON.stringify([{ error: { status: 'INVALID_ARGUMENT', message: 'API key not valid. Please pass a valid API key.' } }]), {
          status: 400,
        });
      }
      if (auth.includes('AIza-limited-key')) {
        return new Response(JSON.stringify([{ error: { status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded for quota metric.' } }]), {
          status: 429,
        });
      }
      return Response.json({
        choices: [{ index: 0, message: { role: 'assistant', content: 'Gemini 4 Hydrogen ready' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 8, completion_tokens: 4, total_tokens: 12 },
      });
    });

    const resolve = createAdapterResolver(cfg, { fetcher: f });
    const adapter = resolve('google')!;
    const out = await adapter.complete({ ...req, upstreamModel: 'gemini-4-hydrogen' }, new AbortController().signal);
    expect(out.content).toBe('Gemini 4 Hydrogen ready');
    expect(seenAuth).toEqual(['Bearer AIza-bad-key', 'Bearer AIza-limited-key', 'Bearer AIza-good-key']);

    const snaps = resolve.poolSnapshots?.() ?? {};
    expect(snaps.google?.exhausted).toBe(1);
    expect(snaps.google?.coolingDown).toBe(1);
    expect(snaps.google?.healthy).toBe(1);
    expect(JSON.stringify(snaps)).not.toContain('AIza-');
  });
});
