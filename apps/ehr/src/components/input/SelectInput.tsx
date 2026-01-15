import React from 'react';
import { AutocompleteInput, AutocompleteInputProps } from './AutocompleteInput';

type Props<Value> = Omit<AutocompleteInputProps<Value>, 'selectOnly'>;

export function SelectInput<Value>(props: Props<Value>): React.JSX.Element {
  return <AutocompleteInput {...props} />;
}
