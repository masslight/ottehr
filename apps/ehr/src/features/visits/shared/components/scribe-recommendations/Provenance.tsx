import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import MicNoneOutlinedIcon from '@mui/icons-material/MicNoneOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import { PROVIDER_EVIDENCE_NOTE, TRANSCRIPT_QUOTE_NOTE, UNBACKED_LINE_NOTE } from './narrativeLines';
import { EvidenceOrigin } from './types';

/**
 * Why the AI proposed something, and the words it read. A panel of twenty suggestions is only
 * scannable if this stays off the row: it is the hover on the line itself, so nothing on the row
 * has to be pressed — or looked past — to read it.
 *
 * The provenance is two hops long. The quote is a phrase of the narrative — what the planner read —
 * and under it come the transcript snippets the narrative line was written from: what was actually
 * said. A line the generator said on its own, or one the provider wrote, has no snippets, and says so.
 * A quote the planner took from the transcript rather than the narrative has no narrative excerpt: it is
 * shown as a transcript snippet, with a caption saying so.
 */

interface ProvenanceContentProps {
  /** Something to check before applying. Doubles as the flag on the row. */
  warning?: string;
  /** How the AI read the narrative, or what applying this will do. */
  note?: string;
  /** The narrative excerpt itself. */
  evidence?: string;
  /** The transcript snippets behind the narrative line the excerpt sits in, or the transcript quote itself. */
  transcriptSources?: string[];
  evidenceOrigin?: EvidenceOrigin;
}

export const hasProvenance = ({
  warning,
  note,
  evidence,
  transcriptSources,
  evidenceOrigin,
}: ProvenanceContentProps): boolean =>
  Boolean(warning || note || evidence || transcriptSources?.length || evidenceOrigin);

// Rendered in the panel and, from AiAddedMark, in the note: the icons take the size of whichever theme is in scope.
export const ProvenanceContent: FC<ProvenanceContentProps> = ({
  warning,
  note,
  evidence,
  transcriptSources,
  evidenceOrigin,
}) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
    {warning && (
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
        <WarningAmberOutlinedIcon
          sx={(theme) => ({ fontSize: theme.typography.pxToRem(15), mt: '1px', flexShrink: 0 })}
        />
        <Typography variant="caption">{warning}</Typography>
      </Box>
    )}
    {note && <Typography variant="caption">{note}</Typography>}
    {evidence && (
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.25 }}>
        <FormatQuoteIcon sx={(theme) => ({ fontSize: theme.typography.pxToRem(14), mt: '1px', flexShrink: 0 })} />
        <Typography variant="caption" sx={{ fontStyle: 'italic' }}>
          {evidence}
        </Typography>
      </Box>
    )}
    {transcriptSources?.map((source, index) => (
      <Box key={index} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.25, pl: 1 }}>
        <MicNoneOutlinedIcon sx={(theme) => ({ fontSize: theme.typography.pxToRem(14), mt: '1px', flexShrink: 0 })} />
        <Typography variant="caption" sx={{ fontStyle: 'italic' }}>
          {source}
        </Typography>
      </Box>
    ))}
    {evidenceOrigin === 'unbacked' && <Typography variant="caption">{UNBACKED_LINE_NOTE}</Typography>}
    {evidenceOrigin === 'provider' && <Typography variant="caption">{PROVIDER_EVIDENCE_NOTE}</Typography>}
    {evidenceOrigin === 'transcript' && <Typography variant="caption">{TRANSCRIPT_QUOTE_NOTE}</Typography>}
  </Box>
);
