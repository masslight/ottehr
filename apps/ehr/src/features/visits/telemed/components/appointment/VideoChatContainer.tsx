import {
  DeviceLabels,
  useAudioVideo,
  useLocalVideo,
  useLogger,
  useMeetingManager,
  useMeetingStatus,
  useVideoInputs,
} from 'amazon-chime-sdk-component-library-react';
import { LogLevel, MeetingSessionConfiguration } from 'amazon-chime-sdk-js';
import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { getSelectors } from 'utils';
import { useApplyVirtualBackground } from '../../hooks/useApplyVirtualBackground';
import { useVideoCallStore } from '../../state/video-call/video-call.store';
import { VideoChatLayout } from './VideoChatLayout';
import { VideoRoom } from './VideoRoom';

export const VideoChatContainer: FC = () => {
  const videoCallState = getSelectors(useVideoCallStore, ['meetingData']);
  const meetingManager = useMeetingManager();
  const audioVideo = useAudioVideo();
  const { toggleVideo, isVideoEnabled } = useLocalVideo();
  const meetingStatus = useMeetingStatus();
  const { devices: videoDevices, selectedDevice } = useVideoInputs();
  const { applyBackground, isBackgroundBlurSupported, isBackgroundReplacementSupported } = useApplyVirtualBackground();
  const [isCameraTurnedOnForStart, setIsCameraTurnedOnForStart] = useState(false);
  // Set to true after toggleVideo() resolves so Phase 2 (background) starts only then.
  const [cameraStartComplete, setCameraStartComplete] = useState(false);
  const appliedStartupBackground = useRef(false);

  const logger = useLogger();
  logger.setLogLevel(LogLevel.OFF);

  const stopAudioVideoUsage = useCallback(async (): Promise<void> => {
    await audioVideo?.stopVideoInput();
    await audioVideo?.stopAudioInput();
  }, [audioVideo]);

  useEffect(() => {
    return () => void stopAudioVideoUsage();
  }, [stopAudioVideoUsage]);

  useEffect(() => {
    let isDisposed = false;

    const startCall = async (): Promise<void> => {
      if (videoCallState.meetingData) {
        const meetingSessionConfiguration = new MeetingSessionConfiguration(
          videoCallState.meetingData.Meeting,
          videoCallState.meetingData.Attendee
        );
        const options = {
          deviceLabels: DeviceLabels.AudioAndVideo,
        };

        await meetingManager.join(meetingSessionConfiguration, options);

        if (isDisposed) {
          return;
        }

        await meetingManager.start();
      }
    };

    void startCall();

    return () => {
      isDisposed = true;
    };
  }, [meetingManager, videoCallState.meetingData]);

  // Phase 1: set preferred devices and turn on the camera as soon as the meeting is connected.
  useEffect(() => {
    async function toggle(): Promise<void> {
      if (!isVideoEnabled && meetingStatus === 1 && !isCameraTurnedOnForStart) {
        setIsCameraTurnedOnForStart(true);

        // Read device preferences directly from the store (not reactive) to avoid adding them
        // as effect deps, which would cause this effect to re-run mid-call.
        const { preferredVideoDeviceId, preferredAudioDeviceId } = useVideoCallStore.getState();

        const rawDeviceId =
          preferredVideoDeviceId ||
          (typeof selectedDevice === 'string'
            ? selectedDevice
            : (selectedDevice as MediaDeviceInfo | null | undefined)?.deviceId) ||
          videoDevices[0]?.deviceId;

        if (rawDeviceId) {
          useVideoCallStore.setState({ currentRawVideoDeviceId: rawDeviceId });
          await meetingManager.startVideoInputDevice(rawDeviceId);
        }
        if (preferredAudioDeviceId && audioVideo) {
          await audioVideo.startAudioInput(preferredAudioDeviceId);
        }
        await toggleVideo();
        setCameraStartComplete(true);
      }
    }

    void toggle();
    // ignoring the deps here not to rerender every time, cause for some reason toggleVideo is not memoized
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVideoEnabled, meetingStatus]);

  // Phase 2: apply pre-selected background once the camera is fully on and background support
  // is confirmed. Background WASM loads asynchronously so isBackgroundBlurSupported may still
  // be undefined when Phase 1 runs — this effect retries each time the support flag changes.
  useEffect(() => {
    if (!cameraStartComplete || appliedStartupBackground.current) return;

    const { virtualBackground, preferredVideoDeviceId } = useVideoCallStore.getState();

    if (virtualBackground.mode === 'none') {
      appliedStartupBackground.current = true;
      return;
    }
    if (virtualBackground.mode === 'blur' && isBackgroundBlurSupported === undefined) return;
    if (virtualBackground.mode === 'image' && isBackgroundReplacementSupported === undefined) return;

    const rawDeviceId =
      preferredVideoDeviceId ||
      (selectedDevice as string) ||
      (selectedDevice as MediaDeviceInfo)?.deviceId ||
      videoDevices[0]?.deviceId;

    if (!rawDeviceId) return;

    appliedStartupBackground.current = true;
    void applyBackground(rawDeviceId);
  }, [
    cameraStartComplete,
    isBackgroundBlurSupported,
    isBackgroundReplacementSupported,
    applyBackground,
    selectedDevice,
    videoDevices,
  ]);

  return (
    <VideoChatLayout>
      <VideoRoom />
    </VideoChatLayout>
  );
};
