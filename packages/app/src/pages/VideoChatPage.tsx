import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Participant } from 'twilio-video';
import { VideoRoom } from '../components';
import { useVideoParticipant } from '../store';

export const VideoChatPage: FC = () => {
  const { t } = useTranslation();
  const { room } = useVideoParticipant();

  const [participants, setParticipants] = useState<Participant[]>([]);

  if (!room) {
    return <div>{t('video.missingRoom')}</div>;
  }

  return (
    <div>
      <VideoRoom participants={participants} room={room} setParticipants={setParticipants} />
    </div>
  );
};
