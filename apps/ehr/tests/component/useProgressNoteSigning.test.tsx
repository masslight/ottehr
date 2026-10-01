import { renderHook } from '@testing-library/react';
import { Practitioner } from 'fhir/r4b';
import { PROVIDER_TYPE_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { VisitStatusLabel } from 'utils/lib/types/api/appointment.types';
import { VisitNoteResponse } from 'utils/lib/types/api/chart-data/get-visit-note.types';
import { ProviderTypeCode } from 'utils/lib/types/api/practitioner.types';
import { NO_SIGN_PERMISSION_MESSAGE } from 'utils/lib/types/api/sign-appointment/sign-appointment.types';
import { RoleType } from 'utils/lib/types/api/user.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyVisitNote } from './helpers/emptyVisitNote';

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
let note: VisitNoteResponse | undefined;
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
}));

vi.mock('src/features/visits/shared/hooks/useVisitNote', () => ({
  useVisitNote: () => ({ data: note }),
}));

vi.mock('utils/lib/utils/visitUtils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('utils/lib/utils/visitUtils')>()),
  getInPersonVisitStatus: () => visitStatus,
  getSupervisorApprovalStatus: () => undefined,
}));

vi.mock('src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: () => ({ visitType: 'in-person', isAppointmentReadOnly: false }),
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

const signableNote = (): VisitNoteResponse =>
  emptyVisitNote({
    assessment: { diagnosis: [{ isPrimary: true }], emCode: { code: '99213' } },
    encounterNotes: { chiefComplaint: { text: 'HPI' }, patientInfoConfirmed: { value: true } },
  } as unknown as Partial<VisitNoteResponse>);

describe('useProgressNoteSigning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userRoles = [RoleType.Provider];
    practitioner = makePractitioner('NP');
    visitStatus = 'discharged';
    isAssignedProviderEligible = true;
    supervisorApprovalEnabled = true;
    note = signableNote();
  });

  it('reports nothing blocking a complete, discharged note', () => {
    const { result } = renderHook(() => useProgressNoteSigning());

    expect(result.current.errorMessages).toEqual([]);
    expect(result.current.permissionMessages).toEqual([]);
    expect(result.current.readinessMessages).toEqual([]);
  });

  it('keeps the discharge-status reason out of readinessMessages', () => {
    visitStatus = 'provider';
    const { result } = renderHook(() => useProgressNoteSigning());

    expect(result.current.errorMessages).toContain('You must discharge the patient before signing');
    expect(result.current.readinessMessages).toEqual([]);
    expect(result.current.permissionMessages).toEqual([]);
  });

  it('puts chart gaps in readinessMessages so both callers block on them', () => {
    note = emptyVisitNote();
    const { result } = renderHook(() => useProgressNoteSigning());

    expect(result.current.readinessMessages).toEqual([
      'You need to fill in the missing data',
      'You need to confirm patient information',
    ]);
    expect(result.current.errorMessages).toEqual(result.current.readinessMessages);
  });

  it('reports a role that may not sign alone, hiding every other gap', () => {
    userRoles = [RoleType.Clinician];
    note = emptyVisitNote();
    visitStatus = 'provider';
    const { result } = renderHook(() => useProgressNoteSigning());

    expect(result.current.permissionMessages).toEqual([NO_SIGN_PERMISSION_MESSAGE]);
    expect(result.current.errorMessages).toEqual([NO_SIGN_PERMISSION_MESSAGE]);
    expect(result.current.readinessMessages).toEqual([]);
  });

  it('reports an ineligible assigned provider alongside the remaining gaps', () => {
    isAssignedProviderEligible = false;
    note = emptyVisitNote();
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
