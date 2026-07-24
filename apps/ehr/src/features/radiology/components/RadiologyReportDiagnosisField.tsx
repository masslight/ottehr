import { Autocomplete, TextField } from '@mui/material';
import React, { useState } from 'react';
import { useICD10SearchNew } from 'src/features/visits/shared/stores/appointment/appointment.queries';
import { useDebounce } from 'src/shared/hooks/useDebounce';

export interface RadiologyReportDiagnosis {
  code: string;
  display: string;
}

/**
 * Multi-select ICD-10 diagnosis picker used when saving a radiology preliminary read.
 * Diagnosis is optional at order time and captured here instead, so this field mirrors the
 * order form's Diagnosis autocomplete but sources its options purely from ICD-10 search.
 */
export const RadiologyReportDiagnosisField: React.FC<{
  value: RadiologyReportDiagnosis[];
  onChange: (value: RadiologyReportDiagnosis[]) => void;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
}> = ({ value, onChange, disabled, error, helperText }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const { isFetching, data } = useICD10SearchNew({ search: searchTerm });
  const options = data?.codes ?? [];
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
      id="report-select-dx"
      size="small"
      fullWidth
      filterOptions={(x) => x}
      filterSelectedOptions
      noOptionsText={noOptionsText}
      value={value}
      isOptionEqualToValue={(option, selected) => selected.code === option.code}
      onChange={(_event, selected) => onChange(selected as RadiologyReportDiagnosis[])}
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
