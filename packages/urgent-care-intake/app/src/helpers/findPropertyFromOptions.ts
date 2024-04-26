import { SelectInputOption } from 'ottehr-components';

export function findLabelFromOptions(match: string, array: SelectInputOption[]): string {
  return array.filter((option) => option.value === match)[0].label;
}

export function findValueFromOptions(match: string, array: SelectInputOption[]): string {
  return array.filter((option) => option.label === match)[0].value;
}
