import CheckIcon from '@mui/icons-material/Check';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Box, Checkbox, DialogContentText, FormControlLabel, Stack, Tooltip, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import { FC, useMemo, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { FEATURE_FLAGS } from 'src/constants/feature-flags';
import { usePractitionerActions } from 'src/features/visits/shared/hooks/usePractitioner';
import { usePendingSupervisorApproval } from 'src/features/visits/telemed/hooks/usePendingSupervisorApproval';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { useProgressNoteConfig } from 'src/hooks/useProgressNoteConfig';
import { getPatientName } from 'src/shared/utils';
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
import {
  getInPersonVisitStatus,
  getProviderType,
  getSupervisorApprovalStatus,
  isPhysicianProviderType,
  PRACTITIONER_CODINGS,
} from 'utils';
import { ConfirmationDialog } from '../../../../../components/ConfirmationDialog';
import { RoundedButton } from '../../../../../components/RoundedButton';
import { useChartFields } from '../../hooks/useChartFields';
import { useGetAppointmentAccessibility } from '../../hooks/useGetAppointmentAccessibility';
import { useOystehrAPIClient } from '../../hooks/useOystehrAPIClient';
import { useAppointmentData, useChartData } from '../../stores/appointment/appointment.store';
import { useSignAppointmentMutation } from '../../stores/tracking-board/tracking-board.queries';

type ReviewAndSignButtonProps = {
  onSigned?: () => void;
};

export const ReviewAndSignButton: FC<ReviewAndSignButtonProps> = ({ onSigned }) => {
  const { patient, appointment, encounter, appointmentRefetch } = useAppointmentData();
  const { chartData } = useChartData();
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

  const { data: chartFields } = useChartFields({
    requestedFields: {
      medicalDecision: {
        _tag: 'medical-decision',
      },
      chiefComplaint: {
        _tag: 'chief-complaint',
      },
      historyOfPresentIllness: {
        _tag: 'history-of-present-illness',
      },
      accident: {
        _tag: 'accident',
      },
      inHouseLabResults: {},
      patientInfoConfirmed: {},
    },
  });

  const apiClient = useOystehrAPIClient();
  const practitioner = useEvolveUser()?.profileResource;

  const { mutateAsync: signAppointment, isPending: isSignLoading } = useSignAppointmentMutation();
  const [openTooltip, setOpenTooltip] = useState(false);

  const [requireSupervisorApproval, setRequireSupervisorApproval] = useState(true);

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

  const patientName = getPatientName(patient?.name).firstLastName;

  const { isEncounterUpdatePending } = usePractitionerActions(encounter, 'end', PRACTITIONER_CODINGS.Attender);

  const isLoading = isSignLoading || isEncounterUpdatePending || isPendingSupervisorApproval;
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

  const errorMessage = useMemo(() => {
    const messages: string[] = [];

    if (completed || isFollowup) {
      return messages;
    }

    if (inPersonStatus) {
      if (inPersonStatus === 'provider') {
        messages.push('You must discharge the patient before signing');
      } else if (inPersonStatus !== 'discharged' && inPersonStatus !== 'completed') {
        messages.push('The appointment must be in the status of discharged');
      }
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
    inPersonStatus,
    primaryDiagnosis,
    medicalDecision,
    mdmRequired,
    hpi,
    emCode,
    accidentMissingDate,
    accidentMissingState,
    patientInfoConfirmed,
    inHouseLabResultsPending,
    isFollowup,
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

  const handleCloseTooltip = (): void => {
    setOpenTooltip(false);
  };

  const handleOpenTooltip = (): void => {
    setOpenTooltip(true);
  };

  const handleSign = async (): Promise<void> => {
    if (!apiClient || !appointment?.id) {
      throw new Error('api client not defined or appointmentId not provided');
    }

    if (shouldRequireSupervisorApproval && requireSupervisorApproval) {
      await updateVisitStatusToAwaitSupervisorApproval();
    } else {
      await signAppointment({
        apiClient,
        appointmentId: appointment.id,
        encounterId: encounter.id!,
        timezone: DateTime.now().zoneName,
        supervisorApprovalEnabled: FEATURE_FLAGS.SUPERVISOR_APPROVAL_ENABLED,
      });
      await appointmentRefetch();
    }

    if (onSigned) {
      onSigned();
    }
  };

  const showSupervisorCheckbox = useMemo(() => {
    if (!practitioner) return false;

    const providerType = getProviderType(practitioner);
    const isPhysician = isPhysicianProviderType(providerType);

    return !isPhysician;
  }, [practitioner]);

  const shouldRequireSupervisorApproval =
    FEATURE_FLAGS.SUPERVISOR_APPROVAL_ENABLED && showSupervisorCheckbox && !isFollowup;
  const confirmationDescription = mdmRequired
    ? 'Are you sure you have reviewed the patient chart, performed the examination, defined the diagnoses, made a medical decision and chosen an E&M code and are ready to sign this patient?'
    : 'Are you sure you have reviewed the patient chart, performed the examination, defined the diagnoses and chosen an E&M code and are ready to sign this patient?';

  return (
    <Box sx={{ display: 'flex', justifyContent: 'end' }}>
      <Tooltip
        placement="top"
        open={openTooltip && errorMessage.length > 0}
        onClose={handleCloseTooltip}
        onOpen={handleOpenTooltip}
        title={errorMessage.map((message) => (
          <Typography key={message}>{message}</Typography>
        ))}
      >
        <Box>
          <ConfirmationDialog
            title={`Review and Sign ${patientName}`}
            description={
              <Stack spacing={2}>
                <DialogContentText>{confirmationDescription}</DialogContentText>

                {shouldRequireSupervisorApproval && (
                  <FormControlLabel
                    control={
                      <Checkbox
                        data-testid={dataTestIds.progressNotePage.supervisorApprovalCheckbox}
                        checked={requireSupervisorApproval}
                        onChange={(e) => setRequireSupervisorApproval(e.target.checked)}
                      />
                    }
                    label={
                      <Box display="flex" alignItems="center" gap={0.5}>
                        Require Supervisor approval
                        <Tooltip
                          placement="top"
                          title="When this option is ON, the button 'Approve' becomes available for Supervisor on the complete visits on Discharged tab of the Tracking Board. Once approved, the claim will be submitted to RCM."
                        >
                          <InfoOutlinedIcon fontSize="small" color="action" />
                        </Tooltip>
                      </Box>
                    }
                  />
                )}
              </Stack>
            }
            response={handleSign}
            actionButtons={{
              proceed: { text: 'Sign', loading: isLoading },
              back: { text: 'Cancel' },
              reverse: true,
            }}
          >
            {(showDialog) => (
              <RoundedButton
                disabled={errorMessage.length > 0 || isLoading || completed || inPersonStatus === 'provider'}
                variant="contained"
                onClick={showDialog}
                startIcon={completed ? <CheckIcon color="inherit" /> : undefined}
                data-testid={dataTestIds.progressNotePage.reviewAndSignButton}
              >
                {completed ? 'Signed' : 'Review & Sign'}
              </RoundedButton>
            )}
          </ConfirmationDialog>
        </Box>
      </Tooltip>
    </Box>
  );
};
