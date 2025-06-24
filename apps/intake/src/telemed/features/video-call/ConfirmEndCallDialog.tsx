import { LoadingButton } from '@mui/lab';
import { Box, Button, Dialog, Paper, Typography } from '@mui/material';
import { useMeetingManager } from 'amazon-chime-sdk-component-library-react';
import { FC, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getSelectors } from 'utils';
import { intakeFlowPageRoute } from '../../../App';
import { useAppointmentStore } from '../appointments';
import { useGetWaitStatus, useWaitingRoomStore } from '../waiting-room';
import { useVideoCallStore } from '.';

interface ConfirmEndCallDialogProps {
  openModal: boolean;
  setOpenModal: (open: boolean) => void;
}

export const ConfirmEndCallDialog: FC<ConfirmEndCallDialogProps> = ({ openModal, setOpenModal }): JSX.Element => {
  const navigate = useNavigate();
  const location = useLocation();
  const isInvitedParticipant = location.pathname === intakeFlowPageRoute.InvitedVideoCall.path;

  const meetingManager = useMeetingManager();
  const [confirmClicked, setConfirmClicked] = useState(false);
  const { appointmentID } = getSelectors(useAppointmentStore, ['appointmentID']);

  const cleanup = async (): Promise<void> => {
    if (meetingManager) {
      await meetingManager.meetingSession?.deviceController.destroy().catch((error) => console.error(error));
      await meetingManager.leave().catch((error) => console.error(error));
    }
  };

  const { isFetching } = useGetWaitStatus(
    async (data) => {
      useWaitingRoomStore.setState(data);
      if (confirmClicked) {
        await disconnect();
      }
    },
    appointmentID || '',
    false
  );

  const disconnect = async (): Promise<void> => {
    await cleanup();
    useVideoCallStore.setState({ meetingData: null });
    const { status } = useWaitingRoomStore.getState();
    if (isInvitedParticipant) {
      navigate(intakeFlowPageRoute.InvitedCallEnded.path);
    } else {
      if (status === 'complete') {
        navigate(intakeFlowPageRoute.CallEnded.path);
      } else {
        navigate(intakeFlowPageRoute.Homepage.path);
      }
    }
  };

  return (
    <Dialog
      open={openModal}
      onClose={() => setOpenModal(false)}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <Paper>
        <Box margin={5} maxWidth="sm">
          <Typography sx={{ width: '100%' }} variant="h2" color="primary.main">
            Do you want to quit the video call?
          </Typography>
          <Box
            display="flex"
            flexDirection={{ xs: 'column', md: 'row' }}
            sx={{ justifyContent: 'space-between', mt: 4.125 }}
          >
            <LoadingButton
              loading={confirmClicked && isFetching}
              variant="contained"
              onClick={async () => {
                setConfirmClicked(true);
                if (!isFetching) {
                  await disconnect();
                }
              }}
              size="large"
              type="submit"
            >
              Confirm
            </LoadingButton>
            <Button
              disabled={confirmClicked && isFetching}
              variant="outlined"
              onClick={() => setOpenModal(false)}
              color="primary"
              size="large"
              type="button"
            >
              Stay
            </Button>
          </Box>
        </Box>
      </Paper>
    </Dialog>
  );
};
