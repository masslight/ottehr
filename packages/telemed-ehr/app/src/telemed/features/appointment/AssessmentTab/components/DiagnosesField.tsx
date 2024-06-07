import React, { FC, useState } from 'react';
import { Autocomplete, TextField } from '@mui/material';
import { useDebounce } from '../../../../hooks';
import { useGetIcd10Search } from '../../../../state';
import { IcdSearchResponse } from 'ehr-utils';

type DiagnosesFieldProps = {
  onChange: (data: IcdSearchResponse['codes'][number]) => void;
  disableForPrimary: boolean;
  disabled?: boolean;
};

export const DiagnosesField: FC<DiagnosesFieldProps> = (props) => {
  const { onChange, disabled, disableForPrimary } = props;

  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const { isFetching: isSearching, data } = useGetIcd10Search(debouncedSearchTerm);
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
      blurOnSelect
      disabled={disabled}
      options={icdSearchOptions}
      value={null}
      isOptionEqualToValue={(option, value) => value.code === option.code}
      loading={isSearching}
      onChange={onInternalChange}
      getOptionLabel={(option) => (typeof option === 'string' ? option : `${option.code} ${option.display}`)}
      getOptionDisabled={(option) => disableForPrimary && option.code.startsWith('W')}
      renderInput={(params) => (
        <TextField
          {...params}
          onChange={(e) => debouncedHandleInputChange(e.target.value)}
          size="small"
          label="Search"
          placeholder="Diagnoses"
        />
      )}
    />
  );
};
