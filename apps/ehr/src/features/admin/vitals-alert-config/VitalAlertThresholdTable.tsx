import { Box, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { Fragment, ReactElement, useEffect, useState } from 'react';
import { Control, Controller, useWatch } from 'react-hook-form';
import { AccordionCard } from 'src/components/AccordionCard';
import { dataTestIds } from 'src/constants/data-test-ids';
import {
  VITAL_ALERT_LABELS,
  VITAL_ALERT_LEVEL_LABELS,
  VITAL_ALERT_LEVELS_BY_TYPE,
  VITAL_ALERT_UNITS,
  VitalAlertAgeRange,
  VitalAlertType,
  VitalsAlertConfig,
} from 'utils/lib/types/api/vitals-alert-config/vitals-alert-config.types';
import { formatVitalAlertAgeRange, formatVitalNormalRange } from 'utils/lib/utils/vitals-alert-config';
import { parseNumberInput } from './helpers';

const NORMAL_RANGE_AFTER_LEVEL = 'abnormalLow';

const AGE_RANGE_COLUMN_MIN_WIDTH = 130;
const LEVEL_COLUMN_MIN_WIDTH = 110;
const NORMAL_RANGE_COLUMN_MIN_WIDTH = 120;

interface NormalRangeCellProps {
  control: Control<VitalsAlertConfig>;
  vital: VitalAlertType;
  rangeId: string;
}

const NormalRangeCell = ({ control, vital, rangeId }: NormalRangeCellProps): ReactElement => {
  const levels = useWatch({ control, name: `thresholds.${vital}.${rangeId}` });

  return (
    <TableCell align="center" data-testid={dataTestIds.vitalsAlertConfig.normalRangeCell(vital, rangeId)}>
      <Typography variant="body2" color="text.primary" sx={{ whiteSpace: 'nowrap' }}>
        {formatVitalNormalRange(levels ?? {}, vital)}
      </Typography>
    </TableCell>
  );
};

interface VitalAlertThresholdTableProps {
  control: Control<VitalsAlertConfig>;
  vital: VitalAlertType;
  ageRanges: VitalAlertAgeRange[];
  hasErrors: boolean;
}

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
  const levels = VITAL_ALERT_LEVELS_BY_TYPE[vital];
  const tableMinWidth =
    AGE_RANGE_COLUMN_MIN_WIDTH + levels.length * LEVEL_COLUMN_MIN_WIDTH + NORMAL_RANGE_COLUMN_MIN_WIDTH;

  return (
    <AccordionCard
      label={label}
      collapsed={isCollapsed}
      onSwitch={() => setIsCollapsed((collapsed) => !collapsed)}
      dataTestId={dataTestIds.vitalsAlertConfig.vitalAccordion(vital)}
    >
      <Box sx={{ p: 2, overflowX: 'auto' }}>
        <Table size="small" sx={{ width: 'auto', minWidth: tableMinWidth }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ minWidth: AGE_RANGE_COLUMN_MIN_WIDTH }}>Age range</TableCell>
              {levels.map((level) => (
                <Fragment key={level}>
                  <TableCell align="center" sx={{ minWidth: LEVEL_COLUMN_MIN_WIDTH }}>
                    {VITAL_ALERT_LEVEL_LABELS[level]}
                  </TableCell>
                  {level === NORMAL_RANGE_AFTER_LEVEL && (
                    <TableCell align="center" sx={{ minWidth: NORMAL_RANGE_COLUMN_MIN_WIDTH }}>
                      Normal range
                    </TableCell>
                  )}
                </Fragment>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {ageRanges.map((range) => (
              <TableRow key={range.id}>
                <TableCell>
                  <Typography variant="body2">{formatVitalAlertAgeRange(range)}</Typography>
                </TableCell>
                {levels.map((level) => (
                  <Fragment key={level}>
                    <TableCell align="center">
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
                    {level === NORMAL_RANGE_AFTER_LEVEL && (
                      <NormalRangeCell control={control} vital={vital} rangeId={range.id} />
                    )}
                  </Fragment>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </AccordionCard>
  );
};
