import React, { useState } from 'react';
import { VideoRoom } from '../components';
import { Participant } from 'twilio-video';
import { usePatient } from '../store';

export const VideoChatPage: React.FC = () => {
  const { room } = usePatient();
  const [participants, setParticipants] = useState<Participant[]>([]);
  console.log('Rendering VideoChatPage...');

  const handleLogout = (): void => {
    // Handle logout
  };

  if (!room) {
    return <div>You don't have room created to be here</div>;
  }

  return (
    <div>
      <VideoRoom
        handleLogout={handleLogout}
        participants={participants}
        setParticipants={setParticipants}
        room={room}
      />
    </div>
  );
};
