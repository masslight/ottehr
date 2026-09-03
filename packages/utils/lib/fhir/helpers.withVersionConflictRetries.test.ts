import { describe, expect, it, vi } from 'vitest';
import { isVersionConflictError, withVersionConflictRetries } from './helpers';

const conflict = (): Error => Object.assign(new Error('Precondition Failed'), { code: 412 });

describe('isVersionConflictError', () => {
  it('classifies errors carrying a 412 code, statusCode, or message', () => {
    expect(isVersionConflictError({ code: 412 })).toBe(true);
    expect(isVersionConflictError({ statusCode: 412 })).toBe(true);
    expect(isVersionConflictError(new Error('request failed with status 412'))).toBe(true);
  });

  it('does not classify other errors, including non-string messages', () => {
    expect(isVersionConflictError({ code: 409 })).toBe(false);
    expect(isVersionConflictError(new Error('boom'))).toBe(false);
    expect(isVersionConflictError({ message: 412 })).toBe(false);
    expect(isVersionConflictError(undefined)).toBe(false);
    expect(isVersionConflictError(null)).toBe(false);
  });
});

describe('withVersionConflictRetries', () => {
  it('returns the callback result without retrying on success', async () => {
    const fn = vi.fn().mockResolvedValue('done');
    await expect(withVersionConflictRetries(fn)).resolves.toBe('done');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(1);
  });

  it('retries on a version conflict and reports each conflict with its attempt number', async () => {
    const fn = vi.fn().mockRejectedValueOnce(conflict()).mockRejectedValueOnce(conflict()).mockResolvedValue('done');
    const onConflict = vi.fn();
    await expect(withVersionConflictRetries(fn, { onConflict })).resolves.toBe('done');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(fn).toHaveBeenNthCalledWith(3, 3);
    expect(onConflict.mock.calls).toEqual([[1], [2]]);
  });

  it('rethrows a conflict once the attempts are exhausted (3 by default)', async () => {
    const fn = vi.fn().mockRejectedValue(conflict());
    await expect(withVersionConflictRetries(fn)).rejects.toMatchObject({ code: 412 });
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('respects a caller-provided maxAttempts', async () => {
    const fn = vi.fn().mockRejectedValue(conflict());
    await expect(withVersionConflictRetries(fn, { maxAttempts: 5 })).rejects.toMatchObject({ code: 412 });
    expect(fn).toHaveBeenCalledTimes(5);
  });

  it('rethrows non-conflict errors immediately without retrying', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('boom'));
    const onConflict = vi.fn();
    await expect(withVersionConflictRetries(fn, { onConflict })).rejects.toThrow('boom');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(onConflict).not.toHaveBeenCalled();
  });
});
