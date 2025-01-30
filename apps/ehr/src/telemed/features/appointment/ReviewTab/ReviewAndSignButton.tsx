import { Box, Tooltip, Typography } from '@mui/material';
import { FC, useMemo, useState } from 'react';
import { getVisitStatus, TelemedAppointmentStatusEnum } from 'utils';
import { RoundedButton } from '../../../../components/RoundedButton';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { ConfirmationDialog } from '../../../components';
import { useGetAppointmentAccessibility } from '../../../hooks';
import { useZapEHRAPIClient } from '../../../hooks/useOystehrAPIClient';
import {
  useAppointmentStore,
  useChangeTelemedAppointmentStatusMutation,
  useSignAppointmentMutation,
} from '../../../state';
import { getPatientName } from '../../../utils';
import { useFeatureFlags } from '../../../../features/css-module/context/featureFlags';
import { useAppointment } from '../../../../features/css-module/hooks/useAppointment';
import { practitionerType } from '../../../../helpers/practitionerUtils';
import { usePractitionerActions } from '../../../../features/css-module/hooks/usePractitioner';
import { enqueueSnackbar } from 'notistack';

type ReviewAndSignButtonProps = {
  onSigned?: () => void;
};

export const ReviewAndSignButton: FC<ReviewAndSignButtonProps> = ({ onSigned }) => {
  const { patient, appointment, encounter, chartData } = getSelectors(useAppointmentStore, [
    'patient',
    'appointment',
    'encounter',
    'chartData',
  ]);
  const apiClient = useZapEHRAPIClient();
  const { mutateAsync: changeTelemedAppointmentStatus, isLoading: isChangeLoading } =
    useChangeTelemedAppointmentStatusMutation();
  const { mutateAsync: signAppointment, isLoading: isSignLoading } = useSignAppointmentMutation();
  const [openTooltip, setOpenTooltip] = useState(false);

  const { refetch } = useAppointment(appointment?.id);
  const { css } = useFeatureFlags();
  const appointmentAccessibility = useGetAppointmentAccessibility();

  const primaryDiagnosis = (chartData?.diagnosis || []).find((item) => item.isPrimary);
  const medicalDecision = chartData?.medicalDecision?.text;
  const emCode = chartData?.emCode;
  const patientInfoConfirmed = chartData?.patientInfoConfirmed?.value;

  const patientName = getPatientName(patient?.name).firstLastName;

  const { isEncounterUpdatePending, handleUpdatePractitionerAndStatus } = usePractitionerActions(
    encounter,
    'end',
    practitionerType.Attender
  );

  const handleCompleteProvider = async (): Promise<void> => {
    try {
      await handleUpdatePractitionerAndStatus();
    } catch (error: any) {
      console.log(error.message);
      enqueueSnackbar('An error occurred trying to complete intake. Please try again.', { variant: 'error' });
    }
  };

  const isLoading = isChangeLoading || isSignLoading || isEncounterUpdatePending;
  const inPersonStatus = useMemo(() => appointment && getVisitStatus(appointment, encounter), [appointment, encounter]);

  const errorMessage = useMemo(() => {
    const messages = [];

    if (css && inPersonStatus) {
      if (!['provider', 'ready for discharge'].includes(inPersonStatus)) {
        messages.push('The appointment must be in the status of provider or ready for discharge');
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

    return messages;
  }, [
    css,
    inPersonStatus,
    primaryDiagnosis,
    medicalDecision,
    emCode,
    patientInfoConfirmed,
    appointmentAccessibility.status,
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
        await handleCompleteProvider();
        await signAppointment({ apiClient, appointmentId: appointment.id });
        await refetch();
      } catch (error: any) {
        console.log(error.message);
      }
    } else {
      await changeTelemedAppointmentStatus({
        apiClient,
        appointmentId: appointment.id,
        newStatus: TelemedAppointmentStatusEnum.complete,
      });
      useAppointmentStore.setState({
        encounter: { ...encounter, status: 'finished' },
        appointment: { ...appointment, status: 'fulfilled' },
      });
    }

    onSigned && onSigned();
  };

  // TODO: remove after actualizing isAppointmentReadOnly logic
  if (css && inPersonStatus === 'completed') {
    return null;
  }

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
            description="Are you sure you have reviewed the patient chart, performed the examination, defined the diagnoses, medical decision making and E&M code and ready to sing this patient."
            response={handleSign}
            actionButtons={{
              proceed: {
                text: 'Sign',
              },
              back: { text: 'Cancel' },
            }}
          >
            {(showDialog) => (
              <RoundedButton disabled={errorMessage.length > 0 || isLoading} variant="contained" onClick={showDialog}>
                Review & Sign
              </RoundedButton>
            )}
          </ConfirmationDialog>
        </Box>
      </Tooltip>
    </Box>
  );
};
