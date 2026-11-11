// Stands in for packages/zambdas/src/subscriptions/task/helpers.ts.
import Oystehr from '@oystehr/sdk';

export function wrapTaskHandler(
  name: string,
  handler: (input: { taskId: string }, oystehr: Oystehr) => Promise<void>,
  options: { retry?: boolean; createClient?: () => Oystehr } = {}
): () => Promise<void> {
  return () => handler({ taskId: name }, options.createClient?.() ?? new Oystehr({}));
}
