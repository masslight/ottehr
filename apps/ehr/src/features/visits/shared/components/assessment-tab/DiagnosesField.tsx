import { Autocomplete, TextField } from '@mui/material';
import { FC, useEffect, useRef, useState } from 'react';
import { FieldError } from 'react-hook-form';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useDebounce } from 'src/shared/hooks/useDebounce';
import { IcdSearchResponse } from 'utils/lib/types/api/icd-search/icd-search.types';
import { useICD10SearchNew } from '../../stores/appointment/appointment.queries';

type DiagnosesFieldProps = {
  onChange: (data: IcdSearchResponse['codes'][number]) => void;
  disableForPrimary: boolean;
  disabled?: boolean;
  value?: IcdSearchResponse['codes'][number] | null;
  label?: string;
  placeholder?: string;
  error?: FieldError;
  /** A known set of diagnoses (e.g. the encounter's charted ones) offered while the search box is empty. */
  quickPickOptions?: IcdSearchResponse['codes'];
};

export const DiagnosesField: FC<DiagnosesFieldProps> = (props) => {
  const { onChange, disabled, disableForPrimary, value, label, placeholder, error, quickPickOptions } = props;

  const [inputText, setInputText] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const { isFetching: isSearching, isPlaceholderData, data } = useICD10SearchNew({ search: debouncedSearchTerm });
  const waitingForSearch = inputText !== debouncedSearchTerm || isSearching || isPlaceholderData;
  const icdSearchOptions = inputText === '' ? quickPickOptions ?? [] : waitingForSearch ? [] : data?.codes ?? [];

  const { debounce, clear } = useDebounce(800);
  const clearRef = useRef(clear);
  clearRef.current = clear;
  useEffect(() => () => clearRef.current(), []);

  const debouncedHandleInputChange = (data: string): void => {
    setInputText(data);
    debounce(() => {
      setDebouncedSearchTerm(data);
    });
  };

  const onInternalChange = (_e: unknown, data: IcdSearchResponse['codes'][number] | null): void => {
    if (data) {
      onChange(data);
      clear();
      setInputText('');
      setDebouncedSearchTerm('');
    }
  };

  return (
    <Autocomplete
      fullWidth
      blurOnSelect
      disabled={disabled}
      options={icdSearchOptions}
      openOnFocus={quickPickOptions != null}
      noOptionsText={
        inputText && !waitingForSearch && icdSearchOptions.length === 0
          ? 'Nothing found for this search criteria'
          : 'Start typing to load results'
      }
      autoComplete
      includeInputInList
      disableClearable
      filterOptions={(x) => x}
      value={value || (null as unknown as undefined)}
      isOptionEqualToValue={(option, value) => value.code === option.code}
      loading={Boolean(inputText) && waitingForSearch}
      onChange={onInternalChange}
      getOptionLabel={(option) => (typeof option === 'string' ? option : `${option.code} ${option.display}`)}
      getOptionDisabled={(option) => disableForPrimary && option.code.startsWith('W')}
      renderInput={(params) => (
        <TextField
          {...params}
          data-testid={dataTestIds.diagnosisContainer.diagnosisDropdown}
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
