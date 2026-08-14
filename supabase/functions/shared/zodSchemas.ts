import { z } from "zod";

const uuid = z.string().uuid();
const trimmed = (max: number) => z.string().trim().min(1).max(max);

export const EmptyInputSchema = z.object({}).strict();

export const ProjectCreateSchema = z.object({
  name: trimmed(100),
  description: z.string().trim().max(2_000).nullable().optional(),
  template: z.string().trim().min(1).max(40).optional(),
}).strict();

export const ProjectFilesSchema = z.object({
  projectId: uuid,
}).strict();

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
}).strict();

export const AgentResumeSchema = z.object({
  sessionId: uuid,
  prompt: trimmed(50_000),
}).strict();

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
