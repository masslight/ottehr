import CheckIcon from '@mui/icons-material/Check';
import { Box, Tooltip, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import { FC, useMemo, useState } from 'react';
import { getVisitStatus, PRACTITIONER_CODINGS, TelemedAppointmentStatusEnum } from 'utils';
import { RoundedButton } from '../../../../components/RoundedButton';
import { dataTestIds } from '../../../../constants/data-test-ids';
import { useFeatureFlags } from '../../../../features/css-module/context/featureFlags';
import { usePractitionerActions } from '../../../../features/css-module/hooks/usePractitioner';
import { ConfirmationDialog } from '../../../components';
import { useGetAppointmentAccessibility } from '../../../hooks';
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
  const { patient, appointment, encounter, appointmentRefetch, appointmentSetState } = useAppointmentData();

  const { chartData } = useChartData();
  const apiClient = useOystehrAPIClient();

  const { mutateAsync: changeTelemedAppointmentStatus, isPending: isChangeLoading } =
    useChangeTelemedAppointmentStatusMutation();

  const { mutateAsync: signAppointment, isPending: isSignLoading } = useSignAppointmentMutation();
  const [openTooltip, setOpenTooltip] = useState(false);

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

    if (css) {
      try {
        const tz = DateTime.now().zoneName;
        await signAppointment({
          apiClient,
          appointmentId: appointment.id,
          timezone: tz,
        });
        await appointmentRefetch();
      } catch (error: any) {
        console.log(error.message);
      }
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

    if (onSigned) {
      onSigned();
    }
  };

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
            title={`Review & Sign ${patientName}`}
            description="Are you sure you have reviewed the patient chart, performed the examination, defined the diagnoses, medical decision making and E&M code and are ready to sign this patient."
            response={handleSign}
            actionButtons={{
              proceed: {
                text: 'Sign',
              },
              back: { text: 'Cancel' },
            }}
          >
            {(showDialog) => (
              <RoundedButton
                disabled={errorMessage.length > 0 || isLoading || completed || inPersonStatus === 'provider'}
                loading={isLoading}
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
