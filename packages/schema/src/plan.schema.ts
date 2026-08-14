import { z } from 'zod';

export const HorizonEnum = z.enum(['long', 'medium', 'short']);
export const EnergyLevelEnum = z.enum(['high', 'medium', 'low']);

export const GoalSchema = z.object({
  title: z.string().min(1),
  horizon: HorizonEnum,
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  successCriteria: z.array(z.string()).optional(),
});

export const MilestoneSchema = z.object({
  title: z.string().min(1),
  dueDate: z.string().optional(),
  weight: z.number().min(0).max(1),
});

export const TaskSchema = z.object({
  title: z.string().min(1),
  date: z.string().optional(),
  durationMinutes: z.number().int().positive().optional(),
  energyLevel: EnergyLevelEnum,
  repeatRule: z.record(z.unknown()).nullable().optional(),
  milestoneRef: z.string().optional(),
  minimumStandard: z.string().optional(),
});

export const HabitSchema = z.object({
  title: z.string().min(1),
  frequency: z.string(),
  preferredTime: z.string().optional(),
  energyLevel: EnergyLevelEnum,
  minimumStandard: z.string().optional(),
});

export const PlanDraftSchema = z.object({
  goal: GoalSchema,
  milestones: z.array(MilestoneSchema),
  tasks: z.array(TaskSchema),
  habits: z.array(HabitSchema),
  assumptions: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  estimatedWeeklyLoad: z.object({
    totalMinutes: z.number().int().nonnegative(),
    highEnergyMinutes: z.number().int().nonnegative(),
  }),
});

export type PlanDraft = z.infer<typeof PlanDraftSchema>;
export type GoalInput = z.infer<typeof GoalSchema>;
export type TaskInput = z.infer<typeof TaskSchema>;
export type HabitInput = z.infer<typeof HabitSchema>;
