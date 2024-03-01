import { Box } from '@mui/material';
import { FC } from 'react';
import { Footer, VideoControls } from '.';
import {
  useLocalVideo,
  useRemoteVideoTileState,
  RemoteVideo,
  LocalVideo,
} from 'amazon-chime-sdk-component-library-react';

export const VideoRoom: FC = () => {
  const { tiles } = useRemoteVideoTileState();
  const { isVideoEnabled, toggleVideo } = useLocalVideo();


  // Render remote participants
  const remoteParticipants = tiles.map(tileId => (
    <Box key={tileId} sx={{ position: 'relative', height: '100vh' }}>
      <RemoteVideo tileId={tileId} />
    </Box>
  ));

  return (
    // for now only speaker view for two participants
    <Box sx={{ height: '100vh', position: 'relative', width: '100vw' }}>
      <Box key="video-room">
        <Box
          sx={{
            backgroundColor: 'gray',
            height: '100vh',
          }}
        >
          {remoteParticipants}
        </Box>
        {/* local video */}
        <Box
          sx={{
            backgroundColor: 'lightgray',
            height: 135,
            position: 'absolute',
            right: 16,
            top: 16,
            width: 240,
            zIndex: 2,
          }}
        >
          {isVideoEnabled && <LocalVideo />}
        </Box>
        <Box
          sx={{
            bottom: 16,
            left: '50%',
            position: 'absolute',
            transform: 'translate(-50%, 50%)',
            zIndex: 3,
          }}
        >
          <VideoControls inCallRoom={true} />
        </Box>
      </Box>
      <Footer />
    </Box>
  );
};


