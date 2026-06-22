/**
 * Scrolls to (and focuses) the first invalid field so the user is taken
 * straight to what needs fixing after pressing Save.
 *
 * @param fieldKeys - Ordered list of field keys to consider (defines priority).
 * @param hasError - Predicate returning whether a given field key is invalid.
 */
export const scrollToFirstInvalidField = (fieldKeys: string[], hasError: (key: string) => boolean): void => {
  const FOCUSABLE_SELECTOR = 'input, textarea, select, [tabindex]';

  const firstInvalidKey = fieldKeys.find((key) => hasError(key));

  if (!firstInvalidKey) return;

  const fieldElement =
    document.getElementById(firstInvalidKey) ||
    document.querySelector<HTMLElement>(`[name="${firstInvalidKey}"], [aria-label="${firstInvalidKey}"]`);

  if (!fieldElement) return;

  fieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const inputToFocus = fieldElement.matches(FOCUSABLE_SELECTOR)
    ? fieldElement
    : fieldElement.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);

  inputToFocus?.focus({ preventScroll: true });
};
