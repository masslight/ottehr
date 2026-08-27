import { checkCompatibility, isBindingComplete, requiredTransformKind } from 'utils/lib/form-tokens/mapping';
import { TOKEN_CATALOG } from 'utils/lib/form-tokens/token-catalog';
import { FormFieldType } from 'utils/lib/types/api/form-template.types';
import { describe, expect, it } from 'vitest';

describe('binding compatibility', () => {
  it('never allows a binding to a signature or button field', () => {
    // These hold no value we could supply, so no token should be offerable for them at all.
    for (const token of TOKEN_CATALOG) {
      expect(checkCompatibility(token.type, 'signature')).toBe('incompatible');
      expect(checkCompatibility(token.type, 'button')).toBe('incompatible');
    }
  });

  it('requires a format for the pairings that are meaningful but incomplete', () => {
    // A date is not a string — something has to decide how it reads on the page — and a boolean in a
    // text box could be "Yes", "X" or anything else. Both are accepted only with a transform.
    expect(checkCompatibility('date', 'text')).toBe('needsTransform');
    expect(requiredTransformKind('date', 'text')).toBe('dateFormat');

    expect(checkCompatibility('boolean', 'text')).toBe('needsTransform');
    expect(requiredTransformKind('boolean', 'text')).toBe('booleanText');
  });

  it('lets a boolean drive a checkbox directly, because the export value comes from the field', () => {
    expect(checkCompatibility('boolean', 'checkbox')).toBe('direct');
    expect(requiredTransformKind('boolean', 'checkbox')).toBeUndefined();
  });

  it('rejects a date bound to anything other than a text field', () => {
    const nonText: FormFieldType[] = ['checkbox', 'radio', 'dropdown', 'optionList'];
    for (const fieldType of nonText) {
      expect(checkCompatibility('date', fieldType)).toBe('incompatible');
    }
  });

  it('treats a binding as incomplete until its required transform is supplied', () => {
    const binding = { fieldName: 'f1', tokenKey: 'patient.dateOfBirth' };
    expect(isBindingComplete(binding, 'date', 'text')).toBe(false);

    const withFormat = { ...binding, transform: { kind: 'dateFormat' as const, format: 'MM/DD/YYYY' as const } };
    expect(isBindingComplete(withFormat, 'date', 'text')).toBe(true);

    // The wrong kind of transform does not satisfy the requirement.
    const wrongKind = { ...binding, transform: { kind: 'booleanText' as const, trueText: 'Y', falseText: 'N' } };
    expect(isBindingComplete(wrongKind, 'date', 'text')).toBe(false);
  });

  it('leaves every catalog token bindable to at least one field type', () => {
    // A token no field can accept would sit in the picker permanently unusable.
    const fieldTypes: FormFieldType[] = ['text', 'checkbox', 'radio', 'dropdown', 'optionList'];
    for (const token of TOKEN_CATALOG) {
      const usable = fieldTypes.some((fieldType) => checkCompatibility(token.type, fieldType) !== 'incompatible');
      expect(usable, `token ${token.key} cannot bind to any field type`).toBe(true);
    }
  });
});
