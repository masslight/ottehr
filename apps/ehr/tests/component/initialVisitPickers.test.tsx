import { render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Appointment, Encounter } from 'fhir/r4b';
import { MemoryRouter } from 'react-router-dom';
import { buildFollowupEncounterType, FOLLOWUP_SYSTEMS } from 'utils/lib/fhir/encounter';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PatientFollowupForm from '../../src/features/visits/shared/components/patient/PatientFollowupForm';
import { useParentEncounters } from '../../src/features/visits/shared/components/patient/useParentEncounters';

const searchMock = vi.fn();
const oystehrZambda = { fhir: { search: (...args: unknown[]) => searchMock(...args) } };
vi.mock('../../src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehrZambda }) }));
vi.mock('../../src/api/api', () => ({
  getEmployees: () => new Promise(() => undefined),
  saveFollowup: vi.fn(),
}));
vi.mock('../../src/hooks/useEvolveUser', () => ({ default: () => undefined }));
vi.mock('../../src/components/LocationSelect', () => ({ default: () => null }));
vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));

const PATIENT_ID = 'patient-1';
const SERVER_PAGE_SIZE = 20;
const EXCLUDE_FOLLOWUPS = `${FOLLOWUP_SYSTEMS.type.url}|${FOLLOWUP_SYSTEMS.type.code}`;

const freeFormNotes: Encounter[] = Array.from({ length: SERVER_PAGE_SIZE + 10 }, (_, index) => ({
  resourceType: 'Encounter',
  id: `note-${index}`,
  status: 'finished',
  class: { code: 'VR' },
  type: buildFollowupEncounterType('annotation'),
  subject: { reference: `Patient/${PATIENT_ID}` },
  period: { start: `2026-10-${String(index + 1).padStart(2, '0')}T12:00:00.000Z` },
}));

const visitEncounter: Encounter = {
  resourceType: 'Encounter',
  id: 'visit-encounter',
  status: 'finished',
  class: { code: 'AMB' },
  subject: { reference: `Patient/${PATIENT_ID}` },
  appointment: [{ reference: 'Appointment/visit-appointment' }],
};

const visitAppointment: Appointment = {
  resourceType: 'Appointment',
  id: 'visit-appointment',
  status: 'fulfilled',
  start: '2026-01-05T15:00:00.000Z',
  appointmentType: { text: 'Walk-in' },
  participant: [],
};

describe('initial-visit pickers with many free-form notes', () => {
  beforeEach(() => {
    searchMock.mockReset();
    searchMock.mockImplementation(async ({ params }: { params: Array<{ name: string; value: string }> }) => {
      const excludesFollowups = params.some((param) => param.name === 'type:not' && param.value === EXCLUDE_FOLLOWUPS);
      const matches = excludesFollowups ? [visitEncounter] : [...freeFormNotes, visitEncounter];
      const page = matches.slice(0, SERVER_PAGE_SIZE);
      const included = page.includes(visitEncounter) ? [visitAppointment] : [];
      return { unbundle: () => [...page, ...included] };
    });
  });

  it('useParentEncounters asks the server to leave follow-ups out and still lists the visit', async () => {
    const { result } = renderHook(() => useParentEncounters(PATIENT_ID));

    await waitFor(() => expect(result.current.previousEncounters.map((row) => row.id)).toEqual(['visit-encounter']));
    expect(searchMock.mock.calls[0][0].params).toContainEqual({ name: 'type:not', value: EXCLUDE_FOLLOWUPS });
  });

  it('PatientFollowupForm asks the server to leave follow-ups out and still lists the visit', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <PatientFollowupForm patient={{ resourceType: 'Patient', id: PATIENT_ID }} />
      </MemoryRouter>
    );

    await waitFor(() => expect(searchMock).toHaveBeenCalled());
    expect(searchMock.mock.calls[0][0].params).toContainEqual({ name: 'type:not', value: EXCLUDE_FOLLOWUPS });

    await user.click(screen.getByLabelText('Initial visit *'));
    expect(await screen.findAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option', { name: /Walk-in/ })).toBeInTheDocument();
  });
});
