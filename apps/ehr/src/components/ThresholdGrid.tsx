import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
} from '@mui/material';
import { ReactElement, useState } from 'react';

type Metric = 'Systolic' | 'Diastolic' | 'Glucose' | 'Weight (in pounds)';

interface ThresholdRow {
  metric: Metric;
  baseline: string;
  variance: string;
}

export function ThresholdsTable(): ReactElement {
  const [rows, setRows] = useState<ThresholdRow[]>([
    { metric: 'Systolic', baseline: '', variance: '' },
    { metric: 'Diastolic', baseline: '', variance: '' },
    { metric: 'Glucose', baseline: '', variance: '' },
    { metric: 'Weight (in pounds)', baseline: '', variance: '' },
  ]);

  const [touched, setTouched] = useState<Record<number, boolean>>({});

  const handleChange = (index: number, field: 'baseline' | 'variance', value: string): void => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const handleBlur = (index: number): void => {
    setTouched((prev) => ({ ...prev, [index]: true }));
  };

  const VALIDATION_RULES: Record<Metric, { min: number; max: number; message: string }> = {
    Systolic: { min: 70, max: 250, message: 'Systolic must be between 70–250 mmHg' },
    Diastolic: { min: 40, max: 150, message: 'Diastolic must be between 40–150 mmHg' },
    Glucose: { min: 50, max: 500, message: 'Glucose must be between 50–500 mg/dL' },
    'Weight (in pounds)': { min: 30, max: 600, message: 'Weight must be between 30–600 lbs' },
  };

  const getRange = (baselineStr: string, varianceStr: string): any => {
    const baseline = parseFloat(baselineStr);
    const variance = parseFloat(varianceStr);
    if (isNaN(baseline) || isNaN(variance)) return '-';

    const delta = (baseline * variance) / 100;
    const min = baseline - delta;
    const max = baseline + delta;
    return `${min.toFixed(1)} - ${max.toFixed(1)}`;
  };

  return (
    <Box>
      <TableContainer component={Paper} sx={{ border: 'none', boxShadow: 'none' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold', py: 0.7, px: 2 }}>Metric</TableCell>
              <TableCell sx={{ fontWeight: 'bold', py: 0.7, px: 2 }}>Baseline</TableCell>
              <TableCell sx={{ fontWeight: 'bold', py: 0.7, px: 2 }}>Variance (%)</TableCell>
              <TableCell sx={{ fontWeight: 'bold', py: 0.7, px: 7 }}>Range</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, index): JSX.Element => {
              const baselineNum = parseFloat(row.baseline);
              const rules = VALIDATION_RULES[row.metric];
              const hasError =
                touched[index] &&
                row.baseline !== '' &&
                (isNaN(baselineNum) || baselineNum < rules.min || baselineNum > rules.max);

              return (
                <TableRow key={row.metric}>
                  <TableCell sx={{ py: 0.7, px: 2 }}>{row.metric}</TableCell>

                  <TableCell sx={{ py: 0.7, px: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <TextField
                        type="number"
                        size="small"
                        placeholder={`Enter ${row.metric} baseline`}
                        value={row.baseline}
                        error={hasError}
                        onChange={(e) => handleChange(index, 'baseline', e.target.value)}
                        onBlur={() => handleBlur(index)}
                      />
                      {hasError && (
                        <Tooltip title={rules.message}>
                          <ErrorOutlineIcon color="error" fontSize="small" style={{ marginLeft: 6 }} />
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>

                  <TableCell sx={{ py: 0.7, px: 2 }}>
                    <TextField
                      type="number"
                      size="small"
                      inputProps={{ min: 0, max: 100 }}
                      placeholder="Variance"
                      value={row.variance}
                      sx={{ minWidth: 120 }}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        if (newValue === '' || (/^\d+$/.test(newValue) && +newValue >= 0 && +newValue <= 100)) {
                          handleChange(index, 'variance', newValue);
                        }
                      }}
                    />
                  </TableCell>

                  <TableCell sx={{ py: 0.7, px: 2, minWidth: 120 }}>{getRange(row.baseline, row.variance)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
