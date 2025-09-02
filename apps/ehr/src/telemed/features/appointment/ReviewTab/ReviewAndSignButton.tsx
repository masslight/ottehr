import CheckIcon from '@mui/icons-material/Check';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Box, Checkbox, DialogContentText, FormControlLabel, Stack, Tooltip, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import { FC, useMemo, useState } from 'react';
import { FEATURE_FLAGS } from 'src/constants/feature-flags';
import useEvolveUser from 'src/hooks/useEvolveUser';
import {
  getPractitionerQualificationByLocation,
  getVisitStatus,
  isPhysicianQualification,
  PRACTITIONER_CODINGS,
  TelemedAppointmentStatusEnum,
} from 'utils';
import { RoundedButton } from '../../../../components/RoundedButton';
import { dataTestIds } from '../../../../constants/data-test-ids';
import { useFeatureFlags } from '../../../../features/css-module/context/featureFlags';
import { usePractitionerActions } from '../../../../features/css-module/hooks/usePractitioner';
import { ConfirmationDialog } from '../../../components';
import { useGetAppointmentAccessibility, usePendingSupervisorApproval } from '../../../hooks';
import { useOystehrAPIClient } from '../../../hooks/useOystehrAPIClient';
import {
  useAppointmentData,
  useChangeTelemedAppointmentStatusMutation,
  useChartData,
  useSignAppointmentMutation,
} from '../../../state';
import { getPatientName } from '../../../utils';

type ReviewAndSignButtonProps = {
  onSigned?: () => void;
};

export const ReviewAndSignButton: FC<ReviewAndSignButtonProps> = ({ onSigned }) => {
  const { patient, appointment, encounter, appointmentRefetch, appointmentSetState, location } = useAppointmentData();

  const { chartData } = useChartData();
  const apiClient = useOystehrAPIClient();
  const practitioner = useEvolveUser()?.profileResource;

  const { mutateAsync: changeTelemedAppointmentStatus, isPending: isChangeLoading } =
    useChangeTelemedAppointmentStatusMutation();

  const { mutateAsync: signAppointment, isPending: isSignLoading } = useSignAppointmentMutation();
  const [openTooltip, setOpenTooltip] = useState(false);

  const [requireSupervisorApproval, setRequireSupervisorApproval] = useState(false);

  const { updateVisitStatusToAwaitSupervisorApproval } = usePendingSupervisorApproval({
    encounterId: encounter.id!,
    practitionerId: practitioner?.id ?? '',
  });
  const { css } = useFeatureFlags();
  const appointmentAccessibility = useGetAppointmentAccessibility();

  const primaryDiagnosis = (chartData?.diagnosis || []).find((item) => item.isPrimary);
  const medicalDecision = chartData?.medicalDecision?.text;
  const emCode = chartData?.emCode;
  const patientInfoConfirmed = chartData?.patientInfoConfirmed?.value;
  const inHouseLabResultsPending = chartData?.inHouseLabResults?.resultsPending;

  const patientName = getPatientName(patient?.name).firstLastName;

  const { isEncounterUpdatePending } = usePractitionerActions(encounter, 'end', PRACTITIONER_CODINGS.Attender);

  const isLoading = isChangeLoading || isSignLoading || isEncounterUpdatePending;
  const inPersonStatus = useMemo(() => appointment && getVisitStatus(appointment, encounter), [appointment, encounter]);

  const completed = useMemo(() => {
    if (css) {
      return inPersonStatus === 'completed';
    }
    return appointmentAccessibility.status === TelemedAppointmentStatusEnum.complete;
  }, [css, inPersonStatus, appointmentAccessibility.status]);

  const errorMessage = useMemo(() => {
    const messages: string[] = [];

    if (completed) {
      return messages;
    }

    if (css && inPersonStatus) {
      if (inPersonStatus === 'provider') {
        messages.push('You must discharge the patient before signing');
      } else if (inPersonStatus !== 'discharged') {
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
    css,
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
      if (css) {
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
    if (!location || !practitioner) return false;

    const qualification = getPractitionerQualificationByLocation(practitioner, location);
    const isPhysician = isPhysicianQualification(qualification);

    return !isPhysician;
  }, [practitioner, location]);

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
                  medical decision making and E&M code and are ready to sign this patient.
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
