import { FC, useEffect, useRef, useState } from 'react';
import {
  useMeetingManager,
  useAudioVideo
} from 'amazon-chime-sdk-component-library-react';
import { Select, MenuItem, FormControl, InputLabel, Dialog, DialogTitle, DialogContent, DialogActions, Button, SelectChangeEvent, Box, Grid } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { ConsoleLogger, DefaultDeviceController } from 'amazon-chime-sdk-js';

interface CallSettingsProps {
  onClose: () => void;
  open: boolean;
}

export const CallSettings: FC<CallSettingsProps> = ({ onClose, open }) => {
  const meetingManager = useMeetingManager();
  const audioVideo = useAudioVideo();
  const { t } = useTranslation();

  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoDevice, setSelectedVideoDevice] = useState('');
  const [selectedAudioDevice, setSelectedAudioDevice] = useState('');
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  // device controller for video preview only
  const logger = new ConsoleLogger('preview');
  const previewDeviceController = new DefaultDeviceController(logger);

  const handleSave = async () => {
    if (selectedVideoDevice) {
      await audioVideo?.startVideoInput(selectedVideoDevice);
    }

    if (selectedAudioDevice) {
      await audioVideo?.startAudioInput(selectedAudioDevice);
    }

    onClose();
  };

  useEffect(() => {
    const observer = {
      audioInputsChanged: (freshAudioInputDevices: MediaDeviceInfo[]) => {
        setAudioDevices(freshAudioInputDevices);
      },
      videoInputsChanged: (freshVideoInputDevices: MediaDeviceInfo[]) => {
        setVideoDevices(freshVideoInputDevices);
      },
    };

    meetingManager.audioVideo?.addDeviceChangeObserver(observer);

    const initDevices = async () => {
      const videoInputDevices = await meetingManager.audioVideo?.listVideoInputDevices() ?? [];
      const audioInputDevices = await meetingManager.audioVideo?.listAudioInputDevices() ?? [];

      setVideoDevices(videoInputDevices);
      setAudioDevices(audioInputDevices);

      if (videoInputDevices.length > 0) {
        setSelectedVideoDevice(videoInputDevices[0].deviceId);
      }
      if (audioInputDevices.length > 0) {
        setSelectedAudioDevice(audioInputDevices[0].deviceId);
      }
    };

    initDevices();

    return () => {
      meetingManager.audioVideo?.removeDeviceChangeObserver(observer);
    };
  }, [meetingManager.audioVideo]);

  const startVideoPreview = async (deviceId: string) => {
    if (previewDeviceController && videoPreviewRef.current) {
      await previewDeviceController.startVideoInput(deviceId);
      previewDeviceController.startVideoPreviewForVideoInput(videoPreviewRef.current);
    }
  };

  const handleVideoDeviceChange = async (event: SelectChangeEvent<string>) => {
    const deviceId = event.target.value;
    setSelectedVideoDevice(deviceId);

    await startVideoPreview(deviceId);
  }
  const handleAudioDeviceChange = async (event: SelectChangeEvent<string>) => {
    const deviceId = event.target.value;
    setSelectedAudioDevice(deviceId);
    await audioVideo?.startAudioInput(deviceId);
  };

  useEffect(() => {
    if (open && selectedVideoDevice) {
      // delay untill camera is ready
      setTimeout(() => {
        startVideoPreview(selectedVideoDevice);
      }, 200);
    }
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Call Settings</DialogTitle>
      <DialogContent>
        {/* Camera preview */}
        <video ref={videoPreviewRef} autoPlay muted playsInline style={{
          height: '100%',
          width: '100%',
        }}></video>
        <FormControl fullWidth margin='normal'>
          <InputLabel>Camera</InputLabel>
          <Select value={selectedVideoDevice} onChange={handleVideoDeviceChange}>
            {videoDevices.map((device) => (
              <MenuItem key={device.deviceId} value={device.deviceId}>
                {device.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth margin='normal'>
          <InputLabel>Microphone</InputLabel>
          <Select value={selectedAudioDevice} onChange={handleAudioDeviceChange}>
            {audioDevices.map((device) => (
              <MenuItem key={device.deviceId} value={device.deviceId}>
                {device.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions sx={{ alignItems: 'center', justifyContent: 'flex-end', padding: '16px 24px' }}>
        <Button onClick={onClose} sx={{ marginRight: 1 }} variant="text">
          {t('callSettings.cancel')}
        </Button>
        <Button onClick={handleSave} variant="contained">
          {t('callSettings.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
