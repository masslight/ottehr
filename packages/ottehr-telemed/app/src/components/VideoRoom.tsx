import { Box } from '@mui/material';
import { FC } from 'react';
import { Footer, VideoControls } from '.';
import { otherColors } from '../OttehrThemeProvider';
import {
  useLocalVideo,
  useRemoteVideoTileState,
  RemoteVideo,
  LocalVideo,
} from 'amazon-chime-sdk-component-library-react';
import { useVideoParticipant } from '../store';

export const VideoRoom: FC = () => {
  const { tiles } = useRemoteVideoTileState();
  const { isVideoEnabled } = useLocalVideo();
  const { remoteParticipantName } = useVideoParticipant();

  // Render remote participants
  const remoteParticipants = tiles.map((tileId) => (
    <Box
      key={tileId}
      sx={{
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
        width: '100%',
      }}
    >
      <RemoteVideo tileId={tileId} />
      <Box
        sx={{
          backgroundColor: otherColors.blackTransparent,
          bottom: 0,
          color: 'white',
          left: 0,
          padding: '0.5rem',
          position: 'absolute',
        }}
      >
        {remoteParticipantName}
      </Box>
    </Box>
  ));

  return (
    // for now only speaker view for two participants
    <Box sx={{ height: '100vh', position: 'relative' }}>
      <Box key="video-meeting">
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
