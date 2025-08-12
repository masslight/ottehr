import { LoadingButton } from '@mui/lab';
import { useQueryClient } from '@tanstack/react-query';
import { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { TelemedAppointmentInformation, TelemedAppointmentStatus, TelemedAppointmentStatusEnum } from 'utils';
import { dataTestIds } from '../../../constants/data-test-ids';
import { ConfirmationDialog } from '../../components';
import { useTrackingBoardTableButtonType } from '../../hooks';
import { useOystehrAPIClient } from '../../hooks/useOystehrAPIClient';
import { useChangeTelemedAppointmentStatusMutation } from '../../state';

const baseStyles = {
  borderRadius: 8,
  textTransform: 'none',
  fontSize: '15px',
  fontWeight: 500,
};

export const TrackingBoardTableButton: FC<{ appointment: TelemedAppointmentInformation }> = (props) => {
  const { appointment } = props;

  const apiClient = useOystehrAPIClient();
  const mutation = useChangeTelemedAppointmentStatusMutation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const goToAppointment = (state?: unknown): void => {
    navigate(`/telemed/appointments/${appointment.id}`, { state });
  };

  const changeStatus = async (newStatus: TelemedAppointmentStatus, invalidate?: boolean): Promise<void> => {
    if (!apiClient) {
      throw new Error('api client not defined');
    }
    await mutation.mutateAsync({ apiClient, appointmentId: appointment.id, newStatus }, {});

    if (invalidate) {
      await queryClient.invalidateQueries({ queryKey: ['telemed-appointments'] });
    }
  };

  const changeStatusAndGoTo = async (newStatus: TelemedAppointmentStatus): Promise<void> => {
    await changeStatus(newStatus);
    goToAppointment();
  };

  const { type } = useTrackingBoardTableButtonType({ appointment });

  switch (type) {
    case 'viewContained':
    case 'viewOutlined': {
      return (
        <LoadingButton
          onClick={() => goToAppointment()}
          variant={type === 'viewContained' ? 'contained' : 'outlined'}
          sx={baseStyles}
          data-testid={dataTestIds.telemedEhrFlow.trackingBoardViewButton(appointment.id)}
        >
          View
        </LoadingButton>
      );
    }
    case 'assignMe': {
      return (
        <ConfirmationDialog
          title="Do you want to assign this appointment?"
          response={() => changeStatusAndGoTo(TelemedAppointmentStatusEnum['pre-video'])}
          actionButtons={{
            proceed: {
              text: 'Assign me',
            },
            back: { text: 'Cancel' },
          }}
        >
          {(showDialog) => (
            <LoadingButton
              onClick={showDialog}
              loading={mutation.isPending}
              variant="contained"
              sx={baseStyles}
              data-testid={dataTestIds.telemedEhrFlow.trackingBoardAssignButton}
            >
              Assign me
            </LoadingButton>
          )}
        </ConfirmationDialog>
      );
    }
    case 'unassign': {
      return (
        <ConfirmationDialog
          title="Do you want to unassign this appointment?"
          response={() => changeStatus(TelemedAppointmentStatusEnum.ready, true)}
          actionButtons={{
            proceed: {
              text: 'Unassign',
              color: 'error',
            },
            back: { text: 'Cancel' },
          }}
        >
          {(showDialog) => (
            <LoadingButton
              onClick={showDialog}
              loading={mutation.isPending}
              color="error"
              variant="outlined"
              sx={baseStyles}
            >
              Unassign
            </LoadingButton>
          )}
        </ConfirmationDialog>
      );
    }
    case 'reconnect': {
      return (
        <LoadingButton
          onClick={() => goToAppointment({ reconnect: true })}
          loading={mutation.isPending}
          variant="contained"
          sx={baseStyles}
        >
          Reconnect
        </LoadingButton>
      );
    }
    default: {
      return null;
    }
  }
};
