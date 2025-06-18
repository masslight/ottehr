import {
  DeviceLabels,
  useAudioVideo,
  useLocalVideo,
  useMeetingManager,
  useMeetingStatus,
} from 'amazon-chime-sdk-component-library-react';
import { MeetingSessionConfiguration } from 'amazon-chime-sdk-js';
import { FC, useCallback, useEffect, useState } from 'react';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useVideoCallStore } from '../../state';
import { VideoChatLayout } from './VideoChatLayout';
import { VideoRoom } from './VideoRoom';

export const VideoChatContainer: FC = () => {
  const videoCallState = getSelectors(useVideoCallStore, ['meetingData']);
  const meetingManager = useMeetingManager();
  const audioVideo = useAudioVideo();
  const { toggleVideo, isVideoEnabled } = useLocalVideo();
  const meetingStatus = useMeetingStatus();
  const [isCameraTurnedOnForStart, setIsCameraTurnedOnForStart] = useState(false);

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

  useEffect(() => {
    async function toggle(): Promise<void> {
      if (!isVideoEnabled && meetingStatus === 1 && !isCameraTurnedOnForStart) {
        setIsCameraTurnedOnForStart(true);
        await toggleVideo();
      }
    }

    void toggle();
    // ignoring the deps here not to rerender every time, cause for some reason toggleVideo is not memoized
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVideoEnabled, meetingStatus]);

  return (
    <VideoChatLayout>
      <VideoRoom />
    </VideoChatLayout>
  );
};
