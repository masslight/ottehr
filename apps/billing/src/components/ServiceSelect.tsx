import { Autocomplete, AutocompleteRenderInputParams, TextField } from '@mui/material';
import { HTMLAttributes, ReactElement, ReactNode, Ref, useMemo } from 'react';
import { serviceCodeFor } from 'utils/lib/types/data/billing/rules-engine.field-catalog';
import { BillingServiceOption, useBillingServices } from '../hooks/useBillingServices';

// Service picker for the rules builder: only the services on claims created from visits so far (the
// same list and names as the claims list's Service filter), offered by name. It stores the picked
// service's name. A value saved as a code shows as its service, and a saved value naming no listed
// service stays visible so the rule renders as saved (saving rejects it on a set action).

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

  // The listed service each saved value names, else a stand-in showing the value as saved. Memoized so
  // a re-render while typing doesn't reset the picker's input.
  const selected = useMemo(() => {
    const saved = Array.isArray(value) ? value : value ? [value] : [];
    const codes = services.map((service) => service.code);
    return saved.map((v) => {
      const code = serviceCodeFor(codes, v);
      return services.find((service) => service.code === code) ?? { code: v, name: v };
    });
  }, [value, services]);
  const options = useMemo(
    () => [...services, ...selected.filter((service) => !services.includes(service))],
    [services, selected]
  );

  // Props shared by the single- and multi-select variants (the NioSelect precedent).
  const shared = {
    size: 'small' as const,
    options,
    getOptionLabel: (o: BillingServiceOption): string => o.name,
    isOptionEqualToValue: (o: BillingServiceOption, v: BillingServiceOption): boolean => o.code === v.code,
    renderOption: (props: HTMLAttributes<HTMLLIElement>, o: BillingServiceOption): ReactElement => (
      <li {...props} key={o.code}>
        {o.name}
      </li>
    ),
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
      <Autocomplete<BillingServiceOption, true, false, false>
        {...shared}
        multiple
        // Picked services leave the list, so Enter can't pick one again (which would remove it).
        filterSelectedOptions
        value={selected}
        onChange={(_, next) => onChange(next.map((service) => service.name))}
        sx={{ minWidth: 260 }}
      />
    );
  }

  return (
    <Autocomplete<BillingServiceOption, false, false, false>
      {...shared}
      value={selected[0] ?? null}
      onChange={(_, next) => onChange(next?.name ?? '')}
      sx={{ minWidth: 240 }}
    />
  );
}
