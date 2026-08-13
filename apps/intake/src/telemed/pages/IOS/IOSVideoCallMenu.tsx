import CloseIcon from '@mui/icons-material/Close';
import { IconButton, List } from '@mui/material';
import { Box } from '@mui/system';
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppointmentStore } from 'src/telemed/features/appointments/appointment.store';
import { InvitedParticipantListItemButton } from 'src/telemed/features/invited-participants/InvitedParticipantsListItemButton';
import {
  createIOSMessageCloseWebView,
  sendIOSAppMessage,
} from 'src/telemed/features/ios-communication/iosCommunicationChannel';
import { UploadPhotosListItemButton } from 'src/telemed/features/upload-photos/UploadPhotosListItemButton';
import { intakeFlowPageRoute } from '../../../App';

export function IOSVideoCallMenu(): JSX.Element {
  const [searchParams, _] = useSearchParams();
  const urlAppointmentID = searchParams.get('appointment_id');
  const appointmentId = useAppointmentStore((state) => state.appointmentID);
  const navigate = useNavigate();

  useEffect(() => {
    if (urlAppointmentID) {
      useAppointmentStore.setState(() => ({ appointmentID: urlAppointmentID }));
    }
  }, [urlAppointmentID]);

  const handleClose = (): void => {
    sendIOSAppMessage(createIOSMessageCloseWebView());
  };

  const handleClickManageParticipants = (): void => {
    navigate(`${intakeFlowPageRoute.IOSPatientManageParticipants.path}?appointment_id=${appointmentId}`);
  };

  const handleClickManagePhotos = (): void => {
    navigate(`${intakeFlowPageRoute.IOSPatientPhotosEdit.path}?appointment_id=${appointmentId}`);
  };

  return (
    <Box
      sx={{
        padding: '14px',
        flex: '1 auto',
        p: 5,
        position: 'relative',
      }}
    >
      <IconButton onClick={handleClose} size="small" sx={{ position: 'absolute', right: 7, top: 7 }}>
        <CloseIcon />
      </IconButton>
      <List sx={{ p: 0 }}>
        <InvitedParticipantListItemButton onClick={() => handleClickManageParticipants()} hideText={false} />

        <UploadPhotosListItemButton onClick={() => handleClickManagePhotos()} hideText={false} />
      </List>
    </Box>
  );
}
