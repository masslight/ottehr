import { renderHook } from '@testing-library/react';
import { Practitioner } from 'fhir/r4b';
import { PROVIDER_TYPE_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { VisitStatusLabel } from 'utils/lib/types/api/appointment.types';
import { ProviderTypeCode } from 'utils/lib/types/api/practitioner.types';
import { NO_SIGN_PERMISSION_MESSAGE } from 'utils/lib/types/api/sign-appointment/sign-appointment.types';
import { RoleType } from 'utils/lib/types/api/user.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The hook is the single source of truth for "may this note be signed, and if not why not", shared
// by the Review & Sign button and by the Discharge dialog. The two gate on different subsets, so
// what matters here is that the reasons land in the right bucket — in particular that the
// discharge-status reason is kept out of `readinessMessages`, which is what lets the Discharge
// dialog offer signing on a visit it is about to discharge.

const signAppointment = vi.fn().mockResolvedValue(undefined);
const updateVisitStatusToAwaitSupervisorApproval = vi.fn().mockResolvedValue(undefined);
const appointmentRefetch = vi.fn().mockResolvedValue(undefined);

const makePractitioner = (providerType: ProviderTypeCode): Practitioner => ({
  resourceType: 'Practitioner',
  id: 'practitioner-1',
  extension: [
    {
      url: PROVIDER_TYPE_EXTENSION_URL,
      valueCodeableConcept: { coding: [{ code: providerType }] },
    },
  ],
});

let userRoles: RoleType[] = [RoleType.Provider];
let practitioner: Practitioner = makePractitioner('NP');
let visitStatus: VisitStatusLabel = 'discharged';
let isAssignedProviderEligible = true;
let chartFields: Record<string, unknown> = {};
let chartData: Record<string, unknown> = {};
let supervisorApprovalEnabled = true;

vi.mock('src/hooks/useEvolveUser', () => ({
  default: () => ({
    profileResource: practitioner,
    hasRole: (roles: RoleType[]) => roles.some((role) => userRoles.includes(role)),
  }),
}));

vi.mock('src/constants/feature-flags', () => ({
  get FEATURE_FLAGS() {
    return { SUPERVISOR_APPROVAL_ENABLED: supervisorApprovalEnabled };
  },
}));

vi.mock('src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({
    appointment: { id: 'appointment-1', resourceType: 'Appointment', status: 'fulfilled' },
    encounter: { id: 'encounter-1', resourceType: 'Encounter' },
    appointmentRefetch,
  }),
  useChartData: () => ({ chartData }),
}));

vi.mock('utils/lib/utils/visitUtils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('utils/lib/utils/visitUtils')>()),
  getInPersonVisitStatus: () => visitStatus,
  getSupervisorApprovalStatus: () => undefined,
}));

vi.mock('src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: () => ({ visitType: 'in-person', isAppointmentReadOnly: false }),
}));

vi.mock('src/features/visits/shared/hooks/useChartFields', () => ({
  useChartFields: () => ({ data: chartFields }),
}));

vi.mock('src/features/visits/shared/hooks/useOystehrAPIClient', () => ({
  useOystehrAPIClient: () => ({}),
}));

vi.mock('src/features/visits/shared/hooks/useAssignedProvider', () => ({
  useAssignedProvider: () => ({ isAssignedProviderEligible }),
}));

vi.mock('src/features/visits/shared/stores/tracking-board/tracking-board.queries', () => ({
  useSignAppointmentMutation: () => ({ mutateAsync: signAppointment, isPending: false }),
}));

vi.mock('src/features/visits/telemed/hooks/usePendingSupervisorApproval', () => ({
  usePendingSupervisorApproval: () => ({ updateVisitStatusToAwaitSupervisorApproval, loading: false }),
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

import { useProgressNoteSigning } from '../../src/features/visits/shared/hooks/useProgressNoteSigning';

const signable = {
  chartData: { diagnosis: [{ isPrimary: true }], emCode: { code: '99213' } },
  chartFields: {
    chiefComplaint: { text: 'HPI' },
    accident: {},
    inHouseLabResults: {},
    patientInfoConfirmed: { value: true },
  },
};

describe('useProgressNoteSigning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userRoles = [RoleType.Provider];
    practitioner = makePractitioner('NP');
    visitStatus = 'discharged';
    isAssignedProviderEligible = true;
    supervisorApprovalEnabled = true;
    chartData = signable.chartData;
    chartFields = signable.chartFields;
  });

  it('reports nothing blocking a complete, discharged note', () => {
    const { result } = renderHook(() => useProgressNoteSigning());

    expect(result.current.errorMessages).toEqual([]);
    expect(result.current.permissionMessages).toEqual([]);
    expect(result.current.readinessMessages).toEqual([]);
  });

  // The contract the Discharge dialog depends on: it signs straight after the discharge it is about
  // to perform, so it reads `readinessMessages` and must not see the not-yet-discharged reason.
  it('keeps the discharge-status reason out of readinessMessages', () => {
    visitStatus = 'provider';
    const { result } = renderHook(() => useProgressNoteSigning());

    expect(result.current.errorMessages).toContain('You must discharge the patient before signing');
    expect(result.current.readinessMessages).toEqual([]);
    expect(result.current.permissionMessages).toEqual([]);
  });

  it('puts chart gaps in readinessMessages so both callers block on them', () => {
    chartData = {};
    chartFields = { accident: {}, inHouseLabResults: {} };
    const { result } = renderHook(() => useProgressNoteSigning());

    expect(result.current.readinessMessages).toEqual([
      'You need to fill in the missing data',
      'You need to confirm patient information',
    ]);
    expect(result.current.errorMessages).toEqual(result.current.readinessMessages);
  });

  it('reports a role that may not sign alone, hiding every other gap', () => {
    userRoles = [RoleType.Clinician];
    chartData = {};
    visitStatus = 'provider';
    const { result } = renderHook(() => useProgressNoteSigning());

    expect(result.current.permissionMessages).toEqual([NO_SIGN_PERMISSION_MESSAGE]);
    expect(result.current.errorMessages).toEqual([NO_SIGN_PERMISSION_MESSAGE]);
    expect(result.current.readinessMessages).toEqual([]);
  });

  it('reports an ineligible assigned provider alongside the remaining gaps', () => {
    isAssignedProviderEligible = false;
    chartData = {};
    const { result } = renderHook(() => useProgressNoteSigning());

    expect(result.current.errorMessages[0]).toBe('A provider must be assigned to this visit');
    expect(result.current.errorMessages).toContain('You need to fill in the missing data');
  });

  it('offers supervisor approval to a non-physician only', () => {
    expect(renderHook(() => useProgressNoteSigning()).result.current.supervisorApprovalApplies).toBe(true);

    practitioner = makePractitioner('MD');
    expect(renderHook(() => useProgressNoteSigning()).result.current.supervisorApprovalApplies).toBe(false);

    practitioner = makePractitioner('NP');
    supervisorApprovalEnabled = false;
    expect(renderHook(() => useProgressNoteSigning()).result.current.supervisorApprovalApplies).toBe(false);
  });

  it('routes to the supervisor approval flow instead of signing when asked', async () => {
    const { result } = renderHook(() => useProgressNoteSigning());

    await result.current.signNote({ requireSupervisorApproval: true });

    expect(updateVisitStatusToAwaitSupervisorApproval).toHaveBeenCalledTimes(1);
    expect(signAppointment).not.toHaveBeenCalled();
    expect(appointmentRefetch).toHaveBeenCalledTimes(1);
  });

  it('signs directly when approval is declined, and refreshes the appointment', async () => {
    const { result } = renderHook(() => useProgressNoteSigning());

    await result.current.signNote({ requireSupervisorApproval: false });

    expect(signAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ appointmentId: 'appointment-1', encounterId: 'encounter-1' })
    );
    expect(updateVisitStatusToAwaitSupervisorApproval).not.toHaveBeenCalled();
    expect(appointmentRefetch).toHaveBeenCalledTimes(1);
  });

  // The Discharge dialog closes itself when signNote resolves, so a failed approval must surface.
  it('propagates a failed supervisor-approval request', async () => {
    updateVisitStatusToAwaitSupervisorApproval.mockRejectedValueOnce(new Error('approval routing failed'));
    const { result } = renderHook(() => useProgressNoteSigning());

    await expect(result.current.signNote({ requireSupervisorApproval: true })).rejects.toThrow(
      'approval routing failed'
    );
    expect(appointmentRefetch).not.toHaveBeenCalled();
  });

  it('signs directly for a physician even if approval is requested', async () => {
    practitioner = makePractitioner('MD');
    const { result } = renderHook(() => useProgressNoteSigning());

    await result.current.signNote({ requireSupervisorApproval: true });

    expect(signAppointment).toHaveBeenCalledTimes(1);
    expect(updateVisitStatusToAwaitSupervisorApproval).not.toHaveBeenCalled();
  });
});
