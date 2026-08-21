// The hospitalization picker, extracted from HospitalizationForm so it can be reused.
//
// One picker, one option list, one sort order. Easy Chart needs to offer this list on a charted row, and a
// second copy there would drift — a differently sorted list, or one missing whatever gets added to
// HospitalizationOptions next.

import { Autocomplete, TextField, Typography } from '@mui/material';
import { FC, useMemo } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { HospitalizationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { HospitalizationOptions } from './hospitalizationOptions';

export interface HospitalizationFieldProps {
  onChange: (value: HospitalizationDTO | null) => void;
  /** The charted row, for an EDIT. Omitted by the add field, which must stay empty after each pick. */
  value?: HospitalizationDTO | null;
  disabled?: boolean;
  /** See DiagnosesField: opt-in, for a field that appears in response to a click. */
  autoFocus?: boolean;
  /**
   * Offer "Other", which the caller completes with a free-text name.
   *
   * ON for the page, which has room for the follow-up text field and an Add button. OFF for an in-row
   * editor, which does not — offering a branch that cannot be finished is worse than not offering it, and a
   * custom entry can still be made on the Hospitalization page.
   */
  includeOther?: boolean;
}

export const HospitalizationField: FC<HospitalizationFieldProps> = ({
  onChange,
  value,
  disabled,
  autoFocus,
  includeOther = true,
}) => {
  const options = useMemo(() => {
    const sorted = [...HospitalizationOptions].sort((a, b) =>
      a.display.toLowerCase().localeCompare(b.display.toLowerCase())
    );
    return includeOther ? [...sorted, { display: 'Other', code: 'other' }] : sorted;
  }, [includeOther]);

  // A charted row's own value may not be in the catalogue at all — anything added through "Other" reads as
  // `Other (…)`. Appending it keeps Autocomplete from warning about a value outside its options and keeps
  // the field showing what is actually charted.
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
      // Paired with autoFocus: focusing without this leaves the caret in a closed field, which reads as
      // nothing having happened.
      openOnFocus={autoFocus}
      disabled={disabled}
      options={withValue}
      noOptionsText="Nothing found for this search criteria"
      getOptionLabel={(option) => `${option.display}`}
      renderOption={(props, option) => (
        <li {...props}>
          <Typography component="span"> {option.display} </Typography>
        </li>
      )}
      isOptionEqualToValue={(option, selected) => option.code === selected.code}
      renderInput={(params) => (
        <TextField
          {...params}
          autoFocus={autoFocus}
          data-testid={dataTestIds.hospitalizationPage.hospitalizationDropdown}
          label="Hospitalization"
          placeholder="Search"
          InputLabelProps={{ shrink: true }}
          sx={{ '& .MuiInputLabel-root': { fontWeight: 'bold' } }}
        />
      )}
    />
  );
};
