// The CPT / HCPCS search field, extracted from BillingCodesContainer so it can be reused.
//
// It was inline in the Billing card, which meant Easy Chart had no way to offer CPT editing without
// growing a second search — with its own debounce interval, its own "nothing found" wording and its own
// idea of how results are ordered. Two searches that rank differently for the same query is a bug a
// provider experiences as the app disagreeing with itself.
//
// Deliberately shaped like DiagnosesField, because the two are used the same way in both places: an ADD
// field that stays empty on the Assessment page, and a prefilled EDIT field that Easy Chart opens on a
// row the provider clicked.

import { Autocomplete, TextField } from '@mui/material';
import { FC, useEffect, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useDebounce } from 'src/shared/hooks/useDebounce';
import { CPTCodeOption } from 'utils/lib/types/common';
import { useGetCPTHCPCSSearch } from '../../stores/appointment/appointment.queries';

export interface CptCodeFieldProps {
  onChange: (data: CPTCodeOption) => void;
  disabled?: boolean;
  /** The charted code, for an EDIT. Omitted by the add field, which must stay empty after each pick. */
  value?: CPTCodeOption | null;
  label?: string;
  placeholder?: string;
  /**
   * Focus the input on mount and open the dropdown with it.
   *
   * OPT-IN, for the same reason as DiagnosesField's: the Assessment page renders this field permanently,
   * so autofocusing there would steal the caret whenever the page opened. It is for a field that appears
   * in response to a click, where the click IS the request to start editing.
   */
  autoFocus?: boolean;
  /**
   * The search's error, reported up as it changes.
   *
   * The CPT search fails wholesale when the practice has no NLM API key, and the Billing card answers that
   * with a setup link rather than an empty dropdown. Owning the query here means the caller can no longer
   * see that error, so it is handed back instead of being swallowed.
   */
  onSearchError?: (error: unknown) => void;
}

export const CptCodeField: FC<CptCodeFieldProps> = ({
  onChange,
  disabled,
  value,
  label,
  placeholder,
  autoFocus,
  onSearchError,
}) => {
  // Seeded from the initial value, so a field opened ON a charted code already has that code's options
  // loaded instead of an empty dropdown the provider has to retype into. Only the FIRST render seeds it —
  // after that the term follows what is typed, which is what an edit needs.
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(value?.display ?? '');
  const { isFetching: isSearching, data, error } = useGetCPTHCPCSSearch({ search: debouncedSearchTerm, type: 'both' });
  const cptSearchOptions = data?.codes || [];

  useEffect(() => {
    // `error` is react-query's `TError | null`, and it is reported AS null when there is none. That matters:
    // a caller whose state also starts at null then sees no change on mount, so wiring this up costs it no
    // extra render. Reporting `undefined` here against a `null` initial state is an update on every mount,
    // which is a re-render of the whole card for nothing.
    onSearchError?.(error ?? null);
    // Only when the error itself changes: `onSearchError` is usually an inline arrow, and depending on it
    // would re-report on every render of the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  const { debounce } = useDebounce(800);

  const debouncedHandleInputChange = (term: string): void => {
    debounce(() => {
      setDebouncedSearchTerm(term);
    });
  };

  return (
    <Autocomplete
      fullWidth
      blurOnSelect
      // Paired with autoFocus: focusing without this leaves the caret in a closed field, which reads as
      // nothing having happened.
      openOnFocus={autoFocus}
      disabled={disabled}
      options={cptSearchOptions}
      noOptionsText={
        debouncedSearchTerm && cptSearchOptions.length === 0
          ? 'Nothing found for this search criteria'
          : 'Start typing to load results'
      }
      autoComplete
      includeInputInList
      disableClearable
      filterOptions={(x) => x}
      value={value || (null as unknown as undefined)}
      isOptionEqualToValue={(option, selected) => selected.code === option.code}
      loading={isSearching}
      onChange={(_event, selected) => {
        if (selected) onChange(selected);
      }}
      getOptionLabel={(option) => (typeof option === 'string' ? option : `${option.code} ${option.display}`)}
      renderInput={(params) => (
        <TextField
          {...params}
          autoFocus={autoFocus}
          size="small"
          label={label ?? 'Additional CPT codes'}
          placeholder={placeholder ?? 'Search CPT code'}
          onChange={(event) => debouncedHandleInputChange(event.target.value)}
          data-testid={dataTestIds.assessmentCard.cptCodeField}
        />
      )}
    />
  );
};
