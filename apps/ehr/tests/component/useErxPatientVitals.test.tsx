import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type ChartFieldResult = {
  data?: { vitalsObservations?: Array<{ field: string; value?: number }> };
  isLoading: boolean;
  isFetched: boolean;
};

const state = vi.hoisted(() => ({
  heightResult: { data: undefined, isLoading: false, isFetched: true } as ChartFieldResult,
  weightResult: { data: undefined, isLoading: false, isFetched: true } as ChartFieldResult,
  patient: { id: 'p1', birthDate: '1980-01-01' } as { id: string; birthDate?: string },
}));

// height and weight both request fieldName 'vitalsObservations'; they differ only by `_tag`.
vi.mock('../../src/features/visits/shared/hooks/useChartFields', () => ({
  useChartFields: (args: { requestedFields?: { vitalsObservations?: { _tag?: string } } }) => {
    const tag = args?.requestedFields?.vitalsObservations?._tag;
    return tag === 'vital-height' ? state.heightResult : state.weightResult;
  },
}));

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({ patient: state.patient, encounter: { id: 'enc-1' } }),
}));

import { useErxPatientVitals } from '../../src/features/visits/shared/hooks/useErxPatientVitals';

const heightObs = {
  data: { vitalsObservations: [{ field: 'vital-height', value: 120 }] },
  isLoading: false,
  isFetched: true,
};
const weightObs = {
  data: { vitalsObservations: [{ field: 'vital-weight', value: 30 }] },
  isLoading: false,
  isFetched: true,
};
const emptyObs = { data: { vitalsObservations: [] }, isLoading: false, isFetched: true };

describe('useErxPatientVitals', () => {
  beforeEach(() => {
    state.heightResult = { data: undefined, isLoading: false, isFetched: true };
    state.weightResult = { data: undefined, isLoading: false, isFetched: true };
    state.patient = { id: 'p1', birthDate: '1980-01-01' };
  });

  it('treats an adult as having vitals even when none are recorded', () => {
    state.patient = { id: 'p1', birthDate: '1980-01-01' };
    state.heightResult = emptyObs;
    state.weightResult = emptyObs;

    const { result } = renderHook(() => useErxPatientVitals());

    expect(result.current.hasVitals).toBe(true);
  });

  it('requires both height and weight for a patient 18 or younger', () => {
    state.patient = { id: 'p1', birthDate: '2015-01-01' };
    state.heightResult = heightObs;
    state.weightResult = weightObs;

    const { result } = renderHook(() => useErxPatientVitals());

    expect(result.current.hasVitals).toBe(true);
  });

  it('reports missing vitals for a minor without a weight', () => {
    state.patient = { id: 'p1', birthDate: '2015-01-01' };
    state.heightResult = heightObs;
    state.weightResult = emptyObs;

    const { result } = renderHook(() => useErxPatientVitals());

    expect(result.current.hasVitals).toBe(false);
  });

  it('reports missing vitals for a minor without a height', () => {
    state.patient = { id: 'p1', birthDate: '2015-01-01' };
    state.heightResult = emptyObs;
    state.weightResult = weightObs;

    const { result } = renderHook(() => useErxPatientVitals());

    expect(result.current.hasVitals).toBe(false);
  });

  it('treats a patient with no birth date as requiring vitals', () => {
    state.patient = { id: 'p1' };
    state.heightResult = emptyObs;
    state.weightResult = emptyObs;

    const { result } = renderHook(() => useErxPatientVitals());

    expect(result.current.hasVitals).toBe(false);
  });

  it('surfaces loading and fetched flags from the underlying vitals queries', () => {
    state.heightResult = { data: undefined, isLoading: true, isFetched: false };
    state.weightResult = { data: undefined, isLoading: false, isFetched: true };

    const { result } = renderHook(() => useErxPatientVitals());

    expect(result.current.isVitalsLoading).toBe(true);
    expect(result.current.isVitalsFetched).toBe(false);
  });
});
