import { Alert, Box, CircularProgress, FormControlLabel, Grid, Paper, Switch, Typography } from '@mui/material';
import { ReactElement } from 'react';
import { useProgressNoteConfig, useUpdateProgressNoteConfig } from 'src/hooks/useProgressNoteConfig';
import PageContainer from 'src/layout/PageContainer';
import { DEFAULT_PROGRESS_NOTE_CONFIG, ProgressNoteConfig } from 'utils';

interface ProgressNoteToggle {
  key: keyof ProgressNoteConfig;
  label: string;
}

const TOGGLES: ProgressNoteToggle[] = [
  {
    key: 'mdmRequired',
    label: 'Medical Decision Making (MDM) required to sign progress note',
  },
];

export default function ProgressNoteAdminPage(): ReactElement {
  const { data, isPending, isError } = useProgressNoteConfig();
  const { mutate, isPending: isSubmitting } = useUpdateProgressNoteConfig();

  const config: ProgressNoteConfig = {
    ...DEFAULT_PROGRESS_NOTE_CONFIG,
    ...data,
  };

  const handleToggle = (key: keyof ProgressNoteConfig, checked: boolean): void => {
    mutate({
      ...config,
      [key]: checked,
    });
  };

  return (
    <PageContainer tabTitle="Progress Note Configuration" showEnvFooter={false}>
      <Grid container direction="row" alignItems="center" justifyContent="center">
        <Grid item maxWidth="800px" width="100%">
          <Paper sx={{ padding: 3, marginTop: 2, marginBottom: 2 }}>
            <Typography variant="h5" sx={{ mb: 1 }}>
              Progress Note
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Configure how providers complete and sign progress notes for this practice.
            </Typography>

            {isPending ? (
              <Box display="flex" justifyContent="center" alignItems="center" py={3}>
                <CircularProgress />
              </Box>
            ) : isError ? (
              <Alert severity="error">Failed to load the current progress note settings.</Alert>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                {TOGGLES.map(({ key, label }) => (
                  <FormControlLabel
                    key={key}
                    control={
                      <Switch
                        checked={config[key]}
                        onChange={(_event, checked) => handleToggle(key, checked)}
                        disabled={isSubmitting}
                      />
                    }
                    label={label}
                  />
                ))}
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </PageContainer>
  );
}
