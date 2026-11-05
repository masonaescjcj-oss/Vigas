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
});
