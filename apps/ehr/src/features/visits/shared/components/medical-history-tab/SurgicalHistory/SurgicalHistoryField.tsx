// The surgery picker, extracted from ProceduresForm so it can be reused.
//
// Same reason as HospitalizationField: one option list with one label format (`code display`), so a
// correction on Easy Chart's note offers exactly what the Surgical History page offers.

import { Autocomplete, TextField, Typography } from '@mui/material';
import { FC, useMemo } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { SURGICAL_HISTORY_OPTIONS } from './surgicalHistoryOptions';

/** One catalogue row, and the shape a charted surgery is stored in. */
export interface SurgicalHistoryOption {
  code: string;
  display: string;
}

export interface SurgicalHistoryFieldProps {
  onChange: (value: SurgicalHistoryOption | null) => void;
  /** The charted row, for an EDIT. Omitted by the add field, which must stay empty after each pick. */
  value?: SurgicalHistoryOption | null;
  disabled?: boolean;
  /** See DiagnosesField: opt-in, for a field that appears in response to a click. */
  autoFocus?: boolean;
  /**
   * Offer "Other", which the caller completes with a free-text name. OFF for an in-row editor, which has
   * nowhere to put the follow-up text field — see HospitalizationField.
   */
  includeOther?: boolean;
}

export const SurgicalHistoryField: FC<SurgicalHistoryFieldProps> = ({
  onChange,
  value,
  disabled,
  autoFocus,
  includeOther = true,
}) => {
  // "Other" is already IN the shared list, so this filters rather than appends.
  const options = useMemo(
    () => (includeOther ? SURGICAL_HISTORY_OPTIONS : SURGICAL_HISTORY_OPTIONS.filter((o) => o.display !== 'Other')),
    [includeOther]
  );

  // A row added through "Other" is not in the catalogue; keep it so the field shows what is charted.
  const withValue = useMemo(
    () => (value && !options.some((option) => option.code === value.code) ? [value, ...options] : options),
    [options, value]
  );

  return (
    <Autocomplete
      value={value ?? null}
      onChange={(_event, selected) => onChange(selected)}
      fullWidth
      size="small"
      // Paired with autoFocus: focusing without this leaves the caret in a closed field.
      openOnFocus={autoFocus}
      disabled={disabled}
      options={withValue}
      noOptionsText="Nothing found for this search criteria"
      getOptionLabel={(option) => `${option.code} ${option.display}`}
      renderOption={(props, option) => (
        <li data-testid={dataTestIds.surgicalHistory.surgicalHistoryOption} {...props}>
          <Typography component="span">
            {option.code} {option.display}
          </Typography>
        </li>
      )}
      isOptionEqualToValue={(option, selected) => option.code === selected.code}
      renderInput={(params) => (
        <TextField
          {...params}
          autoFocus={autoFocus}
          label="Surgery"
          placeholder="Search"
          InputLabelProps={{ shrink: true }}
          data-testid={dataTestIds.surgicalHistory.surgicalHistoryInput}
          sx={{ '& .MuiInputLabel-root': { fontWeight: 'bold' } }}
        />
      )}
    />
  );
};
