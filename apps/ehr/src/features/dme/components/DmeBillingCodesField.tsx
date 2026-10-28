import { Autocomplete, TextField } from '@mui/material';
import React, { useState } from 'react';
import { useGetCPTHCPCSSearch } from 'src/features/visits/shared/stores/appointment/appointment.queries';
import { useDebounce } from 'src/shared/hooks/useDebounce';
import { CPTCodeDTO } from 'utils/lib/types/api/chart-data/chart-data.types';

interface DmeBillingCodesFieldProps {
  value: CPTCodeDTO[];
  onChange: (value: CPTCodeDTO[]) => void;
  disabled?: boolean;
  dataTestId?: string;
}

export const DmeBillingCodesField: React.FC<DmeBillingCodesFieldProps> = ({
  value,
  onChange,
  disabled,
  dataTestId,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const { isFetching, data } = useGetCPTHCPCSSearch({ search: searchTerm, type: 'both' });
  const options: CPTCodeDTO[] = searchTerm ? data?.codes ?? [] : [];
  const { debounce } = useDebounce(800);

  const noOptionsText =
    searchTerm && options.length === 0 ? 'Nothing found for this search criteria' : 'Start typing to load results';

  return (
    <Autocomplete
      multiple
      id="select-dme-billing-codes"
      size="small"
      fullWidth
      filterOptions={(x) => x}
      filterSelectedOptions
      noOptionsText={noOptionsText}
      value={value}
      options={options}
      loading={isFetching}
      disabled={disabled}
      isOptionEqualToValue={(option, selected) => option.code === selected.code}
      getOptionLabel={(option) => `${option.code} ${option.display}`}
      onChange={(_event, selected) => onChange(selected.map(({ code, display }) => ({ code, display })))}
      renderInput={(params) => (
        <TextField
          {...params}
          onChange={(e) => debounce(() => setSearchTerm(e.target.value))}
          label="CPT / HCPCS Codes"
          placeholder="Search CPT / HCPCS codes"
          InputLabelProps={{ shrink: true }}
          data-testid={dataTestId}
        />
      )}
    />
  );
};
