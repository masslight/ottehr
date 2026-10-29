import { Autocomplete, Box, TextField, Tooltip } from '@mui/material';
import { FC, useState } from 'react';
import { PharmacySearchResult } from 'utils/lib/types/api/erx-search.types';
import { useSearchPharmacies } from '../../../shared/hooks/useErxSearch';

const optionLabel = (option: PharmacySearchResult): string => `${option.name} - ${option.address}`;

export const PharmacySearch: FC<{
  onPick: (pharmacy: PharmacySearchResult) => void;
  /** Why a pharmacy can't be picked, if it can't: it shows disabled, saying why on hover. */
  unavailable?: (pharmacy: PharmacySearchResult) => string | undefined;
}> = ({ onPick, unavailable }) => {
  const [query, setQuery] = useState('');
  const { data: pharmacies = [], isFetching } = useSearchPharmacies(query);
  return (
    <Box sx={{ width: 360, pt: 0.5 }}>
      <Autocomplete<PharmacySearchResult>
        options={pharmacies}
        loading={isFetching}
        filterOptions={(options) => options}
        getOptionLabel={optionLabel}
        getOptionDisabled={(option) => !!unavailable?.(option)}
        renderOption={(props, option) => {
          const why = unavailable?.(option);
          return why ? (
            // A disabled option takes no pointer events; this one does, for its tooltip. describeChild keeps the
            // pharmacy as its name and the reason as its description.
            <Tooltip key={option.ncpdpId} title={why} placement="right" describeChild>
              <li {...props} style={{ pointerEvents: 'auto' }}>
                {optionLabel(option)}
              </li>
            </Tooltip>
          ) : (
            <li {...props} key={option.ncpdpId}>
              {optionLabel(option)}
            </li>
          );
        }}
        inputValue={query}
        onInputChange={(_event, value) => setQuery(value)}
        value={null}
        onChange={(_event, option) => option && !unavailable?.(option) && onPick(option)}
        noOptionsText={query.trim().length < 2 ? 'Type to search pharmacies' : 'Nothing found for this search criteria'}
        renderInput={(params) => <TextField {...params} size="small" label="Pharmacy" />}
      />
    </Box>
  );
};
