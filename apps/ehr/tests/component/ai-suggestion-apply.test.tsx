import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import React, { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: () => ({ oystehr: null, oystehrZambda: null }),
}));

vi.mock('src/api/api', () => ({
  icd10Search: vi.fn(),
}));

import { useAiSuggestionApply } from 'src/features/visits/shared/hooks/useAiSuggestionApply';
import { MappedItemData } from 'src/features/visits/shared/hooks/useAiSuggestionMapping';
import { ObservationTextFieldDTO } from 'utils';

function createWrapper(): ({ children }: { children: ReactNode }) => ReactNode {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

function makeObservation(value: string): ObservationTextFieldDTO {
  return { field: 'test-field', value } as ObservationTextFieldDTO;
}

describe('useAiSuggestionApply', () => {
  let onApply: ReturnType<typeof vi.fn>;
  let isAlreadyApplied: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onApply = vi.fn();
    isAlreadyApplied = vi.fn().mockReturnValue(false);
  });

  it('returns empty arrays when aiObservations is undefined', () => {
    const { result } = renderHook(
      () =>
        useAiSuggestionApply({
          aiObservations: undefined,
          section: 'surgicalHistory',
          isAlreadyApplied,
          onApply,
        }),
      { wrapper: createWrapper() }
    );

    expect(result.current.expandedContent).toEqual([]);
    expect(result.current.mappedSuggestions).toEqual([]);
    expect(result.current.effectiveAppliedIndices.size).toBe(0);
  });

  it('expands content by parsing AI values', () => {
    const observations = [makeObservation('Appendectomy, Tonsillectomy')];

    const { result } = renderHook(
      () =>
        useAiSuggestionApply({
          aiObservations: observations,
          section: 'surgicalHistory',
          isAlreadyApplied,
          onApply,
        }),
      { wrapper: createWrapper() }
    );

    expect(result.current.expandedContent).toHaveLength(2);
    expect(result.current.expandedContent[0].value).toBe('Appendectomy');
    expect(result.current.expandedContent[1].value).toBe('Tonsillectomy');
  });

  it('maps surgical history items to static options', () => {
    const observations = [makeObservation('Appendectomy')];

    const { result } = renderHook(
      () =>
        useAiSuggestionApply({
          aiObservations: observations,
          section: 'surgicalHistory',
          isAlreadyApplied,
          onApply,
        }),
      { wrapper: createWrapper() }
    );

    expect(result.current.mappedSuggestions).toHaveLength(1);
    expect(result.current.mappedSuggestions[0].mappedData).toEqual({
      section: 'surgicalHistory',
      code: '44950',
      display: 'Appendectomy',
    });
    expect(result.current.mappedSuggestions[0].searchDisplay).toBe('Appendectomy');
  });

  it('returns null mappedData for unrecognized surgical history', () => {
    const observations = [makeObservation('Some unknown procedure XYZ')];

    const { result } = renderHook(
      () =>
        useAiSuggestionApply({
          aiObservations: observations,
          section: 'surgicalHistory',
          isAlreadyApplied,
          onApply,
        }),
      { wrapper: createWrapper() }
    );

    expect(result.current.mappedSuggestions).toHaveLength(1);
    expect(result.current.mappedSuggestions[0].mappedData).toBeNull();
  });

  it('detects already-applied suggestions via isAlreadyApplied callback', () => {
    const observations = [makeObservation('Appendectomy')];
    isAlreadyApplied.mockImplementation((data: MappedItemData) => {
      return data.section === 'surgicalHistory' && 'code' in data && data.code === '44950';
    });

    const { result } = renderHook(
      () =>
        useAiSuggestionApply({
          aiObservations: observations,
          section: 'surgicalHistory',
          isAlreadyApplied,
          onApply,
        }),
      { wrapper: createWrapper() }
    );

    expect(result.current.effectiveAppliedIndices.has(0)).toBe(true);
  });

  it('marks index as applied after handleSuggestionClick', async () => {
    onApply.mockResolvedValue(undefined);
    const observations = [makeObservation('Appendectomy')];

    const { result } = renderHook(
      () =>
        useAiSuggestionApply({
          aiObservations: observations,
          section: 'surgicalHistory',
          isAlreadyApplied,
          onApply,
        }),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await result.current.handleSuggestionClick(0);
    });

    expect(onApply).toHaveBeenCalledOnce();
    expect(result.current.effectiveAppliedIndices.has(0)).toBe(true);
  });

  it('rolls back applied index on onApply error', async () => {
    onApply.mockRejectedValue(new Error('Save failed'));
    const observations = [makeObservation('Appendectomy')];

    const { result } = renderHook(
      () =>
        useAiSuggestionApply({
          aiObservations: observations,
          section: 'surgicalHistory',
          isAlreadyApplied,
          onApply,
        }),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await result.current.handleSuggestionClick(0);
    });

    expect(onApply).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(result.current.effectiveAppliedIndices.has(0)).toBe(false);
    });
  });

  it('does nothing when clicking a suggestion with no mappedData', async () => {
    const observations = [makeObservation('Some unknown procedure XYZ')];

    const { result } = renderHook(
      () =>
        useAiSuggestionApply({
          aiObservations: observations,
          section: 'surgicalHistory',
          isAlreadyApplied,
          onApply,
        }),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await result.current.handleSuggestionClick(0);
    });

    expect(onApply).not.toHaveBeenCalled();
  });

  it('skips negated values', () => {
    const observations = [makeObservation('Denies any surgeries')];

    const { result } = renderHook(
      () =>
        useAiSuggestionApply({
          aiObservations: observations,
          section: 'surgicalHistory',
          isAlreadyApplied,
          onApply,
        }),
      { wrapper: createWrapper() }
    );

    if (result.current.mappedSuggestions.length > 0) {
      expect(result.current.mappedSuggestions[0].mappedData).toBeNull();
    }
  });

  it('maps episodeOfCare to hospitalization options', () => {
    const observations = [makeObservation('Appendicitis')];

    const { result } = renderHook(
      () =>
        useAiSuggestionApply({
          aiObservations: observations,
          section: 'episodeOfCare',
          isAlreadyApplied,
          onApply,
        }),
      { wrapper: createWrapper() }
    );

    expect(result.current.mappedSuggestions).toHaveLength(1);
    expect(result.current.mappedSuggestions[0].mappedData).toEqual({
      section: 'episodeOfCare',
      code: '74400008',
      display: 'Appendicitis',
    });
  });
});
