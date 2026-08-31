import { Typography } from '@mui/material';
import { FC } from 'react';
import { FieldValues } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useCancelTelemedAppointmentMutation } from 'src/telemed/features/appointments/appointment.queries';
import { useOystehrAPIClient } from 'src/telemed/utils/getOystehrAPI';
import { CustomDialog } from 'ui-components/lib/components/intake/CustomDialog';
import { safelyCaptureException } from 'utils/lib/frontend/sentry';
import { VALUE_SETS } from 'utils/lib/ottehr-config/value-sets';
import { intakeFlowPageRoute } from '../../App';
import PageForm from '../../components/PageForm';

type CancelVisitDialogProps = { onClose: (canceled: boolean) => void; appointmentID?: string };

export const CancelVisitDialog: FC<CancelVisitDialogProps> = ({ onClose, appointmentID }) => {
  const apiClient = useOystehrAPIClient();
  const navigate = useNavigate();
  const cancelAppointment = useCancelTelemedAppointmentMutation();

  const onSubmit = async (data: FieldValues): Promise<void> => {
    if (!appointmentID) {
      throw new Error('appointmentID is not defined');
    }

    if (!apiClient) {
      throw new Error('apiClient is not defined');
    }
    const cancellationReasonAdditional =
      data.cancellationReason === 'Other' ? data.cancellationReasonAdditional : undefined;

    cancelAppointment.mutate(
      {
        apiClient: apiClient,
        appointmentID: appointmentID,
        cancellationReason: data.cancellationReason,
        cancellationReasonAdditional,
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
            selectOptions: VALUE_SETS.cancelReasonOptionsVirtualPatient,
          },
          {
            type: 'Text',
            name: 'cancellationReasonAdditional',
            label: 'Other reason',
            required: false,
            hidden: true,
            enableWhen: {
              question: 'cancellationReason',
              operator: '=',
              answer: 'Other',
            },
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
