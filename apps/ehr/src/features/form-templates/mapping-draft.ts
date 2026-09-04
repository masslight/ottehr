import { FormFieldBinding } from 'utils/lib/form-tokens/mapping';

/**
 * Unsaved mappings survive a reload in session storage.
 *
 * Mapping a long form is many minutes of work, and losing it to an accidental refresh is the kind of
 * thing that stops people trusting the screen. Session storage rather than local storage: the draft is
 * meant to outlive a reload, not to follow someone around for weeks after they abandoned it.
 *
 * Every access is guarded — storage can be full, disabled, or unavailable in a private window, and none
 * of that is worth failing the page over.
 */
const draftKeyFor = (templateId: string): string => `ottehr.form-template-mapping-draft.${templateId}`;

export const readMappingDraft = (templateId: string): FormFieldBinding[] | undefined => {
  try {
    const raw = sessionStorage.getItem(draftKeyFor(templateId));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { bindings?: unknown };
    return Array.isArray(parsed.bindings) ? (parsed.bindings as FormFieldBinding[]) : undefined;
  } catch {
    return undefined;
  }
};

export const writeMappingDraft = (templateId: string, bindings: FormFieldBinding[]): void => {
  try {
    sessionStorage.setItem(draftKeyFor(templateId), JSON.stringify({ version: 1, bindings }));
  } catch {
    // The mapping still saves normally; only the local draft is lost.
  }
};

/**
 * Discards the draft.
 *
 * Called after a successful save, and after the template's PDF is replaced — a draft authored against
 * the old field inventory would otherwise be restored on the next visit and quietly reintroduce
 * bindings the replacement had just reconciled away.
 */
export const clearMappingDraft = (templateId: string): void => {
  try {
    sessionStorage.removeItem(draftKeyFor(templateId));
  } catch {
    // A stale draft is ignored on load when it matches what the server holds, so this is not harmful.
  }
};
