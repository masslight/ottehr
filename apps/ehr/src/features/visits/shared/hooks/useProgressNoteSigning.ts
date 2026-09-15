import { DateTime } from 'luxon';
import { useCallback, useMemo } from 'react';
import { FEATURE_FLAGS } from 'src/constants/feature-flags';
import { usePendingSupervisorApproval } from 'src/features/visits/telemed/hooks/usePendingSupervisorApproval';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { useProgressNoteConfig } from 'src/hooks/useProgressNoteConfig';
import {
  useCreateExternalLabStore,
  useCreateInHouseLabStore,
  useCreateRadiologyOrderStore,
  useImmunizationOrderStore,
  useInHouseMedicationOrderStore,
  useNursingOrderStore,
  useProcedureStore,
  useVitalsDraftStore,
} from 'src/state/draft-data.store';
import { getProviderType, isPhysicianProviderType } from 'utils/lib/helpers/helpers';
import {
  NO_SIGN_PERMISSION_MESSAGE,
  VISIT_NOTE_SIGNING_ROLES,
} from 'utils/lib/types/api/sign-appointment/sign-appointment.types';
import { PRACTITIONER_CODINGS } from 'utils/lib/types/data/appointments/appointments.types';
import { getInPersonVisitStatus, getSupervisorApprovalStatus } from 'utils/lib/utils/visitUtils';
import { useAppointmentData, useChartData } from '../stores/appointment/appointment.store';
import { useSignAppointmentMutation } from '../stores/tracking-board/tracking-board.queries';
import { useAssignedProvider } from './useAssignedProvider';
import { useGetAppointmentAccessibility } from './useGetAppointmentAccessibility';
import { useOystehrAPIClient } from './useOystehrAPIClient';
import { usePractitionerActions } from './usePractitioner';
import { useProgressNoteChartFields } from './useProgressNoteChartFields';

export interface ProgressNoteSigning {
  /** The note is already signed (or awaiting supervisor approval) and cannot be signed again. */
  completed: boolean;
  /** Reasons this user may not sign this note at all, whatever state the chart is in. */
  permissionMessages: string[];
  /** Reasons the chart itself is not ready to be signed. */
  readinessMessages: string[];
  /** Every reason the note cannot be signed right now, most fundamental first. */
  errorMessages: string[];
  /** Whether the supervisor-approval option applies to the signing practitioner. */
  supervisorApprovalApplies: boolean;
  /** Whether a medical decision is required before the note can be signed. */
  mdmRequired: boolean;
  inPersonStatus: ReturnType<typeof getInPersonVisitStatus> | undefined;
  isSigning: boolean;
  signNote: (options: { requireSupervisorApproval: boolean }) => Promise<void>;
}

/**
 * Everything needed to sign a visit note: whether it can be signed, why not, and the action itself.
 *
 * Shared by the standalone Review & Sign button and by the Discharge dialog's Review & Sign
 * section, so the two cannot disagree about when a note is signable. The reasons are returned in
 * categories rather than as one list because the callers gate on different subsets — the Discharge
 * dialog signs immediately after the discharge it is about to perform, so the visit-status reason
 * ("you must discharge first") folded into `errorMessages` does not apply to it.
 */
export const useProgressNoteSigning = (): ProgressNoteSigning => {
  const { appointment, encounter, appointmentRefetch } = useAppointmentData();
  const { chartData } = useChartData();
  const { data: chartFields } = useProgressNoteChartFields();
  const appointmentAccessibility = useGetAppointmentAccessibility();
  const isFollowup = appointmentAccessibility.visitType === 'follow-up';

  const { hasDraft: hasExternalLabDraft } = useCreateExternalLabStore();
  const { hasDraft: hasInHouseLabDraft } = useCreateInHouseLabStore();
  const { hasDraft: hasRadiologyDraft } = useCreateRadiologyOrderStore();
  const { hasDraft: hasProcedureDraft } = useProcedureStore();
  const { hasDraft: hasNursingOrderDraft } = useNursingOrderStore();
  const { hasDraft: hasImmunizationDraft } = useImmunizationOrderStore();
  const { hasDraft: hasMedDraft } = useInHouseMedicationOrderStore();
  const { hasDraft: hasVitalsDraft } = useVitalsDraftStore();

  const apiClient = useOystehrAPIClient();
  const { isAssignedProviderEligible } = useAssignedProvider();
  const user = useEvolveUser();
  const practitioner = user?.profileResource;
  // Signing is limited to provider-level roles; a Clinician charts the visit but may not sign it.
  // The sign zambda refuses the same call, so this only spares the round trip and explains why.
  // Undefined while the user is still loading — treated as permitted so the button isn't briefly
  // greyed out with a permission message for a provider.
  const canSignNote = user ? user.hasRole(VISIT_NOTE_SIGNING_ROLES) : true;

  const { mutateAsync: signAppointment, isPending: isSignLoading } = useSignAppointmentMutation();

  const { updateVisitStatusToAwaitSupervisorApproval, loading: isPendingSupervisorApproval } =
    usePendingSupervisorApproval({
      encounterId: encounter.id!,
      practitionerId: practitioner?.id ?? '',
    });

  const { data: progressNoteConfig } = useProgressNoteConfig();
  const mdmRequired = progressNoteConfig?.mdmRequired ?? true;

  const primaryDiagnosis = (chartData?.diagnosis || []).find((item) => item.isPrimary);
  const medicalDecision = chartFields?.medicalDecision?.text;
  const hpi = chartFields?.chiefComplaint?.text;
  const emCode = chartData?.emCode;
  const patientInfoConfirmed = chartFields?.patientInfoConfirmed?.value;
  const hasAccidentType = (chartFields?.accident?.type?.length ?? 0) > 0;
  const isAutoAccident = chartFields?.accident?.type?.includes('AA') ?? false;
  const accidentMissingDate = hasAccidentType && !chartFields?.accident?.date;
  const accidentMissingState = isAutoAccident && !chartFields?.accident?.state;
  const inHouseLabResultsPending = chartFields?.inHouseLabResults?.resultsPending;
  const inHouseLabReflexTestPending = chartFields?.inHouseLabResults?.reflexTestsPending;

  const { isEncounterUpdatePending } = usePractitionerActions(encounter, 'end', PRACTITIONER_CODINGS.Attender);

  const isSigning = isSignLoading || isEncounterUpdatePending || isPendingSupervisorApproval;

  const inPersonStatus = useMemo(
    () => appointment && getInPersonVisitStatus(appointment, encounter),
    [appointment, encounter]
  );
  const approvalStatus = getSupervisorApprovalStatus(appointment, encounter);
  const completed = useMemo(() => {
    return isFollowup
      ? appointmentAccessibility.isAppointmentReadOnly
      : appointmentAccessibility.isAppointmentReadOnly || approvalStatus === 'waiting-for-approval';
  }, [appointmentAccessibility.isAppointmentReadOnly, isFollowup, approvalStatus]);

  const permissionMessages = useMemo(() => {
    if (completed) {
      return [];
    }

    // Reported alone: nothing else the user could fix would make signing possible, so listing the
    // visit's other gaps alongside it would only obscure the reason.
    if (!canSignNote) {
      return [NO_SIGN_PERMISSION_MESSAGE];
    }

    // The assigned provider is the note's rendering provider, and the sign zambda rejects a visit
    // whose provider no longer holds the Provider role. Checked here too so the caller reports it
    // rather than failing the request — the enclosing InPersonLayout normally hides this whole page
    // in that state, so this only matters if that gate is ever relaxed.
    if (!isAssignedProviderEligible) {
      return ['A provider must be assigned to this visit'];
    }

    return [];
  }, [completed, canSignNote, isAssignedProviderEligible]);

  const visitStatusMessages = useMemo(() => {
    if (completed || !canSignNote || isFollowup || !inPersonStatus) {
      return [];
    }

    if (inPersonStatus === 'provider') {
      return ['You must discharge the patient before signing'];
    }

    if (inPersonStatus !== 'discharged' && inPersonStatus !== 'completed') {
      return ['The appointment must be in the status of discharged'];
    }

    return [];
  }, [completed, canSignNote, isFollowup, inPersonStatus]);

  const readinessMessages = useMemo(() => {
    const messages: string[] = [];

    if (completed || !canSignNote || isFollowup) {
      return messages;
    }

    if (
      !primaryDiagnosis ||
      (mdmRequired && !medicalDecision) ||
      !emCode ||
      !hpi ||
      accidentMissingDate ||
      accidentMissingState
    ) {
      messages.push('You need to fill in the missing data');
    }

    if (!patientInfoConfirmed) {
      messages.push('You need to confirm patient information');
    }

    if (inHouseLabResultsPending) {
      messages.push('In-House lab results pending');
    }

    if (inHouseLabReflexTestPending) {
      inHouseLabReflexTestPending.forEach((test) =>
        messages.push(`In-House lab results have triggered a reflex test for ${test}`)
      );
    }

    if (encounter.id) {
      const makeDraftWarningMessage = (infoType: string): string => {
        return `Complete or clear the in-progress ${infoType} to sign`;
      };
      if (hasExternalLabDraft(encounter.id)) {
        messages.push(makeDraftWarningMessage('external lab order'));
      }

      if (hasInHouseLabDraft(encounter.id)) {
        messages.push(makeDraftWarningMessage('in house lab order'));
      }

      if (hasRadiologyDraft(encounter.id)) {
        messages.push(makeDraftWarningMessage('radiology order'));
      }
      if (hasProcedureDraft(encounter.id)) {
        messages.push(makeDraftWarningMessage('procedure'));
      }
      if (hasNursingOrderDraft(encounter.id)) {
        messages.push(makeDraftWarningMessage('nursing order'));
      }
      if (hasImmunizationDraft(encounter.id)) {
        messages.push(makeDraftWarningMessage('immunization'));
      }
      if (hasMedDraft(encounter.id)) {
        messages.push(makeDraftWarningMessage('in house medication order'));
      }
      if (hasVitalsDraft(encounter.id)) {
        messages.push(makeDraftWarningMessage('vitals'));
      }
    }

    return messages;
  }, [
    completed,
    canSignNote,
    isFollowup,
    primaryDiagnosis,
    medicalDecision,
    mdmRequired,
    hpi,
    emCode,
    accidentMissingDate,
    accidentMissingState,
    patientInfoConfirmed,
    inHouseLabResultsPending,
    inHouseLabReflexTestPending,
    hasExternalLabDraft,
    hasInHouseLabDraft,
    hasRadiologyDraft,
    hasProcedureDraft,
    hasNursingOrderDraft,
    hasImmunizationDraft,
    hasMedDraft,
    hasVitalsDraft,
    encounter.id,
  ]);

  // Concatenated rather than short-circuited: every category already returns empty when a more
  // fundamental one applies, so the order here is the order the reasons are reported in.
  const errorMessages = useMemo(
    () => [...permissionMessages, ...visitStatusMessages, ...readinessMessages],
    [permissionMessages, visitStatusMessages, readinessMessages]
  );

  const supervisorApprovalApplies = useMemo(() => {
    if (!FEATURE_FLAGS.SUPERVISOR_APPROVAL_ENABLED || isFollowup || !practitioner) {
      return false;
    }

    return !isPhysicianProviderType(getProviderType(practitioner));
  }, [isFollowup, practitioner]);

  const signNote = useCallback(
    async ({ requireSupervisorApproval }: { requireSupervisorApproval: boolean }): Promise<void> => {
      if (!apiClient || !appointment?.id) {
        throw new Error('api client not defined or appointmentId not provided');
      }

      if (supervisorApprovalApplies && requireSupervisorApproval) {
        await updateVisitStatusToAwaitSupervisorApproval();
      } else {
        await signAppointment({
          apiClient,
          appointmentId: appointment.id,
          encounterId: encounter.id!,
          timezone: DateTime.now().zoneName,
          supervisorApprovalEnabled: FEATURE_FLAGS.SUPERVISOR_APPROVAL_ENABLED,
        });
      }

      await appointmentRefetch();
    },
    [
      apiClient,
      appointment?.id,
      encounter.id,
      supervisorApprovalApplies,
      updateVisitStatusToAwaitSupervisorApproval,
      signAppointment,
      appointmentRefetch,
    ]
  );

  return {
    completed,
    permissionMessages,
    readinessMessages,
    errorMessages,
    supervisorApprovalApplies,
    mdmRequired,
    inPersonStatus,
    isSigning,
    signNote,
  };
};
