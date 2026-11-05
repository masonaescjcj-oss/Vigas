import { z } from 'zod';

/** OpenAI-compatible Chat Completions request, plus Vigas routing extensions. */

const textPart = z.object({ type: z.literal('text'), text: z.string() });
const imagePart = z.object({
  type: z.literal('image_url'),
  image_url: z.object({ url: z.string(), detail: z.enum(['auto', 'low', 'high']).optional() }),
});
export const contentPartSchema = z.union([textPart, imagePart]);

const toolCallSchema = z.object({
  id: z.string(),
  type: z.literal('function'),
  function: z.object({ name: z.string(), arguments: z.string() }),
});

export const chatMessageSchema = z.union([
  z.object({ role: z.literal('system'), content: z.union([z.string(), z.array(textPart)]), name: z.string().optional() }),
  z.object({ role: z.literal('developer'), content: z.union([z.string(), z.array(textPart)]) }),
  z.object({ role: z.literal('user'), content: z.union([z.string(), z.array(contentPartSchema)]), name: z.string().optional() }),
  z.object({
    role: z.literal('assistant'),
    content: z.union([z.string(), z.array(textPart)]).nullable().optional(),
    tool_calls: z.array(toolCallSchema).optional(),
    name: z.string().optional(),
  }),
  z.object({ role: z.literal('tool'), content: z.union([z.string(), z.array(textPart)]), tool_call_id: z.string() }),
]);

export const chatCompletionRequestSchema = z.looseObject({
  model: z.string().min(1),
  /** Fallback models, tried in order after `model`. */
  models: z.array(z.string()).max(5).optional(),
  messages: z.array(chatMessageSchema).min(1),
  stream: z.boolean().optional(),
  stream_options: z.object({ include_usage: z.boolean().optional() }).optional(),
  max_tokens: z.number().int().positive().optional(),
  max_completion_tokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  stop: z.union([z.string(), z.array(z.string()).max(4)]).optional(),
  presence_penalty: z.number().optional(),
  frequency_penalty: z.number().optional(),
  seed: z.number().int().optional(),
  tools: z.array(z.unknown()).optional(),
  tool_choice: z.unknown().optional(),
  response_format: z.unknown().optional(),
  user: z.string().optional(),
  /** Vigas extension: how to pick and order providers. */
  route: z
    .object({
      sort: z.enum(['price', 'latency', 'quality']).optional(),
      fallbacks: z.boolean().optional(),
    })
    .optional(),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatCompletionRequest = z.infer<typeof chatCompletionRequestSchema>;

export interface ChatUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  /** Vigas extension: what this request cost, in USD. */
  cost?: number;
}

export interface ChatCompletion {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  /** Vigas extension: which provider served the request. */
  provider?: string;
  choices: Array<{
    index: number;
    message: { role: 'assistant'; content: string | null; tool_calls?: z.infer<typeof toolCallSchema>[] };
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
  }>;
  usage: ChatUsage;
}

export interface ChatCompletionChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  provider?: string;
  choices: Array<{
    index: number;
    delta: { role?: 'assistant'; content?: string | null; tool_calls?: unknown[] };
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
  }>;
  usage?: ChatUsage | null;
}

export interface OpenAIErrorBody {
  error: { message: string; type: string; code: string | null; param?: string | null };
}

/** Flattens message content to plain text (for token estimates and providers without parts). */
export function messageText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((p) => (p && typeof p === 'object' && 'text' in p && typeof p.text === 'string' ? p.text : ''))
      .join('\n');
  }
  return '';
}
