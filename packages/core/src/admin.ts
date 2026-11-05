import { z } from 'zod';
import { NEWS_CATEGORIES, TOOL_CATEGORIES } from './app-api';

/** Input validation for the content admin (news articles, tools, authors). */

const slug = z
  .string()
  .trim()
  .min(2)
  .max(96)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and single hyphens');

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a #RRGGBB color');

export const articleInputSchema = z.object({
  /** Omit to derive from the title (new articles only). */
  slug: slug.optional(),
  title: z.string().trim().min(8).max(200),
  dek: z.string().trim().min(8).max(400),
  category: z.enum(NEWS_CATEGORIES as unknown as [string, ...string[]]),
  flag: z.enum(['Breaking', 'Analysis', 'Exclusive']).nullable().default(null),
  authorSlug: slug,
  status: z.enum(['draft', 'published']).default('draft'),
  /** Markdown. */
  body: z.string().trim().min(20).max(100_000),
  cover: z.object({ big: z.string().trim().min(1).max(8), caption: z.string().trim().min(1).max(24), color: hexColor }),
  faq: z.array(z.object({ q: z.string().trim().min(3).max(300), a: z.string().trim().min(3).max(2000) })).max(12).default([]),
  mentionedModelIds: z.array(z.string().min(3).max(120)).max(12).default([]),
  pullQuote: z.object({ text: z.string().trim().min(3).max(400), cite: z.string().trim().min(1).max(120) }).nullable().default(null),
});

export type ArticleInput = z.input<typeof articleInputSchema>;
export type ArticleInputParsed = z.output<typeof articleInputSchema>;

export const toolInputSchema = z.object({
  slug,
  name: z.string().trim().min(1).max(80),
  tagline: z.string().trim().min(8).max(160),
  description: z.string().trim().min(8).max(4000),
  category: z.enum(TOOL_CATEGORIES as unknown as [string, ...string[]]),
  pricing: z.enum(['Free', 'Freemium', 'Paid']),
  rating: z.number().min(0).max(5).default(0),
  color: hexColor,
  letter: z.string().trim().min(1).max(3),
  url: z.url().max(500),
  runsOnVigas: z.boolean().default(false),
  isNew: z.boolean().default(false),
});

export type ToolInput = z.input<typeof toolInputSchema>;
export type ToolInputParsed = z.output<typeof toolInputSchema>;

export const authorInputSchema = z.object({
  slug,
  name: z.string().trim().min(2).max(80),
  role: z.string().trim().min(2).max(120),
  color: hexColor,
});

export type AuthorInput = z.input<typeof authorInputSchema>;
