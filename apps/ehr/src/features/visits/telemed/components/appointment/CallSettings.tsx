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
  Typography,
} from '@mui/material';
import { useAudioInputs, useAudioVideo, useVideoInputs } from 'amazon-chime-sdk-component-library-react';
import {
  BackgroundBlurVideoFrameProcessor,
  BackgroundReplacementProcessor,
  BackgroundReplacementVideoFrameProcessor,
  ConsoleLogger,
  DefaultDeviceController,
  DefaultVideoTransformDevice,
  VideoFrameProcessor,
} from 'amazon-chime-sdk-js';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApplyVirtualBackground } from '../../hooks/useApplyVirtualBackground';
import { useVideoCallStore } from '../../state/video-call/video-call.store';
import { VirtualBackgroundSettings } from './VirtualBackgroundSettings';

interface CallSettingsProps {
  onClose: () => void;
}

export const CallSettings: FC<CallSettingsProps> = ({ onClose }) => {
  const audioVideo = useAudioVideo();
  const { applyBackground, isBackgroundBlurSupported, isBackgroundReplacementSupported } = useApplyVirtualBackground();
  const { devices: audioDevices, selectedDevice: initialAudioDevice } = useAudioInputs();
  const { devices: videoDevices, selectedDevice: initialVideoDevice } = useVideoInputs();

  const [selectedAudioDevice, setSelectedAudioDevice] = useState(initialAudioDevice);
  const [selectedVideoPreviewDeviceId, setSelectedVideoPreviewDeviceId] = useState(initialVideoDevice);

  // Chime enumerates devices asynchronously; initialVideoDevice may be undefined at mount time.
  // Sync the local state once the SDK reports a selected device (only if the user hasn't picked one yet).
  useEffect(() => {
    if (initialVideoDevice && !selectedVideoPreviewDeviceId) {
      setSelectedVideoPreviewDeviceId(initialVideoDevice);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialVideoDevice]);

  const virtualBackground = useVideoCallStore((s) => s.virtualBackground);
  // Snapshot at open time so Cancel can roll back store changes made by VirtualBackgroundSettings.
  const [initialVirtualBackground] = useState(useVideoCallStore.getState().virtualBackground);

  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const previewLoggerRef = useRef(new ConsoleLogger('preview'));
  const previewProcessorRef = useRef<VideoFrameProcessor | null>(null);
  const previewTransformDeviceRef = useRef<DefaultVideoTransformDevice | null>(null);

  const previewDeviceController = useMemo(() => new DefaultDeviceController(previewLoggerRef.current), []);

  const handleSave = async (): Promise<void> => {
    await stopAudioVideoPreviewAndUsage();

    const targetDeviceId =
      selectedVideoPreviewDeviceId?.toString() || initialVideoDevice?.toString() || videoDevices[0]?.deviceId;

    if (targetDeviceId) {
      await applyBackground(targetDeviceId);
    }

    onClose();
  };

  const handleClose = async (): Promise<void> => {
    await stopAudioVideoPreviewAndUsage();
    await audioVideo?.startAudioInput(initialAudioDevice || audioDevices[0].deviceId);
    useVideoCallStore.setState({ virtualBackground: initialVirtualBackground });
    onClose();
  };

  const stopAudioVideoPreviewAndUsage = useCallback(async (): Promise<void> => {
    if (previewDeviceController && videoPreviewRef.current) {
      previewDeviceController.stopVideoPreviewForVideoInput(videoPreviewRef.current);
    }
    await previewDeviceController?.stopVideoInput();
    await previewDeviceController?.stopAudioInput();
    if (previewTransformDeviceRef.current) {
      await previewTransformDeviceRef.current.stop();
      previewTransformDeviceRef.current = null;
    }
    if (previewProcessorRef.current) {
      await previewProcessorRef.current.destroy();
      previewProcessorRef.current = null;
    }
  }, [previewDeviceController]);

  useEffect(() => {
    return () => void stopAudioVideoPreviewAndUsage();
  }, [stopAudioVideoPreviewAndUsage]);

  const startVideoPreview = useCallback(
    async (deviceId: string): Promise<void> => {
      if (!previewDeviceController || !videoPreviewRef.current) return;

      previewDeviceController.stopVideoPreviewForVideoInput(videoPreviewRef.current);
      await previewDeviceController.stopVideoInput();

      if (previewTransformDeviceRef.current) {
        await previewTransformDeviceRef.current.stop();
        previewTransformDeviceRef.current = null;
      }
      if (previewProcessorRef.current) {
        await previewProcessorRef.current.destroy();
        previewProcessorRef.current = null;
      }

      let processor: VideoFrameProcessor | undefined;
      if (virtualBackground.mode === 'blur') {
        processor = await BackgroundBlurVideoFrameProcessor.create();
      } else if (virtualBackground.mode === 'image' && virtualBackground.imageBlob) {
        processor = await BackgroundReplacementVideoFrameProcessor.create();
      }

      if (processor) {
        if (virtualBackground.mode === 'image')
          await (processor as BackgroundReplacementProcessor).setImageBlob(virtualBackground.imageBlob);
        previewProcessorRef.current = processor;
        const transformDevice = new DefaultVideoTransformDevice(previewLoggerRef.current, deviceId, [processor]);
        previewTransformDeviceRef.current = transformDevice;
        await previewDeviceController.startVideoInput(transformDevice as unknown as string);
      } else {
        await previewDeviceController.startVideoInput(deviceId);
      }

      previewDeviceController.startVideoPreviewForVideoInput(videoPreviewRef.current);
    },
    [previewDeviceController, virtualBackground]
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

        <FormControl fullWidth margin="normal" sx={{ mb: 2 }}>
          <InputLabel>Microphone</InputLabel>
          <Select value={selectedAudioDevice?.toString()} onChange={handleAudioDeviceChange} label="Microphone">
            {audioDevices.map((device) => (
              <MenuItem key={device.deviceId} value={device.deviceId}>
                {device.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <video
          ref={videoPreviewRef}
          autoPlay
          muted
          playsInline
          style={{
            width: '100%',
            borderRadius: '10px',
          }}
        ></video>

        <VirtualBackgroundSettings
          isBlurSupported={isBackgroundBlurSupported}
          isReplacementSupported={isBackgroundReplacementSupported}
        />

        <Typography sx={{ mt: 3 }}>
          Functional microphone, sound and camera are required to proceed with the visit. If something is not working
          for you, please contact out support team.
        </Typography>
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
