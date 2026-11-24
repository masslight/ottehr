import { Autocomplete, TextField } from '@mui/material';
import { FC, useEffect, useRef, useState } from 'react';
import { useGetCPTHCPCSSearch } from 'src/features/visits/shared/stores/appointment/appointment.queries';
import { useDebounce } from 'src/shared/hooks/useDebounce';
import { CPTCodeDTO } from 'utils/lib/types/api/chart-data/chart-data.types';

interface CptCodeSearchProps {
  label: string;
  selected: readonly { code: string }[];
  onPick: (code: CPTCodeDTO) => void;
  dataTestId?: string;
}

export const CptCodeSearch: FC<CptCodeSearchProps> = ({ label, selected, onPick, dataTestId }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const { isFetching, data } = useGetCPTHCPCSSearch({ search: searchTerm, type: 'both' });
  const options = searchTerm ? data?.codes ?? [] : [];
  const { debounce, clear } = useDebounce(800);
  // A search typed just before the popover closes must not land on the unmounted field.
  const clearRef = useRef(clear);
  clearRef.current = clear;
  useEffect(() => () => clearRef.current(), []);

  return (
    <Autocomplete
      size="small"
      fullWidth
      openOnFocus
      filterOptions={(x) => x}
      noOptionsText={searchTerm ? 'Nothing found for this search criteria' : 'Start typing to load results'}
      value={null}
      options={options}
      loading={isFetching}
      getOptionLabel={(option) => `${option.code} ${option.display}`}
      getOptionDisabled={(option) => selected.some((code) => code.code === option.code)}
      onChange={(_event, option) => option && onPick({ code: option.code, display: option.display })}
      onInputChange={(_event, value) => debounce(() => setSearchTerm(value))}
      renderInput={(params) => <TextField {...params} label={label} data-testid={dataTestId} />}
      sx={{ width: 360, maxWidth: '100%', pt: 0.5 }}
    />
  );
};
