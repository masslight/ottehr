import { Paper, Typography } from '@mui/material';
import React from 'react';
import { formatValue, ValueFormat } from './format';

export interface KpiProps {
  label: string;
  value: unknown;
  /** integer | number | percent | currency */
  format?: ValueFormat;
}

/** One KPI card. Compose several in a flex row (e.g. <MUI.Stack direction="row" …>). */
export function Kpi({ label, value, format }: KpiProps): React.ReactElement {
  return (
    <Paper variant="outlined" sx={{ p: 2, minWidth: 160, flex: '1 1 160px' }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h5" fontWeight={600}>
        {formatValue(value, format)}
      </Typography>
    </Paper>
  );
}
