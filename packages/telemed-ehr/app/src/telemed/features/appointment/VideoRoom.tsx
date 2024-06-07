import { Box, Typography, useTheme } from '@mui/material';
import { FC, useEffect, useMemo, useState } from 'react';
import {
  useRemoteVideoTileState,
  useLocalVideo,
  RemoteVideo,
  LocalVideo,
  useRosterState,
} from 'amazon-chime-sdk-component-library-react';
import { VideoControls } from './VideoControls';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useVideoCallStore } from '../../state';
import { RosterAttendeeType } from 'amazon-chime-sdk-component-library-react/lib/types';

type Participant = RosterAttendeeType & {
  tileId?: number;
};

export const VideoRoom: FC = () => {
  const theme = useTheme();
  const { attendeeIdToTileId } = useRemoteVideoTileState();
  const { isVideoEnabled } = useLocalVideo();
  const { roster } = useRosterState();
  const videoCallState = getSelectors(useVideoCallStore, ['meetingData']);

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
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        height: '100%',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}
      >
        <Box sx={{ display: 'flex', padding: 1, gap: 1, height: '100%' }}>
          <Box
            sx={{
              color: 'white',
              width: '100%',
              overflow: 'hidden',
              display: 'flex',
              gap: 1,
            }}
          >
            {activeParticipant && (
              <Box
                sx={{
                  height: '100%',
                  overflow: 'hidden',
                  position: 'relative',
                  width: '100%',
                  backgroundColor: theme.palette.primary.dark,
                  borderRadius: 2,
                }}
              >
                {activeParticipant.tileId && <RemoteVideo tileId={activeParticipant.tileId} />}
              </Box>
            )}
          </Box>
          <Box
            sx={{
              color: 'white',
              minWidth: '20%',
              display: 'grid',
              gridAutoColumns: '1fr',
              rowGap: 1,
              alignContent: 'start',
            }}
          >
            <Box
              sx={{
                aspectRatio: '1/1',
                backgroundColor: theme.palette.primary.dark,
                borderRadius: '8px',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              {isVideoEnabled && <LocalVideo />}
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  height: 34,
                  width: '100%',
                  backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0))',
                  pt: '10px',
                  pl: '10px',
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
                    aspectRatio: '1/1',
                    backgroundColor: theme.palette.primary.dark,
                    borderRadius: '8px',
                    overflow: 'hidden',
                    position: 'relative',
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
        <Box
          sx={{
            backgroundColor: theme.palette.primary.dark,
            display: 'flex',
            justifyContent: 'end',
            px: 1,
          }}
        >
          <VideoControls />
        </Box>
      </Box>
    </Box>
  );
};
