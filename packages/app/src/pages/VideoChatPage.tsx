import { FC, useState } from 'react';
import { VideoRoom } from '../components';
import { Participant } from 'twilio-video';
import { useVideoParticipant } from '../store';

export const VideoChatPage: FC = () => {
  const { room } = useVideoParticipant();

  const [participants, setParticipants] = useState<Participant[]>([]);

  if (!room) {
    return <div>Missing created room</div>;
  }

  return (
    <div>
      <VideoRoom participants={participants} room={room} setParticipants={setParticipants} />
    </div>
  );
};