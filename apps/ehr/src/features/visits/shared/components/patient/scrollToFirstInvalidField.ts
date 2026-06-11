/**
 * Scrolls to (and focuses) the first invalid field so the user is taken
 * straight to what needs fixing after pressing Save.
 *
 * Field rows render their input wrapper with `id={fieldKey}` (see Row.tsx), so
 * we locate the element by the field key and bring it into view.
 *
 * @param fieldKeys - Ordered list of field keys to consider (defines priority).
 * @param hasError - Predicate returning whether a given field key is invalid.
 */
export const scrollToFirstInvalidField = (fieldKeys: string[], hasError: (key: string) => boolean): void => {
  const firstInvalidKey = fieldKeys.find((key) => hasError(key));
  if (!firstInvalidKey) return;

  const el = document.getElementById(firstInvalidKey);
  if (!el) return;

  el.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // Focus the underlying input so the user can immediately start typing.
  const focusable = el.querySelector<HTMLElement>('input, textarea, select, [tabindex]');
  focusable?.focus({ preventScroll: true });
};
