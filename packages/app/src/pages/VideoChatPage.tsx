import React, { useEffect, useState } from 'react';
import { VideoRoom } from '../components';
import { Participant, Room } from 'twilio-video';
import { usePatient } from '../store';

export const VideoChatPage: React.FC = () => {
  const { room } = usePatient();
  const [data, setData] = useState<Room | null>(null);

  const [participants, setParticipants] = useState<Participant[]>([]);
  console.log('Rendering VideoChatPage...');

  const handleLogout = (): void => {
    // Handle logout
  };

  useEffect(() => {
    setData(room);
  }, [room]);

  if (!data) {
    return <div>You don't have room created to be here</div>;
  }

  return (
    <div>
      <VideoRoom
        handleLogout={handleLogout}
        participants={participants}
        setParticipants={setParticipants}
        room={data}
      />
    </div>
  );
};
