import { z } from 'zod';

export const DeleteUserZambdaInputSchema = z.object({
  userId: z.string().uuid(),
});
export type DeleteUserZambdaInput = z.infer<typeof DeleteUserZambdaInputSchema>;

export interface DeleteUserZambdaOutput {
  message: string;
}
