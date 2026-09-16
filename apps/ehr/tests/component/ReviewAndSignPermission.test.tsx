import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { dataTestIds } from 'src/constants/data-test-ids';
import { NO_SIGN_PERMISSION_MESSAGE } from 'utils/lib/types/api/sign-appointment/sign-appointment.types';
import { RoleType } from 'utils/lib/types/api/user.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Signing a visit note is limited to provider-level roles. A Clinician charts the visit but may not
// sign it, so the button has to say so rather than fail the request — the zambda refuses the same
// call. Everything else about the visit is mocked into a signable state so only the role gate is
// under test.

let userRoles: RoleType[] = [RoleType.Provider];

vi.mock('src/hooks/useEvolveUser', () => ({
  default: () => ({
    profileResource: { resourceType: 'Practitioner', id: 'practitioner-1' },
    hasRole: (roles: RoleType[]) => roles.some((role) => userRoles.includes(role)),
  }),
}));

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({
    patient: { id: 'patient-1', name: [{ given: ['Alex'], family: 'Patient' }] },
    appointment: { id: 'appointment-1', resourceType: 'Appointment', status: 'fulfilled' },
    encounter: { id: 'encounter-1', resourceType: 'Encounter' },
    appointmentRefetch: vi.fn(),
  }),
  useChartData: () => ({
    chartData: { diagnosis: [{ isPrimary: true }], emCode: { code: '99213' } },
  }),
}));

// 'discharged' is the only status the sign button accepts; the permission gate is checked ahead of it.
vi.mock('utils/lib/utils/visitUtils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('utils/lib/utils/visitUtils')>()),
  getInPersonVisitStatus: () => 'discharged',
  getSupervisorApprovalStatus: () => undefined,
}));

vi.mock('../../src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: () => ({ visitType: 'in-person', isAppointmentReadOnly: false }),
}));

vi.mock('../../src/features/visits/shared/hooks/useChartFields', () => ({
  useChartFields: () => ({
    data: {
      medicalDecision: { text: 'MDM' },
      chiefComplaint: { text: 'HPI' },
      historyOfPresentIllness: { text: 'HPI' },
      accident: {},
      inHouseLabResults: {},
      patientInfoConfirmed: { value: true },
    },
  }),
}));

vi.mock('../../src/features/visits/shared/hooks/useOystehrAPIClient', () => ({
  useOystehrAPIClient: () => ({}),
}));

vi.mock('../../src/features/visits/shared/hooks/useAssignedProvider', () => ({
  useAssignedProvider: () => ({ isAssignedProviderEligible: true }),
}));

vi.mock('../../src/features/visits/shared/stores/tracking-board/tracking-board.queries', () => ({
  useSignAppointmentMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('src/features/visits/telemed/hooks/usePendingSupervisorApproval', () => ({
  usePendingSupervisorApproval: () => ({
    updateVisitStatusToAwaitSupervisorApproval: vi.fn(),
    loading: false,
  }),
}));

vi.mock('src/hooks/useProgressNoteConfig', () => ({
  useProgressNoteConfig: () => ({ data: { mdmRequired: false } }),
}));

vi.mock('src/features/visits/shared/hooks/usePractitioner', () => ({
  usePractitionerActions: () => ({ isEncounterUpdatePending: false }),
}));

const noDrafts = { hasDraft: () => false };
vi.mock('src/state/draft-data.store', () => ({
  useCreateExternalLabStore: () => noDrafts,
  useCreateInHouseLabStore: () => noDrafts,
  useCreateRadiologyOrderStore: () => noDrafts,
  useImmunizationOrderStore: () => noDrafts,
  useInHouseMedicationOrderStore: () => noDrafts,
  useNursingOrderStore: () => noDrafts,
  useProcedureStore: () => noDrafts,
  useVitalsDraftStore: () => noDrafts,
}));

import { ReviewAndSignButton } from '../../src/features/visits/shared/components/review-tab/ReviewAndSignButton';

const signButton = (): HTMLElement => screen.getByTestId(dataTestIds.progressNotePage.reviewAndSignButton);

describe('ReviewAndSignButton role gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userRoles = [RoleType.Provider];
  });

  it('greys out the button and explains why for a Clinician', async () => {
    userRoles = [RoleType.Clinician];
    render(<ReviewAndSignButton />);

    expect(signButton()).toBeDisabled();

    await userEvent.hover(signButton().parentElement!);
    expect(await screen.findByText(NO_SIGN_PERMISSION_MESSAGE)).toBeInTheDocument();
  });

  it('leaves the button usable for a Provider', async () => {
    render(<ReviewAndSignButton />);

    expect(signButton()).toBeEnabled();

    await userEvent.hover(signButton().parentElement!);
    expect(screen.queryByText(NO_SIGN_PERMISSION_MESSAGE)).not.toBeInTheDocument();
  });
});
