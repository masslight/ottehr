import { renderHook } from '@testing-library/react';
import { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

// Hands each mounted consumer its own token, so a test can stage the divergence that the
// useAuthToken race used to produce: one consumer holding a token, another holding none.
const tokensByMountOrder: (string | undefined)[] = [];

vi.mock('../../src/hooks/useAuthToken', async () => {
  const { useState } = await import('react');
  let mounted = 0;
  return {
    useAuthToken: () => {
      const [index] = useState(() => mounted++);
      return tokensByMountOrder[index];
    },
  };
});

// The client store lives in module scope, so each test needs a fresh copy of the module.
const loadUseApiClients = async (): Promise<() => { oystehrZambda?: { config: { accessToken?: string } } }> => {
  vi.resetModules();
  return (await import('../../src/hooks/useAppClients')).useApiClients as any;
};

describe('useApiClients', () => {
  it('does not publish a zambda client for a consumer with no token', async () => {
    const useApiClients = await loadUseApiClients();
    tokensByMountOrder.length = 0;
    tokensByMountOrder.push(undefined);

    const { result } = renderHook(() => useApiClients());

    // A token-less client would be published to the shared store, where every consumer's
    // `enabled: !!oystehrZambda` gate reads it as ready and fires unauthenticated requests.
    expect(result.current.oystehrZambda).toBeUndefined();
  });

  it('settles on the token-carrying client when consumers disagree about the token', async () => {
    const useApiClients = await loadUseApiClients();
    tokensByMountOrder.length = 0;
    tokensByMountOrder.push(undefined, 'the-token');

    // The token-less consumer mounts first and shares the store with the token-carrying one.
    // Unguarded, the two rewrite the shared client in turn; in the browser each write re-triggers
    // the other's effect until React throws "Maximum update depth exceeded". act() flushes effects
    // differently from the browser's paint-scheduled passive effects, so the runaway loop itself
    // does not reproduce here — what this pins is the divergence that feeds it: unguarded, the
    // store ends up holding the token-less client.
    const TokenlessConsumer = (): null => {
      useApiClients();
      return null;
    };
    const { result, rerender } = renderHook(() => useApiClients(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <>
          <TokenlessConsumer />
          {children}
        </>
      ),
    });

    expect(result.current.oystehrZambda?.config.accessToken).toBe('the-token');

    const client = result.current.oystehrZambda;
    rerender();
    expect(result.current.oystehrZambda).toBe(client);
  });
});
