import { act } from '@testing-library/react';
import { vi } from 'vitest';

/**
 * A chart-data mutation captured mid-flight, so a test can decide what the user does before the
 * server answers — which is the whole point of the observation write reconciliation.
 */
export type DeferredCall = {
  variables: any;
  resolve: (data?: any) => void;
  reject: (error?: unknown) => void;
};

/**
 * Stands in for a `mutateAsync` that never settles on its own, pushing each call onto `calls`.
 *
 * Pair it with `isPending: false` when mocking useSaveChartData / useDeleteChartData: the
 * per-call-site mutation state is exactly what fails to lock the other components during a bulk
 * write, so it must not be what makes a locking assertion pass.
 */
export const createDeferredMutation = (calls: DeferredCall[]): ReturnType<typeof vi.fn> =>
  vi.fn(
    (variables: any) =>
      new Promise<any>((resolve, reject) => {
        calls.push({ variables, resolve, reject });
      })
  );

/** Answers one captured call. */
export const settle = async (call: DeferredCall, data: any = { chartData: {} }): Promise<void> => {
  await act(async () => {
    call.resolve(data);
  });
};

/** Fails one captured call, to exercise the rollback. */
export const fail = async (call: DeferredCall, error: unknown = new Error('save failed')): Promise<void> => {
  await act(async () => {
    call.reject(error);
  });
};

/** Answers everything captured so far and empties `calls`. */
export const settleAll = async (calls: DeferredCall[], data: any = { chartData: {} }): Promise<void> => {
  const pending = calls.splice(0, calls.length);

  await act(async () => {
    pending.forEach((call) => call.resolve(data));
  });
};
