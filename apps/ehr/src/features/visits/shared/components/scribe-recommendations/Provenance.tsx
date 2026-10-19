import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import MicNoneOutlinedIcon from '@mui/icons-material/MicNoneOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import {
  CHART_QUOTE_NOTE,
  INEXACT_MATCH_NOTE,
  PROVIDER_EVIDENCE_NOTE,
  TRANSCRIPT_QUOTE_NOTE,
  UNBACKED_LINE_NOTE,
} from './narrativeLines';
import { EvidenceOrigin } from './types';

/**
 * Hover content explaining a recommendation: the narrative quote, then the transcript snippets its narrative
 * line came from (or a caption when there are none), or a transcript or chart quote with its caption.
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
  /** The chart line the planner quoted, for a recommendation the chart rather than the narrative justifies. */
  chartSources?: string[];
  evidenceOrigin?: EvidenceOrigin;
}

export const hasProvenance = ({
  warning,
  note,
  evidence,
  transcriptSources,
  chartSources,
  evidenceOrigin,
}: ProvenanceContentProps): boolean =>
  Boolean(warning || note || evidence || transcriptSources?.length || chartSources?.length || evidenceOrigin);

// Rendered in the panel and, from AiAddedMark, in the note: the icons take the size of whichever theme is in scope.
export const ProvenanceContent: FC<ProvenanceContentProps> = ({
  warning,
  note,
  evidence,
  transcriptSources,
  chartSources,
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
    {/* The inexact caption heads the passage below it; other origin captions follow the sources. */}
    {evidenceOrigin === 'inexact' && <Typography variant="caption">{INEXACT_MATCH_NOTE}</Typography>}
    {transcriptSources?.map((source, index) => (
      <Box key={index} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.25, pl: 1 }}>
        <MicNoneOutlinedIcon sx={(theme) => ({ fontSize: theme.typography.pxToRem(14), mt: '1px', flexShrink: 0 })} />
        <Typography variant="caption" sx={{ fontStyle: 'italic' }}>
          {source}
        </Typography>
      </Box>
    ))}
    {chartSources?.map((source, index) => (
      <Box key={index} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.25, pl: 1 }}>
        <DescriptionOutlinedIcon
          sx={(theme) => ({ fontSize: theme.typography.pxToRem(14), mt: '1px', flexShrink: 0 })}
        />
        <Typography variant="caption" sx={{ fontStyle: 'italic' }}>
          {source}
        </Typography>
      </Box>
    ))}
    {evidenceOrigin === 'unbacked' && <Typography variant="caption">{UNBACKED_LINE_NOTE}</Typography>}
    {evidenceOrigin === 'provider' && <Typography variant="caption">{PROVIDER_EVIDENCE_NOTE}</Typography>}
    {evidenceOrigin === 'transcript' && <Typography variant="caption">{TRANSCRIPT_QUOTE_NOTE}</Typography>}
    {evidenceOrigin === 'chart' && <Typography variant="caption">{CHART_QUOTE_NOTE}</Typography>}
  </Box>
);
