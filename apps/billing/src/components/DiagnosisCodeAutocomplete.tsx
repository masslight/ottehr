import { Autocomplete, TextField } from '@mui/material';
import { ReactElement, useRef, useState } from 'react';
import { BillingCodeOption } from 'utils/lib/types/data/billing/billing.types';
import { searchBillingDiagnosisCodes } from '../api/api';
import { useApiClients } from '../hooks/useAppClients';

interface DiagnosisCodeAutocompleteProps {
  value: string;
  onChange: (code: BillingCodeOption) => void;
  onInputChange: (code: string) => void;
  label?: string;
  width?: number;
}

// freeSolo so users can still enter arbitrary/custom codes
export function DiagnosisCodeAutocomplete({
  value,
  onChange,
  onInputChange,
  label = 'CPT',
  width = 150,
}: DiagnosisCodeAutocompleteProps): ReactElement {
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
        const res = await searchBillingDiagnosisCodes(oystehrZambda, { query: query.trim() });
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
        onInputChange(v);
        search(v);
      }}
      onChange={(_, o) => {
        if (o && typeof o !== 'string') onChange(o);
      }}
      renderInput={(params) => <TextField {...params} label={label} />}
      sx={{ width }}
    />
  );
}
