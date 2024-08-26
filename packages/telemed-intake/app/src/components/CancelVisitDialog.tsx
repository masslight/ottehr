import { FC } from 'react'; // Import useState for managing the select value
import { Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { CustomDialog, PageForm, safelyCaptureException } from 'ottehr-components';
import { useZapEHRAPIClient } from '../utils';
import { useCancelAppointmentMutation } from '../features/appointments';
import { FieldValues } from 'react-hook-form';
import { CancellationReasonOptionsTelemed, getSelectors } from 'ottehr-utils';
import { useAppointmentStore } from '../features/appointments';
import { useNavigate } from 'react-router-dom';
import { IntakeFlowPageRoute } from '../App';

type CancelVisitDialogProps = { onClose: () => void };

export const CancelVisitDialog: FC<CancelVisitDialogProps> = ({ onClose }) => {
  const apiClient = useZapEHRAPIClient();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { appointmentID } = getSelectors(useAppointmentStore, ['appointmentID']);

  const cancelAppointment = useCancelAppointmentMutation();

  const onSubmit = async (data: FieldValues): Promise<void> => {
    if (!appointmentID) {
      throw new Error('appointmentID is not defined');
    }

    if (!apiClient) {
      throw new Error('apiClient is not defined');
    }

    navigate(IntakeFlowPageRoute.PatientPortal.path);
    cancelAppointment.mutate(
      {
        apiClient: apiClient,
        appointmentID: appointmentID,
        cancellationReason: data.cancellationReason,
      },
      {
        onSuccess: () => {
          navigate(IntakeFlowPageRoute.PatientPortal.path);
          handleClose();
        },
        onError: (error) => {
          safelyCaptureException(error);
        },
      },
    );

    handleClose();
  };

  const handleClose = (): void => {
    onClose();
  };

  return (
    <CustomDialog open={true} onClose={handleClose}>
      <Typography variant="h2" color="primary.main" sx={{ pb: 3 }}>
        {t('cancelVisit.title')}
      </Typography>
      <PageForm
        formElements={[
          {
            type: 'Select',
            name: 'cancellationReason',
            label: t('cancelVisit.formElement.labels.cancellationReason'),
            required: true,
            selectOptions: Object.keys(CancellationReasonOptionsTelemed).map((value: string) => ({
              label: value,
              value: value,
            })),
          },
        ]}
        controlButtons={{
          submitLabel: t('cancelVisit.cancelVisitButton'),
          loading: cancelAppointment.isLoading,
          submitDisabled: cancelAppointment.isLoading,
          onBack: handleClose,
        }}
        onSubmit={onSubmit}
      />
    </CustomDialog>
  );
};
