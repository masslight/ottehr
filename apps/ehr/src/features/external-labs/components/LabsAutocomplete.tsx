import { FC, useState } from 'react';
import { OrderableItemSearchResult, nameLabTest } from 'utils';
import { Autocomplete, TextField } from '@mui/material';
import { useGetCreateExternalLabResources } from 'src/telemed';
import { useDebounce } from 'src/telemed';

type LabsAutocompleteProps = {
  selectedLab: OrderableItemSearchResult | null;
  setSelectedLab: (value: OrderableItemSearchResult | null) => void;
  patientId: string;
};

export const LabsAutocomplete: FC<LabsAutocompleteProps> = (props) => {
  const { selectedLab, setSelectedLab, patientId } = props;
  const [debouncedLabSearchTerm, setDebouncedLabSearchTerm] = useState<string | undefined>(undefined);

  const { isFetching: searchingForLabs, data: createExternalLabResources } = useGetCreateExternalLabResources({
    patientId,
    search: debouncedLabSearchTerm,
  });

  const labs = createExternalLabResources?.labs || [];

  const { debounce } = useDebounce(800);
  const debouncedHandleLabInputChange = (searchValue: string): void => {
    debounce(() => {
      setDebouncedLabSearchTerm(searchValue);
    });
  };

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
      loading={searchingForLabs}
      renderInput={(params) => (
        <TextField
          required
          {...params}
          label="Lab"
          variant="outlined"
          onChange={(e) => debouncedHandleLabInputChange(e.target.value)}
        />
      )}
    />
  );
};
