import { User } from '@oystehr/sdk';

export interface DeactivateUserZambdaInput {
  user: User;
}

export type DeactivateUserZambdaOutput = Record<string, never>;
