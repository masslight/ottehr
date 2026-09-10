import { textToNumericValue } from 'utils/lib/utils/convert';

export const parseNumberInput = (raw: string): number | undefined => {
  const parsed = textToNumericValue(raw);
  return parsed !== undefined && Number.isFinite(parsed) ? parsed : undefined;
};
