import CheckIcon from '@mui/icons-material/Check';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Box, Checkbox, DialogContentText, FormControlLabel, Stack, Tooltip, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import { FC, useMemo, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { FEATURE_FLAGS } from 'src/constants/feature-flags';
import { usePendingSupervisorApproval } from 'src/features/telemed';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { useAppointmentData, useChartData } from 'src/shared/hooks/appointment/appointment.store';
import { useChartFields } from 'src/shared/hooks/appointment/useChartFields';
import { useGetAppointmentAccessibility } from 'src/shared/hooks/appointment/useGetAppointmentAccessibility';
import { useGetAppointmentAwaitingSupervisorApproval } from 'src/shared/hooks/appointment/useGetAppointmentAwaitingSupervisorApproval';
import {
  useChangeTelemedAppointmentStatusMutation,
  useSignAppointmentMutation,
} from 'src/shared/hooks/tracking-board/tracking-board.queries';
import { usePractitionerActions } from 'src/shared/hooks/usePractitioner';
import { getPatientName } from 'src/shared/utils';
import {
  getProviderType,
  getVisitStatus,
  isPhysicianProviderType,
  PRACTITIONER_CODINGS,
  TelemedAppointmentStatusEnum,
} from 'utils';
import { useAppFlags } from '../../shared/contexts/useAppFlags';
import { useOystehrAPIClient } from '../../shared/hooks/useOystehrAPIClient';
import { ConfirmationDialog } from '../ConfirmationDialog';
import { RoundedButton } from '../RoundedButton';

type ReviewAndSignButtonProps = {
  onSigned?: () => void;
};

export const ReviewAndSignButton: FC<ReviewAndSignButtonProps> = ({ onSigned }) => {
  const { patient, appointment, encounter, appointmentRefetch, appointmentSetState } = useAppointmentData();
  const { chartData } = useChartData();

  const { data: chartFields } = useChartFields({
    requestedFields: {
      medicalDecision: {
        _tag: 'medical-decision',
      },
      inHouseLabResults: {},
      patientInfoConfirmed: {},
    },
  });

  const apiClient = useOystehrAPIClient();
  const practitioner = useEvolveUser()?.profileResource;

  const { mutateAsync: changeTelemedAppointmentStatus, isPending: isChangeLoading } =
    useChangeTelemedAppointmentStatusMutation();

  const { mutateAsync: signAppointment, isPending: isSignLoading } = useSignAppointmentMutation();
  const [openTooltip, setOpenTooltip] = useState(false);

  const [requireSupervisorApproval, setRequireSupervisorApproval] = useState(false);

  const { updateVisitStatusToAwaitSupervisorApproval, loading: isPendingSupervisorApproval } =
    usePendingSupervisorApproval({
      encounterId: encounter.id!,
      practitionerId: practitioner?.id ?? '',
    });
  const { isInPerson: inPerson } = useAppFlags();
  const appointmentAccessibility = useGetAppointmentAccessibility();

  const primaryDiagnosis = (chartData?.diagnosis || []).find((item) => item.isPrimary);
  const medicalDecision = chartFields?.medicalDecision?.text;
  const emCode = chartData?.emCode;
  const patientInfoConfirmed = chartFields?.patientInfoConfirmed?.value;
  const inHouseLabResultsPending = chartFields?.inHouseLabResults?.resultsPending;

  const patientName = getPatientName(patient?.name).firstLastName;

  const { isEncounterUpdatePending } = usePractitionerActions(encounter, 'end', PRACTITIONER_CODINGS.Attender);

  const isLoading = isChangeLoading || isSignLoading || isEncounterUpdatePending || isPendingSupervisorApproval;
  const inPersonStatus = useMemo(() => appointment && getVisitStatus(appointment, encounter), [appointment, encounter]);
  const isAwaitingSupervisorApproval = useGetAppointmentAwaitingSupervisorApproval();
  const completed = useMemo(() => {
    if (inPerson) {
      return appointmentAccessibility.isAppointmentLocked || isAwaitingSupervisorApproval;
    }
    return appointmentAccessibility.status === TelemedAppointmentStatusEnum.complete;
  }, [
    inPerson,
    appointmentAccessibility.status,
    appointmentAccessibility.isAppointmentLocked,
    isAwaitingSupervisorApproval,
  ]);

  const errorMessage = useMemo(() => {
    const messages: string[] = [];

    if (completed) {
      return messages;
    }

    if (inPerson && inPersonStatus) {
      if (inPersonStatus === 'provider') {
        messages.push('You must discharge the patient before signing');
      } else if (inPersonStatus !== 'discharged' && inPersonStatus !== 'completed') {
        messages.push('The appointment must be in the status of discharged');
      }
    } else {
      if (appointmentAccessibility.status !== TelemedAppointmentStatusEnum.unsigned) {
        messages.push('You need to finish a video call with the patient');
      }
    }

    if (!primaryDiagnosis || !medicalDecision || !emCode) {
      messages.push('You need to fill in the missing data');
    }

    if (!patientInfoConfirmed) {
      messages.push('You need to confirm patient information');
    }

    if (inHouseLabResultsPending) {
      messages.push('In-House lab results pending');
    }

    return messages;
  }, [
    inPerson,
    completed,
    inPersonStatus,
    primaryDiagnosis,
    medicalDecision,
    emCode,
    patientInfoConfirmed,
    appointmentAccessibility.status,
    inHouseLabResultsPending,
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

    if (FEATURE_FLAGS.SUPERVISOR_APPROVAL_ENABLED && requireSupervisorApproval) {
      await updateVisitStatusToAwaitSupervisorApproval();
    } else {
      if (inPerson) {
        const tz = DateTime.now().zoneName;
        await signAppointment({
          apiClient,
          appointmentId: appointment.id,
          timezone: tz,
          supervisorApprovalEnabled: FEATURE_FLAGS.SUPERVISOR_APPROVAL_ENABLED,
        });
        await appointmentRefetch();
      } else {
        await changeTelemedAppointmentStatus({
          apiClient,
          appointmentId: appointment.id,
          newStatus: TelemedAppointmentStatusEnum.complete,
        });
        appointmentSetState({
          encounter: { ...encounter, status: 'finished' },
          appointment: { ...appointment, status: 'fulfilled' },
        });
      }
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
                <DialogContentText>
                  Are you sure you have reviewed the patient chart, performed the examination, defined the diagnoses,
                  made a medical decision and chosen an E&M code and are ready to sign this patient?
                  {!inPerson && ' Once signed, notes will be locked and no changes can be made.'}
                </DialogContentText>

                {FEATURE_FLAGS.SUPERVISOR_APPROVAL_ENABLED && showSupervisorCheckbox && (
                  <FormControlLabel
                    control={
                      <Checkbox
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
