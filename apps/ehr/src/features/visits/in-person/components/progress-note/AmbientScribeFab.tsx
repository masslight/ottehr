import { Mic } from '@mui/icons-material';
import { Container, Fab, Paper } from '@mui/material';
import React from 'react';
import { AIChatDetails } from 'utils/lib/types/api/chart-data/chart-data.types';
import { RecordAudioContainer } from './RecordAudioContainer';

interface AmbientScribeFabProps {
  encounterId: string | undefined;
  aiChat: AIChatDetails | undefined;
  // Position overrides (px from the viewport bottom) so a host page can keep the Fab and its
  // popover clear of its own bottom-right UI (e.g. the easy-chart assistant composer).
  fabBottom?: number;
  popoverBottom?: number;
  // Fired after a recording upload completes (see RecordAudioContainer.onSaved) — e.g. so the
  // easy-chart page can start polling for the asynchronously-created transcript.
  onRecordingSaved?: () => void;
}

// The Ambient Scribe mic Fab + recorder popover, shared by the in-person visit layout and the
// easy-chart page. The popover is hidden (not unmounted) when closed so an in-progress recording
// keeps running.
export const AmbientScribeFab: React.FC<AmbientScribeFabProps> = ({
  encounterId,
  aiChat,
  fabBottom = 8,
  popoverBottom = 75,
  onRecordingSaved,
}) => {
  const [recordingAnchorElement, setRecordingAnchorElement] = React.useState<HTMLButtonElement | null>(null);
  const recordingElementID = 'recording-element';
  const recordingOpen = Boolean(recordingAnchorElement);

  return (
    <Container>
      <Fab
        color="primary"
        aria-label=""
        aria-describedby={recordingElementID}
        sx={{ position: 'fixed', right: 8, bottom: fabBottom }}
        onClick={(event) =>
          recordingOpen ? setRecordingAnchorElement(null) : setRecordingAnchorElement(event.currentTarget)
        }
      >
        <Mic />
      </Fab>
      {encounterId && (
        <Paper
          sx={{
            position: 'fixed',
            right: '15px',
            bottom: `${popoverBottom}px`,
            zIndex: '10',
            ...(!recordingOpen && { display: 'none' }),
          }}
        >
          <RecordAudioContainer
            visitID={encounterId}
            aiChat={aiChat}
            setRecordingAnchorElement={setRecordingAnchorElement}
            onSaved={onRecordingSaved}
          />
        </Paper>
      )}
    </Container>
  );
};
