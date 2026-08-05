import { LoadingButton } from '@mui/lab';
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
import {
  BackgroundBlurVideoFrameProcessor,
  BackgroundReplacementProcessor,
  BackgroundReplacementVideoFrameProcessor,
  ConsoleLogger,
  DefaultDeviceController,
  DefaultVideoTransformDevice,
  VideoFrameProcessor,
} from 'amazon-chime-sdk-js';
import { enqueueSnackbar } from 'notistack';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useVideoCallStore } from '../../state/video-call/video-call.store';
import { VirtualBackgroundSettings } from './VirtualBackgroundSettings';

interface PreCallSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  onConnect: () => Promise<void>;
}

export const PreCallSettingsDialog: FC<PreCallSettingsDialogProps> = ({ open, onClose, onConnect }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);

  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);

  const storedVideoDeviceId = useVideoCallStore((s) => s.preferredVideoDeviceId);
  const storedAudioDeviceId = useVideoCallStore((s) => s.preferredAudioDeviceId);
  const virtualBackground = useVideoCallStore((s) => s.virtualBackground);

  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState(storedVideoDeviceId ?? '');
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState(storedAudioDeviceId ?? '');

  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const previewLoggerRef = useRef(new ConsoleLogger('pre-call-preview'));
  const previewProcessorRef = useRef<VideoFrameProcessor | null>(null);
  const previewTransformDeviceRef = useRef<DefaultVideoTransformDevice | null>(null);

  const previewDeviceController = useMemo(() => new DefaultDeviceController(previewLoggerRef.current), []);

  const enumerateDevices = useCallback(async (): Promise<void> => {
    const all = await navigator.mediaDevices.enumerateDevices();
    const video = all.filter((d) => d.kind === 'videoinput');
    const audio = all.filter((d) => d.kind === 'audioinput');
    setVideoDevices(video);
    setAudioDevices(audio);
    // Validate stored selection; fall back to first device if the stored ID is gone
    setSelectedVideoDeviceId((prev) =>
      prev && video.some((d) => d.deviceId === prev) ? prev : video[0]?.deviceId ?? ''
    );
    setSelectedAudioDeviceId((prev) =>
      prev && audio.some((d) => d.deviceId === prev) ? prev : audio[0]?.deviceId ?? ''
    );
  }, []);

  const stopPreview = useCallback(async (): Promise<void> => {
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
    return () => void stopPreview();
  }, [stopPreview]);

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
        if (virtualBackground.mode === 'image') {
          await (processor as BackgroundReplacementProcessor).setImageBlob(virtualBackground.imageBlob);
        }
        previewProcessorRef.current = processor;
        const transformDevice = new DefaultVideoTransformDevice(previewLoggerRef.current, deviceId, [processor]);
        previewTransformDeviceRef.current = transformDevice;
        await previewDeviceController.startVideoInput(transformDevice as unknown as string);
      } else {
        await previewDeviceController.startVideoInput(deviceId);
      }

      previewDeviceController.startVideoPreviewForVideoInput(videoPreviewRef.current);
      // Re-enumerate after camera permission is granted to populate device labels
      await enumerateDevices();
    },
    [previewDeviceController, virtualBackground, enumerateDevices]
  );

  // Enumerate devices when the dialog opens.
  // enumerateDevices() only returns labeled results after the browser has granted camera/mic
  // permission. If we haven't asked yet, request it first so the dropdown is populated on open.
  useEffect(() => {
    if (!open) return;
    const init = async (): Promise<void> => {
      const existing = await navigator.mediaDevices.enumerateDevices();
      const hasPermission = existing.some((d) => d.kind === 'videoinput' && d.label);
      if (!hasPermission) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          stream.getTracks().forEach((t) => t.stop());
        } catch {
          // Permission denied or no camera — enumerateDevices will return what it can
        }
      }
      await enumerateDevices();
    };
    void init();
  }, [open, enumerateDevices]);

  // Start/restart preview when the dialog is open, the device changes, the background changes,
  // or after a failed connect attempt (previewKey).
  useEffect(() => {
    if (!open || !selectedVideoDeviceId) {
      void stopPreview();
      return;
    }
    let isDisposed = false;
    const timer = setTimeout(() => {
      if (!isDisposed) void startVideoPreview(selectedVideoDeviceId);
    }, 200);
    return () => {
      isDisposed = true;
      clearTimeout(timer);
    };
    // previewKey is intentional: lets us restart the preview after a failed connect attempt
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedVideoDeviceId, startVideoPreview, previewKey]);

  const handleVideoDeviceChange = (event: SelectChangeEvent<string>): void => {
    setSelectedVideoDeviceId(event.target.value);
  };

  const handleAudioDeviceChange = (event: SelectChangeEvent<string>): void => {
    setSelectedAudioDeviceId(event.target.value);
  };

  const handleConnect = async (): Promise<void> => {
    setIsConnecting(true);
    try {
      await stopPreview();
      useVideoCallStore.setState({
        preferredVideoDeviceId: selectedVideoDeviceId || null,
        preferredAudioDeviceId: selectedAudioDeviceId || null,
      });
      await onConnect();
    } catch (error) {
      console.error('Error connecting to patient video call:', error);
      enqueueSnackbar('Error trying to connect to a patient.', { variant: 'error' });
      setPreviewKey((k) => k + 1);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <Dialog open={open} onClose={isConnecting ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Call Settings</DialogTitle>
      <DialogContent>
        <FormControl fullWidth margin="normal">
          <InputLabel>Camera</InputLabel>
          <Select value={selectedVideoDeviceId} onChange={handleVideoDeviceChange} label="Camera">
            {videoDevices.map((device) => (
              <MenuItem key={device.deviceId} value={device.deviceId}>
                {device.label || device.deviceId}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth margin="normal" sx={{ mb: 2 }}>
          <InputLabel>Microphone</InputLabel>
          <Select value={selectedAudioDeviceId} onChange={handleAudioDeviceChange} label="Microphone">
            {audioDevices.map((device) => (
              <MenuItem key={device.deviceId} value={device.deviceId}>
                {device.label || device.deviceId}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <video ref={videoPreviewRef} autoPlay muted playsInline style={{ width: '100%', borderRadius: '10px' }} />

        <VirtualBackgroundSettings isBlurSupported={undefined} isReplacementSupported={undefined} />

        <Typography sx={{ mt: 3 }} variant="body2">
          Functional microphone, sound and camera are required to proceed with the visit. If something is not working
          for you, please contact our support team.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ alignItems: 'center', justifyContent: 'flex-end', padding: '16px 24px' }}>
        <Button onClick={onClose} variant="text" disabled={isConnecting} sx={{ marginRight: 1 }}>
          Cancel
        </Button>
        <LoadingButton
          loading={isConnecting}
          onClick={() => void handleConnect()}
          variant="contained"
          data-testid={dataTestIds.dialog.proceedButton}
        >
          Connect to Patient
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
};
