import { Check } from '@mui/icons-material';
import { capitalize, CircularProgress, Divider, Grid, Typography, useTheme } from '@mui/material';
import { ReactElement } from 'react';

interface RecordedAudioProps {
  duration: string | undefined;
  status: 'loading' | 'ready';
  source: string | undefined;
}

export function RecordedAudio(props: RecordedAudioProps): ReactElement {
  const theme = useTheme();
  const { duration, status, source } = props;
  return (
    <>
      <Grid item xs={8}>
        <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
          {duration || 'unknown'}
        </Typography>
      </Grid>
      <Grid item xs={4}>
        {status === 'ready' ? (
          <Check color="success" sx={{ display: 'inline-block', verticalAlign: 'middle' }} />
        ) : (
          <CircularProgress
            size="16px"
            sx={{
              marginLeft: '4px',
              display: 'inline-block',
              color: theme.palette.secondary.light,
              verticalAlign: 'middle',
            }}
          />
        )}
        <Typography
          variant="body1"
          sx={{
            display: 'inline-block',
            verticalAlign: 'middle',
            marginLeft: status === 'ready' ? '5px' : '8px',
            color: status === 'ready' ? theme.palette.success.main : theme.palette.secondary.light,
          }}
        >
          {capitalize(status)}
        </Typography>
      </Grid>
      <Grid item xs={12}>
        <Typography variant="body2" sx={{ color: theme.palette.secondary.light }}>
          {source || 'unknown'}
        </Typography>
        <Divider sx={{ marginTop: 1, marginBottom: 1 }} />
      </Grid>
    </>
  );
}
