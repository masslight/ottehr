import { z } from 'zod';

export const UserActivationModeSchema = z.enum(['activate', 'deactivate'] as const);
export type UserActivationMode = z.infer<typeof UserActivationModeSchema>;

export const UserActivationZambdaInputSchema = z.object({
  userId: z.string().uuid(),
  mode: UserActivationModeSchema,
});
export type UserActivationZambdaInput = z.infer<typeof UserActivationZambdaInputSchema>;

export type UserActivationZambdaOutput = Record<string, string>;
