// The allergen search, extracted from KnownAllergiesProviderColumn's add form so it can be reused.
//
// The eRx allergen database is a real server-side search with real details: a minimum query length, an
// 800ms debounce, and a brand name folded into the label when it differs from the generic name. Easy Chart
// needs the same search on a charted row, and a second copy would be a second set of those details.
//
// What it does NOT own: the quick picks, the command-palette entries, and the "Other" free-text submit.
// Those belong to the page's add form, which is the only place with room for them.

import { Autocomplete, debounce, TextField } from '@mui/material';
import { ErxSearchAllergensResponse } from '@oystehr/sdk';
import { FC, useMemo, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { ExtractObjectType, useGetAllergiesSearch } from '../../stores/appointment/appointment.queries';

export type AllergenOption = ExtractObjectType<ErxSearchAllergensResponse>;

/** The eRx search ignores anything shorter — two characters match half the database. */
const MIN_QUERY_LENGTH = 2;

export interface AllergyFieldProps {
  onChange: (value: AllergenOption | null) => void;
  /** The charted allergy, for an EDIT. Omitted by the add field, which must stay empty after each pick. */
  value?: AllergenOption | null;
  disabled?: boolean;
  /** See DiagnosesField: opt-in, for a field that appears in response to a click. */
  autoFocus?: boolean;
  /**
   * Offer "Other", which the caller completes with a free-text name. OFF for an in-row editor, which has
   * nowhere to put the follow-up text field — see HospitalizationField.
   */
  includeOther?: boolean;
}

export const AllergyField: FC<AllergyFieldProps> = ({ onChange, value, disabled, autoFocus, includeOther = true }) => {
  // Seeded from the initial value, so a field opened ON a charted allergy already has that allergen's
  // options loaded instead of an empty dropdown the provider has to retype into. The add form passes no
  // `value`, so it still starts empty.
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(value?.name ?? '');
  const { isFetching: isSearching, data } = useGetAllergiesSearch(debouncedSearchTerm);

  const options = useMemo(() => {
    if (!data || isSearching) return [];
    const withBrand = data.map((allergen) =>
      // The brand name only earns its place when it says something the generic name does not.
      allergen.brandName && allergen.brandName !== allergen.name
        ? { ...allergen, name: `${allergen.name} (${allergen.brandName})` }
        : allergen
    );
    return includeOther ? [...withBrand, { name: 'Other' } as unknown as AllergenOption] : withBrand;
  }, [data, isSearching, includeOther]);

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
      getOptionLabel={(option) => (typeof option === 'string' ? option : option.name || '')}
      fullWidth
      size="small"
      // Paired with autoFocus: focusing without this leaves the caret in a closed field.
      openOnFocus={autoFocus}
      loading={isSearching}
      filterOptions={(unfiltered) => unfiltered}
      isOptionEqualToValue={(option, selected) => option.name === selected.name}
      disablePortal
      blurOnSelect
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
          data-testid={dataTestIds.allergies.knownAllergiesInput}
          label="Agent/Substance"
          placeholder="Search"
          InputLabelProps={{ shrink: true }}
          sx={{ '& .MuiInputLabel-root': { fontWeight: 'bold' } }}
        />
      )}
    />
  );
};
