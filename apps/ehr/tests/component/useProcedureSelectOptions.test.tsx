import Oystehr from '@oystehr/sdk';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { ValueSet } from 'fhir/r4b';
import { ReactNode } from 'react';
import { BODY_SITES_VALUE_SET_URL } from 'utils';
import { describe, expect, it, vi } from 'vitest';
import {
  latestValueSet,
  useProcedureSelectOptions,
} from '../../src/features/visits/in-person/components/procedures/useProcedureSelectOptions';

const createWrapper = (): ((props: { children: ReactNode }) => JSX.Element) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('procedure select options', () => {
  it('selects the latest dotted numeric ValueSet version', () => {
    const valueSets: ValueSet[] = [
      { resourceType: 'ValueSet', status: 'active', url: BODY_SITES_VALUE_SET_URL, version: '1.0.10' },
      { resourceType: 'ValueSet', status: 'active', url: BODY_SITES_VALUE_SET_URL, version: '1.0.2' },
    ];

    expect(latestValueSet(BODY_SITES_VALUE_SET_URL, valueSets)?.version).toBe('1.0.10');
  });

  it('waits for the Oystehr client before loading and caching options', async () => {
    const search = vi.fn().mockResolvedValue({
      unbundle: () => [
        {
          resourceType: 'ValueSet',
          status: 'active',
          url: BODY_SITES_VALUE_SET_URL,
          version: '1.0.1',
          expansion: { timestamp: '2026-09-03T00:00:00.000Z', contains: [{ code: 'hand', display: 'Hand' }] },
        } satisfies ValueSet,
      ],
    });
    const client = { fhir: { search } } as unknown as Oystehr;
    const initialProps: { oystehr: Oystehr | undefined } = { oystehr: undefined };
    const { result, rerender } = renderHook(
      ({ oystehr }: { oystehr: Oystehr | undefined }) => useProcedureSelectOptions(oystehr),
      { initialProps, wrapper: createWrapper() }
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(search).not.toHaveBeenCalled();

    rerender({ oystehr: client });
    await waitFor(() => expect(result.current.data?.bodySites).toEqual(['Hand']));
    expect(search).toHaveBeenCalledTimes(1);
  });

  it('loads ValueSets from every FHIR search page before selecting the latest version', async () => {
    const oldValueSet = {
      resourceType: 'ValueSet',
      id: 'body-sites-old',
      status: 'active',
      url: BODY_SITES_VALUE_SET_URL,
      version: '1.0.1',
      expansion: { timestamp: '2026-09-03T00:00:00.000Z', contains: [{ code: 'arm', display: 'Arm' }] },
    } satisfies ValueSet;
    const latestValueSet = {
      resourceType: 'ValueSet',
      id: 'body-sites-latest',
      status: 'active',
      url: BODY_SITES_VALUE_SET_URL,
      version: '1.0.2',
      expansion: { timestamp: '2026-09-03T00:00:00.000Z', contains: [{ code: 'hand', display: 'Hand' }] },
    } satisfies ValueSet;
    const pages = [oldValueSet, latestValueSet];
    const search = vi.fn().mockImplementation(async ({ params }) => {
      const offset = Number(params.find((param: { name: string }) => param.name === '_offset')?.value ?? 0);
      const resource = pages[offset];
      return {
        total: pages.length,
        entry: resource ? [{ resource, search: { mode: 'match' } }] : [],
        unbundle: () => (resource ? [resource] : []),
      };
    });
    const client = { fhir: { search } } as unknown as Oystehr;
    const { result } = renderHook(() => useProcedureSelectOptions(client), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.data?.bodySites).toEqual(['Hand']));
    expect(search).toHaveBeenCalledTimes(2);
  });
});
