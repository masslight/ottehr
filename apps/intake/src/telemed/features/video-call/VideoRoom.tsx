import { Box, Typography, useTheme } from '@mui/material';
import {
  LocalVideo,
  RemoteVideo,
  RosterAttendeeType,
  useLocalVideo,
  useRemoteVideoTileState,
  useRosterState,
} from 'amazon-chime-sdk-component-library-react';
import { FC, useEffect, useMemo, useState } from 'react';
import { getSelectors } from 'utils';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useVideoCallStore, VideoControls } from '.';

type Participant = RosterAttendeeType & {
  tileId?: number;
};

export const VideoRoom: FC = () => {
  const theme = useTheme();
  const { attendeeIdToTileId } = useRemoteVideoTileState();
  const { isVideoEnabled } = useLocalVideo();
  const { roster } = useRosterState();
  const videoCallState = getSelectors(useVideoCallStore, ['meetingData']);
  const isMobile = useIsMobile();

  const [activeParticipant, setActiveParticipant] = useState<null | Participant>(null);

  const participants = useMemo<Participant[]>(() => {
    return Object.keys(roster)
      .filter(
        (participantId) => (videoCallState.meetingData?.Attendee as { AttendeeId: string }).AttendeeId !== participantId
      )
      .map((participantId) => ({
        ...roster[participantId],
        tileId: attendeeIdToTileId[participantId],
      }));
  }, [roster, videoCallState.meetingData?.Attendee, attendeeIdToTileId]);

  useEffect(() => {
    if (participants.length) {
      setActiveParticipant(participants[0]);
    } else {
      setActiveParticipant(null);
    }
  }, [participants]);

  return (
    <Box sx={{ position: 'relative', width: '100%', height: isMobile ? '100vh' : 'auto' }}>
      <Box
        key="video-room"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          borderRadius: isMobile ? '0px' : '8px',
          overflow: 'hidden',
          height: '100%',
        }}
      >
        <Box
          sx={{
            position: 'relative',
            backgroundColor: '#0A2143',
            height: isMobile ? '100%' : '600px',
            flex: isMobile ? 1 : undefined,
            color: 'white',
          }}
        >
          {activeParticipant && (
            <Box
              sx={{
                height: '100%',
                overflow: 'hidden',
                position: 'relative',
                width: '100%',
                flex: isMobile ? 1 : undefined,
              }}
            >
              {activeParticipant.tileId && <RemoteVideo tileId={activeParticipant.tileId} />}
            </Box>
          )}

          <Box
            sx={{
              position: 'absolute',
              display: 'flex',
              flexDirection: isMobile ? 'row' : 'column',
              gap: 2,
              ...(isMobile
                ? { left: 16, bottom: 16 }
                : {
                    right: 16,
                    top: 16,
                  }),
            }}
          >
            <Box
              sx={{
                position: 'relative',
                width: isMobile ? 120 : 150,
                height: isMobile ? 120 : 150,
                borderRadius: '8px',
                overflow: 'hidden',
                color: 'white',
                zIndex: 2,
                border: '1px solid #fff',
                backgroundColor: theme.palette.secondary.main,
              }}
            >
              {isVideoEnabled && <LocalVideo />}
              <Box
                sx={{
                  position: 'absolute',
                  display: 'flex',
                  alignItems: 'end',
                  bottom: 0,
                  left: 0,
                  height: 34,
                  width: '100%',
                  backgroundImage: 'linear-gradient(rgba(0,0,0,0), rgba(0,0,0,0.7))',
                  pb: 1,
                  pl: 1,
                }}
              >
                <Typography sx={{ fontWeight: 700, fontSize: '14px' }}>You</Typography>
              </Box>
            </Box>

            {participants
              .filter((participant) => participant.chimeAttendeeId !== activeParticipant?.chimeAttendeeId)
              .map((participant) => (
                <Box
                  key={participant.chimeAttendeeId}
                  sx={{
                    width: isMobile ? 120 : 150,
                    height: isMobile ? 120 : 150,
                    borderRadius: '8px',
                    overflow: 'hidden',
                    color: 'white',
                    zIndex: 2,
                    border: '1px solid #fff',
                    backgroundColor: theme.palette.secondary.main,
                    cursor: participant.tileId ? 'pointer' : 'auto',
                  }}
                >
                  {participant.tileId && (
                    <RemoteVideo
                      onClick={() => {
                        setActiveParticipant(participant);
                      }}
                      tileId={participant.tileId}
                    />
                  )}
                </Box>
              ))}
          </Box>
        </Box>

        <Box>
          <VideoControls />
        </Box>
      </Box>
    </Box>
  );
};
