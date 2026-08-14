import { z } from 'zod';

export const EnergySlotSchema = z.object({
  start: z.string(), // HH:mm
  end: z.string(),
  level: z.enum(['high', 'medium', 'low']),
});

export const AvailableTimeSchema = z.object({
  weekday: z.array(EnergySlotSchema),
  weekend: z.array(EnergySlotSchema),
});

export const UserPreferencesSchema = z.object({
  timezone: z.string().default('Asia/Shanghai'),
  availableTime: AvailableTimeSchema,
  energyCurve: z.array(EnergySlotSchema),
  notificationSetting: z.record(z.unknown()).default({}),
});

export type UserPreferences = z.infer<typeof UserPreferencesSchema>;
