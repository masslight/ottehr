/**
 * The vocabulary an administrator maps PDF form fields against.
 *
 * A token is one named, typed, human-labelled handle on a single piece of encounter context. Deciding
 * that a token is worth offering, what its label reads, and what type it carries are product decisions,
 * so the catalog is hand-written rather than derived from the shape of the underlying data. Reflecting
 * the resource graph would surface hundreds of entries that are individually meaningless to an
 * administrator, and would still miss the atoms that matter most.
 */

/**
 * Deliberately small. The type exists so the mapping UI can reject a binding a field cannot accept —
 * a date bound to a checkbox — before it becomes a silently blank field at fill time.
 */
export type FormTokenType = 'string' | 'date' | 'boolean' | 'number';

export type FormTokenGroup =
  | 'Patient'
  | 'Visit'
  | 'Provider'
  | 'Facility'
  | 'Insurance'
  | 'Vitals'
  | 'Clinical'
  | 'Workers comp'
  | 'Form';

export interface FormTokenDescriptor {
  /**
   * Stable identity, and the only part of a token that gets persisted: mappings store keys, never labels.
   *
   * Keys are therefore append-only. A key may be deprecated but must never be deleted or repurposed —
   * repurposing silently rewires every mapping already using it, with no error anywhere.
   */
  key: string;
  /** Shown in the mapping UI. Safe to reword at any time; nothing stores it. */
  label: string;
  group: FormTokenGroup;
  type: FormTokenType;
  /** Optional clarification for tokens whose label alone leaves the source ambiguous. */
  description?: string;
}
