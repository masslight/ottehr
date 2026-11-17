import { Autocomplete, AutocompleteRenderInputParams, TextField } from '@mui/material';
import { ReactElement, ReactNode, Ref, useMemo } from 'react';
import { formatAntCaseString } from 'utils/lib/types/data/billing/claim-status';
import { useBillingServices } from '../hooks/useBillingServices';

// Service picker for the rules builder: only the services on claims created from visits so far (the
// same list as the claims list's Service filter), shown by the name the claim screens use and stored as
// the service's code, like the payer and provider pickers. A saved value no listed service has stays
// visible as saved.

interface ServiceSelectProps {
  multiple: boolean;
  value: string | string[] | null | undefined;
  onChange: (value: string | string[]) => void;
  label?: string;
  required?: boolean;
  // Validation display + react-hook-form focus ref, for use inside Controller-registered forms.
  error?: boolean;
  helperText?: ReactNode;
  inputRef?: Ref<HTMLInputElement>;
}

export function ServiceSelect({
  multiple,
  value,
  onChange,
  label,
  required,
  error,
  helperText,
  inputRef,
}: ServiceSelectProps): ReactElement {
  const { services, load } = useBillingServices();
  const codes = useMemo(() => services.map((service) => service.name), [services]);

  // Memoized so a re-render while typing doesn't reset the picker's input.
  const selected = useMemo(() => (Array.isArray(value) ? value : value ? [value] : []), [value]);
  const options = useMemo(() => [...codes, ...selected.filter((v) => !codes.includes(v))], [codes, selected]);

  // Props shared by the single- and multi-select variants (the NioSelect precedent).
  const shared = {
    size: 'small' as const,
    options,
    getOptionLabel: (code: string): string => formatAntCaseString(code),
    getOptionKey: (code: string): string => code,
    onOpen: load,
    renderInput: (params: AutocompleteRenderInputParams): ReactElement => (
      <TextField
        {...params}
        label={label ?? (multiple ? 'Services' : 'Service')}
        placeholder={multiple ? 'Pick services…' : 'Pick a service…'}
        required={required}
        error={error}
        helperText={helperText}
        inputRef={inputRef}
      />
    ),
  };

  if (multiple) {
    return (
      <Autocomplete<string, true, false, false>
        {...shared}
        multiple
        // Picked services leave the list, so Enter can't pick one again (which would remove it).
        filterSelectedOptions
        value={selected}
        onChange={(_, next) => onChange(next)}
        sx={{ minWidth: 260 }}
      />
    );
  }

  return (
    <Autocomplete<string, false, false, false>
      {...shared}
      value={selected[0] ?? null}
      onChange={(_, next) => onChange(next ?? '')}
      sx={{ minWidth: 240 }}
    />
  );
}
