import { Autocomplete, CircularProgress, TextField } from '@mui/material';
import { JSX, useMemo, useRef, useState } from 'react';
import { useGetMedicationsSearch } from 'src/features/visits/shared/stores/appointment/appointment.queries';

interface MedResult {
  id?: string | number;
  code?: string;
  name: string;
  strength?: string;
}

const optKey = (o: MedResult): string => String(o.id ?? o.code ?? o.name);
const optLabel = (o: MedResult): string => `${o.name}${o.strength ? ` (${o.strength})` : ''}`;

/**
 * Type-to-filter medication picker for the easy-chart "choose a medication" step. Reuses the exact
 * search the medical-history Current Medications field uses (`useGetMedicationsSearch` →
 * `erx.searchMedications`), so the list of choices is identical — the difference from the old
 * fixed ranked list is that the provider drives the query and can retype to filter, instead of the
 * planner's raw dictation deciding the matches.
 *
 * Seeded with the dictated drug name so relevant results appear immediately; until the live search
 * returns, the planner's already-fetched ranked results are shown so there's no empty flash.
 */
export function MedicationSearchPicker({
  seedTerm,
  initialResults,
  onPick,
}: {
  seedTerm: string;
  initialResults: MedResult[];
  onPick: (result: MedResult) => void;
}): JSX.Element {
  // Drop the dictated dose/strength from the seed (e.g. "Cefdinir 14 mg per kg" → "Cefdinir") so the
  // initial query is the drug name — the part the catalog search matches on.
  const seedName = (seedTerm ?? '').split(/\s+\d/)[0].trim();
  const [input, setInput] = useState(seedName);
  const [term, setTerm] = useState(seedName.length >= 3 ? seedName : '');

  const { isFetching, data } = useGetMedicationsSearch(term);
  const liveResults = (data ?? []) as unknown as MedResult[];
  const options = liveResults.length > 0 ? liveResults : initialResults;

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedSearch = useMemo(
    () =>
      (value: string): void => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          const trimmed = value.trim();
          if (trimmed.length >= 3) setTerm(trimmed);
        }, 500);
      },
    []
  );

  return (
    <Autocomplete<MedResult, false, false, false>
      openOnFocus
      autoHighlight
      size="small"
      fullWidth
      options={options}
      // Results are already filtered server-side by the search term — render them as-is.
      filterOptions={(opts) => opts}
      inputValue={input}
      onInputChange={(_e, value, reason) => {
        setInput(value);
        if (reason === 'input') debouncedSearch(value);
      }}
      getOptionLabel={optLabel}
      isOptionEqualToValue={(o, v) => optKey(o) === optKey(v)}
      loading={isFetching}
      noOptionsText={term.length >= 3 ? 'Nothing found for this search' : 'Type at least 3 characters'}
      onChange={(_e, value) => {
        if (value) onPick(value);
      }}
      sx={{ mt: 0.75 }}
      renderInput={(params) => (
        <TextField
          {...params}
          autoFocus
          placeholder="Search medications…"
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {isFetching ? <CircularProgress color="inherit" size={14} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
}
