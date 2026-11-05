import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, RenderHookResult, waitFor } from '@testing-library/react';
import { Appointment, Encounter, FhirResource, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { ReactElement, ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { buildFollowupEncounterType } from 'utils/lib/fhir/encounter';
import { DOB_DATE_FORMAT } from 'utils/lib/utils/date';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fhirGetMock, fhirSearchMock, vitalsState } = vi.hoisted(() => ({
  fhirGetMock: vi.fn(),
  fhirSearchMock: vi.fn(),
  vitalsState: { encounterIdsWithVitals: [] as string[] },
}));

vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: () => ({
    oystehr: { fhir: { get: fhirGetMock, search: fhirSearchMock } },
    oystehrZambda: {},
  }),
}));

vi.mock('../../src/features/visits/shared/components/vitals/hooks/useGetVitals', () => {
  const heightAndWeight = {
    'vital-height': [{ field: 'vital-height', value: 120 }],
    'vital-weight': [{ field: 'vital-weight', value: 30 }],
  };
  const vitalsQuery = (encounterId: string | undefined, data: Record<string, unknown>): object =>
    encounterId ? { data, isLoading: false, isFetched: true } : { data: undefined, isLoading: false, isFetched: false };
  return {
    useGetVitals: (encounterId?: string) =>
      vitalsQuery(
        encounterId,
        encounterId && vitalsState.encounterIdsWithVitals.includes(encounterId) ? heightAndWeight : {}
      ),
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

const scheduledAppointment: Appointment = {
  resourceType: 'Appointment',
  id: 'appt-2',
  status: 'booked',
  participant: [{ actor: { reference: 'Patient/patient-1' }, status: 'accepted' }],
};

const scheduledFollowup: Encounter = {
  resourceType: 'Encounter',
  id: 'scheduled-enc',
  status: 'in-progress',
  class: { code: 'AMB' },
  subject: { reference: 'Patient/patient-1' },
  type: buildFollowupEncounterType('scheduled'),
  partOf: { reference: 'Encounter/origin-enc' },
  appointment: [{ reference: 'Appointment/appt-2' }],
};

const serveAppointmentBundles = (bundlesByAppointmentId: Record<string, FhirResource[]>): void => {
  fhirSearchMock.mockImplementation(async ({ params }: { params: Array<{ name: string; value: string }> }) => ({
    unbundle: () => [...(bundlesByAppointmentId[params.find((param) => param.name === '_id')?.value ?? ''] ?? [])],
  }));
  fhirGetMock.mockResolvedValue(originEncounter);
};

const idsOf = (resources: FhirResource[], resourceType: FhirResource['resourceType']): Array<string | undefined> =>
  resources
    .filter((resource) => resource.resourceType === resourceType)
    .map((resource) => resource.id)
    .sort();

const renderVisitAt = (
  url: string
): RenderHookResult<
  { visit: ReturnType<typeof useAppointmentData>; vitals: ReturnType<typeof useErxPatientVitals> },
  unknown
> => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/in-person/:id/*" element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return renderHook(() => ({ visit: useAppointmentData(), vitals: useErxPatientVitals() }), { wrapper });
};

beforeEach(() => {
  fhirGetMock.mockReset();
  fhirSearchMock.mockReset();
  vitalsState.encounterIdsWithVitals = [];
});

describe('an annotation follow-up opened from the visit it annotates', () => {
  it('resolves that visit as its origin and reads height and weight from it', async () => {
    vitalsState.encounterIdsWithVitals = ['origin-enc'];
    serveAppointmentBundles({ 'appt-1': [annotationFollowup, appointment, patient, originEncounter] });

    const { result } = renderVisitAt('/in-person/appt-1/erx?encounterId=followup-enc');

    await waitFor(() => expect(result.current.visit.encounter?.id).toBe('followup-enc'));
    await waitFor(() => {
      expect(result.current.visit.followUpOriginEncounter?.id).toBe('origin-enc');
      expect(result.current.vitals.isVitalsFetched).toBe(true);
    });
    expect(result.current.vitals.hasVitals).toBe(true);
  });
});

describe('a scheduled follow-up opened on its own appointment', () => {
  it('selects its own encounter and appointment, loads the visit it follows up on, and reads its own vitals', async () => {
    vitalsState.encounterIdsWithVitals = ['scheduled-enc'];
    serveAppointmentBundles({
      'appt-2': [scheduledAppointment, patient, scheduledFollowup],
      'appt-1': [appointment, originEncounter, scheduledFollowup],
    });

    const { result } = renderVisitAt('/in-person/appt-2');

    await waitFor(() => expect(result.current.visit.encounter?.id).toBe('scheduled-enc'));
    expect(result.current.visit.appointment?.id).toBe('appt-2');
    expect(result.current.visit.followUpOriginEncounter?.id).toBe('scheduled-enc');
    expect(idsOf(result.current.visit.rawResources, 'Encounter')).toEqual(['origin-enc', 'scheduled-enc']);
    expect(idsOf(result.current.visit.rawResources, 'Appointment')).toEqual(['appt-1', 'appt-2']);
    await waitFor(() => expect(result.current.vitals.isVitalsFetched).toBe(true));
    expect(result.current.vitals.hasVitals).toBe(true);
  });
});

describe('a main visit with a scheduled follow-up hanging off it', () => {
  it('keeps the main encounter and appointment selected', async () => {
    serveAppointmentBundles({
      'appt-1': [scheduledFollowup, scheduledAppointment, appointment, patient, originEncounter],
    });

    const { result } = renderVisitAt('/in-person/appt-1');

    await waitFor(() => {
      expect(result.current.visit.isAppointmentLoading).toBe(false);
      expect(result.current.visit.encounter?.id).toBe('origin-enc');
      expect(result.current.visit.appointment?.id).toBe('appt-1');
      expect(result.current.visit.followUpOriginEncounter?.id).toBe('origin-enc');
    });
  });
});
