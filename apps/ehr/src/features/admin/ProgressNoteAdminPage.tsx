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
import { FormEvent, ReactElement, useEffect } from 'react';
import { Control, Controller, useForm } from 'react-hook-form';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useVitalsAlertConfigForm } from 'src/features/admin/vitals-alert-config/useVitalsAlertConfigForm';
import { VitalsAlertConfigFields } from 'src/features/admin/vitals-alert-config/VitalsAlertConfigFields';
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
    getValues,
    trigger,
    reset,
  } = useForm<ProgressNoteConfig>({
    defaultValues: DEFAULT_PROGRESS_NOTE_CONFIG,
    resolver: zodResolver(UpdateProgressNoteConfigInputSchema),
  });

  // Its own resource and endpoint, saved by the shared buttons below.
  const vitalsAlerts = useVitalsAlertConfigForm();

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

  const progressNoteEditable = !isPending && !isError;
  const vitalsAlertsEditable = !vitalsAlerts.isPending && !vitalsAlerts.isError;
  const anySubmitting = isSubmitting || vitalsAlerts.isSubmitting;
  const anyDirty = (progressNoteEditable && isDirty) || (vitalsAlertsEditable && vitalsAlerts.isDirty);

  const handleSave = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    // Both editable sections validate before either is written, so a Save cannot half-apply.
    const [progressNoteValid, vitalsAlertsValid] = await Promise.all([
      progressNoteEditable ? trigger() : true,
      vitalsAlertsEditable ? vitalsAlerts.validate() : true,
    ]);
    if (!progressNoteValid || !vitalsAlertsValid) return;

    if (progressNoteEditable && isDirty) {
      // getValues() bypasses the resolver, so parse to apply the schema's trims.
      const parsed = UpdateProgressNoteConfigInputSchema.safeParse(getValues());
      if (parsed.success) {
        // The prompt field is customer-support-only, and react-hook-form submits the value it loaded
        // even for a field it never rendered. Omitting it keeps this form from carrying a stale prompt
        // back to the server, where absent means "leave the stored prompt alone".
        const { signReviewPrompt: _signReviewPrompt, ...withoutPrompt } = parsed.data;
        mutate(isCustomerSupport ? parsed.data : withoutPrompt, {
          onSuccess: () => {
            reset(parsed.data);
          },
        });
      }
    }
    if (vitalsAlertsEditable && vitalsAlerts.isDirty) {
      vitalsAlerts.submit();
    }
  };

  const handleDiscard = (): void => {
    if (progressNoteEditable) {
      reset({ ...DEFAULT_PROGRESS_NOTE_CONFIG, ...data });
    }
    if (vitalsAlertsEditable) {
      vitalsAlerts.discard();
    }
  };

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Settings for how providers complete and sign progress notes
      </Typography>

      {/* Loading and error state is per section: one failing endpoint must not disable the other. */}
      <Paper component="form" onSubmit={handleSave} sx={{ p: 3 }}>
        <Stack spacing={3}>
          {isPending ? (
            <Box display="flex" justifyContent="center" alignItems="center" py={3}>
              <CircularProgress />
            </Box>
          ) : isError ? (
            <Alert severity="error">Failed to load the current progress note settings.</Alert>
          ) : (
            <>
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
            </>
          )}

          <Divider />

          {vitalsAlerts.isPending ? (
            <Box display="flex" justifyContent="center" alignItems="center" py={3}>
              <CircularProgress />
            </Box>
          ) : vitalsAlerts.isError ? (
            <Alert severity="error">Failed to load the current vital alert levels.</Alert>
          ) : (
            <VitalsAlertConfigFields form={vitalsAlerts} />
          )}

          <Divider />

          <Stack direction="row" spacing={1}>
            <LoadingButton
              type="submit"
              variant="contained"
              loading={anySubmitting}
              disabled={!anyDirty}
              data-testid={dataTestIds.progressNoteAdmin.saveButton}
            >
              Save
            </LoadingButton>
            <LoadingButton
              type="button"
              variant="outlined"
              disabled={anySubmitting || !anyDirty}
              onClick={handleDiscard}
              data-testid={dataTestIds.progressNoteAdmin.discardButton}
            >
              Discard changes
            </LoadingButton>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
