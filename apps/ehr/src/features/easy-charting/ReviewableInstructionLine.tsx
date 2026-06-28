import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { Box, Button, Divider, IconButton, Popover, Tooltip, Typography } from '@mui/material';
import { JSX, MouseEvent, useState } from 'react';

/**
 * One read-only patient-instruction line. Mirrors the InlineNoteField review treatment for the
 * free-text note fields: when the AI-written instruction likely drifted from the dictation (e.g. it
 * still names a dose that no longer matches the order), the line is highlighted amber with a warning
 * icon whose popover shows the reason and a one-click confirm.
 */
export function ReviewableInstructionLine({
  title,
  text,
  needsReview = false,
  reason,
  onConfirm,
}: {
  title?: string;
  text: string;
  needsReview?: boolean;
  reason?: string;
  onConfirm?: () => void;
}): JSX.Element {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = (e: MouseEvent<HTMLElement>): void => setAnchorEl(e.currentTarget);
  const close = (): void => setAnchorEl(null);
  const confirm = (): void => {
    close();
    onConfirm?.();
  };

  return (
    <Box
      sx={{
        position: 'relative',
        ...(needsReview && {
          bgcolor: 'rgba(237,108,2,0.06)',
          borderLeft: '2px solid',
          borderColor: 'warning.main',
          borderRadius: 0.5,
          pl: 0.75,
          pr: 3,
          py: 0.25,
        }),
      }}
    >
      {needsReview && (
        <Tooltip title={reason || 'Review against your dictation'}>
          <IconButton
            size="small"
            onClick={open}
            sx={{ position: 'absolute', top: 2, right: 2, color: 'warning.main', p: 0.25 }}
          >
            <WarningAmberRoundedIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Tooltip>
      )}
      {title && (
        <Typography variant="body2" fontWeight={600}>
          {title}
        </Typography>
      )}
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
        {text}
      </Typography>
      <Popover
        open={!!anchorEl}
        anchorEl={anchorEl}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Box sx={{ p: 1.5, maxWidth: 340 }}>
          {reason && (
            <Typography variant="body2" sx={{ color: 'warning.dark', fontWeight: 600 }}>
              {reason}
            </Typography>
          )}
          {onConfirm && (
            <>
              <Divider sx={{ my: 1 }} />
              <Button size="small" variant="contained" startIcon={<CheckRoundedIcon />} onClick={confirm}>
                Looks right
              </Button>
            </>
          )}
        </Box>
      </Popover>
    </Box>
  );
}
