import { z } from 'zod';

export const emailSchema = z.email('Enter a valid email address.').max(254).transform((s) => s.trim().toLowerCase());

export const signupSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, 'Password must be at least 8 characters.').max(200),
  name: z.string().trim().max(80).optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password.').max(200),
});
