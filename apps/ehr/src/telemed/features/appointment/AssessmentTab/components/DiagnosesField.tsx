import { FC, useState } from 'react';
import { Autocomplete, TextField } from '@mui/material';
import { useDebounce } from '../../../../hooks';
import { useGetIcd10Search } from '../../../../state';
import { IcdSearchResponse } from 'utils';
import { FieldError } from 'react-hook-form';
import { dataTestIds } from '../../../../../constants/data-test-ids';

type DiagnosesFieldProps = {
  onChange: (data: IcdSearchResponse['codes'][number]) => void;
  disableForPrimary: boolean;
  disabled?: boolean;
  value?: IcdSearchResponse['codes'][number] | null;
  label?: string;
  placeholder?: string;
  error?: FieldError;
};

export const DiagnosesField: FC<DiagnosesFieldProps> = (props) => {
  const { onChange, disabled, disableForPrimary, value, label, placeholder, error } = props;

  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const { isFetching: isSearching, data } = useGetIcd10Search({ search: debouncedSearchTerm, sabs: 'ICD10CM' });
  const icdSearchOptions = data?.codes || [];

  const { debounce } = useDebounce(800);

  const debouncedHandleInputChange = (data: string): void => {
    debounce(() => {
      setDebouncedSearchTerm(data);
    });
  };

  const onInternalChange = (_e: unknown, data: IcdSearchResponse['codes'][number] | null): void => {
    if (data) {
      onChange(data);
    }
  };

  return (
    <Autocomplete
      fullWidth
      blurOnSelect
      disabled={disabled}
      options={icdSearchOptions}
      noOptionsText={
        debouncedSearchTerm && icdSearchOptions.length === 0
          ? 'Nothing found for this search criteria'
          : 'Start typing to load results'
      }
      autoComplete
      includeInputInList
      disableClearable
      filterOptions={(x) => x}
      value={value || (null as unknown as undefined)}
      isOptionEqualToValue={(option, value) => value.code === option.code}
      loading={isSearching}
      onChange={onInternalChange}
      getOptionLabel={(option) => (typeof option === 'string' ? option : `${option.code} ${option.display}`)}
      getOptionDisabled={(option) => disableForPrimary && option.code.startsWith('W')}
      renderInput={(params) => (
        <TextField
          data-testid={dataTestIds.assessmentPage.diagnosisDropdown}
          {...params}
          onChange={(e) => debouncedHandleInputChange(e.target.value)}
          size="small"
          label={label || 'Search'}
          placeholder={placeholder || 'Diagnoses'}
          helperText={error ? error.message : null}
          error={!!error}
        />
      )}
    />
  );
};
