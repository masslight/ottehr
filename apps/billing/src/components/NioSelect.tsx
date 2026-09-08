import { Autocomplete, AutocompleteInputChangeReason, AutocompleteRenderInputParams, TextField } from '@mui/material';
import { HTMLAttributes, ReactElement, ReactNode, Ref, SyntheticEvent, useState } from 'react';
import { searchBillingNonInsuranceOrgs } from '../api/api';
import { useApiClients } from '../hooks/useAppClients';
import { useDebounce } from '../hooks/useDebounce';

// Searchable non-insurance organization picker backed by the NIO directory
// (search-billing-non-insurance-orgs). It displays the organization's name but stores its
// Organization id — the token the rules engine's nonInsurancePayerId reader/writer and the claims
// list's NIO filter use. Selecting only real organizations (no free text) is the point.

// The slice of a directory organization the picker needs.
export interface NioOption {
  id: string;
  name: string;
}

interface NioSelectProps {
  multiple: boolean;
  value: string | string[] | null | undefined;
  onChange: (value: string | string[]) => void;
  label?: string;
  // Options the caller already knows (e.g. the claim's current payer), so a stored id shows its
  // display name before any search has run.
  initialOptions?: NioOption[];
  // Offer only active organizations — claim editing picks a payer to bill, while the rule builder
  // and the claims-list filter search the whole directory.
  activeOnly?: boolean;
  required?: boolean;
  // Validation display + react-hook-form focus ref, for use inside Controller-registered forms.
  error?: boolean;
  helperText?: ReactNode;
  inputRef?: Ref<HTMLInputElement>;
}

const optionLabel = (o: NioOption): string => o.name || o.id;

// Debounced server-side search plus a memory of organizations we've seen, so a selected
// organization keeps its label even after the option list changes (or on edit, once it shows up in
// a search).
function useNioSearch(
  initialOptions?: NioOption[],
  activeOnly?: boolean
): {
  options: NioOption[];
  known: Record<string, NioOption>;
  search: (query?: string) => void;
} {
  const { oystehrZambda } = useApiClients();
  const { debounce } = useDebounce(300);
  const [options, setOptions] = useState<NioOption[]>([]);
  const [known, setKnown] = useState<Record<string, NioOption>>(() =>
    Object.fromEntries((initialOptions ?? []).filter((o) => o.id).map((o) => [o.id, o]))
  );

  const runSearch = async (query?: string): Promise<void> => {
    if (!oystehrZambda) return;
    try {
      const res = await searchBillingNonInsuranceOrgs(oystehrZambda, query ? { name: query } : {});
      const orgs = (res.organizations ?? [])
        .filter((org) => !activeOnly || org.active)
        .map(({ id, name }) => ({ id, name }));
      setOptions(orgs);
      setKnown((prev) => {
        const next = { ...prev };
        orgs.forEach((o) => (next[o.id] = o));
        return next;
      });
    } catch {
      setOptions([]);
    }
  };

  return { options, known, search: (query?: string) => debounce(() => void runSearch(query)) };
}

// Resolve a stored id to a display option, falling back to a synthetic option showing the raw id.
const resolve = (id: string, known: Record<string, NioOption>, options: NioOption[]): NioOption =>
  known[id] ?? options.find((o) => o.id === id) ?? { id, name: '' };

export function NioSelect({
  multiple,
  value,
  onChange,
  label = 'Non-insurance organization',
  initialOptions,
  activeOnly,
  required,
  error,
  helperText,
  inputRef,
}: NioSelectProps): ReactElement {
  const { options, known, search } = useNioSearch(initialOptions, activeOnly);

  // Props shared by the single- and multi-select variants. Callbacks are typed with their own
  // (narrower) signatures so the object is assignable to both Autocomplete generic instantiations.
  const shared = {
    size: 'small' as const,
    filterOptions: (x: NioOption[]): NioOption[] => x,
    isOptionEqualToValue: (o: NioOption, v: NioOption): boolean => o.id === v.id,
    getOptionLabel: optionLabel,
    renderOption: (props: HTMLAttributes<HTMLLIElement>, o: NioOption): ReactElement => (
      <li {...props} key={o.id}>
        {optionLabel(o)}
      </li>
    ),
    onOpen: () => search(),
    onInputChange: (_: SyntheticEvent, v: string, reason: AutocompleteInputChangeReason): void => {
      if (reason === 'input') search(v || undefined);
    },
    renderInput: (params: AutocompleteRenderInputParams): ReactElement => (
      <TextField
        {...params}
        label={label}
        placeholder="Search non-insurance organizations…"
        required={required}
        error={error}
        helperText={helperText}
        inputRef={inputRef}
      />
    ),
  };

  if (multiple) {
    const ids = Array.isArray(value) ? value : value ? [value] : [];
    const selected = ids.map((id) => resolve(id, known, options));
    const merged = [...selected.filter((s) => !options.some((o) => o.id === s.id)), ...options];
    return (
      <Autocomplete<NioOption, true, false, false>
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
    <Autocomplete<NioOption, false, false, false>
      {...shared}
      options={merged}
      value={selected}
      onChange={(_, o) => onChange(o?.id ?? '')}
      sx={{ minWidth: 240 }}
    />
  );
}
