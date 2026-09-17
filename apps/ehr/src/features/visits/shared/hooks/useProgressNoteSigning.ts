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
  /** The note is already signed, or awaiting supervisor approval. */
  completed: boolean;
  /** Reasons this user may not sign this note, whatever state the chart is in. */
  permissionMessages: string[];
  /** Reasons the chart itself is not ready to be signed. */
  readinessMessages: string[];
  /** Permission, visit-status and readiness reasons combined. */
  errorMessages: string[];
  supervisorApprovalApplies: boolean;
  mdmRequired: boolean;
  inPersonStatus: ReturnType<typeof getInPersonVisitStatus> | undefined;
  isSigning: boolean;
  signNote: (options: { requireSupervisorApproval: boolean }) => Promise<void>;
}

/**
 * Shared by the Review & Sign button and the Discharge dialog. Reasons are grouped by category
 * because the two gate on different subsets.
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
  // Permitted while the user is still loading, so the button is not briefly greyed out.
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

    if (!canSignNote) {
      return [NO_SIGN_PERMISSION_MESSAGE];
    }

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
