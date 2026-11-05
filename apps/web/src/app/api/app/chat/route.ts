import { z } from 'zod';
import { chatMessageSchema } from '@vigas/core';
import { gatewayErrorResponse, postChatCompletion, readUpstreamError } from '@/lib/gateway';
import { rateLimit, readJson, requireAuth } from '@/lib/http';

const schema = z.object({
  model: z.string().trim().min(1).max(200),
  messages: z.array(chatMessageSchema).min(1).max(200),
  stream: z.boolean().optional(),
});

/** Streams a chat completion from the gateway, billed to the signed-in user's account. */
export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const limited = rateLimit(`chat:${auth.user.id}`, 30, 60_000);
  if (limited) return limited;
  const body = await readJson(req, schema);
  if (!body.ok) return body.res;

  let upstream: Response;
  try {
    upstream = await postChatCompletion(
      { model: body.data.model, messages: body.data.messages, stream: true, stream_options: { include_usage: true } },
      { accountId: auth.user.accountId, source: 'chat', signal: req.signal },
    );
  } catch (err) {
    return gatewayErrorResponse(err);
  }
  if (!upstream.ok || !upstream.body) return gatewayErrorResponse(await readUpstreamError(upstream));

  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'X-Accel-Buffering': 'no',
  });
  for (const h of ['x-vigas-provider', 'x-vigas-model']) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  return new Response(upstream.body, { status: 200, headers });
}
