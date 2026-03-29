import { describe, expect, it } from 'vitest';
import { makePromiseWithTimeout } from './timeout';

describe('makePromiseWithTimeout', () => {
  it('should resolve when promise resolves before timeout', async () => {
    const result = await makePromiseWithTimeout(Promise.resolve('success'), 1000, 'test');
    expect(result).toBe('success');
  });

  it('should reject when promise takes longer than timeout', async () => {
    const slowPromise = new Promise<string>((resolve) => setTimeout(() => resolve('late'), 500));
    await expect(makePromiseWithTimeout(slowPromise, 10, 'slow')).rejects.toThrow('Timed out after 10 ms');
  });

  it('should include promise name in timeout error message', async () => {
    const slowPromise = new Promise<string>((resolve) => setTimeout(() => resolve('late'), 500));
    await expect(makePromiseWithTimeout(slowPromise, 10, 'myPromise')).rejects.toThrow('myPromise');
  });

  it('should propagate original error when promise rejects before timeout', async () => {
    const failingPromise = Promise.reject(new Error('original error'));
    await expect(makePromiseWithTimeout(failingPromise, 1000, 'test')).rejects.toThrow('original error');
  });

  it('should work without a promise name', async () => {
    const result = await makePromiseWithTimeout(Promise.resolve(42), 1000);
    expect(result).toBe(42);
  });
});
