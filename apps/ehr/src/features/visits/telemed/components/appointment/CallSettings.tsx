import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
} from '@mui/material';
import { useAudioInputs, useAudioVideo, useVideoInputs } from 'amazon-chime-sdk-component-library-react';
import { ConsoleLogger, DefaultDeviceController } from 'amazon-chime-sdk-js';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface CallSettingsProps {
  onClose: () => void;
}

export const CallSettings: FC<CallSettingsProps> = ({ onClose }) => {
  // const meetingManager = useMeetingManager();
  const audioVideo = useAudioVideo();
  const { devices: audioDevices, selectedDevice: initialAudioDevice } = useAudioInputs();
  const { devices: videoDevices, selectedDevice: initialVideoDevice } = useVideoInputs();

  const [selectedAudioDevice, setSelectedAudioDevice] = useState(initialAudioDevice);
  const [selectedVideoPreviewDeviceId, setSelectedVideoPreviewDeviceId] = useState(initialVideoDevice);

  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  const previewDeviceController = useMemo(() => {
    const logger = new ConsoleLogger('preview');
    return new DefaultDeviceController(logger);
  }, []);

  const handleSave = async (): Promise<void> => {
    await stopAudioVideoPreviewAndUsage();

    if (selectedVideoPreviewDeviceId !== initialVideoDevice) {
      await audioVideo?.startVideoInput(selectedVideoPreviewDeviceId || initialVideoDevice || videoDevices[0].deviceId);
    }

    onClose();
  };

  const handleClose = async (): Promise<void> => {
    await stopAudioVideoPreviewAndUsage();
    await audioVideo?.startAudioInput(initialAudioDevice || audioDevices[0].deviceId);
    onClose();
  };

  const stopAudioVideoPreviewAndUsage = useCallback(async (): Promise<void> => {
    if (previewDeviceController && videoPreviewRef.current) {
      await previewDeviceController?.stopVideoPreviewForVideoInput(videoPreviewRef.current);
    }
    await previewDeviceController?.stopVideoInput();
    await previewDeviceController?.stopAudioInput();
  }, [previewDeviceController]);

  useEffect(() => {
    return () => void stopAudioVideoPreviewAndUsage();
  }, [stopAudioVideoPreviewAndUsage]);

  const startVideoPreview = useCallback(
    async (deviceId: string): Promise<void> => {
      if (previewDeviceController && videoPreviewRef.current) {
        await previewDeviceController.stopVideoInput();
        await previewDeviceController.startVideoInput(deviceId);
        previewDeviceController.startVideoPreviewForVideoInput(videoPreviewRef.current);
      }
    },
    [previewDeviceController]
  );

  const handleVideoDeviceChange = async (event: SelectChangeEvent<string>): Promise<void> => {
    const deviceId = event.target.value;
    setSelectedVideoPreviewDeviceId(deviceId);
  };
  const handleAudioDeviceChange = async (event: SelectChangeEvent<string>): Promise<void> => {
    const deviceId = event.target.value;

    setSelectedAudioDevice(deviceId);
    await audioVideo?.startAudioInput(deviceId);
  };

  useEffect(() => {
    let isDisposed = false;
    if (selectedVideoPreviewDeviceId) {
      setTimeout(() => {
        if (!isDisposed) {
          void startVideoPreview(selectedVideoPreviewDeviceId.toString());
        }
      }, 200);
    }
    return () => {
      isDisposed = true;
    };
  }, [selectedVideoPreviewDeviceId, startVideoPreview]);

  return (
    <Dialog open onClose={onClose}>
      <DialogTitle>Call Settings</DialogTitle>
      <DialogContent>
        <video
          ref={videoPreviewRef}
          autoPlay
          muted
          playsInline
          style={{
            height: '100%',
            width: '100%',
          }}
        ></video>
        <FormControl fullWidth margin="normal">
          <InputLabel>Camera</InputLabel>
          <Select value={selectedVideoPreviewDeviceId?.toString()} onChange={handleVideoDeviceChange} label="Camera">
            {videoDevices.map((device) => (
              <MenuItem key={device.deviceId} value={device.deviceId}>
                {device.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth margin="normal">
          <InputLabel>Microphone</InputLabel>
          <Select value={selectedAudioDevice?.toString()} onChange={handleAudioDeviceChange} label="Microphone">
            {audioDevices.map((device) => (
              <MenuItem key={device.deviceId} value={device.deviceId}>
                {device.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions sx={{ alignItems: 'center', justifyContent: 'flex-end', padding: '16px 24px' }}>
        <Button onClick={handleClose} sx={{ marginRight: 1 }} variant="text">
          Cancel
        </Button>
        <Button onClick={handleSave} variant="contained">
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
};
