// The medication search, extracted from CurrentMedicationsProviderColumn's add form so it can be reused.
//
// Same shape and the same reasons as AllergyField: the eRx drug database is a real server-side search with a
// minimum query length, an 800ms debounce, and a label that appends the strength when the record carries
// one. Easy Chart needs it on a charted row, and a second copy would be a second set of those details.
//
// What it does NOT own: the dose / units / route fields and the scheduled-vs-as-needed choice. Those belong
// to the page's add form, which is the only place with room for them.

import { Autocomplete, debounce, TextField } from '@mui/material';
import { ErxSearchMedicationsResponse } from '@oystehr/sdk';
import { FC, useMemo, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { ExtractObjectType, useGetMedicationsSearch } from '../../../stores/appointment/appointment.queries';

export type MedicationOption = ExtractObjectType<ErxSearchMedicationsResponse>;

/** The eRx search ignores anything shorter — two characters match half the database. */
const MIN_QUERY_LENGTH = 2;

export interface MedicationFieldProps {
  onChange: (value: MedicationOption | null) => void;
  /** The charted medication, for an EDIT. Omitted by the add field, which stays empty after each pick. */
  value?: MedicationOption | null;
  disabled?: boolean;
  /** See DiagnosesField: opt-in, for a field that appears in response to a click. */
  autoFocus?: boolean;
  required?: boolean;
  error?: boolean;
}

export const MedicationField: FC<MedicationFieldProps> = ({
  onChange,
  value,
  disabled,
  autoFocus,
  required,
  error,
}) => {
  // Seeded from the initial value — see AllergyField. The add form passes none, so it still starts empty.
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(value?.name ?? '');
  const { isFetching: isSearching, data } = useGetMedicationsSearch(debouncedSearchTerm);
  const options = data || [];

  const debouncedHandleInputChange = useMemo(
    () =>
      debounce((term: string) => {
        if (term.length > MIN_QUERY_LENGTH) {
          setDebouncedSearchTerm(term);
        }
      }, 800),
    []
  );

  return (
    <Autocomplete
      value={value ?? null}
      onChange={(_event, selected) => onChange(selected)}
      getOptionLabel={(option) =>
        typeof option === 'string' ? option : `${option.name} ${option.strength ? `(${option.strength})` : ''}`
      }
      fullWidth
      size="small"
      // Paired with autoFocus: focusing without this leaves the caret in a closed field.
      openOnFocus={autoFocus}
      isOptionEqualToValue={(option, selected) => selected.id === option.id}
      loading={isSearching}
      disablePortal
      disabled={disabled}
      options={options}
      noOptionsText={
        debouncedSearchTerm && debouncedSearchTerm.length > MIN_QUERY_LENGTH && options.length === 0
          ? 'Nothing found for this search criteria'
          : 'Start typing to load results'
      }
      renderInput={(params) => (
        <TextField
          {...params}
          autoFocus={autoFocus}
          onChange={(event) => debouncedHandleInputChange(event.target.value)}
          data-testid={dataTestIds.telemedEhrFlow.hpiCurrentMedicationsInput}
          label="Medication"
          placeholder="Search"
          required={required}
          error={error}
          InputLabelProps={{ shrink: true }}
          sx={{ '& .MuiInputLabel-root': { fontWeight: 'bold' } }}
        />
      )}
    />
  );
};
