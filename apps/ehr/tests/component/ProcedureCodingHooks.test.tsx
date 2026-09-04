import Oystehr from '@oystehr/sdk';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { ValueSet } from 'fhir/r4b';
import { ReactNode } from 'react';
import { EvaluationFamilyMatchKind, ProcedureFactsInput } from 'utils/lib/procedure-coding/model.types';
import { CPT_RULES_VINTAGE } from 'utils/lib/procedure-coding/provenance';
import { BODY_SITES_VALUE_SET_URL } from 'utils/lib/types/api/procedures.constants';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  latestValueSet,
  useProcedureSelectOptions,
} from '../../src/features/visits/in-person/components/procedures/useProcedureSelectOptions';
import {
  ProcedureCodingEvaluationStateKind,
  useProcedureCoding,
} from '../../src/features/visits/in-person/hooks/useProcedureCoding';

const LACERATION_FACTS: ProcedureFactsInput = {
  procedureType: 'Laceration Repair',
  bodySite: 'Hand',
  lengthCm: 3.2,
  repairDepth: 'subcutaneous-layered',
  procedureDetails: 'Layered closure performed on the hand.',
};

describe('useProcedureCoding temporal state', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('starts evaluating and becomes ready with both directions after the debounce', () => {
    const { result } = renderHook(() => useProcedureCoding(LACERATION_FACTS));

    expect(result.current.rulesVintage).toBe(CPT_RULES_VINTAGE);
    expect(result.current.evaluationState).toEqual({
      kind: ProcedureCodingEvaluationStateKind.Evaluating,
      previous: null,
    });

    act(() => vi.advanceTimersByTime(500));

    expect(result.current.evaluationState.kind).toBe(ProcedureCodingEvaluationStateKind.Ready);
    if (result.current.evaluationState.kind !== ProcedureCodingEvaluationStateKind.Ready) {
      throw new Error('Expected the coding evaluation to be ready');
    }
    expect(result.current.evaluationState.current.suggestion.family).toEqual({
      kind: EvaluationFamilyMatchKind.Matched,
      id: 'laceration',
    });
    expect(result.current.evaluationState.current.defense.family).toEqual({
      kind: EvaluationFamilyMatchKind.Matched,
      id: 'laceration',
    });
  });

  it('retains the previous result only while reevaluating the same family', () => {
    const { result, rerender } = renderHook(({ facts }) => useProcedureCoding(facts), {
      initialProps: { facts: LACERATION_FACTS },
    });
    act(() => vi.advanceTimersByTime(500));

    rerender({
      facts: { ...LACERATION_FACTS, procedureDetails: 'Layered hand closure. Tetanus status reviewed.' },
    });

    expect(result.current.evaluationState.kind).toBe(ProcedureCodingEvaluationStateKind.Evaluating);
    if (result.current.evaluationState.kind !== ProcedureCodingEvaluationStateKind.Evaluating) {
      throw new Error('Expected reevaluation after changing the note');
    }
    expect(result.current.evaluationState.previous?.suggestion.family).toEqual({
      kind: EvaluationFamilyMatchKind.Matched,
      id: 'laceration',
    });

    rerender({
      facts: {
        procedureType: 'Diagnostic EKG',
        procedureDetails: '12-lead EKG obtained. Rate 82, normal sinus rhythm.',
      },
    });

    expect(result.current.evaluationState).toEqual({
      kind: ProcedureCodingEvaluationStateKind.Evaluating,
      previous: null,
    });
  });

  it('cancels a superseded timer instead of publishing stale facts', () => {
    const { result, rerender } = renderHook(({ facts }) => useProcedureCoding(facts), {
      initialProps: { facts: LACERATION_FACTS },
    });

    act(() => vi.advanceTimersByTime(499));
    rerender({ facts: { ...LACERATION_FACTS, lengthCm: 4.1 } });
    act(() => vi.advanceTimersByTime(1));

    expect(result.current.evaluationState.kind).toBe(ProcedureCodingEvaluationStateKind.Evaluating);

    act(() => vi.advanceTimersByTime(499));
    expect(result.current.evaluationState.kind).toBe(ProcedureCodingEvaluationStateKind.Ready);
  });

  it('publishes an explicit unmatched result for an unsupported procedure type', () => {
    const { result } = renderHook(() => useProcedureCoding({ procedureType: 'X-Ray' }));

    act(() => vi.advanceTimersByTime(500));

    expect(result.current.evaluationState.kind).toBe(ProcedureCodingEvaluationStateKind.Ready);
    if (result.current.evaluationState.kind !== ProcedureCodingEvaluationStateKind.Ready) {
      throw new Error('Expected the unsupported procedure evaluation to be ready');
    }
    expect(result.current.evaluationState.current.suggestion.family).toEqual({
      kind: EvaluationFamilyMatchKind.Unmatched,
    });
  });
});

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

  it('loads every FHIR search page before selecting the latest version', async () => {
    const oldValueSet = {
      resourceType: 'ValueSet',
      id: 'body-sites-old',
      status: 'active',
      url: BODY_SITES_VALUE_SET_URL,
      version: '1.0.1',
      expansion: { timestamp: '2026-09-03T00:00:00.000Z', contains: [{ code: 'arm', display: 'Arm' }] },
    } satisfies ValueSet;
    const currentValueSet = {
      resourceType: 'ValueSet',
      id: 'body-sites-latest',
      status: 'active',
      url: BODY_SITES_VALUE_SET_URL,
      version: '1.0.2',
      expansion: { timestamp: '2026-09-03T00:00:00.000Z', contains: [{ code: 'hand', display: 'Hand' }] },
    } satisfies ValueSet;
    const pages = [oldValueSet, currentValueSet];
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
