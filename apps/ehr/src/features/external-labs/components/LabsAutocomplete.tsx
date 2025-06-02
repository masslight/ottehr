import { FC, useState, useMemo } from 'react';
import { OrderableItemSearchResult, nameLabTest } from 'utils';
import { Autocomplete, TextField } from '@mui/material';
import { useGetExternalLabResources } from 'src/telemed';
import { useDebounce } from 'src/telemed';

type LabsAutocompleteProps = {
  selectedLab: OrderableItemSearchResult | null;
  setSelectedLab: (value: OrderableItemSearchResult | null) => void;
  patientId: string;
};

export const LabsAutocomplete: FC<LabsAutocompleteProps> = (props) => {
  const { selectedLab, setSelectedLab, patientId } = props;
  const [inputValue, setInputValue] = useState('');

  const { debounce } = useDebounce(800);

  // used to fetch external lab items list
  const [debouncedLabSearchTerm, setDebouncedLabSearchTerm] = useState('');
  const { isFetching: searchingForLabs, data: getExternalLabSearchRes } = useGetExternalLabResources({
    patientId,
    search: debouncedLabSearchTerm,
  });
  const debouncedHandleLabInputChange = (searchValue: string): void => {
    debounce(() => {
      setDebouncedLabSearchTerm(searchValue);
    });
  };

  const filterOptions = useMemo(() => {
    const labs = getExternalLabSearchRes?.labs || [];
    if (inputValue === '') return [];
    return labs.filter((item) => {
      return item.item.itemName.toLowerCase().includes(inputValue.toLowerCase());
    });
  }, [inputValue, getExternalLabSearchRes?.labs]);

  return (
    <Autocomplete
      size="small"
      options={filterOptions}
      getOptionLabel={(option) => nameLabTest(option.item.itemName, option.lab.labName, false)}
      noOptionsText={inputValue && filterOptions.length === 0 ? 'No labs based on input' : 'Start typing to load labs'}
      value={selectedLab}
      onChange={(_, newValue) => setSelectedLab(newValue)}
      inputValue={inputValue}
      onInputChange={(_, newValue) => setInputValue(newValue)}
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
