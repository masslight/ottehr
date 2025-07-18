import { Typography } from '@mui/material';
import { FC } from 'react';
import { FieldValues } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { CancellationReasonOptionsTelemed } from 'utils';
import { intakeFlowPageRoute } from '../../App';
import { CustomDialog } from '../../components/CustomDialog';
import PageForm from '../../components/PageForm';
import { safelyCaptureException } from '../../helpers/sentry';
import { useCancelAppointmentMutation } from '../features/appointments';
import { useOystehrAPIClient } from '../utils';

type CancelVisitDialogProps = { onClose: (canceled: boolean) => void; appointmentID?: string };

export const CancelVisitDialog: FC<CancelVisitDialogProps> = ({ onClose, appointmentID }) => {
  const apiClient = useOystehrAPIClient();
  const navigate = useNavigate();
  const cancelAppointment = useCancelAppointmentMutation();

  const onSubmit = async (data: FieldValues): Promise<void> => {
    if (!appointmentID) {
      throw new Error('appointmentID is not defined');
    }

    if (!apiClient) {
      throw new Error('apiClient is not defined');
    }

    cancelAppointment.mutate(
      {
        apiClient: apiClient,
        appointmentID: appointmentID,
        cancellationReason: data.cancellationReason,
      },
      {
        onSuccess: async () => {
          navigate(intakeFlowPageRoute.Homepage.path);
          onClose(true);
        },
        onError: (error) => {
          safelyCaptureException(error);
        },
      }
    );
  };

  const handleClose = (): void => {
    onClose(false);
  };

  return (
    <CustomDialog PaperProps={{ sx: { borderRadius: 2 } }} open={true} onClose={handleClose}>
      <Typography variant="h2" color="primary.main" sx={{ pb: 3 }}>
        Why are you canceling?
      </Typography>
      <PageForm
        formElements={[
          {
            type: 'Select',
            name: 'cancellationReason',
            label: 'Cancelation reason',
            required: true,
            selectOptions: Object.keys(CancellationReasonOptionsTelemed).map((value: string) => ({
              label: value,
              value: value,
            })),
          },
        ]}
        controlButtons={{
          submitLabel: 'Cancel visit',
          loading: cancelAppointment.isPending,
          submitDisabled: cancelAppointment.isPending,
          onBack: handleClose,
        }}
        onSubmit={onSubmit}
      />
    </CustomDialog>
  );
};
