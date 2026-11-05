import type { OpenAIErrorBody } from '@vigas/core';

export type ErrorType =
  | 'invalid_request_error'
  | 'authentication_error'
  | 'insufficient_quota'
  | 'rate_limit_error'
  | 'not_found_error'
  | 'api_error'
  | 'upstream_error';

/** An OpenAI-shaped error response. */
export function errorResponse(
  status: number,
  message: string,
  type: ErrorType,
  code: string | null = null,
  headers: Record<string, string> = {},
): Response {
  const body: OpenAIErrorBody = { error: { message, type, code } };
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}
