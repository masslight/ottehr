import { Autocomplete, TextField } from '@mui/material';
import { ReactElement, useRef, useState } from 'react';
import { BillingPayerOption } from 'utils';
import { searchBillingPayers } from '../../api/api';
import { useApiClients } from '../../hooks/useAppClients';

// Searchable payer picker backed by the Oystehr payer list (search-billing-payers). It displays the
// human-friendly payer name + clearinghouse payer id, but stores the RCM payer `id` — the same token
// coverage.payor / Claim.insurer use (see getPayerUrl/extractPayerIdFromUrl), so it round-trips with
// the rules engine's payerId reader/writer. Selecting only valid payers (no free text) is the point.

interface PayerSelectProps {
  multiple: boolean;
  value: string | string[] | null | undefined;
  onChange: (value: string | string[]) => void;
  label?: string;
}

const optionLabel = (o: BillingPayerOption): string => (o.name ? `${o.name} (${o.payerId})` : o.id);

// usePayerSearch: debounced server-side search plus a memory of payers we've seen, so a selected payer
// keeps its label even after the option list changes (or on edit, once it shows up in a search).
function usePayerSearch(): {
  options: BillingPayerOption[];
  known: Record<string, BillingPayerOption>;
  search: (query?: string) => void;
} {
  const { oystehrZambda } = useApiClients();
  const [options, setOptions] = useState<BillingPayerOption[]>([]);
  const [known, setKnown] = useState<Record<string, BillingPayerOption>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = (query?: string): void => {
    if (timer.current) clearTimeout(timer.current);
    if (!oystehrZambda) return;
    timer.current = setTimeout(async () => {
      try {
        const res = await searchBillingPayers(oystehrZambda, query ? { name: query } : {});
        const payers = res.payers ?? [];
        setOptions(payers);
        setKnown((prev) => {
          const next = { ...prev };
          payers.forEach((p) => (next[p.id] = p));
          return next;
        });
      } catch {
        setOptions([]);
      }
    }, 300);
  };

  return { options, known, search };
}

// Resolve a stored id to a display option, falling back to a synthetic option showing the raw id.
const resolve = (
  id: string,
  known: Record<string, BillingPayerOption>,
  options: BillingPayerOption[]
): BillingPayerOption => known[id] ?? options.find((o) => o.id === id) ?? { id, name: '', payerId: id };

export function PayerSelect({ multiple, value, onChange, label = 'Payer' }: PayerSelectProps): ReactElement {
  const { options, known, search } = usePayerSearch();

  if (multiple) {
    const ids = Array.isArray(value) ? value : value ? [value] : [];
    const selected = ids.map((id) => resolve(id, known, options));
    const merged = [...selected.filter((s) => !options.some((o) => o.id === s.id)), ...options];
    return (
      <Autocomplete<BillingPayerOption, true, false, false>
        multiple
        size="small"
        options={merged}
        value={selected}
        filterOptions={(x) => x}
        isOptionEqualToValue={(o, v) => o.id === v.id}
        getOptionLabel={optionLabel}
        renderOption={(props, o) => (
          <li {...props} key={o.id}>
            {optionLabel(o)}
          </li>
        )}
        onOpen={() => search()}
        onInputChange={(_, v, reason) => {
          if (reason === 'input') search(v || undefined);
        }}
        onChange={(_, opts) => onChange(opts.map((o) => o.id))}
        renderInput={(params) => <TextField {...params} label={label} placeholder="Search payers…" />}
        sx={{ minWidth: 260 }}
      />
    );
  }

  const id = typeof value === 'string' ? value : '';
  const selected = id ? resolve(id, known, options) : null;
  const merged = selected && !options.some((o) => o.id === selected.id) ? [selected, ...options] : options;
  return (
    <Autocomplete<BillingPayerOption, false, false, false>
      size="small"
      options={merged}
      value={selected}
      filterOptions={(x) => x}
      isOptionEqualToValue={(o, v) => o.id === v.id}
      getOptionLabel={optionLabel}
      renderOption={(props, o) => (
        <li {...props} key={o.id}>
          {optionLabel(o)}
        </li>
      )}
      onOpen={() => search()}
      onInputChange={(_, v, reason) => {
        if (reason === 'input') search(v || undefined);
      }}
      onChange={(_, o) => onChange(o?.id ?? '')}
      renderInput={(params) => <TextField {...params} label={label} placeholder="Search payers…" />}
      sx={{ minWidth: 240 }}
    />
  );
}
