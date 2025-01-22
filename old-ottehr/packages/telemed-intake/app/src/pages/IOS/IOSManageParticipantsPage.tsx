import { Box } from '@mui/system';
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppointmentStore } from '../../features/appointments';
import { ManageParticipants } from '../../features/invited-participants/ManageParticipants';
import { createIOSMesssageCloseWebView, sendIOSAppMessage } from '../../features/ios-communication';

export function IOSPatientManageParticipantsPage(): JSX.Element {
  const [searchParams, _] = useSearchParams();
  const urlAppointmentID = searchParams.get('appointment_id');

  useEffect(() => {
    if (urlAppointmentID) {
      useAppointmentStore.setState(() => ({ appointmentID: urlAppointmentID }));
    }
  }, [urlAppointmentID]);

  const handleClose = (): void => {
    sendIOSAppMessage(createIOSMesssageCloseWebView());
  };
  return (
    <Box sx={{ padding: '14px' }}>
      <ManageParticipants onClose={handleClose}></ManageParticipants>
    </Box>
  );
}
