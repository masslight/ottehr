import React, { useState } from 'react';
import { VideoRoom } from '../components';
import { Participant } from 'twilio-video';
import { useVideoParticipant } from '../store';

export const VideoChatPage: React.FC = () => {
  const { room } = useVideoParticipant();

  const [participants, setParticipants] = useState<Participant[]>([]);

  if (!room) {
    return <div>You don't have room created to be here</div>;
  }

  return (
    <div>
      <VideoRoom participants={participants} setParticipants={setParticipants} room={room} />
    </div>
  );
};
