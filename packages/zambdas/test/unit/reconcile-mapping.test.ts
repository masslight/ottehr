import { FormTemplateMapping } from 'utils/lib/form-tokens/mapping';
import { FormFieldInfo, FormFieldType } from 'utils/lib/types/api/form-template.types';
import { describe, expect, it } from 'vitest';
import { reconcileMappingWithFields } from '../../src/ehr/shared/form-template-helpers';

/**
 * What survives a PDF replacement.
 *
 * A binding that should have been dropped is worse than one that was: it points at something real, fills
 * without complaint, and puts the wrong value on a form nobody re-reads. So the question each case asks is
 * whether a binding the new document can no longer honour is actually removed.
 */
const field = (name: string, type: FormFieldType, mappable = true): FormFieldInfo =>
  ({ name, type, mappable, readOnly: !mappable, pages: [0] }) as FormFieldInfo;

const mappingWith = (...bindings: FormTemplateMapping['bindings']): FormTemplateMapping => ({
  version: 1,
  bindings,
});

describe('reconcileMappingWithFields', () => {
  it('keeps a binding the replacement can still honour', () => {
    const { mapping, dropped } = reconcileMappingWithFields(
      mappingWith({ fieldName: 'name', tokenKey: 'patient.firstName' }),
      [field('name', 'text')]
    );

    expect(dropped).toEqual([]);
    expect(mapping.bindings).toHaveLength(1);
  });

  it('drops a binding whose field the replacement no longer has', () => {
    const { dropped } = reconcileMappingWithFields(mappingWith({ fieldName: 'gone', tokenKey: 'patient.firstName' }), [
      field('name', 'text'),
    ]);

    expect(dropped).toEqual(['gone']);
  });

  it('drops a binding whose field kept its name but changed type', () => {
    // The case a name-only check misses: the binding still resolves, and writes a patient's name into
    // something that is now a checkbox.
    const { dropped } = reconcileMappingWithFields(mappingWith({ fieldName: 'name', tokenKey: 'patient.firstName' }), [
      field('name', 'checkbox'),
    ]);

    expect(dropped).toEqual(['name']);
  });

  it('drops a binding whose field became read-only', () => {
    // Same name, same type, but the filler cannot write it — and a failed write can cost the whole
    // prefill rather than one field.
    const { dropped } = reconcileMappingWithFields(mappingWith({ fieldName: 'name', tokenKey: 'patient.firstName' }), [
      field('name', 'text', false),
    ]);

    expect(dropped).toEqual(['name']);
  });

  it('drops a binding naming a token the catalog no longer declares', () => {
    const { dropped } = reconcileMappingWithFields(
      mappingWith({ fieldName: 'name', tokenKey: 'patient.retiredLongAgo' }),
      [field('name', 'text')]
    );

    expect(dropped).toEqual(['name']);
  });

  it('drops a pairing that now needs a transform it does not carry', () => {
    // `visit.date` on a text field needs a date format. Without one the binding is incomplete, and the
    // editor would not let an administrator create it today either.
    const { dropped } = reconcileMappingWithFields(mappingWith({ fieldName: 'when', tokenKey: 'visit.date' }), [
      field('when', 'text'),
    ]);

    expect(dropped).toEqual(['when']);
  });
});
