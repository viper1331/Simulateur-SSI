import { z } from 'zod';

export const siteConfigSchema = z.object({
  evacOnDAI: z.boolean(),
  evacOnDMDelayMs: z.number().int().min(0).max(600000),
  processAckRequired: z.boolean()
});

export const processAckSchema = z.object({
  ackedBy: z.string().min(1)
});
