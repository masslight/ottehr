import React, { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoadingButton } from '@mui/lab';
import { useQueryClient } from 'react-query';
import { ApptStatus, TelemedAppointmentInformation } from 'ehr-utils';
import { useZapEHRAPIClient } from '../../hooks/useZapEHRAPIClient';
import { useChangeTelemedAppointmentStatusMutation } from '../../state';
import { ConfirmationDialog } from '../../components';
import { useTrackingBoardTableButtonType } from '../../hooks';

const baseStyles = {
  borderRadius: 8,
  textTransform: 'none',
  fontSize: '15px',
  fontWeight: '700',
};

export const TrackingBoardTableButton: FC<{ appointment: TelemedAppointmentInformation }> = (props) => {
  const { appointment } = props;

  const apiClient = useZapEHRAPIClient();
  const mutation = useChangeTelemedAppointmentStatusMutation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const goToAppointment = (state?: unknown): void => {
    navigate(`/telemed/appointments/${appointment.id}`, { state });
  };

  const changeStatus = async (newStatus: ApptStatus, invalidate?: boolean): Promise<void> => {
    if (!apiClient) {
      throw new Error('api client not defined');
    }
    await mutation.mutateAsync({ apiClient, appointmentId: appointment.id, newStatus }, {});

    if (invalidate) {
      await queryClient.invalidateQueries({ queryKey: ['telemed-appointments'] });
    }
  };

  const changeStatusAndGoTo = async (newStatus: ApptStatus): Promise<void> => {
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
        >
          View
        </LoadingButton>
      );
    }
    case 'assignMe': {
      return (
        <ConfirmationDialog
          title="Do you want to assign this appointment?"
          response={() => changeStatusAndGoTo(ApptStatus['pre-video'])}
          actionButtons={{
            proceed: {
              text: 'Assign to me',
            },
            back: { text: 'Cancel' },
          }}
        >
          {(showDialog) => (
            <LoadingButton onClick={showDialog} loading={mutation.isLoading} variant="contained" sx={baseStyles}>
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
          response={() => changeStatus(ApptStatus.ready, true)}
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
              loading={mutation.isLoading}
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
          loading={mutation.isLoading}
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
