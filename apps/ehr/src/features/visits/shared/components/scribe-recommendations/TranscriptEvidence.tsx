import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Box, Button, Collapse, Paper, Typography } from '@mui/material';
import { FC, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { wordCount } from './scribeSections';
import { scaled } from './scribeTheme';

const testIds = dataTestIds.scribeRecommendations;

/** Enough to read an exchange in; the rest scrolls, so a long recording cannot bury what is under it. */
const TRANSCRIPT_MAX_HEIGHT = scaled(240);

interface TranscriptEvidenceProps {
  transcript: string;
  defaultExpanded: boolean;
}

/**
 * The transcript, read-only, for checking the narrative against. It is never edited: the narrative is where
 * corrections go, and the transcript is what they are checked against. It is plain text, folded away until
 * wanted; the words behind a narrative sentence or a recommendation are shown on hover there, not lit here.
 */
export const TranscriptEvidence: FC<TranscriptEvidenceProps> = ({ transcript, defaultExpanded }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <Paper variant="outlined" data-testid={testIds.transcriptEvidence} sx={{ px: 1.5, py: 0.5 }}>
      <Button
        size="small"
        onClick={() => setIsExpanded((value) => !value)}
        endIcon={isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        aria-expanded={isExpanded}
        sx={{ textTransform: 'none', minWidth: 0, p: 0, fontSize: scaled(12), color: 'text.secondary' }}
        data-testid={testIds.transcriptToggle}
      >
        {isExpanded ? 'Transcript' : 'Show transcript'} · {wordCount(transcript)} words
      </Button>
      <Collapse in={isExpanded}>
        <Box sx={{ maxHeight: TRANSCRIPT_MAX_HEIGHT, overflowY: 'auto', pb: 0.5 }}>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ lineHeight: 1.6, whiteSpace: 'pre-wrap' }}
            data-testid={testIds.transcriptPreview}
          >
            {transcript}
          </Typography>
        </Box>
      </Collapse>
    </Paper>
  );
};
