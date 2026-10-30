// Stands in for packages/zambdas/src/subscriptions/task/helpers.ts.
import Oystehr from '@oystehr/sdk';
import { ClinicalOystehr } from './clinical';

type Handler<Client extends Oystehr> = (input: { taskId: string }, oystehr: Client) => Promise<void>;

export function wrapTaskHandler<Client extends Oystehr>(
  name: string,
  handler: Handler<Client>,
  options: { retry?: boolean; createClient: () => Client }
): () => Promise<void>;
export function wrapTaskHandler(
  name: string,
  handler: Handler<ClinicalOystehr>,
  options?: { retry?: boolean }
): () => Promise<void>;
export function wrapTaskHandler(): () => Promise<void> {
  return async () => undefined;
}
