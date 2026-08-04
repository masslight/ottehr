import { Autocomplete, TextField } from '@mui/material';
import { ReactElement, ReactNode, Ref, useRef, useState } from 'react';
import { BillingCodeOption } from 'utils';
import { searchBillingProcedureCodes } from '../api/api';
import { useApiClients } from '../hooks/useAppClients';

interface ProcedureCodeAutocompleteProps {
  value: string;
  onChange: (code: string) => void;
  label?: string;
  width?: number;
  required?: boolean;
  // Validation display + react-hook-form focus ref, for use inside Controller-registered forms
  // (the rules builder).
  error?: boolean;
  helperText?: ReactNode;
  inputRef?: Ref<HTMLInputElement>;
}

// freeSolo so users can still enter arbitrary/custom codes
export function ProcedureCodeAutocomplete({
  value,
  onChange,
  label = 'CPT',
  width = 150,
  required,
  error,
  helperText,
  inputRef,
}: ProcedureCodeAutocompleteProps): ReactElement {
  const { oystehrZambda } = useApiClients();
  const [options, setOptions] = useState<BillingCodeOption[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = (query: string): void => {
    if (timer.current) clearTimeout(timer.current);
    if (!oystehrZambda || query.trim().length < 2) {
      setOptions([]);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        const res = await searchBillingProcedureCodes(oystehrZambda, { query: query.trim() });
        setOptions(res.codes ?? []);
      } catch {
        setOptions([]);
      }
    }, 300);
  };

  return (
    <Autocomplete<BillingCodeOption, false, false, true>
      freeSolo
      size="small"
      options={options}
      filterOptions={(x) => x}
      getOptionLabel={(o) => (typeof o === 'string' ? o : o.code)}
      renderOption={(props, o) => (
        <li {...props} key={o.code}>
          {o.code} — {o.display}
        </li>
      )}
      inputValue={value}
      onInputChange={(_, v, reason) => {
        if (reason === 'reset') return; // option-selection reset is handled in onChange
        onChange(v);
        search(v);
      }}
      onChange={(_, o) => {
        if (o && typeof o !== 'string') onChange(o.code);
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          required={required}
          error={error}
          helperText={helperText}
          inputRef={inputRef}
        />
      )}
      sx={{ width }}
    />
  );
}
