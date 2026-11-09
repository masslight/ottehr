import { ReactElement, ReactNode } from 'react';

// A plain labelled input standing in for pickers that need MUI X or live search under jsdom
// (DateInput, PayerSelect, ProviderSelect, ProcedureCodeAutocomplete). An error is marked the way MUI
// marks one, for code that looks for the first field showing an error.
export function InputStub({
  label,
  value,
  onChange,
  error,
  helperText,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  helperText?: ReactNode;
}): ReactElement {
  return (
    <label className={error ? 'Mui-error' : undefined}>
      {label}
      <input aria-label={label} value={value ?? ''} onChange={(event) => onChange(event.target.value)} />
      {helperText ? <span>{helperText}</span> : null}
    </label>
  );
}
