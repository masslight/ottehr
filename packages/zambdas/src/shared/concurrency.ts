import { Context } from 'aws-lambda';

/**
 * Runs `worker` over `items` with at most `limit` running at once, preserving input order in the
 * result. Use instead of `Promise.all` whenever the item count is driven by patient data: a record
 * with hundreds of documents would otherwise open hundreds of simultaneous requests.
 *
 * Rejects as soon as any worker rejects. Work already in flight is not cancelled, so a caller that
 * needs to stop early should check its own budget inside the worker.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const run = async (): Promise<void> => {
    for (;;) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  };

  const poolSize = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: poolSize }, () => run()));
  return results;
}

/** Resolves with `work`, or with `onDeadline()` once the deadline passes; `work` itself is not cancelled. */
export const settleByDeadline = <T>(
  work: Promise<T>,
  deadline: number | undefined,
  onDeadline: () => T
): Promise<T> => {
  if (deadline === undefined) return work;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(onDeadline()), Math.max(0, deadline - Date.now()));
  });
  return Promise.race([work, expired]).finally(() => clearTimeout(timer));
};

/** The time to stop waiting so the response still goes out `reserveMs` before the Lambda timeout; none without a Lambda context. */
export const deadlineFromContext = (context: Context | undefined, reserveMs: number): number | undefined =>
  context ? Date.now() + context.getRemainingTimeInMillis() - reserveMs : undefined;
