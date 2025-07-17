import { Autocomplete, TextField } from '@mui/material';
import { FC } from 'react';
import { OrderableItemSearchResult, PatientLabItem } from 'utils';

type LabsAutocompleteForPatientProps = {
  patientLabItems: PatientLabItem[];
  selectedLabItem: OrderableItemSearchResult | null;
  setSelectedLabItem: (value: OrderableItemSearchResult | null) => void;
  loading?: boolean;
  error?: boolean;
  helperText?: string;
  label?: string;
  required?: boolean;
};

export const LabsAutocompleteForPatient: FC<LabsAutocompleteForPatientProps> = ({
  patientLabItems,
  selectedLabItem,
  setSelectedLabItem,
  loading = false,
  error = false,
  helperText = '',
  label = 'Test Type',
  required = false,
}) => {
  const selectedPatientLabItem = selectedLabItem
    ? {
        code: selectedLabItem.item.itemCode,
        display: selectedLabItem.item.itemName,
      }
    : null;

  const handleChange = (_: any, newValue: PatientLabItem | null): void => {
    if (newValue) {
      const orderableItem: OrderableItemSearchResult = {
        item: {
          itemCode: newValue.code,
          itemName: newValue.display,
          itemLoinc: newValue.code,
        },
        lab: { labName: '' },
      } as OrderableItemSearchResult;
      setSelectedLabItem(orderableItem);
    } else {
      setSelectedLabItem(null);
    }
  };

  return (
    <Autocomplete
      size="small"
      options={patientLabItems}
      getOptionLabel={(option) => `${option.display} (${option.code})`}
      noOptionsText="No lab tests available for this patient"
      value={selectedPatientLabItem}
      onChange={handleChange}
      loading={loading}
      isOptionEqualToValue={(option, value) => option.code === value.code}
      renderInput={(params) => (
        <TextField
          required={required}
          {...params}
          label={label}
          variant="outlined"
          error={error}
          helperText={helperText}
        />
      )}
    />
  );
};
