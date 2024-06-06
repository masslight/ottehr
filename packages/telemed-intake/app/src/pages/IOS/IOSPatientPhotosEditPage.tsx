import { Box } from '@mui/system';
import { createIOSMesssageCloseWebView, sendIOSAppMessage } from '../../features/ios-communication';
import { UploadPhotosWrapper } from '../../features/upload-photos';

export function IOSPatientPhotosEditPage(): JSX.Element {
  const handleClose = (): void => {
    sendIOSAppMessage(createIOSMesssageCloseWebView());
  };
  return (
    <Box sx={{ padding: '14px' }}>
      <UploadPhotosWrapper onClose={handleClose} />
    </Box>
  );
}
