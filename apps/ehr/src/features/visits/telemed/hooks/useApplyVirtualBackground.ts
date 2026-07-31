import {
  useAudioVideo,
  useBackgroundBlur,
  useBackgroundReplacement,
  useMeetingManager,
} from 'amazon-chime-sdk-component-library-react';
import { DefaultVideoTransformDevice } from 'amazon-chime-sdk-js';
import { useCallback, useRef } from 'react';
import { getSelectors } from 'utils';
import { useVideoCallStore } from '../state/video-call/video-call.store';

export function useApplyVirtualBackground(): {
  applyBackground: (rawDeviceId: string) => Promise<void>;
  isBackgroundBlurSupported: boolean | undefined;
  isBackgroundReplacementSupported: boolean | undefined;
} {
  const { virtualBackground } = getSelectors(useVideoCallStore, ['virtualBackground']);
  const { isBackgroundBlurSupported, createBackgroundBlurDevice } = useBackgroundBlur();
  const { isBackgroundReplacementSupported, createBackgroundReplacementDevice, changeBackgroundReplacementImage } =
    useBackgroundReplacement();
  const audioVideo = useAudioVideo();
  const meetingManager = useMeetingManager();

  // Tracks the active transform device so we can stop it before replacing.
  const activeTransformDeviceRef = useRef<DefaultVideoTransformDevice | null>(null);

  const applyBackground = useCallback(
    async (rawDeviceId: string): Promise<void> => {
      if (!audioVideo) return;

      if (activeTransformDeviceRef.current) {
        await activeTransformDeviceRef.current.stop();
        activeTransformDeviceRef.current = null;
      }

      if (virtualBackground.mode === 'blur' && isBackgroundBlurSupported) {
        const transformDevice = await createBackgroundBlurDevice(rawDeviceId);
        activeTransformDeviceRef.current = transformDevice as DefaultVideoTransformDevice;
        await meetingManager.startVideoInputDevice(transformDevice);
      } else if (
        virtualBackground.mode === 'image' &&
        virtualBackground.imageBlob &&
        isBackgroundReplacementSupported
      ) {
        const transformDevice = await createBackgroundReplacementDevice(rawDeviceId);
        await changeBackgroundReplacementImage(virtualBackground.imageBlob);
        activeTransformDeviceRef.current = transformDevice as DefaultVideoTransformDevice;
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
      createBackgroundBlurDevice,
      createBackgroundReplacementDevice,
      changeBackgroundReplacementImage,
    ]
  );

  return { applyBackground, isBackgroundBlurSupported, isBackgroundReplacementSupported };
}
