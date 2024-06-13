import CloseIcon from '@mui/icons-material/Close';
import { IconButton, List } from '@mui/material';
import { Box } from '@mui/system';
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IntakeFlowPageRoute } from '../../App';
import { useAppointmentStore } from '../../features/appointments';
import { InvitedParticipantListItemButton } from '../../features/invited-participants';
import {
  createIOSMesssageCloseWebView,
  createIOSMesssageOpenPage,
  sendIOSAppMessage,
} from '../../features/ios-communication';
import { UploadPhotosListItemButton } from '../../features/upload-photos';

export function IOSVideoCallMenu(): JSX.Element {
  const [searchParams, _] = useSearchParams();
  const urlAppointmentID = searchParams.get('appointment_id');
  const appointmentId = useAppointmentStore((state) => state.appointmentID);

  useEffect(() => {
    if (urlAppointmentID) {
      useAppointmentStore.setState(() => ({ appointmentID: urlAppointmentID }));
    }
  }, [urlAppointmentID]);

  const handleClose = (): void => {
    sendIOSAppMessage(createIOSMesssageCloseWebView());
  };

  const handleClickManageParticipants = (): void => {
    // location.href = `${window.location.origin}${IntakeFlowPageRoute.IOSPatientManageParticipants.path}?appointment_id=${appointmentId}`;
    sendIOSAppMessage(
      createIOSMesssageOpenPage(
        `${window.location.origin}${IntakeFlowPageRoute.IOSPatientManageParticipants.path}?appointment_id=${appointmentId}`,
      ),
    );
  };

  const handleClickManagePhotos = (): void => {
    // location.href = `${window.location.origin}${IntakeFlowPageRoute.IOSPatientPhotosEdit.path}?appointment_id=${appointmentId}`;
    sendIOSAppMessage(
      createIOSMesssageOpenPage(
        `${window.location.origin}${IntakeFlowPageRoute.IOSPatientPhotosEdit.path}?appointment_id=${appointmentId}`,
      ),
    );
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
