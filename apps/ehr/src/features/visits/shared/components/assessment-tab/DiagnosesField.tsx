import { Autocomplete, TextField } from '@mui/material';
import { FC, useState } from 'react';
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
  /**
   * Focus the input on mount and open the dropdown with it.
   *
   * OPT-IN, not the default: the two ADD call sites render this field permanently on their pages, so
   * autofocusing would steal the caret every time one of those pages opened. It is for a field that
   * appears in response to a click — Easy Chart's in-row correction — where the click IS the request to
   * start editing.
   */
  autoFocus?: boolean;
};

export const DiagnosesField: FC<DiagnosesFieldProps> = (props) => {
  const { onChange, disabled, disableForPrimary, value, label, placeholder, error, autoFocus } = props;

  // Seeded from the initial value, so a field opened ON an existing diagnosis already has that diagnosis's
  // options loaded instead of an empty dropdown the provider has to retype into. Only the FIRST render
  // seeds it — after that the term follows what is typed, which is what a correction needs.
  //
  // The other two call sites (DiagnosesContainer, ProceduresNew) pass no `value` because they ADD a
  // diagnosis, so this changes nothing for them.
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(value?.display ?? '');
  const { isFetching: isSearching, data } = useICD10SearchNew({ search: debouncedSearchTerm });
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
      // Paired with autoFocus: focusing without this leaves the caret in a closed field, which reads as
      // nothing having happened.
      openOnFocus={autoFocus}
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
          {...params}
          autoFocus={autoFocus}
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
