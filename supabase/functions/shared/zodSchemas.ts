import { z } from "zod";

const uuid = z.string().uuid();
const trimmed = (max: number) => z.string().trim().min(1).max(max);

/**
 * How many past turns a question carries. Enough that a follow-up like "and
 * the second one?" still makes sense, small enough that a long chat does not
 * quietly grow the cost of every message.
 */
export const ASK_HISTORY_TURNS = 20;

export const EmptyInputSchema = z.object({}).strict();

export const ProjectCreateSchema = z.object({
  name: trimmed(100),
  description: z.string().trim().max(2_000).nullable().optional(),
  template: z.string().trim().min(1).max(40).optional(),
}).strict();

/**
 * A path inside the project. Anything that could escape the project's prefix —
 * a leading slash, a "..", a backslash, a NUL — is rejected here rather than
 * normalised, so there is one obvious rule instead of a sanitiser to audit.
 */
const projectRelativePath = z.string().trim().min(1).max(400)
  .refine((value) => !value.startsWith("/") && !value.includes("\\") && !value.includes("\0"), {
    message: "Path must be relative and use forward slashes.",
  })
  .refine((value) => !value.split("/").some((segment) => segment === ".." || segment === "."), {
    message: "Path must not contain . or .. segments.",
  });

export const ProjectFilesSchema = z.object({
  projectId: uuid,
  /** Omitted means "list": return every text file in the project. */
  action: z.enum(["write", "delete", "rename"]).optional(),
  path: projectRelativePath.optional(),
  /** write only. */
  content: z.string().max(512_000).optional(),
  /** rename only. */
  toPath: projectRelativePath.optional(),
}).strict().refine(
  (input) => input.action === undefined || input.path !== undefined,
  { message: "path is required for write, delete and rename." },
).refine(
  (input) => input.action !== "write" || input.content !== undefined,
  { message: "content is required for write." },
).refine(
  (input) => input.action !== "rename" || input.toPath !== undefined,
  { message: "toPath is required for rename." },
);

export const ProjectCursorSchema = z.object({
  createdAt: z.string().datetime({ offset: true }),
  id: uuid,
}).strict();

export const ProjectListSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().min(1).max(1_024).optional(),
}).strict();

export const ProjectUpdateSchema = z.object({
  projectId: uuid,
  name: trimmed(100).optional(),
  description: z.string().trim().max(2_000).nullable().optional(),
  lastOpenedAt: z.string().datetime({ offset: true }).nullable().optional(),
}).strict().refine(
  (value) => value.name !== undefined || value.description !== undefined || value.lastOpenedAt !== undefined,
  { message: "At least one project field must be supplied." },
);

export const ProjectDeleteSchema = z.object({ projectId: uuid }).strict();

export const AgentRunSchema = z.object({
  projectId: uuid,
  prompt: trimmed(50_000),
  sessionId: uuid.optional(),
  title: z.string().trim().min(1).max(200).optional(),
  profile: z.enum(["standard", "readonly"]).default("standard"),
  /** Provider model id. Must be allow-listed server-side; omit for the default. */
  model: z.string().trim().min(1).max(80).optional(),
}).strict();

export const AgentResumeSchema = z.object({
  sessionId: uuid,
  prompt: trimmed(50_000),
}).strict();

/**
 * Asking a question, as opposed to running the agent. Answers come straight
 * back — no job queue, no worker, no sandbox — because none of that is needed
 * to talk to a model.
 *
 * Two ways to carry the conversation:
 *   - `projectId` (+ `sessionId` after the first turn): the chat is stored, and
 *     the server reads the recent history back itself.
 *   - `history`: incognito. Nothing is stored, so the client is the only place
 *     the conversation exists and it sends it each turn. Capped, since an
 *     unbounded history would be a free way to push tokens through the model.
 */
export const AgentAskSchema = z.object({
  prompt: trimmed(20_000),
  history: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: trimmed(20_000),
  })).max(ASK_HISTORY_TURNS).default([]),
  projectId: uuid.optional(),
  sessionId: uuid.optional(),
  title: z.string().trim().min(1).max(200).optional(),
  model: z.string().trim().min(1).max(80).optional(),
}).strict().refine(
  (input) => !input.sessionId || !!input.projectId,
  { message: "sessionId requires projectId." },
).refine(
  (input) => !(input.projectId && input.history.length > 0),
  { message: "A stored chat keeps its own history; do not also send one." },
);

/**
 * Bring-your-own provider. The base URL is free-form on purpose — a fixed list
 * of providers would shut out every new entrant — and is checked by
 * providerGuard rather than by an allow-list of companies.
 */
export const ProviderKeysSchema = z.object({
  action: z.enum(["list", "add", "test", "delete"]),
  id: uuid.optional(),
  label: z.string().trim().min(1).max(60).optional(),
  baseUrl: z.string().trim().min(8).max(300).optional(),
  apiKey: z.string().trim().min(8).max(500).optional(),
  model: z.string().trim().min(1).max(120).optional(),
}).strict().refine(
  (input) => input.action !== "add" || (!!input.label && !!input.baseUrl && !!input.apiKey),
  { message: "label, baseUrl and apiKey are required to add a provider." },
).refine(
  (input) => (input.action !== "test" && input.action !== "delete") || !!input.id,
  { message: "id is required." },
);

export const AgentForkSchema = z.object({
  sessionId: uuid,
  atMessageIndex: z.number().int().min(0).max(1_000_000),
}).strict();

export const CheckpointCreateSchema = z.object({
  projectId: uuid,
  sessionId: uuid.nullable().optional(),
  label: z.string().trim().min(1).max(200).default("manual"),
}).strict();

export const CheckpointRestoreSchema = z.object({ checkpointId: uuid }).strict();

export const RevenueCatEventTypeSchema = z.enum([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "CANCELLATION",
  "EXPIRATION",
  "BILLING_ISSUE",
]);

export const RevenueCatEventSchema = z.object({
  id: z.string().min(1).max(500),
  type: RevenueCatEventTypeSchema,
  app_user_id: z.string().min(1).max(1_500),
  original_app_user_id: z.string().min(1).max(1_500).optional(),
  aliases: z.array(z.string().min(1).max(1_500)).max(100).optional(),
  product_id: z.string().min(1).max(500).optional(),
  entitlement_ids: z.array(z.string().min(1).max(500)).max(100).nullable().optional(),
  event_timestamp_ms: z.number().int().nonnegative(),
  expiration_at_ms: z.number().int().nonnegative().nullable().optional(),
  grace_period_expiration_at_ms: z.number().int().nonnegative().nullable().optional(),
  cancel_reason: z.string().max(200).optional(),
  expiration_reason: z.string().max(200).optional(),
  environment: z.enum(["PRODUCTION", "SANDBOX"]).optional(),
}).passthrough();

export const RevenueCatWebhookSchema = z.object({
  api_version: z.string().min(1).max(20),
  event: RevenueCatEventSchema,
}).strict();

export const RevenueCatSubscriberSchema = z.object({
  request_date: z.string().datetime({ offset: true }).optional(),
  subscriber: z.object({
    entitlements: z.record(z.object({
      expires_date: z.string().datetime({ offset: true }).nullable(),
      grace_period_expires_date: z.string().datetime({ offset: true }).nullable().optional(),
      product_identifier: z.string(),
      purchase_date: z.string().datetime({ offset: true }).optional(),
    }).passthrough()),
    subscriptions: z.record(z.object({
      expires_date: z.string().datetime({ offset: true }).nullable(),
      grace_period_expires_date: z.string().datetime({ offset: true }).nullable().optional(),
      billing_issues_detected_at: z.string().datetime({ offset: true }).nullable().optional(),
      unsubscribe_detected_at: z.string().datetime({ offset: true }).nullable().optional(),
    }).passthrough()),
  }).passthrough(),
}).passthrough();

export type RevenueCatEvent = z.infer<typeof RevenueCatEventSchema>;
