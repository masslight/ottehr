import { textToNumericValue } from 'utils/lib/utils/convert';

/** Parses a number input's value, treating a blank or non-finite entry as cleared. */
export const parseNumberInput = (raw: string): number | undefined => {
  const parsed = textToNumericValue(raw);
  return parsed !== undefined && Number.isFinite(parsed) ? parsed : undefined;
};
