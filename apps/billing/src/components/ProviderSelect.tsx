import { Autocomplete, AutocompleteInputChangeReason, AutocompleteRenderInputParams, TextField } from '@mui/material';
import { HTMLAttributes, ReactElement, ReactNode, Ref, SyntheticEvent, useEffect, useRef, useState } from 'react';
import { BillingProviderOption } from 'utils';
import { searchBillingProviders } from '../api/api';
import { useApiClients } from '../hooks/useAppClients';
import { useDebounce } from '../hooks/useDebounce';

// Searchable provider picker over the rendering/billing provider reference resources (the ones the
// provider management pages list). It stores the encoded FHIR reference "Practitioner/<id>" /
// "Organization/<id>" — the value the rules engine's provider readers/writers round-trip — while
// displaying the provider's name and NPI. Selecting only real reference resources (no free text)
// is the point; a stored ref whose resource has been deleted renders as the raw reference and the
// server rejects it with a clear message on the next save.

interface ProviderRefOption {
  ref: string;
  name: string;
  npi?: string;
}

interface ProviderSelectProps {
  // Which provider list to search: the same role tag the save-time check enforces.
  providerRole: 'rendering' | 'billing';
  multiple: boolean;
  value: string | string[] | null | undefined;
  onChange: (value: string | string[]) => void;
  label?: string;
  // Validation display + react-hook-form focus ref, for use inside Controller-registered forms.
  error?: boolean;
  helperText?: ReactNode;
  inputRef?: Ref<HTMLInputElement>;
}

const toRef = (provider: BillingProviderOption): string =>
  `${provider.kind === 'organization' ? 'Organization' : 'Practitioner'}/${provider.id}`;

const toOption = (provider: BillingProviderOption): ProviderRefOption => ({
  ref: toRef(provider),
  name: provider.name,
  npi: provider.npi || undefined,
});

const optionLabel = (option: ProviderRefOption): string =>
  option.name ? (option.npi ? `${option.name} (NPI ${option.npi})` : option.name) : option.ref;

// Debounced server-side search plus a memory of providers we've seen, so a selected provider keeps
// its label after the option list changes. Stored refs the search hasn't surfaced (an edited rule)
// are resolved by id once, so they render readably instead of as a bare reference.
function useProviderSearch(
  providerRole: 'rendering' | 'billing',
  value: string | string[] | null | undefined
): {
  options: ProviderRefOption[];
  known: Record<string, ProviderRefOption>;
  search: (query?: string) => void;
} {
  const { oystehrZambda } = useApiClients();
  const { debounce } = useDebounce(300);
  const [options, setOptions] = useState<ProviderRefOption[]>([]);
  const [known, setKnown] = useState<Record<string, ProviderRefOption>>({});
  // Refs we've already tried to resolve by id — a deleted resource must not be re-fetched forever.
  const attempted = useRef(new Set<string>());

  const absorb = (providers: BillingProviderOption[]): ProviderRefOption[] => {
    const mapped = providers.map(toOption);
    setKnown((prev) => {
      const next = { ...prev };
      mapped.forEach((option) => (next[option.ref] = option));
      return next;
    });
    return mapped;
  };

  const runSearch = async (query?: string): Promise<void> => {
    if (!oystehrZambda) return;
    try {
      const res = await searchBillingProviders(oystehrZambda, {
        providerType: providerRole,
        ...(query ? { name: query } : {}),
      });
      setOptions(absorb(res.providers ?? []));
    } catch {
      setOptions([]);
    }
  };

  useEffect(() => {
    if (!oystehrZambda) return;
    const stored = Array.isArray(value) ? value : value ? [value] : [];
    for (const ref of stored) {
      if (known[ref] || attempted.current.has(ref)) continue;
      attempted.current.add(ref);
      const id = ref.split('/')[1];
      if (!id) continue;
      searchBillingProviders(oystehrZambda, { providerType: providerRole, providerId: id })
        .then((res) => {
          const match = (res.providers ?? []).find((provider) => toRef(provider) === ref);
          if (match) absorb([match]);
        })
        .catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, known, oystehrZambda, providerRole]);

  return { options, known, search: (query?: string) => debounce(() => void runSearch(query)) };
}

// Resolve a stored ref to a display option, falling back to a synthetic option showing the raw ref.
const resolve = (
  ref: string,
  known: Record<string, ProviderRefOption>,
  options: ProviderRefOption[]
): ProviderRefOption => known[ref] ?? options.find((option) => option.ref === ref) ?? { ref, name: '' };

export function ProviderSelect({
  providerRole,
  multiple,
  value,
  onChange,
  label = 'Provider',
  error,
  helperText,
  inputRef,
}: ProviderSelectProps): ReactElement {
  const { options, known, search } = useProviderSearch(providerRole, value);

  // Props shared by the single- and multi-select variants (the PayerSelect pattern).
  const shared = {
    size: 'small' as const,
    filterOptions: (x: ProviderRefOption[]): ProviderRefOption[] => x,
    isOptionEqualToValue: (option: ProviderRefOption, v: ProviderRefOption): boolean => option.ref === v.ref,
    getOptionLabel: optionLabel,
    renderOption: (props: HTMLAttributes<HTMLLIElement>, option: ProviderRefOption): ReactElement => (
      <li {...props} key={option.ref}>
        {optionLabel(option)}
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
        placeholder="Search providers…"
        error={error}
        helperText={helperText}
        inputRef={inputRef}
      />
    ),
  };

  if (multiple) {
    const refs = Array.isArray(value) ? value : value ? [value] : [];
    const selected = refs.map((ref) => resolve(ref, known, options));
    const merged = [...selected.filter((s) => !options.some((option) => option.ref === s.ref)), ...options];
    return (
      <Autocomplete<ProviderRefOption, true, false, false>
        {...shared}
        multiple
        options={merged}
        value={selected}
        onChange={(_, opts) => onChange(opts.map((option) => option.ref))}
        sx={{ minWidth: 280 }}
      />
    );
  }

  const ref = typeof value === 'string' ? value : '';
  const selected = ref ? resolve(ref, known, options) : null;
  const merged = selected && !options.some((option) => option.ref === selected.ref) ? [selected, ...options] : options;
  return (
    <Autocomplete<ProviderRefOption, false, false, false>
      {...shared}
      options={merged}
      value={selected}
      onChange={(_, option) => onChange(option?.ref ?? '')}
      sx={{ minWidth: 260 }}
    />
  );
}
