import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { Appointment, Encounter, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { ReactElement, ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { buildFollowupEncounterType } from 'utils/lib/fhir/encounter';
import { DOB_DATE_FORMAT } from 'utils/lib/utils/date';
import { describe, expect, it, vi } from 'vitest';

const { fhirGetMock, fhirSearchMock } = vi.hoisted(() => ({
  fhirGetMock: vi.fn(),
  fhirSearchMock: vi.fn(),
}));

vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: () => ({
    oystehr: { fhir: { get: fhirGetMock, search: fhirSearchMock } },
    oystehrZambda: {},
  }),
}));

vi.mock('../../src/features/visits/shared/components/vitals/hooks/useGetVitals', () => {
  const originVitals = {
    'vital-height': [{ field: 'vital-height', value: 120 }],
    'vital-weight': [{ field: 'vital-weight', value: 30 }],
  };
  const vitalsQuery = (encounterId: string | undefined, data: Record<string, unknown>): object =>
    encounterId ? { data, isLoading: false, isFetched: true } : { data: undefined, isLoading: false, isFetched: false };
  return {
    useGetVitals: (encounterId?: string) => vitalsQuery(encounterId, encounterId === 'origin-enc' ? originVitals : {}),
    useGetHistoricalVitals: (encounterId?: string) => vitalsQuery(encounterId, {}),
  };
});

import { useErxPatientVitals } from '../../src/features/visits/shared/hooks/useErxPatientVitals';
import { useAppointmentData } from '../../src/features/visits/shared/stores/appointment/appointment.store';

const patient: Patient = {
  resourceType: 'Patient',
  id: 'patient-1',
  birthDate: DateTime.now().minus({ years: 10 }).toFormat(DOB_DATE_FORMAT),
};

const appointment: Appointment = {
  resourceType: 'Appointment',
  id: 'appt-1',
  status: 'fulfilled',
  participant: [{ actor: { reference: 'Patient/patient-1' }, status: 'accepted' }],
};

const originEncounter: Encounter = {
  resourceType: 'Encounter',
  id: 'origin-enc',
  status: 'finished',
  class: { code: 'AMB' },
  subject: { reference: 'Patient/patient-1' },
  appointment: [{ reference: 'Appointment/appt-1' }],
};

const annotationFollowup: Encounter = {
  resourceType: 'Encounter',
  id: 'followup-enc',
  status: 'in-progress',
  class: { code: 'VR' },
  subject: { reference: 'Patient/patient-1' },
  type: buildFollowupEncounterType('annotation'),
  partOf: { reference: 'Encounter/origin-enc' },
  appointment: [{ reference: 'Appointment/appt-1' }],
};

describe('an annotation follow-up opened from the visit it annotates', () => {
  it('resolves that visit as its origin and reads height and weight from it', async () => {
    fhirSearchMock.mockImplementation(async () => ({
      unbundle: () => [annotationFollowup, appointment, patient, originEncounter],
    }));
    fhirGetMock.mockResolvedValue(originEncounter);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/in-person/appt-1/erx?encounterId=followup-enc']}>
          <Routes>
            <Route path="/in-person/:id/*" element={children} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    const { result } = renderHook(() => ({ visit: useAppointmentData(), vitals: useErxPatientVitals() }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.visit.encounter?.id).toBe('followup-enc'));
    await waitFor(() => {
      expect(result.current.visit.followUpOriginEncounter?.id).toBe('origin-enc');
      expect(result.current.vitals.isVitalsFetched).toBe(true);
    });
    expect(result.current.vitals.hasVitals).toBe(true);
  });
});
