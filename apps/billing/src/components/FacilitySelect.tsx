import { Autocomplete, AutocompleteInputChangeReason, AutocompleteRenderInputParams, TextField } from '@mui/material';
import {
  HTMLAttributes,
  ReactElement,
  ReactNode,
  Ref,
  SyntheticEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ServiceFacilityItem } from 'utils';
import { searchBillingServiceFacilities } from '../api/api';
import { useApiClients } from '../hooks/useAppClients';
import { useFacilityOptionsSearch } from '../hooks/useOptionSearch';

// Searchable picker over the service facility reference resources (the Service Facilities page's
// list). It stores the encoded FHIR reference "Location/<id>" — the value the rules engine's
// facility reader/writer round-trips — while displaying the facility's name and NPI. Selecting only
// real reference resources (no free text) is the point; a stored ref whose facility has been
// deleted renders as the raw reference and the server rejects it on the next save.

interface FacilityRefOption {
  ref: string;
  name: string;
  npi?: string;
}

interface FacilitySelectProps {
  multiple: boolean;
  value: string | string[] | null | undefined;
  onChange: (value: string | string[]) => void;
  label?: string;
  // Marks the label with the required asterisk.
  required?: boolean;
  // Validation display + react-hook-form focus ref, for use inside Controller-registered forms.
  error?: boolean;
  helperText?: ReactNode;
  inputRef?: Ref<HTMLInputElement>;
}

const toOption = (facility: ServiceFacilityItem): FacilityRefOption => ({
  ref: `Location/${facility.id}`,
  name: facility.name,
  npi: facility.npi || undefined,
});

const optionLabel = (option: FacilityRefOption): string =>
  option.name ? (option.npi ? `${option.name} (NPI ${option.npi})` : option.name) : option.ref;

// The shared debounced facility search plus a memory of facilities we've seen; stored refs the
// search hasn't surfaced are resolved by id once (that lookup also finds inactive facilities, so an
// existing rule renders faithfully).
function useFacilitySearch(value: string | string[] | null | undefined): {
  options: FacilityRefOption[];
  known: Record<string, FacilityRefOption>;
  search: (query?: string) => void;
} {
  const { oystehrZambda } = useApiClients();
  const { options: searched, search } = useFacilityOptionsSearch();
  const [known, setKnown] = useState<Record<string, FacilityRefOption>>({});
  // Refs we've already tried to resolve by id — a deleted facility must not be re-fetched forever.
  const attempted = useRef(new Set<string>());

  const options = useMemo(() => searched.filter((facility) => facility.id).map(toOption), [searched]);

  useEffect(() => {
    if (options.length === 0) return;
    setKnown((prev) => {
      const next = { ...prev };
      options.forEach((option) => (next[option.ref] = option));
      return next;
    });
  }, [options]);

  useEffect(() => {
    if (!oystehrZambda) return;
    const stored = Array.isArray(value) ? value : value ? [value] : [];
    for (const ref of stored) {
      if (known[ref] || attempted.current.has(ref)) continue;
      attempted.current.add(ref);
      const id = ref.split('/')[1];
      if (!id) continue;
      searchBillingServiceFacilities(oystehrZambda, { facilityId: id })
        .then((res) => {
          const match = (res.facilities ?? []).find((facility) => `Location/${facility.id}` === ref);
          if (match) setKnown((prev) => ({ ...prev, [`Location/${match.id}`]: toOption(match) }));
        })
        .catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, known, oystehrZambda]);

  return { options, known, search };
}

// Resolve a stored ref to a display option, falling back to a synthetic option showing the raw ref.
const resolve = (
  ref: string,
  known: Record<string, FacilityRefOption>,
  options: FacilityRefOption[]
): FacilityRefOption => known[ref] ?? options.find((option) => option.ref === ref) ?? { ref, name: '' };

export function FacilitySelect({
  multiple,
  value,
  onChange,
  label = 'Facility',
  required,
  error,
  helperText,
  inputRef,
}: FacilitySelectProps): ReactElement {
  const { options, known, search } = useFacilitySearch(value);

  // Props shared by the single- and multi-select variants (the PayerSelect pattern).
  const shared = {
    size: 'small' as const,
    filterOptions: (x: FacilityRefOption[]): FacilityRefOption[] => x,
    isOptionEqualToValue: (option: FacilityRefOption, v: FacilityRefOption): boolean => option.ref === v.ref,
    getOptionLabel: optionLabel,
    renderOption: (props: HTMLAttributes<HTMLLIElement>, option: FacilityRefOption): ReactElement => (
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
        placeholder="Search facilities…"
        required={required}
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
      <Autocomplete<FacilityRefOption, true, false, false>
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
    <Autocomplete<FacilityRefOption, false, false, false>
      {...shared}
      options={merged}
      value={selected}
      onChange={(_, option) => onChange(option?.ref ?? '')}
      sx={{ minWidth: 260 }}
    />
  );
}
