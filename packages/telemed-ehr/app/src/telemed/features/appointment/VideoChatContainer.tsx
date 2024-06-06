import { FC, useEffect } from 'react';
import { DeviceLabels, useMeetingManager } from 'amazon-chime-sdk-component-library-react';
import { MeetingSessionConfiguration } from 'amazon-chime-sdk-js';
import { VideoRoom } from './VideoRoom';
import { VideoChatLayout } from './VideoChatLayout';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useVideoCallStore } from '../../state';

export const VideoChatContainer: FC = () => {
  const videoCallState = getSelectors(useVideoCallStore, ['meetingData']);
  const meetingManager = useMeetingManager();

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

  return (
    <VideoChatLayout>
      <VideoRoom />
    </VideoChatLayout>
  );
};
