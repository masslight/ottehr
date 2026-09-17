import Oystehr from '@oystehr/sdk';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { ValueSet } from 'fhir/r4b';
import { ReactNode, StrictMode } from 'react';
import { parseAiSuggestions } from 'utils/lib/procedure-coding/ai';
import {
  CodeOutcomeKind,
  EvaluationFamilyMatchKind,
  EvaluationResult,
  ProcedureFactsInput,
} from 'utils/lib/procedure-coding/model.types';
import { PROCEDURE_NAMES } from 'utils/lib/procedure-coding/procedure-names';
import { CPT_RULES_VINTAGE } from 'utils/lib/procedure-coding/provenance';
import { BODY_SITES_VALUE_SET_URL, PROCEDURE_TYPES_VALUE_SET_URL } from 'utils/lib/types/api/procedures.constants';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  latestValueSet,
  useProcedureSelectOptions,
} from '../../src/features/visits/in-person/components/procedures/useProcedureSelectOptions';
import {
  ProcedureCodingEvaluationStateKind,
  useProcedureCoding,
} from '../../src/features/visits/in-person/hooks/useProcedureCoding';

const { recommend, api } = vi.hoisted(() => {
  const recommend = vi.fn();
  return { recommend, api: { recommendBillingCodes: recommend } };
});
vi.mock('../../src/features/visits/shared/hooks/useOystehrAPIClient', () => ({ useOystehrAPIClient: () => api }));

const response = (): EvaluationResult =>
  parseAiSuggestions('[{"code":"12345","description":"Suggested procedure","useWhen":"Review the documentation"}]');

/** Past the longest debounce: the rules engine settles at 500 ms, an AI request waits 5 s. */
async function evaluate(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000);
  });
}

const LACERATION_FACTS: ProcedureFactsInput = {
  procedureType: PROCEDURE_NAMES.laceration[0],
  bodySite: 'Hand',
  lengthCm: 3.2,
  repairDepth: 'subcutaneous-layered',
  procedureDetails: 'Layered closure performed on the hand.',
};

describe('procedure routing and asynchronous AI results', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    recommend.mockReset();
    recommend.mockResolvedValue(response());
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('answers from the rules engine, in both directions, without asking AI', () => {
    const { result } = renderHook(() => useProcedureCoding(LACERATION_FACTS));

    expect(result.current.rulesVintage).toBe(CPT_RULES_VINTAGE);
    expect(result.current.evaluationState).toEqual({
      kind: ProcedureCodingEvaluationStateKind.Evaluating,
      previous: null,
    });

    act(() => vi.advanceTimersByTime(500));

    expect(recommend).not.toHaveBeenCalled();
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

  it('does not call AI for an exactly matched family with missing answers', async () => {
    const { result } = renderHook(() => useProcedureCoding({ procedureType: 'Laceration Repair (Wound Closure)' }));
    await evaluate();
    expect(recommend).not.toHaveBeenCalled();
    expect(result.current.evaluationState.kind).toBe(ProcedureCodingEvaluationStateKind.Ready);
    if (result.current.evaluationState.kind === 'ready') {
      expect(result.current.evaluationState.current.suggestion.source).toBe('rules');
      expect(result.current.evaluationState.current.suggestion.outcome).toMatchObject({
        kind: CodeOutcomeKind.Suggestions,
        suggestions: [],
      });
    }
  });

  it('sends structured answers and narrative only after exact matching fails', async () => {
    renderHook(() =>
      useProcedureCoding({
        procedureType: 'custom unknown',
        structuredFacts: { count: 2 },
        procedureDetails: 'Clinical narrative',
      })
    );
    await evaluate();
    expect(recommend).toHaveBeenCalledWith(
      expect.objectContaining({
        procedureType: 'custom unknown',
        structuredFacts: { count: 2 },
        procedureDetails: 'Clinical narrative',
      })
    );
  });

  it('keeps the previous result on screen while the same family is reevaluated', () => {
    const { result, rerender } = renderHook(({ facts }) => useProcedureCoding(facts), {
      initialProps: { facts: LACERATION_FACTS },
    });
    act(() => vi.advanceTimersByTime(500));

    rerender({
      facts: { ...LACERATION_FACTS, procedureDetails: 'Layered hand closure. Tetanus status reviewed.' },
    });

    if (result.current.evaluationState.kind !== ProcedureCodingEvaluationStateKind.Evaluating) {
      throw new Error('Expected reevaluation after changing the note');
    }
    expect(result.current.evaluationState.previous?.suggestion.family).toEqual({
      kind: EvaluationFamilyMatchKind.Matched,
      id: 'laceration',
    });
  });

  it('waits longer before reaching for AI than for the local rules engine', async () => {
    const { result } = renderHook(() => useProcedureCoding({ procedureType: 'X-Ray' }));

    // The spinner is up from the first render; only the request itself is held back.
    expect(result.current.evaluationState.kind).toBe(ProcedureCodingEvaluationStateKind.Evaluating);
    act(() => vi.advanceTimersByTime(500));
    expect(recommend).not.toHaveBeenCalled();
    expect(result.current.evaluationState.kind).toBe(ProcedureCodingEvaluationStateKind.Evaluating);

    await evaluate();

    expect(recommend).toHaveBeenCalledTimes(1);
    if (result.current.evaluationState.kind !== ProcedureCodingEvaluationStateKind.Ready) {
      throw new Error('Expected the unsupported procedure evaluation to be ready');
    }
    // An unsupported procedure type is reported as unmatched, never as a rules decision.
    expect(result.current.evaluationState.current.suggestion.family).toEqual({
      kind: EvaluationFamilyMatchKind.Unmatched,
    });
  });

  it('ignores a late AI response after the procedure changes to a known family', async () => {
    let resolve!: (value: EvaluationResult) => void;
    recommend.mockReturnValue(
      new Promise<EvaluationResult>((done) => {
        resolve = done;
      })
    );
    const { result, rerender } = renderHook((facts: ProcedureFactsInput) => useProcedureCoding(facts), {
      initialProps: { procedureType: 'unknown' } as ProcedureFactsInput,
    });
    await evaluate();
    rerender({ procedureType: 'Nail Trephination (Subungual Hematoma Drainage)' });
    await evaluate();
    await act(async () => resolve(response()));
    if (result.current.evaluationState.kind !== 'ready') throw new Error('Expected current evaluation');
    expect(result.current.evaluationState.current.suggestion.source).toBe('rules');
  });

  it('ignores stale answers for a previous unknown name', async () => {
    let resolve!: (value: EvaluationResult) => void;
    recommend.mockReturnValueOnce(
      new Promise<EvaluationResult>((done) => {
        resolve = done;
      })
    );
    const { result, rerender } = renderHook((facts: ProcedureFactsInput) => useProcedureCoding(facts), {
      initialProps: { procedureType: 'first unknown' },
    });
    await evaluate();
    recommend.mockResolvedValue(
      parseAiSuggestions('[{"code":"54321","description":"New result","useWhen":"Current form"}]')
    );
    rerender({ procedureType: 'second unknown' });
    await evaluate();
    await act(async () => resolve(response()));
    if (result.current.evaluationState.kind !== 'ready') throw new Error('Expected current evaluation');
    expect(result.current.evaluationState.current.suggestion.outcome).toMatchObject({
      suggestions: [{ code: '54321' }],
    });
  });

  it('leaves manual coding available when AI fails', async () => {
    recommend.mockRejectedValue(new Error('Unavailable'));
    const { result } = renderHook(() => useProcedureCoding({ procedureType: 'unknown' }));
    await evaluate();
    if (result.current.evaluationState.kind !== 'ready') throw new Error('Expected terminal evaluation');
    expect(result.current.evaluationState.current.suggestion.outcome).toMatchObject({
      kind: 'not-assessed',
      reason: expect.stringContaining('manually'),
    });
  });
});

describe('AI request count', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    recommend.mockReset();
    recommend.mockResolvedValue(response());
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('debounces rapid clinical edits and sends only the final input', async () => {
    const { rerender } = renderHook((facts: ProcedureFactsInput) => useProcedureCoding(facts), {
      initialProps: { procedureType: 'unknown', procedureDetails: 'a' },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    rerender({ procedureType: 'unknown', procedureDetails: 'ab' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(recommend).not.toHaveBeenCalled();
    rerender({ procedureType: 'unknown', procedureDetails: 'abc' });
    await evaluate();
    expect(recommend).toHaveBeenCalledTimes(1);
    expect(recommend.mock.calls[0][0].procedureDetails).toBe('abc');
  });

  it('shares an in-flight request across billing/context edits and equal objects with different key order', async () => {
    recommend.mockReturnValue(new Promise(() => {}));
    const { rerender } = renderHook((facts: ProcedureFactsInput) => useProcedureCoding(facts), {
      initialProps: { procedureType: 'unknown', structuredFacts: { count: 2, side: 'left' } } as ProcedureFactsInput,
    });
    await evaluate();
    rerender({
      procedureType: 'unknown',
      structuredFacts: { side: 'left', count: 2 },
      cptCodes: [{ code: '12345', display: 'selected' }],
      procedureId: 'saved-id',
      context: { completeDay: false, otherProcedures: [] },
      documentedBy: 'Different author',
    });
    await evaluate();
    expect(recommend).toHaveBeenCalledTimes(1);
    expect(recommend.mock.calls[0][0]).not.toHaveProperty('documentedBy');
    expect(recommend.mock.calls[0][0]).not.toHaveProperty('cptCodes');
  });

  it('reuses completed results when returning to earlier clinical input', async () => {
    const { rerender } = renderHook((facts: ProcedureFactsInput) => useProcedureCoding(facts), {
      initialProps: { procedureType: 'unknown', procedureDetails: 'first' },
    });
    await evaluate();
    rerender({ procedureType: 'unknown', procedureDetails: 'second' });
    await evaluate();
    rerender({ procedureType: 'unknown', procedureDetails: 'first' });
    await evaluate();
    expect(recommend).toHaveBeenCalledTimes(2);
  });

  it('does not duplicate a request under React StrictMode', async () => {
    renderHook(() => useProcedureCoding({ procedureType: 'unknown' }), { wrapper: StrictMode });
    await evaluate();
    expect(recommend).toHaveBeenCalledTimes(1);
  });

  it('does not request AI for an empty procedure selection', async () => {
    const { rerender } = renderHook((facts: ProcedureFactsInput) => useProcedureCoding(facts), { initialProps: {} });
    await evaluate();
    rerender({ procedureType: '   ' });
    await evaluate();
    expect(recommend).not.toHaveBeenCalled();
  });

  it('never repeats a request — successful or failed — when only a selected code changes', async () => {
    const { rerender } = renderHook((facts: ProcedureFactsInput) => useProcedureCoding(facts), {
      initialProps: { procedureType: 'unknown' } as ProcedureFactsInput,
    });
    await evaluate();
    rerender({ procedureType: 'unknown', cptCodes: [{ code: '12345', display: 'suggestion' }] });
    await evaluate();
    expect(recommend).toHaveBeenCalledTimes(1);

    recommend.mockRejectedValue(new Error('Unavailable'));
    rerender({ procedureType: 'unknown', procedureDetails: 'Additional evidence' });
    await evaluate();
    expect(recommend).toHaveBeenCalledTimes(2);
    rerender({
      procedureType: 'unknown',
      procedureDetails: 'Additional evidence',
      cptCodes: [{ code: '12345', display: 'manual' }],
    });
    await evaluate();
    expect(recommend).toHaveBeenCalledTimes(2);
  });

  it('retries the unchanged clinical input only when explicitly requested after failure', async () => {
    recommend.mockRejectedValueOnce(new Error('Unavailable'));
    const { result } = renderHook(() => useProcedureCoding({ procedureType: 'unknown' }));
    await evaluate();
    expect(recommend).toHaveBeenCalledTimes(1);
    act(() => result.current.retrySuggestions());
    await evaluate();
    expect(recommend).toHaveBeenCalledTimes(2);
    if (result.current.evaluationState.kind !== 'ready') throw new Error('Expected result');
    expect(result.current.evaluationState.current.suggestion.outcome.kind).toBe('suggestions');
  });

  it('does not display the previous unknown procedure’s suggestions while another procedure loads', async () => {
    const { result, rerender } = renderHook((facts: ProcedureFactsInput) => useProcedureCoding(facts), {
      initialProps: { procedureType: 'first unknown' },
    });
    await evaluate();
    rerender({ procedureType: 'second unknown' });
    expect(result.current.evaluationState).toEqual({ kind: 'evaluating', previous: null });
  });
});

const createWrapper = (): ((props: { children: ReactNode }) => JSX.Element) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('procedure select options', () => {
  it('ignores every catalog default code: the engine and the AI fallback are the only code sources', async () => {
    const cptExtensionUrl = 'https://fhir.ottehr.com/Extension/procedure-type-cpt';
    const valueSet: ValueSet = {
      resourceType: 'ValueSet',
      status: 'active',
      url: PROCEDURE_TYPES_VALUE_SET_URL,
      version: '1.0.1',
      expansion: {
        timestamp: '2026-09-11T00:00:00.000Z',
        contains: [
          {
            code: 'nebulizer-treatment',
            display: 'Nebulizer Treatment (e.g., Albuterol)',
            extension: [
              {
                url: cptExtensionUrl,
                valueCodeableConcept: { coding: [{ code: '94640', display: 'Inhalation treatment' }] },
              },
            ],
          },
          {
            code: 'tick-removal',
            display: 'Tick or Insect Removal',
            extension: [
              {
                url: cptExtensionUrl,
                valueCodeableConcept: { coding: [{ code: '10120', display: 'Foreign body removal' }] },
              },
            ],
          },
          {
            code: 'custom-splint',
            display: 'Custom splint application',
            extension: [
              {
                url: 'https://fhir.ottehr.com/Extension/procedure-type-hcpcs',
                valueCodeableConcept: { coding: [{ code: 'Q4049', display: 'Finger splint' }] },
              },
            ],
          },
        ],
      },
    };
    const client = {
      fhir: { search: vi.fn().mockResolvedValue({ unbundle: () => [valueSet] }) },
    } as unknown as Oystehr;
    const { result } = renderHook(() => useProcedureSelectOptions(client), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.procedureTypes).toEqual([
      { name: 'Custom splint application', code: 'custom-splint' },
      { name: 'Nebulizer Treatment (e.g., Albuterol)', code: 'nebulizer-treatment' },
      { name: 'Tick or Insect Removal', code: 'tick-removal' },
    ]);
  });

  it('waits for the Oystehr client before loading and caching alphabetically sorted options', async () => {
    const search = vi.fn().mockResolvedValue({
      unbundle: () => [
        {
          resourceType: 'ValueSet',
          status: 'active',
          url: BODY_SITES_VALUE_SET_URL,
          version: '1.0.1',
          expansion: {
            timestamp: '2026-09-03T00:00:00.000Z',
            contains: [
              { code: 'hand', display: 'Hand' },
              { code: 'foot', display: 'Foot' },
            ],
          },
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
    await waitFor(() => expect(result.current.data?.bodySites).toEqual(['Foot', 'Hand']));
    expect(search).toHaveBeenCalledTimes(1);
  });

  it('loads every FHIR search page and picks the highest version by number, not by text', async () => {
    const olderValueSet = {
      resourceType: 'ValueSet',
      id: 'body-sites-old',
      status: 'active',
      url: BODY_SITES_VALUE_SET_URL,
      // '1.0.2' sorts after '1.0.10' as text, so a text comparison would pick this one.
      version: '1.0.2',
      expansion: { timestamp: '2026-09-03T00:00:00.000Z', contains: [{ code: 'arm', display: 'Arm' }] },
    } satisfies ValueSet;
    const currentValueSet = {
      resourceType: 'ValueSet',
      id: 'body-sites-latest',
      status: 'active',
      url: BODY_SITES_VALUE_SET_URL,
      version: '1.0.10',
      expansion: { timestamp: '2026-09-03T00:00:00.000Z', contains: [{ code: 'hand', display: 'Hand' }] },
    } satisfies ValueSet;
    const pages = [olderValueSet, currentValueSet];
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
    expect(latestValueSet(BODY_SITES_VALUE_SET_URL, pages)?.version).toBe('1.0.10');
  });
});
