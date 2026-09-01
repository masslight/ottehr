import { Alert, Box, Divider, Stack, Typography } from '@mui/material';
import { ReactElement } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { VITAL_ALERT_TYPES } from 'utils/lib/types/api/vitals-alert-config/vitals-alert-config.types';
import { AgeRangesEditor } from './AgeRangesEditor';
import { VitalsAlertConfigForm } from './useVitalsAlertConfigForm';
import { VitalAlertThresholdTable } from './VitalAlertThresholdTable';
import { collectVitalsAlertConfigErrors, getVitalsWithThresholdErrors } from './vitalsAlertConfigErrors';

interface VitalsAlertConfigFieldsProps {
  form: VitalsAlertConfigForm;
}

/** The "Vital 2 Level Alerts" fields; the surrounding progress note form owns the Save buttons. */
export const VitalsAlertConfigFields = ({ form }: VitalsAlertConfigFieldsProps): ReactElement => {
  // Gathered into one alert: cross-field rules and collapsed accordions have no inline home.
  const errorMessages = collectVitalsAlertConfigErrors(form.errors, form.ageRanges);
  const vitalsWithErrors = getVitalsWithThresholdErrors(form.errors);

  return (
    <Box data-testid={dataTestIds.vitalsAlertConfig.section}>
      <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
        Vital 2 Level Alerts
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Age-based thresholds that flag an entered vital as abnormal (orange) or critical (red). Changes apply to the
        alerts shown on charts, for vitals already recorded as well as new ones.
      </Typography>

      <Stack spacing={3}>
        {errorMessages.length > 0 && (
          <Alert severity="error" data-testid={dataTestIds.vitalsAlertConfig.errorSummary}>
            <Stack>
              {errorMessages.map((message) => (
                <span key={message}>{message}</span>
              ))}
            </Stack>
          </Alert>
        )}

        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Age ranges
          </Typography>
          <AgeRangesEditor
            control={form.control}
            ageRanges={form.ageRanges}
            rowKeys={form.rowKeys}
            onAdd={form.onAddAgeRange}
            onRemove={form.onRemoveAgeRange}
            onMaxAgeValueEntered={form.onMaxAgeValueEntered}
          />
        </Box>

        <Divider />

        <Box>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
            Alert levels
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Leave a level blank to turn off that alert for the age range.
          </Typography>
          <Stack spacing={1}>
            {VITAL_ALERT_TYPES.map((vital) => (
              <VitalAlertThresholdTable
                key={vital}
                control={form.control}
                vital={vital}
                ageRanges={form.ageRanges}
                hasErrors={vitalsWithErrors.has(vital)}
              />
            ))}
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
};
