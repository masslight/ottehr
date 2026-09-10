import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { FC, ReactNode } from 'react';

/**
 * Why the AI proposed something, and the words it heard. A panel of twenty suggestions is only
 * scannable if this stays off the row: it is one hover away, and one click pins it open.
 */

interface ProvenanceContentProps {
  /** Something to check before applying. Doubles as the flag on the toggle. */
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

interface ProvenanceToggleProps {
  content: ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  /** What the provenance is about, e.g. the recommendation's own text. */
  subject: string;
  hasWarning?: boolean;
  dataTestId: string;
}

export const ProvenanceToggle: FC<ProvenanceToggleProps> = ({
  content,
  isOpen,
  onToggle,
  subject,
  hasWarning,
  dataTestId,
}) => (
  // Hovering reads it without committing; clicking pins it open while the provider decides.
  <Tooltip title={isOpen ? '' : content} placement="left">
    <IconButton
      size="small"
      onClick={onToggle}
      aria-expanded={isOpen}
      aria-label={`${isOpen ? 'Hide' : 'Show'} why this was suggested: ${subject}`}
      data-testid={dataTestId}
      sx={{ p: 0.5 }}
    >
      {hasWarning ? (
        <WarningAmberOutlinedIcon sx={{ fontSize: 18, color: 'warning.main' }} />
      ) : (
        <InfoOutlinedIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
      )}
    </IconButton>
  </Tooltip>
);

export const ProvenancePanel: FC<{ hasWarning?: boolean; dataTestId: string; children: ReactNode }> = ({
  hasWarning,
  dataTestId,
  children,
}) => (
  <Box
    data-testid={dataTestId}
    sx={{
      mt: 0.5,
      pl: 1,
      borderLeft: '2px solid',
      borderColor: 'divider',
      color: hasWarning ? 'warning.dark' : 'text.secondary',
    }}
  >
    {children}
  </Box>
);
