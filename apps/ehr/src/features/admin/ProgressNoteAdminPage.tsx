import { zodResolver } from '@hookform/resolvers/zod';
import { LoadingButton } from '@mui/lab';
import {
  Alert,
  Box,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { ReactElement, useEffect } from 'react';
import { Control, Controller, useForm } from 'react-hook-form';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { useProgressNoteConfig, useUpdateProgressNoteConfig } from 'src/hooks/useProgressNoteConfig';
import { mapDispositionTypeToLabel } from 'utils/lib/fhir/disposition';
import {
  ProgressNoteConfig,
  UpdateProgressNoteConfigInputSchema,
  VITALS_UNIT_INPUT_ORDER_LABELS,
  VITALS_UNIT_INPUT_ORDERS,
} from 'utils/lib/types/api/progress-note-config/progress-note-config.types';
import { RoleType } from 'utils/lib/types/api/user.types';
import { DEFAULT_PROGRESS_NOTE_CONFIG } from 'utils/lib/utils/progress-note-config';

type ProgressNoteTextFieldName = Exclude<keyof ProgressNoteConfig, 'mdmRequired' | 'vitalsUnitInputOrder'>;

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
  const isCustomerSupport = useEvolveUser()?.hasRole([RoleType.CustomerSupport]) ?? false;

  const {
    control,
    formState: { isDirty },
    handleSubmit,
    reset,
  } = useForm<ProgressNoteConfig>({
    defaultValues: DEFAULT_PROGRESS_NOTE_CONFIG,
    resolver: zodResolver(UpdateProgressNoteConfigInputSchema),
  });

  useEffect(() => {
    if (!data) return;
    reset(
      {
        ...DEFAULT_PROGRESS_NOTE_CONFIG,
        ...data,
      },
      { keepDirtyValues: true }
    );
  }, [data, reset]);

  const onSubmit = (values: ProgressNoteConfig): void => {
    mutate(values, {
      onSuccess: () => {
        reset(values);
      },
    });
  };

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Settings for how providers complete and sign progress notes
      </Typography>

      {isPending ? (
        <Box display="flex" justifyContent="center" alignItems="center" py={3}>
          <CircularProgress />
        </Box>
      ) : isError ? (
        <Alert severity="error">Failed to load the current progress note settings.</Alert>
      ) : (
        <Paper component="form" onSubmit={handleSubmit(onSubmit)} sx={{ p: 3 }}>
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
                Default content displayed when a disposition option is selected
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
              <Controller
                name="mdmRequired"
                control={control}
                render={({ field: { value, onChange } }) => (
                  <FormControlLabel
                    control={<Switch checked={value} onChange={(_event, checked) => onChange(checked)} />}
                    label="MDM required for sign and close"
                  />
                )}
              />
            </Box>

            <Divider />

            <Box>
              <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
                Vitals
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Order of the unit input fields when a vital is entered (e.g. weight, height, temperature)
              </Typography>
              <Controller
                name="vitalsUnitInputOrder"
                control={control}
                render={({ field: { value, onChange } }) => (
                  <FormControl fullWidth>
                    <InputLabel id="vitals-unit-input-order-label">Vital measurement unit input order</InputLabel>
                    <Select
                      labelId="vitals-unit-input-order-label"
                      label="Vital measurement unit input order"
                      value={value}
                      onChange={(event) => onChange(event.target.value)}
                    >
                      {VITALS_UNIT_INPUT_ORDERS.map((order) => (
                        <MenuItem key={order} value={order}>
                          {VITALS_UNIT_INPUT_ORDER_LABELS[order]}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              />
            </Box>

            {/* Field is hidden for non-CustomerSupport users, but its value still round-trips unchanged:
                react-hook-form submits values carried in defaultValues/reset even when the field is never rendered. */}
            {isCustomerSupport && (
              <>
                <Divider />
                <Box>
                  <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
                    Note review at signing
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Requirements checked against the note when a provider opens Review &amp; Sign. Anything not met is
                    shown to the provider as an informational warning — it never blocks signing. Write it as
                    instructions to a reviewer, e.g. &quot;Confirm at least 4 ROS systems are documented with at least
                    one item each&quot;. Leave blank to turn the review off.
                  </Typography>
                  <ConfigTextAreaField
                    control={control}
                    name="signReviewPrompt"
                    label="Note review requirements"
                    minRows={4}
                  />
                </Box>
              </>
            )}

            <Divider />

            <Stack direction="row" spacing={1}>
              <LoadingButton type="submit" variant="contained" loading={isSubmitting} disabled={!isDirty}>
                Save
              </LoadingButton>
              <LoadingButton
                type="button"
                variant="outlined"
                disabled={isSubmitting || !isDirty}
                onClick={() => reset({ ...DEFAULT_PROGRESS_NOTE_CONFIG, ...data })}
              >
                Discard changes
              </LoadingButton>
            </Stack>
          </Stack>
        </Paper>
      )}
    </Box>
  );
}
