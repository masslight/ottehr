import { FC, RefObject } from 'react';
import { Box, Button, Card, FormControl, IconButton, InputLabel, MenuItem, Select, Typography } from '@mui/material';
import { otherColors } from '../../IntakeThemeProvider';
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';

type CameraSettingsProps = {
  selectedVideoDevice: string;
  setSelectedVideoDevice: (value: string) => void;
  videoDevices: MediaDeviceInfo[];
  videoPreviewRef: RefObject<HTMLVideoElement>;
  isCameraOpen: boolean;
  setIsCameraOpen: (value: boolean) => void;
};

export const CameraSettings: FC<CameraSettingsProps> = (props) => {
  const { selectedVideoDevice, setSelectedVideoDevice, videoDevices, videoPreviewRef, isCameraOpen, setIsCameraOpen } =
    props;

  const toggleCamera = (): void => {
    setIsCameraOpen(!isCameraOpen);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      <FormControl fullWidth margin="normal">
        <InputLabel>Camera</InputLabel>
        <Select
          value={videoDevices.map(({ deviceId }) => deviceId).includes(selectedVideoDevice) ? selectedVideoDevice : ''}
          onChange={(e) => setSelectedVideoDevice(e.target.value)}
          label="Camera"
          size="small"
        >
          {videoDevices.map((device) => (
            <MenuItem key={device.deviceId} value={device.deviceId}>
              {device.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Card
        sx={{
          backgroundColor: otherColors.coachingVisit,
          py: 1,
          px: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
        elevation={0}
      >
        <VideocamOutlinedIcon color="primary" />
        <Typography variant="body2" fontWeight={700} color="primary.main" sx={{ flexGrow: 1 }}>
          Test your video
        </Typography>
        <IconButton
          sx={{
            backgroundColor: 'primary.main',
            color: 'white',
            '&:hover': { backgroundColor: 'primary.main' },
          }}
          size="small"
          onClick={toggleCamera}
        >
          {isCameraOpen ? <VideocamOffIcon fontSize="small" /> : <VideocamIcon fontSize="small" />}
        </IconButton>
      </Card>

      {isCameraOpen && (
        <>
          <video
            ref={videoPreviewRef}
            autoPlay
            muted
            playsInline
            style={{
              height: '100%',
              width: '100%',
              borderRadius: '8px',
            }}
          />

          <Button color="error" sx={{ alignSelf: 'start' }} onClick={toggleCamera}>
            Hide video
          </Button>
        </>
      )}
    </Box>
  );
};
