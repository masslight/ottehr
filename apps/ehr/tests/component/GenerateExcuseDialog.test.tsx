import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Encounter, Practitioner } from 'fhir/r4b';
import { GenerateExcuseDialog } from 'src/features/visits/shared/components/plan-tab/components/GenerateExcuseDialog';
import { useAppointmentData, useChartData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { SchoolWorkNoteExcuseDocDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { PRACTITIONER_CODINGS } from 'utils/lib/types/data/appointments/appointments.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: vi.fn(),
  useChartData: vi.fn(),
  useSaveChartData: vi.fn(),
}));

vi.mock('src/hooks/useEvolveUser', () => ({ default: vi.fn() }));

const assignedProvider: Practitioner = {
  resourceType: 'Practitioner',
  id: 'assigned-provider',
  name: [{ given: ['Alice'], family: 'Attender', suffix: ['MD'] }],
};

// Also a participant on the encounter, but as the intake performer — so a lookup that ignores the
// participant type would pick them up.
const admitter: Practitioner = {
  resourceType: 'Practitioner',
  id: 'admitter',
  name: [{ given: ['Bob'], family: 'Admitter', suffix: ['RN'] }],
};

// Whoever is generating the note — deliberately not the assigned provider.
const currentUserProfile: Practitioner = {
  resourceType: 'Practitioner',
  id: 'current-user',
  name: [{ given: ['Casey'], family: 'Scribe', suffix: ['MA'] }],
};

const encounterWith = (attenderId?: string): Encounter =>
  ({
    resourceType: 'Encounter',
    id: 'encounter-1',
    participant: [
      { type: [{ coding: PRACTITIONER_CODINGS.Admitter }], individual: { reference: `Practitioner/${admitter.id}` } },
      ...(attenderId
        ? [
            {
              type: [{ coding: PRACTITIONER_CODINGS.Attender }],
              individual: { reference: `Practitioner/${attenderId}` },
            },
          ]
        : []),
    ],
  }) as Encounter;

const generate = vi.fn();

const renderDialog = async (
  encounter: Encounter,
  practitioners: Practitioner[]
): Promise<SchoolWorkNoteExcuseDocDTO> => {
  vi.mocked(useAppointmentData).mockReturnValue({
    patient: { resourceType: 'Patient', id: 'patient-1', name: [{ given: ['Kid'], family: 'Patient' }] },
    questionnaireResponse: undefined,
    encounter,
    practitioners,
  } as any);

  render(<GenerateExcuseDialog type="schoolTemplate" open={true} onClose={vi.fn()} generate={generate as any} />);

  await userEvent.click(screen.getByRole('button', { name: 'Generate note' }));

  expect(generate).toHaveBeenCalledTimes(1);
  return generate.mock.calls[0][0].newSchoolWorkNote as SchoolWorkNoteExcuseDocDTO;
};

describe('GenerateExcuseDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useChartData).mockReturnValue({ chartData: undefined, setPartialChartData: vi.fn() } as any);
    vi.mocked(useEvolveUser).mockReturnValue({
      userName: 'Casey Scribe, MA',
      profileResource: currentUserProfile,
    } as any);
  });

  it('signs the note with the provider assigned to the visit, not the user generating it', async () => {
    const excuse = await renderDialog(encounterWith(assignedProvider.id), [admitter, assignedProvider]);

    expect(excuse.providerDetails).toEqual({ name: 'Alice Attender, MD', credentials: 'MD' });
    expect(excuse.footerNote).toContain('Sincerely,\nAlice Attender, MD');
  });

  // A cancelled or no-show visit stays chartable (isVisitFinished) yet is typically never assigned a
  // provider, so this path is reachable and must not leave a "{Provider name}" placeholder in a
  // document handed to the patient.
  it('falls back to the current user when no provider is assigned to the visit', async () => {
    const excuse = await renderDialog(encounterWith(undefined), [admitter]);

    expect(excuse.providerDetails).toEqual({ name: 'Casey Scribe, MA', credentials: 'MA' });
    expect(excuse.footerNote).toContain('Sincerely,\nCasey Scribe, MA');
  });

  // The assignment resolves to a Practitioner that is no longer in the appointment bundle — a
  // deleted record still referenced by the encounter drops out of the search's includes.
  it('falls back to the current user when the assigned practitioner cannot be resolved', async () => {
    const excuse = await renderDialog(encounterWith('deleted-practitioner'), [admitter]);

    expect(excuse.providerDetails).toEqual({ name: 'Casey Scribe, MA', credentials: 'MA' });
  });

  // A Practitioner record with no given and no family name yields no display name at all, so the
  // assignment resolving is not on its own enough to guarantee a signature.
  it('falls back to the current user when the assigned practitioner has no name', async () => {
    const unnamed: Practitioner = { resourceType: 'Practitioner', id: 'unnamed-provider' };

    const excuse = await renderDialog(encounterWith(unnamed.id), [unnamed]);

    expect(excuse.providerDetails.name).toBe('Casey Scribe, MA');
    expect(excuse.footerNote).not.toContain('{Provider name}');
  });

  // Users with no Practitioner profile fall through to the branded team name `userName` supplies,
  // rather than to an empty or placeholder signature.
  it('never signs with a placeholder when neither provider nor user profile resolves', async () => {
    vi.mocked(useEvolveUser).mockReturnValue({ userName: 'Ottehr team', profileResource: undefined } as any);

    const excuse = await renderDialog(encounterWith(undefined), []);

    expect(excuse.providerDetails).toEqual({ name: 'Ottehr team', credentials: '' });
    expect(excuse.footerNote).not.toContain('{Provider name}');
  });
});
