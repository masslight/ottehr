import { Autocomplete, Box, TextField, Typography } from '@mui/material';
import { ReactElement, useEffect, useMemo, useState } from 'react';
import { CARC_OPTIONS, carcDescription } from 'utils/lib/types/data/billing/carc';
import type { RemitCodeEntry } from 'utils/lib/types/data/billing/remit-codes';

export type RemitCodeKind = 'carc' | 'rarc';

// the RARC table is large, so it is fetched the first time a remark-code picker renders
let rarcOptions: Promise<readonly RemitCodeEntry[]> | undefined;
const loadRarcOptions = (): Promise<readonly RemitCodeEntry[]> => {
  rarcOptions ??= import('utils/lib/types/data/billing/rarc').then((module) => module.RARC_OPTIONS);
  return rarcOptions;
};

// one lookup for every service line that shows remark codes
let rarcDescriptions: Promise<ReadonlyMap<string, string>> | undefined;
const loadRarcDescriptions = (): Promise<ReadonlyMap<string, string>> => {
  rarcDescriptions ??= loadRarcOptions().then(
    (options) => new Map(options.map((option) => [option.code, option.description]))
  );
  return rarcDescriptions;
};

// RARC code -> description once the table has loaded (undefined until then, and for unknown codes)
export function useRarcDescription(): (code: string) => string | undefined {
  const [descriptions, setDescriptions] = useState<ReadonlyMap<string, string> | null>(null);
  useEffect(() => {
    let cancelled = false;
    void loadRarcDescriptions().then((loaded) => {
      if (!cancelled) setDescriptions(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return (code: string) => descriptions?.get(code);
}

const MAX_RESULTS = 50;

// The code typed comes first, then codes starting with it, then codes whose description mentions it.
export function filterRemitCodes(options: readonly RemitCodeEntry[], query: string): RemitCodeEntry[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return options.slice(0, MAX_RESULTS);
  const exact = options.filter((option) => option.code.toLowerCase() === needle);
  const byCode = options.filter(
    (option) => option.code.toLowerCase().startsWith(needle) && option.code.toLowerCase() !== needle
  );
  const byText = options.filter(
    (option) => !option.code.toLowerCase().startsWith(needle) && option.description.toLowerCase().includes(needle)
  );
  return [...exact, ...byCode, ...byText].slice(0, MAX_RESULTS);
}

interface RemitCodeAutocompleteProps {
  kind: RemitCodeKind;
  value: string;
  onChange: (code: string) => void;
  error?: boolean;
  helperText?: string;
  width?: number;
}

export function RemitCodeAutocomplete({
  kind,
  value,
  onChange,
  error,
  helperText,
  width,
}: RemitCodeAutocompleteProps): ReactElement {
  const [options, setOptions] = useState<readonly RemitCodeEntry[]>(kind === 'carc' ? CARC_OPTIONS : []);
  const [inputValue, setInputValue] = useState(value);

  useEffect(() => {
    if (kind !== 'rarc') return;
    let cancelled = false;
    void loadRarcOptions().then((loaded) => {
      if (!cancelled) setOptions(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [kind]);

  // a stored code the list doesn't have still shows, with its description if known
  const selected = useMemo((): RemitCodeEntry | null => {
    if (!value) return null;
    return (
      options.find((option) => option.code === value) ?? {
        code: value,
        description: (kind === 'carc' ? carcDescription(value) : undefined) ?? '',
      }
    );
  }, [kind, options, value]);

  const label = kind === 'carc' ? 'CARC' : 'RARC';
  return (
    <Autocomplete<RemitCodeEntry, false, false, false>
      size="small"
      options={options as RemitCodeEntry[]}
      value={selected}
      onChange={(_, option) => onChange(option?.code ?? '')}
      inputValue={inputValue}
      onInputChange={(_, next) => setInputValue(next)}
      filterOptions={(all, state) => filterRemitCodes(all, state.inputValue === value ? '' : state.inputValue)}
      getOptionLabel={(option) => option.code}
      isOptionEqualToValue={(option, current) => option.code === current.code}
      renderOption={(props, option) => (
        <Box component="li" {...props} key={option.code} sx={{ display: 'block !important' }}>
          <Typography variant="body2" fontWeight={700}>
            {option.code}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          >
            {option.description}
          </Typography>
        </Box>
      )}
      slotProps={{ paper: { sx: { minWidth: 420 } } }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          error={error}
          helperText={helperText}
          title={selected?.description || undefined}
        />
      )}
      sx={{ width: width ?? 160 }}
    />
  );
}
