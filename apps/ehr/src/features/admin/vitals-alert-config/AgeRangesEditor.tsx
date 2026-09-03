import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { Box, Button, IconButton, MenuItem, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { ReactElement } from 'react';
import { Control, Controller } from 'react-hook-form';
import { ConfirmationDialog } from 'src/components/ConfirmationDialog';
import { dataTestIds } from 'src/constants/data-test-ids';
import { VitalsAgeUnitSchema } from 'utils/lib/config-helpers/vitals';
import {
  MAX_VITAL_ALERT_AGE_RANGES,
  VitalAlertAgeRange,
  VitalsAlertConfig,
} from 'utils/lib/types/api/vitals-alert-config/vitals-alert-config.types';
import { formatVitalAlertAgeRange } from 'utils/lib/utils/vitals-alert-config';
import { parseNumberInput } from './helpers';

const AGE_UNITS = VitalsAgeUnitSchema.options;

const AgeRangeRemovalDescription = ({
  ageRanges,
  index,
}: {
  ageRanges: VitalAlertAgeRange[];
  index: number;
}): ReactElement => {
  const range = ageRanges[index];
  const label = range ? formatVitalAlertAgeRange(range) : '';

  return (
    <Stack spacing={1} data-testid={dataTestIds.vitalsAlertConfig.removeAgeRangeDescription}>
      <Typography variant="body2">
        <strong>{label}</strong> will be removed, along with its alert levels for all vitals.
      </Typography>
      <Typography variant="body2">
        Patients aged <strong>{label}</strong> will then have no configured alerts for any vital, so their readings will
        not be flagged as abnormal or critical.
      </Typography>
      <Typography variant="body2" color="text.secondary">
        The other age ranges keep their own boundaries and alert levels — none of them is widened to cover this span.
        Nothing is saved until you press Save.
      </Typography>
    </Stack>
  );
};

interface AgeRangesEditorProps {
  control: Control<VitalsAlertConfig>;
  ageRanges: VitalAlertAgeRange[];
  rowKeys: string[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onMaxAgeValueEntered: (index: number) => void;
}

export const AgeRangesEditor = ({
  control,
  ageRanges,
  rowKeys,
  onAdd,
  onRemove,
  onMaxAgeValueEntered,
}: AgeRangesEditorProps): ReactElement => {
  const atMax = ageRanges.length >= MAX_VITAL_ALERT_AGE_RANGES;

  return (
    <Stack spacing={1.5}>
      <Typography variant="body2" color="text.secondary">
        Ranges must run in order and must not overlap. Gaps are allowed: an age not covered by any range has no
        configured alerts, so readings for those patients are not flagged. Leave the last range’s end age blank to make
        it open-ended. Up to {MAX_VITAL_ALERT_AGE_RANGES} ranges.
      </Typography>

      <Stack spacing={1}>
        {ageRanges.map((range, index) => {
          const isLast = index === ageRanges.length - 1;
          return (
            <Stack
              key={rowKeys[index] ?? range.id}
              direction="row"
              spacing={1}
              alignItems="flex-start"
              data-testid={dataTestIds.vitalsAlertConfig.ageRangeRow(index)}
            >
              <Controller
                name={`ageRanges.${index}.minAge.value`}
                control={control}
                render={({ field: { value, onChange, ...field }, fieldState }) => (
                  <TextField
                    {...field}
                    value={value ?? ''}
                    onChange={(event) => onChange(parseNumberInput(event.target.value))}
                    type="number"
                    size="small"
                    label="From"
                    sx={{ width: 96 }}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
              <Controller
                name={`ageRanges.${index}.minAge.unit`}
                control={control}
                render={({ field, fieldState }) => (
                  <TextField {...field} select size="small" label="Unit" sx={{ width: 110 }} error={!!fieldState.error}>
                    {AGE_UNITS.map((unit) => (
                      <MenuItem key={unit} value={unit}>
                        {unit}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />

              <Box sx={{ pt: 1.25 }}>
                <Typography variant="body2" color="text.secondary">
                  to
                </Typography>
              </Box>

              <Controller
                name={`ageRanges.${index}.maxAge.value`}
                control={control}
                render={({ field: { value, onChange, ...field }, fieldState }) => (
                  <TextField
                    {...field}
                    value={value ?? ''}
                    onChange={(event) => {
                      const parsed = parseNumberInput(event.target.value);
                      onChange(parsed);
                      if (parsed !== undefined) {
                        onMaxAgeValueEntered(index);
                      }
                    }}
                    type="number"
                    size="small"
                    label="To"
                    placeholder={isLast ? 'and older' : undefined}
                    sx={{ width: 110 }}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
              <Controller
                name={`ageRanges.${index}.maxAge.unit`}
                control={control}
                render={({ field: { value, ...field }, fieldState }) => (
                  <TextField
                    {...field}
                    // Matches the unit committed when a "To" value is first entered.
                    value={value ?? range.minAge?.unit ?? 'years'}
                    select
                    size="small"
                    label="Unit"
                    sx={{ width: 110 }}
                    error={!!fieldState.error}
                  >
                    {AGE_UNITS.map((unit) => (
                      <MenuItem key={unit} value={unit}>
                        {unit}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />

              <ConfirmationDialog
                title="Remove this age range?"
                description={<AgeRangeRemovalDescription ageRanges={ageRanges} index={index} />}
                response={() => onRemove(index)}
                actionButtons={{ proceed: { text: 'Remove', color: 'error' }, back: { text: 'Cancel' } }}
              >
                {(showDialog) => (
                  <Tooltip title={ageRanges.length === 1 ? 'At least one age range is required' : 'Remove age range'}>
                    <span>
                      <IconButton
                        aria-label="Remove age range"
                        disabled={ageRanges.length === 1}
                        onClick={showDialog}
                        data-testid={dataTestIds.vitalsAlertConfig.removeAgeRangeButton(index)}
                      >
                        <DeleteOutlineIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                )}
              </ConfirmationDialog>
            </Stack>
          );
        })}
      </Stack>

      <Box>
        <Tooltip title={atMax ? `A maximum of ${MAX_VITAL_ALERT_AGE_RANGES} age ranges is supported` : ''}>
          <span>
            <Button
              startIcon={<AddIcon />}
              onClick={onAdd}
              disabled={atMax}
              data-testid={dataTestIds.vitalsAlertConfig.addAgeRangeButton}
            >
              Add age range
            </Button>
          </span>
        </Tooltip>
      </Box>
    </Stack>
  );
};
