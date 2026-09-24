import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import { ReactElement, useId } from 'react';
import { X12_ADJUSTMENT_GROUP_CODES, X12AdjustmentGroupCode } from 'utils/lib/types/data/billing/billing.constants';
import { X12_ADJUSTMENT_GROUP_LABELS } from 'utils/lib/types/data/billing/carc';

// CAS group code picker: the menu reads "CO — Contractual Obligation", the field just "CO".
export function AdjustmentGroupSelect({
  value,
  onChange,
  error,
}: {
  value: X12AdjustmentGroupCode | '';
  onChange: (value: X12AdjustmentGroupCode) => void;
  error?: boolean;
}): ReactElement {
  const labelId = useId();
  return (
    <FormControl size="small" sx={{ width: 110 }} error={error}>
      <InputLabel id={labelId}>Group</InputLabel>
      <Select
        labelId={labelId}
        label="Group"
        value={value}
        onChange={(event) => onChange(event.target.value as X12AdjustmentGroupCode)}
        renderValue={(selected) => selected}
      >
        {X12_ADJUSTMENT_GROUP_CODES.map((code) => (
          <MenuItem key={code} value={code}>
            {code} — {X12_ADJUSTMENT_GROUP_LABELS[code]}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
