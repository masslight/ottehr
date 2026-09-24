import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mirrors the real hook: every consumer reads the same auth0 context value.
const auth0State: { isAuthenticated: boolean; getAccessTokenSilently: () => Promise<string> } = {
  isAuthenticated: true,
  getAccessTokenSilently: () => Promise.resolve('token'),
};

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => auth0State,
}));

const deferred = (): { promise: Promise<string>; resolve: (value: string) => void } => {
  let resolve!: (value: string) => void;
  const promise = new Promise<string>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

// useAuthToken caches the token in module scope, so each test needs a fresh copy of the module.
const loadUseAuthToken = async (): Promise<() => string | undefined> => {
  vi.resetModules();
  return (await import('../../src/hooks/useAuthToken')).useAuthToken;
};

describe('useAuthToken', () => {
  beforeEach(() => {
    auth0State.isAuthenticated = true;
    auth0State.getAccessTokenSilently = () => Promise.resolve('token');
  });

  it('shares one in-flight fetch across concurrent consumers', async () => {
    const useAuthToken = await loadUseAuthToken();
    const pending = deferred();
    const getAccessTokenSilently = vi.fn(() => pending.promise);
    auth0State.getAccessTokenSilently = getAccessTokenSilently;

    const first = renderHook(() => useAuthToken());
    const second = renderHook(() => useAuthToken());

    expect(getAccessTokenSilently).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.resolve('the-token');
      await pending.promise;
    });

    expect(first.result.current).toBe('the-token');
    expect(second.result.current).toBe('the-token');
  });

  it('adopts a token that another consumer resolved first', async () => {
    const useAuthToken = await loadUseAuthToken();
    const pending = deferred();
    const getAccessTokenSilently = vi.fn(() => pending.promise);
    auth0State.getAccessTokenSilently = getAccessTokenSilently;

    // A consumer whose effect runs before auth0 reports a session does nothing on that pass.
    auth0State.isAuthenticated = false;
    const late = renderHook(() => useAuthToken());
    expect(late.result.current).toBeUndefined();

    // Another consumer fetches and resolves the token in the meantime.
    auth0State.isAuthenticated = true;
    const early = renderHook(() => useAuthToken());
    await act(async () => {
      pending.resolve('the-token');
      await pending.promise;
    });
    expect(early.result.current).toBe('the-token');

    // The late consumer's effect now re-runs with the token already cached. It must adopt it
    // rather than skip the fetch and stay undefined for the rest of the session.
    late.rerender();
    await waitFor(() => expect(late.result.current).toBe('the-token'));
    expect(getAccessTokenSilently).toHaveBeenCalledTimes(1);
  });
});
