import { Autocomplete, AutocompleteInputChangeReason, AutocompleteRenderInputParams, TextField } from '@mui/material';
import { HTMLAttributes, ReactElement, SyntheticEvent, useState } from 'react';
import { BillingPayerOption } from 'utils';
import { searchBillingPayers } from '../../api/api';
import { useApiClients } from '../../hooks/useAppClients';
import { useDebounce } from '../../hooks/useDebounce';

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

// Debounced server-side search plus a memory of payers we've seen, so a selected payer keeps its
// label even after the option list changes (or on edit, once it shows up in a search).
function usePayerSearch(): {
  options: BillingPayerOption[];
  known: Record<string, BillingPayerOption>;
  search: (query?: string) => void;
} {
  const { oystehrZambda } = useApiClients();
  const { debounce } = useDebounce(300);
  const [options, setOptions] = useState<BillingPayerOption[]>([]);
  const [known, setKnown] = useState<Record<string, BillingPayerOption>>({});

  const runSearch = async (query?: string): Promise<void> => {
    if (!oystehrZambda) return;
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
  };

  return { options, known, search: (query?: string) => debounce(() => void runSearch(query)) };
}

// Resolve a stored id to a display option, falling back to a synthetic option showing the raw id.
const resolve = (
  id: string,
  known: Record<string, BillingPayerOption>,
  options: BillingPayerOption[]
): BillingPayerOption => known[id] ?? options.find((o) => o.id === id) ?? { id, name: '', payerId: id };

export function PayerSelect({ multiple, value, onChange, label = 'Payer' }: PayerSelectProps): ReactElement {
  const { options, known, search } = usePayerSearch();

  // Props shared by the single- and multi-select variants. Callbacks are typed with their own
  // (narrower) signatures so the object is assignable to both Autocomplete generic instantiations.
  const shared = {
    size: 'small' as const,
    filterOptions: (x: BillingPayerOption[]): BillingPayerOption[] => x,
    isOptionEqualToValue: (o: BillingPayerOption, v: BillingPayerOption): boolean => o.id === v.id,
    getOptionLabel: optionLabel,
    renderOption: (props: HTMLAttributes<HTMLLIElement>, o: BillingPayerOption): ReactElement => (
      <li {...props} key={o.id}>
        {optionLabel(o)}
      </li>
    ),
    onOpen: () => search(),
    onInputChange: (_: SyntheticEvent, v: string, reason: AutocompleteInputChangeReason): void => {
      if (reason === 'input') search(v || undefined);
    },
    renderInput: (params: AutocompleteRenderInputParams): ReactElement => (
      <TextField {...params} label={label} placeholder="Search payers…" />
    ),
  };

  if (multiple) {
    const ids = Array.isArray(value) ? value : value ? [value] : [];
    const selected = ids.map((id) => resolve(id, known, options));
    const merged = [...selected.filter((s) => !options.some((o) => o.id === s.id)), ...options];
    return (
      <Autocomplete<BillingPayerOption, true, false, false>
        {...shared}
        multiple
        options={merged}
        value={selected}
        onChange={(_, opts) => onChange(opts.map((o) => o.id))}
        sx={{ minWidth: 260 }}
      />
    );
  }

  const id = typeof value === 'string' ? value : '';
  const selected = id ? resolve(id, known, options) : null;
  const merged = selected && !options.some((o) => o.id === selected.id) ? [selected, ...options] : options;
  return (
    <Autocomplete<BillingPayerOption, false, false, false>
      {...shared}
      options={merged}
      value={selected}
      onChange={(_, o) => onChange(o?.id ?? '')}
      sx={{ minWidth: 240 }}
    />
  );
}
