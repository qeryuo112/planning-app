import { z } from 'zod';

export const CheckinResultEnum = z.enum(['completed', 'partial', 'skipped', 'makeup']);

export const CheckinSchema = z.object({
  taskId: z.string().optional(),
  habitId: z.string().optional(),
  date: z.string(), // YYYY-MM-DD
  result: CheckinResultEnum,
  actualMinutes: z.number().int().nonnegative().optional(),
  qualityRating: z.number().int().min(1).max(5).optional(),
  isMakeup: z.boolean().default(false),
  blockReasonTag: z.string().optional(),
  note: z.string().optional(),
});

export type CheckinInput = z.infer<typeof CheckinSchema>;
