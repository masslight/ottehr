import {
  useAudioVideo,
  useBackgroundBlur,
  useBackgroundReplacement,
  useLogger,
  useMeetingManager,
} from 'amazon-chime-sdk-component-library-react';
import { DefaultVideoTransformDevice } from 'amazon-chime-sdk-js';
import { useCallback, useRef } from 'react';
import { getSelectors } from 'utils';
import { useVideoCallStore, VirtualBackgroundSetting } from '../state/video-call/video-call.store';

export function useApplyVirtualBackground(): {
  applyBackground: (rawDeviceId: string, bgOverride?: VirtualBackgroundSetting) => Promise<void>;
  isBackgroundBlurSupported: boolean | undefined;
  isBackgroundReplacementSupported: boolean | undefined;
} {
  const { virtualBackground } = getSelectors(useVideoCallStore, ['virtualBackground']);
  const { isBackgroundBlurSupported, createBackgroundBlurDevice } = useBackgroundBlur();
  const { isBackgroundReplacementSupported, backgroundReplacementProcessor, changeBackgroundReplacementImage } =
    useBackgroundReplacement();
  const audioVideo = useAudioVideo();
  const meetingManager = useMeetingManager();
  const logger = useLogger();

  // Tracks the active transform device so we can stop it before replacing.
  const activeTransformDeviceRef = useRef<DefaultVideoTransformDevice | null>(null);

  const applyBackground = useCallback(
    async (rawDeviceId: string, bgOverride?: VirtualBackgroundSetting): Promise<void> => {
      // bgOverride lets callers bypass the closure-captured virtualBackground when they've just
      // updated the store and the new value isn't visible in this callback's closure yet.
      const bg = bgOverride ?? virtualBackground;

      if (!audioVideo) return;

      if (activeTransformDeviceRef.current) {
        await activeTransformDeviceRef.current.stop();
        activeTransformDeviceRef.current = null;
      }

      if (bg.mode === 'blur' && isBackgroundBlurSupported) {
        const transformDevice = await createBackgroundBlurDevice(rawDeviceId);
        activeTransformDeviceRef.current = transformDevice as DefaultVideoTransformDevice;
        await meetingManager.startVideoInputDevice(transformDevice);
      } else if (
        bg.mode === 'image' &&
        bg.imageBlob &&
        isBackgroundReplacementSupported &&
        backgroundReplacementProcessor
      ) {
        // Set the image on the provider's existing processor FIRST, then create the transform
        // device using that same processor instance. createBackgroundReplacementDevice()
        // internally calls initializeBackgroundReplacement() which always creates a fresh
        // processor — so its output and changeBackgroundReplacementImage() target different
        // instances, producing the default blue background. Bypassing it fixes this.
        await changeBackgroundReplacementImage(bg.imageBlob);
        const transformDevice = new DefaultVideoTransformDevice(logger, rawDeviceId, [backgroundReplacementProcessor]);
        activeTransformDeviceRef.current = transformDevice;
        await meetingManager.startVideoInputDevice(transformDevice);
      } else {
        await meetingManager.startVideoInputDevice(rawDeviceId);
      }
    },
    [
      audioVideo,
      meetingManager,
      virtualBackground,
      isBackgroundBlurSupported,
      isBackgroundReplacementSupported,
      backgroundReplacementProcessor,
      createBackgroundBlurDevice,
      changeBackgroundReplacementImage,
      logger,
    ]
  );

  return { applyBackground, isBackgroundBlurSupported, isBackgroundReplacementSupported };
}
