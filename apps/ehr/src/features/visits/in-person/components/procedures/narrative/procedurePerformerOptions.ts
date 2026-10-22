import { PERFORMER_TYPE_OPTIONS } from 'utils/lib/procedure-coding/format';
import { sentenceValue } from './sentenceValue';

/** Stored answers for "Performed by" / "Documented by" and how each reads inside a sentence. */
export const PERFORMED_BY_OPTIONS = PERFORMER_TYPE_OPTIONS.map(({ value, label }) => ({
  value,
  label: sentenceValue(label),
}));
export const DOCUMENTED_BY_OPTIONS = PERFORMED_BY_OPTIONS.filter((option) => option.value !== 'Both');
