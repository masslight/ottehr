/** Stored answers for "Performed by" / "Documented by" and how each reads inside a sentence. */
export const PERFORMED_BY_OPTIONS = [
  { value: 'Healthcare staff', label: 'healthcare staff' },
  { value: 'Provider', label: 'provider' },
  { value: 'Both', label: 'provider and healthcare staff' },
];
export const DOCUMENTED_BY_OPTIONS = PERFORMED_BY_OPTIONS.filter((option) => option.value !== 'Both');
