import { Context } from 'aws-lambda';

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
