import { Autocomplete, TextField } from '@mui/material';
import React, { useState } from 'react';
import { useICD10SearchNew } from 'src/features/visits/shared/stores/appointment/appointment.queries';
import { useDebounce } from 'src/shared/hooks/useDebounce';

export interface RadiologyDiagnosis {
  code: string;
  display: string;
}

/**
 * Multi-select ICD-10 diagnosis picker shared by the radiology order forms (diagnosis is optional at
 * order time) and the preliminary-read entry on the order details page (where it is required). Owns
 * its own ICD-10 search; pass `quickPickOptions` to surface a known set of diagnoses (e.g. the
 * encounter's charted diagnoses) while the search box is empty.
 */
export const RadiologyDiagnosisField: React.FC<{
  value: RadiologyDiagnosis[];
  onChange: (value: RadiologyDiagnosis[]) => void;
  quickPickOptions?: RadiologyDiagnosis[];
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
}> = ({ value, onChange, quickPickOptions, disabled, error, helperText }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const { isFetching, data } = useICD10SearchNew({ search: searchTerm });
  const options: RadiologyDiagnosis[] = searchTerm === '' && quickPickOptions ? quickPickOptions : data?.codes ?? [];
  const { debounce } = useDebounce(800);

  const onInputChange = (input: string): void => {
    debounce(() => setSearchTerm(input));
  };

  const noOptionsText =
    searchTerm && options.length === 0 ? 'Nothing found for this search criteria' : 'Start typing to load results';

  return (
    <Autocomplete
      multiple
      disableCloseOnSelect
      id="select-dx"
      size="small"
      fullWidth
      filterOptions={(x) => x}
      filterSelectedOptions
      noOptionsText={noOptionsText}
      value={value}
      isOptionEqualToValue={(option, selected) => selected.code === option.code}
      onChange={(_event, selected) => onChange(selected as RadiologyDiagnosis[])}
      loading={isFetching}
      options={options}
      disabled={disabled}
      getOptionLabel={(option) => (typeof option === 'string' ? option : `${option.code} ${option.display}`)}
      renderInput={(params) => (
        <TextField
          {...params}
          onChange={(e) => onInputChange(e.target.value)}
          label="Diagnosis"
          placeholder="Select diagnosis from list or search"
          multiline
          error={error}
          helperText={helperText}
          InputLabelProps={{ shrink: true }}
        />
      )}
    />
  );
};
