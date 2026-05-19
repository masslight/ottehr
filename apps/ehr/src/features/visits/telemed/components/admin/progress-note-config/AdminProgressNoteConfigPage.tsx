import { LoadingButton } from '@mui/lab';
import { Box, CircularProgress, Grid, Paper, TextField, Typography } from '@mui/material';
import { ReactElement, useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import PageContainer from 'src/layout/PageContainer';
import {
  DispositionType,
  getDefaultNote,
  mapDispositionTypeToLabel,
  MDM_FIELD_DEFAULT_TEXT,
  ProgressNoteConfig,
} from 'utils';
import { useAdminGetProgressNoteConfig, useAdminUpdateProgressNoteConfig } from '../admin.queries';

const DISPOSITION_TYPES: DispositionType[] = ['pcp-no-type', 'another', 'ed', 'specialty'];

type FormValues = {
  mdmDefaultText: string;
  dispositionDefaults: Record<DispositionType, string>;
};

const buildDefaultFormValues = (): FormValues => ({
  mdmDefaultText: MDM_FIELD_DEFAULT_TEXT,
  dispositionDefaults: Object.fromEntries(DISPOSITION_TYPES.map((type) => [type, getDefaultNote(type)])) as Record<
    DispositionType,
    string
  >,
});

export default function AdminProgressNoteConfigPage(): ReactElement {
  const { data, isPending, isError, dataUpdatedAt } = useAdminGetProgressNoteConfig();
  const { mutateAsync, isPending: isSubmitting } = useAdminUpdateProgressNoteConfig();

  const { control, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: buildDefaultFormValues(),
  });

  useEffect(() => {
    if (data?.config) {
      const config = data.config;
      reset({
        mdmDefaultText: config.mdmDefaultText || MDM_FIELD_DEFAULT_TEXT,
        dispositionDefaults: Object.fromEntries(
          DISPOSITION_TYPES.map((type) => [type, config.dispositionDefaults[type] ?? getDefaultNote(type)])
        ) as Record<DispositionType, string>,
      });
    }
  }, [data?.config, dataUpdatedAt, reset]);

  const onSubmit = async (values: FormValues): Promise<void> => {
    const config: ProgressNoteConfig = {
      mdmDefaultText: values.mdmDefaultText,
      dispositionDefaults: values.dispositionDefaults,
    };
    await mutateAsync({ config });
  };

  return (
    <PageContainer tabTitle="Update Progress Note Configuration" showEnvFooter={false}>
      <Grid container direction="row" alignItems="flex-start" justifyContent="center">
        <Grid item maxWidth="700px" width="100%">
          {isPending ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : isError ? (
            <Typography color="error">Failed to load progress note configuration.</Typography>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)}>
              <Paper sx={{ padding: 3, marginTop: 2, marginBottom: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Medical Decision Making (MDM) Defaults
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Default text pre-filled in the MDM input.
                </Typography>
                <Controller
                  name="mdmDefaultText"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} label="MDM Default Text" multiline minRows={4} fullWidth />
                  )}
                />
              </Paper>

              <Paper sx={{ padding: 3, marginBottom: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Disposition Defaults
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Default text for each disposition type.
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {DISPOSITION_TYPES.map((type) => (
                    <Controller
                      key={type}
                      name={`dispositionDefaults.${type}`}
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} label={mapDispositionTypeToLabel[type]} multiline minRows={2} fullWidth />
                      )}
                    />
                  ))}
                </Box>
              </Paper>

              <Box display="flex" justifyContent="flex-end">
                <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
                  Save
                </LoadingButton>
              </Box>
            </form>
          )}
        </Grid>
      </Grid>
    </PageContainer>
  );
}
