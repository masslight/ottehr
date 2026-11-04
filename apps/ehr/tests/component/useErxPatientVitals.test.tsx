import { renderHook } from '@testing-library/react';
import { Encounter } from 'fhir/r4b';
import { buildFollowupEncounterType } from 'utils/lib/fhir/encounter';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type VitalsResult = {
  data?: Record<string, Array<{ field: string; value?: number }>>;
  isLoading: boolean;
  isFetched: boolean;
};

const state = vi.hoisted(() => ({
  currentResult: { data: undefined, isLoading: false, isFetched: true } as VitalsResult,
  historicalResult: { data: undefined, isLoading: false, isFetched: true } as VitalsResult,
  patient: { id: 'p1', birthDate: '1980-01-01' } as { id: string; birthDate?: string },
  encounter: { id: 'enc-1' } as Partial<Encounter>,
  vitalsEncounterIds: [] as Array<string | undefined>,
}));

// A height or weight from any of the patient's visits counts: this visit's vitals and the historical ones.
vi.mock('../../src/features/visits/shared/components/vitals/hooks/useGetVitals', () => ({
  useGetVitals: (encounterId?: string) => {
    state.vitalsEncounterIds.push(encounterId);
    return state.currentResult;
  },
  useGetHistoricalVitals: (encounterId?: string) => {
    state.vitalsEncounterIds.push(encounterId);
    return state.historicalResult;
  },
}));

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({
    patient: state.patient,
    encounter: state.encounter,
    followUpOriginEncounter: { id: 'origin-enc' },
  }),
}));

import { useErxPatientVitals } from '../../src/features/visits/shared/hooks/useErxPatientVitals';

const idle = (): VitalsResult => ({ data: undefined, isLoading: false, isFetched: true });
const vitals = (values: Record<string, Array<{ field: string; value?: number }>>): VitalsResult => ({
  data: values,
  isLoading: false,
  isFetched: true,
});
const height = [{ field: 'vital-height', value: 120 }];
const weight = [{ field: 'vital-weight', value: 30 }];
const none = vitals({});

describe('useErxPatientVitals', () => {
  beforeEach(() => {
    state.currentResult = idle();
    state.historicalResult = idle();
    state.patient = { id: 'p1', birthDate: '1980-01-01' };
    state.encounter = { id: 'enc-1' };
    state.vitalsEncounterIds = [];
  });

  it('treats an adult as having vitals even when none are recorded', () => {
    state.patient = { id: 'p1', birthDate: '1980-01-01' };
    state.currentResult = none;
    state.historicalResult = none;

    const { result } = renderHook(() => useErxPatientVitals());

    expect(result.current.hasVitals).toBe(true);
  });

  it('requires both height and weight for a patient 18 or younger', () => {
    state.patient = { id: 'p1', birthDate: '2015-01-01' };
    state.currentResult = vitals({ 'vital-height': height, 'vital-weight': weight });
    state.historicalResult = none;

    const { result } = renderHook(() => useErxPatientVitals());

    expect(result.current.hasVitals).toBe(true);
  });

  it('counts a height or weight recorded on a previous visit', () => {
    state.patient = { id: 'p1', birthDate: '2015-01-01' };
    state.currentResult = vitals({ 'vital-weight': weight });
    state.historicalResult = vitals({ 'vital-height': height });

    const { result } = renderHook(() => useErxPatientVitals());

    expect(result.current.hasVitals).toBe(true);
  });

  it('reports missing vitals for a minor without a weight', () => {
    state.patient = { id: 'p1', birthDate: '2015-01-01' };
    state.currentResult = vitals({ 'vital-height': height });
    state.historicalResult = none;

    const { result } = renderHook(() => useErxPatientVitals());

    expect(result.current.hasVitals).toBe(false);
  });

  it('reports missing vitals for a minor without a height', () => {
    state.patient = { id: 'p1', birthDate: '2015-01-01' };
    state.currentResult = vitals({ 'vital-weight': weight });
    state.historicalResult = none;

    const { result } = renderHook(() => useErxPatientVitals());

    expect(result.current.hasVitals).toBe(false);
  });

  it('treats a patient with no birth date as requiring vitals', () => {
    state.patient = { id: 'p1' };
    state.currentResult = none;
    state.historicalResult = none;

    const { result } = renderHook(() => useErxPatientVitals());

    expect(result.current.hasVitals).toBe(false);
  });

  it("reads this visit's vitals and points to its Vitals tab", () => {
    state.patient = { id: 'p1', birthDate: '2015-01-01' };

    const { result } = renderHook(() => useErxPatientVitals());

    expect(new Set(state.vitalsEncounterIds)).toEqual(new Set(['enc-1']));
    expect(result.current.missingVitalsMessage).toBe(
      "Patient doesn't have height or weight vital specified. Please specify it first on the `Vitals` tab"
    );
  });

  it("reads an annotation follow-up's vitals from the visit it annotates", () => {
    state.patient = { id: 'p1', birthDate: '2015-01-01' };
    state.encounter = { id: 'followup-enc', type: buildFollowupEncounterType('annotation') };
    state.currentResult = vitals({ 'vital-height': height, 'vital-weight': weight });
    state.historicalResult = none;

    const { result } = renderHook(() => useErxPatientVitals());

    expect(new Set(state.vitalsEncounterIds)).toEqual(new Set(['origin-enc']));
    expect(result.current.hasVitals).toBe(true);
  });

  it('points an annotation follow-up without vitals to the original visit', () => {
    state.patient = { id: 'p1', birthDate: '2015-01-01' };
    state.encounter = { id: 'followup-enc', type: buildFollowupEncounterType('annotation') };
    state.currentResult = none;
    state.historicalResult = none;

    const { result } = renderHook(() => useErxPatientVitals());

    expect(result.current.hasVitals).toBe(false);
    expect(result.current.missingVitalsMessage).toBe(
      "Patient doesn't have height or weight vital specified. Please specify it first on the `Vitals` tab of the original visit"
    );
  });

  it("reads a scheduled follow-up's own vitals", () => {
    state.encounter = { id: 'scheduled-enc', type: buildFollowupEncounterType('scheduled') };

    renderHook(() => useErxPatientVitals());

    expect(new Set(state.vitalsEncounterIds)).toEqual(new Set(['scheduled-enc']));
  });

  it('surfaces loading and fetched flags from the underlying vitals queries', () => {
    state.currentResult = { data: undefined, isLoading: true, isFetched: false };
    state.historicalResult = idle();

    const { result } = renderHook(() => useErxPatientVitals());

    expect(result.current.isVitalsLoading).toBe(true);
    expect(result.current.isVitalsFetched).toBe(false);
  });
});
