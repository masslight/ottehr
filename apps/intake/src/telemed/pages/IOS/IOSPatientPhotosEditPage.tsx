import { Box } from '@mui/system';
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppointmentStore } from '../../features/appointments';
import { createIOSMessageCloseWebView, sendIOSAppMessage } from '../../features/ios-communication';
import { UploadPhotosWrapper } from '../../features/upload-photos';

export function IOSPatientPhotosEditPage(): JSX.Element {
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
      <UploadPhotosWrapper onClose={handleClose} />
    </Box>
  );
}
