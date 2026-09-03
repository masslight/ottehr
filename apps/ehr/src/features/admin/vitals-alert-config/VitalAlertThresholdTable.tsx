import { Box, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { ReactElement, useEffect, useState } from 'react';
import { Control, Controller } from 'react-hook-form';
import { AccordionCard } from 'src/components/AccordionCard';
import { dataTestIds } from 'src/constants/data-test-ids';
import {
  VITAL_ALERT_LABELS,
  VITAL_ALERT_LEVEL_LABELS,
  VITAL_ALERT_LEVELS,
  VITAL_ALERT_UNITS,
  VitalAlertAgeRange,
  VitalAlertType,
  VitalsAlertConfig,
} from 'utils/lib/types/api/vitals-alert-config/vitals-alert-config.types';
import { formatVitalAlertAgeRange } from 'utils/lib/utils/vitals-alert-config';
import { parseNumberInput } from './helpers';

interface VitalAlertThresholdTableProps {
  control: Control<VitalsAlertConfig>;
  vital: VitalAlertType;
  ageRanges: VitalAlertAgeRange[];
  /** Opens the accordion when true. */
  hasErrors: boolean;
}

/**
 * AccordionCard unmounts its children while collapsed; react-hook-form retains their values, so
 * validation and the saved payload cover collapsed vitals too.
 */
export const VitalAlertThresholdTable = ({
  control,
  vital,
  ageRanges,
  hasErrors,
}: VitalAlertThresholdTableProps): ReactElement => {
  const [isCollapsed, setIsCollapsed] = useState(true);

  useEffect(() => {
    if (hasErrors) {
      setIsCollapsed(false);
    }
  }, [hasErrors]);
  const units = VITAL_ALERT_UNITS[vital];
  const label = units ? `${VITAL_ALERT_LABELS[vital]} (${units})` : VITAL_ALERT_LABELS[vital];

  return (
    <AccordionCard
      label={label}
      collapsed={isCollapsed}
      onSwitch={() => setIsCollapsed((collapsed) => !collapsed)}
      dataTestId={dataTestIds.vitalsAlertConfig.vitalAccordion(vital)}
    >
      <Box sx={{ p: 2, overflowX: 'auto' }}>
        <Table size="small" sx={{ minWidth: 560 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ minWidth: 130 }}>Age range</TableCell>
              {VITAL_ALERT_LEVELS.map((level) => (
                <TableCell key={level} align="center">
                  {VITAL_ALERT_LEVEL_LABELS[level]}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {ageRanges.map((range) => (
              <TableRow key={range.id}>
                <TableCell>
                  <Typography variant="body2">{formatVitalAlertAgeRange(range)}</Typography>
                </TableCell>
                {VITAL_ALERT_LEVELS.map((level) => (
                  <TableCell key={level} align="center">
                    <Controller
                      name={`thresholds.${vital}.${range.id}.${level}`}
                      control={control}
                      render={({ field: { value, onChange, ...field }, fieldState }) => (
                        <TextField
                          {...field}
                          value={value ?? ''}
                          onChange={(event) => onChange(parseNumberInput(event.target.value))}
                          type="number"
                          size="small"
                          inputProps={{ step: 'any', 'aria-label': `${VITAL_ALERT_LEVEL_LABELS[level]}` }}
                          sx={{ width: 96 }}
                          error={!!fieldState.error}
                          helperText={fieldState.error?.message}
                          data-testid={dataTestIds.vitalsAlertConfig.thresholdInput(vital, range.id, level)}
                        />
                      )}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </AccordionCard>
  );
};
