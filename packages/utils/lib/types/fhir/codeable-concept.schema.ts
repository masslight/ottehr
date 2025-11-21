import { z } from 'zod';

const CodingSchema = z.object({
  system: z.string().url().optional(),
  code: z.string().optional(),
  display: z.string().optional(),
});

export const CodeableConceptSchema = z.object({
  coding: z.array(CodingSchema).optional(),
  text: z.string().optional(),
});
