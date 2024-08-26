import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useTranslation } from 'react-i18next';
import { useAudioVideo, useMeetingManager } from 'amazon-chime-sdk-component-library-react';
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

  const previewDeviceController = useMemo(() => {
    const logger = new ConsoleLogger('preview');
    return new DefaultDeviceController(logger);
  }, []);

  const handleSave = async (): Promise<void> => {
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

    const initDevices = async (): Promise<void> => {
      const videoInputDevices = (await meetingManager.audioVideo?.listVideoInputDevices()) ?? [];
      const audioInputDevices = (await meetingManager.audioVideo?.listAudioInputDevices()) ?? [];

      setVideoDevices(videoInputDevices);
      setAudioDevices(audioInputDevices);

      if (videoInputDevices.length > 0) {
        setSelectedVideoDevice(videoInputDevices[0].deviceId);
      }
      if (audioInputDevices.length > 0) {
        setSelectedAudioDevice(audioInputDevices[0].deviceId);
      }
    };

    void initDevices();

    return () => {
      meetingManager.audioVideo?.removeDeviceChangeObserver(observer);
    };
  }, [meetingManager.audioVideo]);

  const startVideoPreview = useCallback(
    async (deviceId: string): Promise<void> => {
      if (previewDeviceController && videoPreviewRef.current) {
        await previewDeviceController.startVideoInput(deviceId);
        previewDeviceController.startVideoPreviewForVideoInput(videoPreviewRef.current);
      }
    },
    [previewDeviceController],
  );

  const handleVideoDeviceChange = async (event: SelectChangeEvent<string>): Promise<void> => {
    const deviceId = event.target.value;
    setSelectedVideoDevice(deviceId);

    await startVideoPreview(deviceId);
  };
  const handleAudioDeviceChange = async (event: SelectChangeEvent<string>): Promise<void> => {
    const deviceId = event.target.value;
    setSelectedAudioDevice(deviceId);
    await audioVideo?.startAudioInput(deviceId);
  };

  useEffect(() => {
    let isDisposed = false;
    if (open && selectedVideoDevice) {
      setTimeout(() => {
        if (!isDisposed) {
          void startVideoPreview(selectedVideoDevice);
        }
      }, 200);
    }
    return () => {
      isDisposed = true;
    };
  }, [open, selectedVideoDevice, startVideoPreview]);

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{t('callSettings.callSettings')}</DialogTitle>
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
          <InputLabel>{t('callSettings.camera')}</InputLabel>
          <Select value={selectedVideoDevice} onChange={handleVideoDeviceChange} label={t('callSettings.camera')}>
            {videoDevices.map((device) => (
              <MenuItem key={device.deviceId} value={device.deviceId}>
                {device.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth margin="normal">
          <InputLabel>{t('callSettings.microphone')}</InputLabel>
          <Select value={selectedAudioDevice} onChange={handleAudioDeviceChange} label={t('callSettings.microphone')}>
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
          {t('general.button.cancel')}
        </Button>
        <Button onClick={handleSave} variant="contained">
          {t('general.button.saveChanges')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
