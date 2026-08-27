import { FormFieldType } from '../types/api/form-template.types';
import { FormTokenType } from '../types/api/form-token.types';

/**
 * How a resolved token value is converted before it is written into a PDF field.
 *
 * Deliberately a small closed set rather than an expression language. Every interface engine grows one
 * eventually, and then the team owns a parser, a sandbox and a debugger. Let real forms demonstrate what
 * is missing before adding to this.
 */
export type FormTransform =
  | {
      kind: 'dateFormat';
      /**
       * `month`, `day` and `year` exist so one date can fan out across the separate MM / DD / YYYY boxes
       * that paper-derived forms use, by binding the same token to three fields with different formats.
       */
      format: 'MM/DD/YYYY' | 'M/D/YYYY' | 'YYYY-MM-DD' | 'MMMM D, YYYY' | 'month' | 'day' | 'year';
    }
  | { kind: 'booleanText'; trueText: string; falseText: string };

/** One PDF field, and where its value comes from. */
export interface FormFieldBinding {
  /** Fully-qualified AcroForm field name, matching the inventory. */
  fieldName: string;
  /** Token key from the catalog. Keys are append-only, so a stored binding stays resolvable. */
  tokenKey: string;
  transform?: FormTransform;
  /** Written when the token resolves to nothing. Omitted means leave the field untouched. */
  fallback?: string;
}

export interface FormTemplateMapping {
  /** Bumped if the stored shape ever changes, so old mappings can be migrated rather than misread. */
  version: 1;
  bindings: FormFieldBinding[];
}

export const EMPTY_MAPPING: FormTemplateMapping = { version: 1, bindings: [] };

/**
 * Whether a token can drive a field, and whether it needs help to do so.
 *
 * `needsTransform` is the interesting case: the binding is meaningful but incomplete, so the mapping UI
 * can insist on a conversion at the moment of binding instead of accepting something half-specified that
 * silently produces a blank box weeks later.
 */
export type BindingCompatibility = 'direct' | 'needsTransform' | 'incompatible';

const CHOICE_FIELDS: ReadonlySet<FormFieldType> = new Set<FormFieldType>(['radio', 'dropdown', 'optionList']);

export const checkCompatibility = (tokenType: FormTokenType, fieldType: FormFieldType): BindingCompatibility => {
  // Nothing can be written into these, whatever the token.
  if (fieldType === 'signature' || fieldType === 'button') return 'incompatible';

  switch (tokenType) {
    case 'string':
      if (fieldType === 'text') return 'direct';
      // The written value has to match one of the field's export values; the UI checks the actual list.
      if (CHOICE_FIELDS.has(fieldType)) return 'direct';
      return 'incompatible';
    case 'number':
      return fieldType === 'text' ? 'direct' : 'incompatible';
    case 'boolean':
      if (fieldType === 'checkbox' || fieldType === 'radio') return 'direct';
      // "Yes"/"No"? "X"/""? Only the author knows, so make them say.
      if (fieldType === 'text') return 'needsTransform';
      return 'incompatible';
    case 'date':
      // A date is not a string; something has to decide how it reads on the page.
      return fieldType === 'text' ? 'needsTransform' : 'incompatible';
    default:
      return 'incompatible';
  }
};

/** The transform kind a `needsTransform` pairing requires, so the UI can offer the right editor. */
export const requiredTransformKind = (
  tokenType: FormTokenType,
  fieldType: FormFieldType
): FormTransform['kind'] | undefined => {
  if (checkCompatibility(tokenType, fieldType) !== 'needsTransform') return undefined;
  return tokenType === 'date' ? 'dateFormat' : 'booleanText';
};

export const DATE_FORMAT_LABELS: Record<Extract<FormTransform, { kind: 'dateFormat' }>['format'], string> = {
  'MM/DD/YYYY': '03/09/2026',
  'M/D/YYYY': '3/9/2026',
  'YYYY-MM-DD': '2026-03-09',
  'MMMM D, YYYY': 'March 9, 2026',
  month: 'Month only (03)',
  day: 'Day only (09)',
  year: 'Year only (2026)',
};

/** A binding is complete when it names a real token and supplies any transform the pairing demands. */
export const isBindingComplete = (
  binding: FormFieldBinding,
  tokenType: FormTokenType,
  fieldType: FormFieldType
): boolean => {
  const compatibility = checkCompatibility(tokenType, fieldType);
  if (compatibility === 'incompatible') return false;
  if (compatibility === 'direct') return true;
  return binding.transform?.kind === requiredTransformKind(tokenType, fieldType);
};
