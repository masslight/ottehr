import React, { FC, useMemo, useState } from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import { ApptStatus } from 'ehr-utils';
import { ConfirmationDialog, RoundedButton } from '../../../components';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { useAppointmentStore, useChangeTelemedAppointmentStatusMutation } from '../../../state';
import { getPatientName } from '../../../utils';
import { useZapEHRAPIClient } from '../../../hooks/useZapEHRAPIClient';
import { useGetAppointmentAccessibility } from '../../../hooks';

export const ReviewAndSignButton: FC = () => {
  const { patient, appointment, encounter, chartData } = getSelectors(useAppointmentStore, [
    'patient',
    'appointment',
    'encounter',
    'chartData',
  ]);
  const apiClient = useZapEHRAPIClient();
  const { mutateAsync, isLoading } = useChangeTelemedAppointmentStatusMutation();
  const [openTooltip, setOpenTooltip] = useState(false);

  const appointmentAccessibility = useGetAppointmentAccessibility();

  const primaryDiagnosis = (chartData?.diagnosis || []).find((item) => item.isPrimary);
  const medicalDecision = chartData?.medicalDecision?.text;
  const cptCode = (chartData?.cptCodes || [])[0];
  const patientInfoConfirmed = chartData?.patientInfoConfirmed?.value;

  const patientName = getPatientName(patient?.name).firstLastName;

  const errorMessage = useMemo(() => {
    const messages = [];

    if (appointmentAccessibility.status !== ApptStatus.unsigned) {
      messages.push('You need to finish a video call with the patient');
    }

    if (!primaryDiagnosis || !medicalDecision || !cptCode) {
      messages.push('You need to fill in the missing data');
    }

    if (!patientInfoConfirmed) {
      messages.push('You need to confirm patient information');
    }

    return messages;
  }, [appointmentAccessibility.status, primaryDiagnosis, medicalDecision, cptCode, patientInfoConfirmed]);

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

    await mutateAsync({ apiClient, appointmentId: appointment.id, newStatus: ApptStatus.complete });
    useAppointmentStore.setState({
      encounter: { ...encounter, status: 'finished' },
      appointment: { ...appointment, status: 'fulfilled' },
    });
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
            description="Are you sure you have reviewed the patient chart, performed the examination, defined the diagnoses, medical decision making and CPT code and ready to sing this patient."
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
