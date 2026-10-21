import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { Encounter } from 'fhir/r4b';
import { ReactNode } from 'react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let roles: string[] = [];
let encounter: Encounter | undefined;
let followUpOriginEncounter: Encounter | undefined;
const handleUpdatePractitioner = vi.fn(async (_practitionerId: string) => {});
const enqueueSnackbar = vi.fn();

vi.mock('../../src/hooks/useEvolveUser', () => ({
  default: () => ({ roles: roles.map((name) => ({ name })), profileResource: { id: 'me' } }),
}));

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({ encounter, followUpOriginEncounter }),
}));

const usePractitionerActions = vi.fn((_encounter?: Encounter) => ({
  isEncounterUpdatePending: false,
  handleUpdatePractitioner,
}));

vi.mock('../../src/features/visits/shared/hooks/usePractitioner', () => ({
  usePractitionerActions: (encounterToUpdate?: Encounter) => usePractitionerActions(encounterToUpdate),
}));

vi.mock('../../src/features/visits/shared/hooks/chartSectionCache', () => ({
  invalidateChart: vi.fn(async () => {}),
}));

vi.mock('notistack', () => ({ enqueueSnackbar: (...args: unknown[]) => enqueueSnackbar(...args) }));

import { useAssignToMeQuickPick } from '../../src/hooks/useAssignToMeQuickPick';
import { useCommandPaletteStore } from '../../src/state/command-palette.store';

const encounterWithProvider = (practitionerId?: string, id = 'enc-1'): Encounter => ({
  resourceType: 'Encounter',
  id,
  status: 'in-progress',
  class: { code: 'AMB' },
  participant: practitionerId
    ? [
        {
          individual: { reference: `Practitioner/${practitionerId}` },
          type: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType', code: 'ATND' }] }],
        },
      ]
    : undefined,
});

/** Renders the hook at `pathname`; the returned function navigates the same router elsewhere. */
const renderAt = (pathname: string): ((to: string) => void) => {
  const queryClient = new QueryClient();
  const { result } = renderHook(
    () => {
      useAssignToMeQuickPick();
      return useNavigate();
    },
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[pathname]}>{children}</MemoryRouter>
        </QueryClientProvider>
      ),
    }
  );
  return (to) => act(() => void result.current(to));
};

const lastBoundEncounterId = (): string | undefined => usePractitionerActions.mock.calls.at(-1)?.[0]?.id;

const assignItem = (): { onSelect: () => void } | undefined =>
  useCommandPaletteStore.getState().sources['assign-chart-to-me']?.items[0];

describe('useAssignToMeQuickPick', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCommandPaletteStore.setState({ sources: {} });
    roles = ['Provider'];
    encounter = encounterWithProvider('someone-else');
    followUpOriginEncounter = encounter;
  });

  it('takes over a chart assigned to another provider', async () => {
    renderAt('/in-person/appt-1/progress-note');

    expect(assignItem()).toMatchObject({ label: 'Assign Current Chart to Me', category: 'Actions' });

    act(() => assignItem()!.onSelect());

    expect(handleUpdatePractitioner).toHaveBeenCalledWith('me');
    await waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ variant: 'success' }))
    );
  });

  it('is offered on an unassigned chart', () => {
    encounter = encounterWithProvider(undefined);

    renderAt('/in-person/appt-1/progress-note');

    expect(assignItem()).toBeDefined();
  });

  it('is hidden when the current user is already the provider', () => {
    encounter = encounterWithProvider('me');

    renderAt('/in-person/appt-1/progress-note');

    expect(assignItem()).toBeUndefined();
  });

  it.each([
    ['a non-provider', ['Staff']],
    ['an inactive provider', ['Provider', 'Inactive']],
  ])('is hidden for %s', (_label, userRoles) => {
    roles = userRoles;

    renderAt('/in-person/appt-1/progress-note');

    expect(assignItem()).toBeUndefined();
  });

  it('is hidden outside a visit', () => {
    renderAt('/visits');

    expect(assignItem()).toBeUndefined();
  });

  it('is offered on the visit details page', () => {
    renderAt('/visit/appt-1');

    expect(assignItem()).toBeDefined();
  });

  it('assigns the selected annotation follow-up on the chart', () => {
    followUpOriginEncounter = encounterWithProvider('someone-else', 'origin-enc');
    encounter = encounterWithProvider('someone-else', 'followup-enc');

    renderAt('/in-person/appt-1/progress-note');

    expect(assignItem()).toBeDefined();
    expect(lastBoundEncounterId()).toBe('followup-enc');
  });

  it("switches to the visit's own encounter when moving from a selected annotation follow-up to visit details", () => {
    followUpOriginEncounter = encounterWithProvider('someone-else', 'origin-enc');
    // The follow-up is already the user's, so going by it would hide the command on visit details.
    encounter = encounterWithProvider('me', 'followup-enc');

    const navigate = renderAt('/in-person/appt-1/progress-note');
    expect(assignItem()).toBeUndefined();

    navigate('/visit/appt-1');

    expect(assignItem()).toBeDefined();
    expect(lastBoundEncounterId()).toBe('origin-enc');
  });

  it('reports a failed assignment', async () => {
    handleUpdatePractitioner.mockRejectedValueOnce(new Error('boom'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    renderAt('/in-person/appt-1/progress-note');
    act(() => assignItem()!.onSelect());

    await waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ variant: 'error' }))
    );
  });
});
