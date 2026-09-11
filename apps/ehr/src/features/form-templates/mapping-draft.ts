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

/** Identifies the document, not just the template: replacing the PDF keeps the id and changes the fields. */
const inventorySignature = (fields: { name: string; type: string }[]): string =>
  fields
    .map((field) => `${field.name}:${field.type}`)
    .sort()
    .join('|');

/**
 * The draft for this template, if it was authored against the fields the PDF still has.
 *
 * Matching on the template id alone is not enough. `clearMappingDraft` only fires on the paths this tab
 * takes, so a PDF replaced in another tab — or by another administrator — leaves this tab holding a draft
 * whose bindings name fields that no longer exist. Restoring it would reintroduce exactly the bindings a
 * replacement had just reconciled away, which is the failure `clearMappingDraft` exists to prevent and
 * cannot cover on its own.
 */
export const readMappingDraft = (
  templateId: string,
  fields: { name: string; type: string }[]
): FormFieldBinding[] | undefined => {
  try {
    const raw = sessionStorage.getItem(draftKeyFor(templateId));
    if (!raw) return undefined;

    const parsed = JSON.parse(raw) as { bindings?: unknown; fields?: unknown };
    if (!Array.isArray(parsed.bindings)) return undefined;

    // A draft from before this check has no `fields`, so it cannot be shown to match and is discarded.
    if (typeof parsed.fields !== 'string' || parsed.fields !== inventorySignature(fields)) {
      return undefined;
    }

    return parsed.bindings as FormFieldBinding[];
  } catch {
    return undefined;
  }
};

export const writeMappingDraft = (
  templateId: string,
  fields: { name: string; type: string }[],
  bindings: FormFieldBinding[]
): void => {
  try {
    sessionStorage.setItem(
      draftKeyFor(templateId),
      JSON.stringify({ version: 1, fields: inventorySignature(fields), bindings })
    );
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
