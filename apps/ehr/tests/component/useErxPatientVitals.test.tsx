import { renderHook } from '@testing-library/react';
import { Encounter } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { buildFollowupEncounterType } from 'utils/lib/fhir/encounter';
import { DOB_DATE_FORMAT } from 'utils/lib/utils/date';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type VitalsMap = Record<string, Array<{ field: string; value?: number }>>;

type VitalsResult = {
  data?: VitalsMap;
  isLoading: boolean;
  isFetched: boolean;
};

const state = vi.hoisted(() => ({
  vitalsByEncounter: {} as Record<string, { current?: VitalsMap; historical?: VitalsMap }>,
  currentResultOverride: undefined as VitalsResult | undefined,
  patient: { id: 'p1', birthDate: '1980-01-01' } as { id: string; birthDate?: string },
  encounter: { id: 'enc-1' } as Partial<Encounter>,
  vitalsEncounterIds: [] as Array<string | undefined>,
}));

// A height or weight from any of the patient's visits counts: this visit's vitals and the historical ones.
vi.mock('../../src/features/visits/shared/components/vitals/hooks/useGetVitals', () => {
  const vitalsQuery = (encounterId: string | undefined, mode: 'current' | 'historical'): VitalsResult => {
    state.vitalsEncounterIds.push(encounterId);
    if (!encounterId) return { data: undefined, isLoading: false, isFetched: false };
    return { data: state.vitalsByEncounter[encounterId]?.[mode] ?? {}, isLoading: false, isFetched: true };
  };
  return {
    useGetVitals: (encounterId?: string) => state.currentResultOverride ?? vitalsQuery(encounterId, 'current'),
    useGetHistoricalVitals: (encounterId?: string) => vitalsQuery(encounterId, 'historical'),
  };
});

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({
    patient: state.patient,
    encounter: state.encounter,
    followUpOriginEncounter: { id: 'origin-enc' },
  }),
}));

import { useErxPatientVitals } from '../../src/features/visits/shared/hooks/useErxPatientVitals';

const minorBirthDate = DateTime.now().minus({ years: 10 }).toFormat(DOB_DATE_FORMAT);
const height = [{ field: 'vital-height', value: 120 }];
const weight = [{ field: 'vital-weight', value: 30 }];
const annotationFollowup: Partial<Encounter> = {
  id: 'followup-enc',
  type: buildFollowupEncounterType('annotation'),
  partOf: { reference: 'Encounter/origin-enc' },
};

describe('useErxPatientVitals', () => {
  beforeEach(() => {
    state.vitalsByEncounter = {};
    state.currentResultOverride = undefined;
    state.patient = { id: 'p1', birthDate: '1980-01-01' };
    state.encounter = { id: 'enc-1' };
    state.vitalsEncounterIds = [];
  });

  it('treats an adult as having vitals even when none are recorded', () => {
    state.patient = { id: 'p1', birthDate: '1980-01-01' };

    const { result } = renderHook(() => useErxPatientVitals());

    expect(result.current.hasVitals).toBe(true);
  });

  it('requires both height and weight for a patient 18 or younger', () => {
    state.patient = { id: 'p1', birthDate: minorBirthDate };
    state.vitalsByEncounter = { 'enc-1': { current: { 'vital-height': height, 'vital-weight': weight } } };

    const { result } = renderHook(() => useErxPatientVitals());

    expect(result.current.hasVitals).toBe(true);
  });

  it('counts a height or weight recorded on a previous visit', () => {
    state.patient = { id: 'p1', birthDate: minorBirthDate };
    state.vitalsByEncounter = {
      'enc-1': { current: { 'vital-weight': weight }, historical: { 'vital-height': height } },
    };

    const { result } = renderHook(() => useErxPatientVitals());

    expect(result.current.hasVitals).toBe(true);
  });

  it('reports missing vitals for a minor without a weight', () => {
    state.patient = { id: 'p1', birthDate: minorBirthDate };
    state.vitalsByEncounter = { 'enc-1': { current: { 'vital-height': height } } };

    const { result } = renderHook(() => useErxPatientVitals());

    expect(result.current.hasVitals).toBe(false);
  });

  it('reports missing vitals for a minor without a height', () => {
    state.patient = { id: 'p1', birthDate: minorBirthDate };
    state.vitalsByEncounter = { 'enc-1': { current: { 'vital-weight': weight } } };

    const { result } = renderHook(() => useErxPatientVitals());

    expect(result.current.hasVitals).toBe(false);
  });

  it('treats a patient with no birth date as requiring vitals', () => {
    state.patient = { id: 'p1' };

    const { result } = renderHook(() => useErxPatientVitals());

    expect(result.current.hasVitals).toBe(false);
  });

  it("reads this visit's vitals and points to its Vitals tab", () => {
    state.patient = { id: 'p1', birthDate: minorBirthDate };

    const { result } = renderHook(() => useErxPatientVitals());

    expect(new Set(state.vitalsEncounterIds)).toEqual(new Set(['enc-1']));
    expect(result.current.missingVitalsMessage).toBe(
      "Patient doesn't have height or weight vital specified. Please specify it first on the `Vitals` tab"
    );
  });

  it("reads an annotation follow-up's vitals from the visit it annotates", () => {
    state.patient = { id: 'p1', birthDate: minorBirthDate };
    state.encounter = annotationFollowup;
    state.vitalsByEncounter = {
      'origin-enc': { current: { 'vital-height': height, 'vital-weight': weight } },
      'followup-enc': { current: {}, historical: {} },
    };

    const { result } = renderHook(() => useErxPatientVitals());

    expect(new Set(state.vitalsEncounterIds)).toEqual(new Set(['origin-enc']));
    expect(result.current.hasVitals).toBe(true);
  });

  it("counts an annotation follow-up's height and weight recorded before the visit it annotates", () => {
    state.patient = { id: 'p1', birthDate: minorBirthDate };
    state.encounter = annotationFollowup;
    state.vitalsByEncounter = {
      'origin-enc': { current: {}, historical: { 'vital-height': height, 'vital-weight': weight } },
      'followup-enc': { current: {}, historical: {} },
    };

    const { result } = renderHook(() => useErxPatientVitals());

    expect(new Set(state.vitalsEncounterIds)).toEqual(new Set(['origin-enc']));
    expect(result.current.hasVitals).toBe(true);
  });

  it('points an annotation follow-up without vitals to the original visit', () => {
    state.patient = { id: 'p1', birthDate: minorBirthDate };
    state.encounter = annotationFollowup;

    const { result } = renderHook(() => useErxPatientVitals());

    expect(result.current.hasVitals).toBe(false);
    expect(result.current.missingVitalsMessage).toBe(
      "Patient doesn't have height or weight vital specified. Please specify it first on the `Vitals` tab of the original visit"
    );
  });

  it("reads a scheduled follow-up's own vitals", () => {
    state.patient = { id: 'p1', birthDate: minorBirthDate };
    state.encounter = { id: 'scheduled-enc', type: buildFollowupEncounterType('scheduled') };
    state.vitalsByEncounter = {
      'scheduled-enc': { current: { 'vital-height': height, 'vital-weight': weight } },
      'origin-enc': { current: {}, historical: {} },
    };

    const { result } = renderHook(() => useErxPatientVitals());

    expect(new Set(state.vitalsEncounterIds)).toEqual(new Set(['scheduled-enc']));
    expect(result.current.hasVitals).toBe(true);
  });

  it('surfaces loading and fetched flags from the underlying vitals queries', () => {
    state.currentResultOverride = { data: undefined, isLoading: true, isFetched: false };

    const { result } = renderHook(() => useErxPatientVitals());

    expect(result.current.isVitalsLoading).toBe(true);
    expect(result.current.isVitalsFetched).toBe(false);
  });
});
