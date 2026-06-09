import { zodResolver } from '@hookform/resolvers/zod';
import { LoadingButton } from '@mui/lab';
import {
  Alert,
  Box,
  CircularProgress,
  Divider,
  FormControlLabel,
  Grid,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { ReactElement, useEffect } from 'react';
import { Control, Controller, useForm } from 'react-hook-form';
import { useProgressNoteConfig, useUpdateProgressNoteConfig } from 'src/hooks/useProgressNoteConfig';
import PageContainer from 'src/layout/PageContainer';
import {
  DEFAULT_PROGRESS_NOTE_CONFIG,
  mapDispositionTypeToLabel,
  ProgressNoteConfig,
  UpdateProgressNoteConfigInputSchema,
} from 'utils';

type ProgressNoteTextFieldName = Exclude<keyof ProgressNoteConfig, 'mdmRequired'>;

interface ConfigTextAreaFieldProps {
  control: Control<ProgressNoteConfig>;
  name: ProgressNoteTextFieldName;
  label: string;
  minRows?: number;
}

const ConfigTextAreaField = ({ control, name, label, minRows = 2 }: ConfigTextAreaFieldProps): ReactElement => (
  <Controller
    name={name}
    control={control}
    render={({ field, fieldState }) => (
      <TextField
        {...field}
        label={label}
        multiline
        minRows={minRows}
        fullWidth
        error={!!fieldState.error}
        helperText={fieldState.error?.message}
      />
    )}
  />
);

export default function ProgressNoteAdminPage(): ReactElement {
  const { data, isPending, isError } = useProgressNoteConfig();
  const { mutate, isPending: isSubmitting } = useUpdateProgressNoteConfig();

  const {
    control,
    formState: { dirtyFields, isDirty },
    handleSubmit,
    reset,
  } = useForm<ProgressNoteConfig>({
    defaultValues: DEFAULT_PROGRESS_NOTE_CONFIG,
    resolver: zodResolver(UpdateProgressNoteConfigInputSchema),
  });
  const hasDirtyFields = Object.keys(dirtyFields).length > 0;

  useEffect(() => {
    if (!data) return;
    reset(
      {
        ...DEFAULT_PROGRESS_NOTE_CONFIG,
        ...data,
      },
      {
        keepDirtyValues: hasDirtyFields,
      }
    );
  }, [data, hasDirtyFields, reset]);

  const onSubmit = (values: ProgressNoteConfig): void => {
    mutate(values, {
      onSuccess: () => {
        reset(values);
      },
    });
  };

  return (
    <PageContainer tabTitle="Progress Note Configuration" showEnvFooter={false}>
      <Grid container direction="row" alignItems="center" justifyContent="center">
        <Grid item maxWidth="900px" width="100%">
          <Paper sx={{ padding: 3, marginTop: 2, marginBottom: 2 }}>
            <Typography variant="h5" sx={{ mb: 1 }}>
              Progress Note
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Configure how providers complete and sign progress notes for this practice.
            </Typography>

            {isPending ? (
              <Box display="flex" justifyContent="center" alignItems="center" py={3}>
                <CircularProgress />
              </Box>
            ) : isError ? (
              <Alert severity="error">Failed to load the current progress note settings.</Alert>
            ) : (
              <Box component="form" onSubmit={handleSubmit(onSubmit)}>
                <Stack spacing={3}>
                  <Box>
                    <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
                      Assessment
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Standard content used when Medical Decision Making is pre-filled for a new note.
                    </Typography>
                    <ConfigTextAreaField
                      control={control}
                      name="medicalDecisionDefaultText"
                      label="Default Medical Decision Making content"
                      minRows={4}
                    />
                  </Box>

                  <Divider />

                  <Box>
                    <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
                      Disposition
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Standard content used when these disposition options are selected.
                    </Typography>
                    <Stack spacing={2}>
                      <ConfigTextAreaField
                        control={control}
                        name="pcpNoTypeDispositionDefaultText"
                        label={mapDispositionTypeToLabel['pcp-no-type']}
                      />
                      <ConfigTextAreaField
                        control={control}
                        name="anotherDispositionDefaultText"
                        label={mapDispositionTypeToLabel.another}
                      />
                      <ConfigTextAreaField
                        control={control}
                        name="edDispositionDefaultText"
                        label={mapDispositionTypeToLabel.ed}
                      />
                    </Stack>
                  </Box>

                  <Divider />

                  <Box>
                    <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
                      Signing Requirements
                    </Typography>
                    <Controller
                      name="mdmRequired"
                      control={control}
                      render={({ field: { value, onChange } }) => (
                        <FormControlLabel
                          control={<Switch checked={value} onChange={(_event, checked) => onChange(checked)} />}
                          label="Medical Decision Making (MDM) required"
                        />
                      )}
                    />
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                    <LoadingButton
                      type="button"
                      variant="outlined"
                      disabled={isSubmitting || !isDirty}
                      onClick={() => reset({ ...DEFAULT_PROGRESS_NOTE_CONFIG, ...data })}
                    >
                      Discard changes
                    </LoadingButton>
                    <LoadingButton type="submit" variant="contained" loading={isSubmitting} disabled={!isDirty}>
                      Save
                    </LoadingButton>
                  </Box>
                </Stack>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </PageContainer>
  );
}
