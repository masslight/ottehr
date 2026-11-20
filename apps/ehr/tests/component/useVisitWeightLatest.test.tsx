import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// The original prescription's visit (March) has a weight; a later visit (June) has a newer one.
const march = { resourceId: 'w-march', value: 14, lastUpdated: '2026-03-02T10:00:00.000Z' };
const june = { resourceId: 'w-june', value: 16, lastUpdated: '2026-06-10T10:00:00.000Z' };
const marchHeight = { resourceId: 'h-march', value: 95, lastUpdated: '2026-03-02T10:00:00.000Z' };
const juneHeight = { resourceId: 'h-june', value: 98, lastUpdated: '2026-06-10T10:00:00.000Z' };

vi.mock('../../src/features/visits/shared/components/vitals/hooks/useGetVitals', () => ({
  useGetVitals: () => ({ data: { 'vital-weight': [march], 'vital-height': [marchHeight] } }),
  useGetHistoricalVitals: () => ({ data: { 'vital-weight': [], 'vital-height': [] } }),
  useGetAllPatientVitals: () => ({
    data: { 'vital-weight': [june, march], 'vital-height': [juneHeight, marchHeight] },
  }),
}));

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({ encounter: { id: 'enc-page' } }),
}));

vi.mock('../../src/features/visits/shared/hooks/useVisitNote', () => ({
  useVisitNote: () => ({ data: undefined }),
}));

import { useVisitHeight, useVisitWeight } from '../../src/features/visits/in-person/components/erx/useVisitWeight';

describe('eRx height and weight sent with an order or approval', () => {
  it("is the patient's latest from any visit, with its date, even a visit after the given one", () => {
    const { result: weight } = renderHook(() => useVisitWeight('enc-march'));
    expect(weight.current).toEqual({ kg: 16, takenAt: '2026-06-10T10:00:00.000Z', thisVisit: false });
    const { result: height } = renderHook(() => useVisitHeight('enc-march'));
    expect(height.current).toEqual({ cm: 98, takenAt: '2026-06-10T10:00:00.000Z' });
  });
});
