import { z } from 'zod';

export const requiredTextSchema = z.string().trim().min(1);

export const optionalTextSchema = z
  .string()
  .nullish()
  .transform((value) => value?.trim() || undefined);

export const isBlankText = (value: unknown): boolean => typeof value === 'string' && !value.trim();
