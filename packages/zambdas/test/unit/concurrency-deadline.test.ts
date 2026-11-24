import { Context } from 'aws-lambda';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deadlineFromContext, settleByDeadline } from '../../src/shared/concurrency';

describe('deadlineFromContext', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps the reserve back from the time the Lambda has left', () => {
    vi.useFakeTimers({ now: 1_000_000 });
    const context = { getRemainingTimeInMillis: () => 30_000 } as Context;

    expect(deadlineFromContext(context, 3_000)).toBe(1_027_000);
  });

  it('sets no deadline without a Lambda context', () => {
    expect(deadlineFromContext(undefined, 3_000)).toBeUndefined();
  });
});

describe('settleByDeadline', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves with the fallback once the deadline passes', async () => {
    vi.useFakeTimers();
    const result = settleByDeadline(new Promise<string>(() => undefined), Date.now() + 500, () => 'expired');

    await vi.advanceTimersByTimeAsync(500);
    await expect(result).resolves.toBe('expired');
  });

  it('waits for the work without a deadline', async () => {
    await expect(settleByDeadline(Promise.resolve('done'), undefined, () => 'expired')).resolves.toBe('done');
  });
});
