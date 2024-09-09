import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { ConsoleLogger, DefaultDeviceController } from 'amazon-chime-sdk-js';
import { CustomDialog } from 'ottehr-components';
import { SoundSettings } from './SoundSettings';
import { MicrophoneSettings } from './MicrophoneSettings';
import { CameraSettings } from './CameraSettings';
import { useIntakeCommonStore } from 'src/features/common';
import { useCallSettingsStore } from 'src/features/video-call/call-settings.store';
import { getSelectors } from 'ottehr-utils';

interface CallSettingsProps {
  onClose: () => void;
}

const useSelectedDevices = (): {
  selectedVideoDevice: string;
  selectedAudioDevice: string;
  selectedOutputDevice: string;
  setSelectedVideoDevice: (value: string) => void;
  setSelectedAudioDevice: (value: string) => void;
  setSelectedOutputDevice: (value: string) => void;
} => {
  const { videoInput, audioInput, audioOutput } = getSelectors(useCallSettingsStore, [
    'videoInput',
    'audioInput',
    'audioOutput',
  ]);

  const createSetFunction = (name: 'videoInput' | 'audioInput' | 'audioOutput'): ((value: string) => void) => {
    return (value) => useCallSettingsStore.setState({ [name]: value });
  };

  return {
    selectedVideoDevice: videoInput,
    selectedAudioDevice: audioInput,
    selectedOutputDevice: audioOutput,
    setSelectedVideoDevice: createSetFunction('videoInput'),
    setSelectedAudioDevice: createSetFunction('audioInput'),
    setSelectedOutputDevice: createSetFunction('audioOutput'),
  };
};

export const CallSettings: FC<CallSettingsProps> = ({ onClose }) => {
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const {
    selectedVideoDevice,
    setSelectedVideoDevice,
    selectedAudioDevice,
    setSelectedAudioDevice,
    selectedOutputDevice,
    setSelectedOutputDevice,
  } = useSelectedDevices();
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const audioPreviewRef = useRef<HTMLAudioElement & { setSinkId: (value: string) => Promise<undefined> }>(null);
  const [deviceController, setDeviceController] = useState<DefaultDeviceController | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  useEffect(() => {
    const logger = new ConsoleLogger('preview');
    const deviceController = new DefaultDeviceController(logger);
    setDeviceController(deviceController);

    const fetchDevices = async (): Promise<void> => {
      const videoInputs = await deviceController.listVideoInputDevices();
      const audioInputs = await deviceController.listAudioInputDevices();
      const audioOutputs = await deviceController.listAudioOutputDevices();
      setVideoDevices(videoInputs);
      setAudioDevices(audioInputs);
      setOutputDevices(audioOutputs);
      if (videoInputs.length > 0 && !selectedVideoDevice) setSelectedVideoDevice(videoInputs[0].deviceId);
      if (audioInputs.length > 0 && !selectedAudioDevice) setSelectedAudioDevice(audioInputs[0].deviceId);
      if (audioOutputs.length > 0 && !selectedOutputDevice) setSelectedOutputDevice(audioOutputs[0].deviceId);
    };

    void fetchDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startVideoPreview = useCallback(async (): Promise<void> => {
    if (deviceController && selectedVideoDevice && videoPreviewRef.current) {
      await deviceController.startVideoInput(selectedVideoDevice);
      deviceController.startVideoPreviewForVideoInput(videoPreviewRef.current);
    }
  }, [deviceController, selectedVideoDevice]);

  const stopVideoPreview = useCallback(async (): Promise<void> => {
    if (deviceController) {
      await deviceController.stopVideoInput();
      await deviceController.stopAudioInput();
      if (videoPreviewRef.current) {
        deviceController.stopVideoPreviewForVideoInput(videoPreviewRef.current);
      }
    }
  }, [deviceController]);

  const setAudioOutput = useCallback(
    async (deviceId: string): Promise<void> => {
      if (deviceController && audioPreviewRef.current) {
        await deviceController.chooseAudioOutput(deviceId);
        await audioPreviewRef.current.setSinkId(deviceId);
      }
    },
    [deviceController],
  );

  useEffect(() => {
    if (isCameraOpen) {
      void startVideoPreview();
    } else {
      void stopVideoPreview();
    }
    return () => {
      void stopVideoPreview();
    };
  }, [isCameraOpen, selectedVideoDevice, startVideoPreview, stopVideoPreview]);

  useEffect(() => {
    if (selectedOutputDevice) {
      void setAudioOutput(selectedOutputDevice);
    }
  }, [selectedOutputDevice, setAudioOutput]);

  return (
    <CustomDialog open onClose={onClose} maxWidth="xs" PaperProps={{ sx: { borderRadius: 2 } }}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <Typography variant="h2" color="primary.main">
          Settings and testing
        </Typography>

        <SoundSettings
          selectedOutputDevice={selectedOutputDevice}
          setSelectedOutputDevice={setSelectedOutputDevice}
          outputDevices={outputDevices}
          audioPreviewRef={audioPreviewRef}
        />

        <MicrophoneSettings
          selectedAudioDevice={selectedAudioDevice}
          setSelectedAudioDevice={setSelectedAudioDevice}
          audioDevices={audioDevices}
        />

        <CameraSettings
          selectedVideoDevice={selectedVideoDevice}
          setSelectedVideoDevice={setSelectedVideoDevice}
          videoDevices={videoDevices}
          videoPreviewRef={videoPreviewRef}
          isCameraOpen={isCameraOpen}
          setIsCameraOpen={setIsCameraOpen}
        />

        <Typography>
          Functional microphone, sound and camera are required to proceed with the visit. If something is not working
          for you, please contact out support team.
        </Typography>

        <Button
          sx={{ alignSelf: 'start' }}
          variant="outlined"
          onClick={() => useIntakeCommonStore.setState({ supportDialogOpen: true })}
        >
          Contact support
        </Button>
      </Box>
    </CustomDialog>
  );
};
