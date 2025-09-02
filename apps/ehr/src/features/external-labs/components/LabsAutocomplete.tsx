import { Autocomplete, TextField } from '@mui/material';
import { FC, useState } from 'react';
import { useGetCreateExternalLabResources } from 'src/telemed';
import { useDebounce } from 'src/telemed';
import { nameLabTest, OrderableItemSearchResult } from 'utils';

type LabsAutocompleteProps = {
  selectedLab: OrderableItemSearchResult | null;
  labOrgIdsString: string;
  setSelectedLab: (value: OrderableItemSearchResult | null) => void;
};

export const LabsAutocomplete: FC<LabsAutocompleteProps> = (props) => {
  const { selectedLab, setSelectedLab, labOrgIdsString } = props;
  const [debouncedLabSearchTerm, setDebouncedLabSearchTerm] = useState<string | undefined>(undefined);

  const {
    isFetching,
    data,
    isError,
    error: resourceFetchError,
  } = useGetCreateExternalLabResources({
    search: debouncedLabSearchTerm,
    labOrgIdsString,
  });

  const labs = data?.labs || [];

  const { debounce } = useDebounce(800);
  const debouncedHandleLabInputChange = (searchValue: string): void => {
    debounce(() => {
      setDebouncedLabSearchTerm(searchValue);
    });
  };

  if (resourceFetchError) console.log('resourceFetchError', resourceFetchError);

  return (
    <Autocomplete
      size="small"
      options={labs}
      getOptionLabel={(option) => nameLabTest(option.item.itemName, option.lab.labName, false)}
      noOptionsText={
        debouncedLabSearchTerm && labs.length === 0 ? 'No labs based on input' : 'Start typing to load labs'
      }
      value={selectedLab}
      onChange={(_, newValue) => setSelectedLab(newValue)}
      loading={isFetching}
      renderInput={(params) => (
        <TextField
          required
          {...params}
          label="Lab"
          variant="outlined"
          error={isError}
          helperText={isError ? 'Failed to load labs list' : ''}
          onChange={(e) => debouncedHandleLabInputChange(e.target.value)}
        />
      )}
    />
  );
};
