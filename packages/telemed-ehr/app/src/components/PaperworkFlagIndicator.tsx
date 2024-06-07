import { ReactElement, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { LoadingButton } from '@mui/lab';
import ClearIcon from '@mui/icons-material/Clear';
import { DateTime } from 'luxon';

interface PaperworkFlagIndicatorProps {
  title: string;
  color: string;
  backgroundColor: string;
  icon: ReactElement;
  onDismiss?(): Promise<void>;
  dateTime?: string;
  timezone?: string;
}

export default function PaperworkFlagIndicator({
  title,
  color,
  backgroundColor,
  icon,
  onDismiss,
  dateTime,
  timezone,
}: PaperworkFlagIndicatorProps): ReactElement {
  const [loading, setLoading] = useState<boolean>(false);
  const adjustedDateTime = dateTime && DateTime.fromISO(dateTime).setZone(timezone);
  const formattedDate = adjustedDateTime
    ? adjustedDateTime.toLocaleString({
        month: 'long',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      })
    : 'Unknown';

  async function dismissAlert(): Promise<void> {
    try {
      setLoading(true);
      onDismiss && (await onDismiss());
    } catch (e) {
      console.log('error dismissing alert: ', JSON.stringify(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box
      sx={{
        width: '100%',
        background: backgroundColor,
        padding: '16px',
        borderRadius: '4px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', padding: '7px 12px 7px 0px' }}>{icon}</Box>
        <Typography
          variant="body1"
          sx={{
            fontWeight: 700,
            background: color,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {`${title} ${dateTime ? formattedDate : ''}`}
        </Typography>
      </Box>
      {onDismiss && (
        <LoadingButton loading={loading} onClick={dismissAlert}>
          {/* svg icon doesn't support layered linear gradients. need to provide hex color here */}
          {!loading && <ClearIcon sx={{ color: color }}></ClearIcon>}
        </LoadingButton>
      )}
    </Box>
  );
}
