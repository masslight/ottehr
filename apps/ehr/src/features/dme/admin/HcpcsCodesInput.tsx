import { Autocomplete, debounce, TextField } from '@mui/material';
import { FC, useEffect, useMemo, useState } from 'react';
import { useGetCPTHCPCSSearch } from 'src/features/visits/shared/stores/appointment/appointment.queries';
import { formatDmeBillingCode } from 'utils/lib/types/api/dme.types';

export interface HcpcsCode {
  code: string;
  display: string;
}

interface HcpcsCodesInputProps {
  value: HcpcsCode[];
  onChange: (codes: HcpcsCode[]) => void;
  disabled?: boolean;
  dataTestId?: string;
}

export const HcpcsCodesInput: FC<HcpcsCodesInputProps> = ({ value, onChange, disabled, dataTestId }) => {
  const [inputValue, setInputValue] = useState('');
  const [search, setSearch] = useState('');

  const debouncedSetSearch = useMemo(() => debounce((term: string) => setSearch(term.trim()), 800), []);
  useEffect(() => () => debouncedSetSearch.clear(), [debouncedSetSearch]);

  const { data, isFetching } = useGetCPTHCPCSSearch({ search, type: 'hcpcs' });

  // selected codes stay in the options so MUI can match them; filterSelectedOptions hides them from the list
  const options = useMemo(() => {
    const results = search ? data?.codes ?? [] : [];
    return [
      ...value,
      ...results
        .filter((result) => !value.some((selected) => selected.code === result.code))
        .map(({ code, display }) => ({ code, display })),
    ];
  }, [data, search, value]);

  return (
    <Autocomplete
      multiple
      filterSelectedOptions
      fullWidth
      data-testid={dataTestId}
      options={options}
      value={value}
      disabled={disabled}
      loading={isFetching}
      filterOptions={(x) => x}
      inputValue={inputValue}
      onInputChange={(_e, newValue, reason) => {
        setInputValue(newValue);
        if (reason === 'input') {
          debouncedSetSearch(newValue);
          return;
        }
        debouncedSetSearch.clear();
        setSearch('');
      }}
      onChange={(_e, codes) => onChange(codes)}
      getOptionLabel={(option) => formatDmeBillingCode(option)}
      isOptionEqualToValue={(option, selected) => option.code === selected.code}
      noOptionsText={search && !isFetching ? 'Nothing found' : 'Start typing to search'}
      ChipProps={{ size: 'small' }}
      renderInput={(params) => (
        <TextField
          {...params}
          label="HCPCS code(s)"
          placeholder={value.length ? undefined : 'Search by code or description'}
          helperText="The A/E/K/L code that describes the equipment itself, not the procedure to fit or apply it"
          InputLabelProps={{ shrink: true }}
        />
      )}
    />
  );
};
