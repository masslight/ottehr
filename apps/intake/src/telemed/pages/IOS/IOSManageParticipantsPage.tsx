import { Box } from '@mui/system';
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppointmentStore } from 'src/telemed/features/appointments/appointment.store';
import {
  createIOSMessageCloseWebView,
  sendIOSAppMessage,
} from 'src/telemed/features/ios-communication/iosCommunicationChannel';
import { ManageParticipants } from '../../features/invited-participants/ManageParticipants';

export function IOSPatientManageParticipantsPage(): JSX.Element {
  const [searchParams, _] = useSearchParams();
  const urlAppointmentID = searchParams.get('appointment_id');

  useEffect(() => {
    if (urlAppointmentID) {
      useAppointmentStore.setState(() => ({ appointmentID: urlAppointmentID }));
    }
  }, [urlAppointmentID]);

  const handleClose = (): void => {
    sendIOSAppMessage(createIOSMessageCloseWebView());
  };
  return (
    <Box sx={{ padding: '14px' }}>
      <ManageParticipants onClose={handleClose}></ManageParticipants>
    </Box>
  );
}
