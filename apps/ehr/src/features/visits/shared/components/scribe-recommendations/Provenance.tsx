import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { Box, Typography } from '@mui/material';
import { FC } from 'react';

/**
 * Why the AI proposed something, and the words it heard. A panel of twenty suggestions is only
 * scannable if this stays off the row: it is the hover on the line itself, so nothing on the row
 * has to be pressed — or looked past — to read it.
 */

interface ProvenanceContentProps {
  /** Something to check before applying. Doubles as the flag on the row. */
  warning?: string;
  /** How the AI read the transcript, or what applying this will do. */
  note?: string;
  /** The transcript excerpt itself. */
  evidence?: string;
}

export const hasProvenance = ({ warning, note, evidence }: ProvenanceContentProps): boolean =>
  Boolean(warning || note || evidence);

export const ProvenanceContent: FC<ProvenanceContentProps> = ({ warning, note, evidence }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
    {warning && (
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
        <WarningAmberOutlinedIcon sx={{ fontSize: 15, mt: '1px', flexShrink: 0 }} />
        <Typography variant="caption">{warning}</Typography>
      </Box>
    )}
    {note && <Typography variant="caption">{note}</Typography>}
    {evidence && (
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.25 }}>
        <FormatQuoteIcon sx={{ fontSize: 14, mt: '1px', flexShrink: 0 }} />
        <Typography variant="caption" sx={{ fontStyle: 'italic' }}>
          {evidence}
        </Typography>
      </Box>
    )}
  </Box>
);
