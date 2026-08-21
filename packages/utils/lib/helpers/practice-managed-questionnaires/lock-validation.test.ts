import { describe, expect, it } from 'vitest';
import { PracticeManagedQuestionnaireItem } from '../../types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';
import { validateEditsAgainstLocks } from './lock-validation';

const item = (overrides: Partial<PracticeManagedQuestionnaireItem>): PracticeManagedQuestionnaireItem =>
  ({ _key: 'k'.repeat(8), linkId: 'x', type: 'string', ...overrides }) as PracticeManagedQuestionnaireItem;

// a base intake-shaped questionnaire: one harvested page with a harvested string field, a harvested
// choice with a protected coded option, and a free (non-harvested) field
const makeBase = (): { item: PracticeManagedQuestionnaireItem[] } => ({
  item: [
    item({
      linkId: 'contact-information-page',
      type: 'group',
      item: [
        item({ linkId: 'patient-first-name', type: 'string', text: 'First name', required: true }),
        item({
          linkId: 'patient-birth-sex',
          type: 'choice',
          answerOption: [
            { valueCoding: { code: 'Male', display: 'Male' } },
            { valueCoding: { code: 'Female', display: 'Female' } },
            { valueCoding: { code: 'Intersex', display: 'Intersex' } },
          ],
        }),
        item({ linkId: 'favorite-color', type: 'string', text: 'Favorite color' }),
      ],
    }),
  ],
});

describe('validateEditsAgainstLocks', () => {
  it('allows a display-only edit of a locked field and its protected option label', () => {
    const base = makeBase();
    const submitted = makeBase();
    // reword a locked field's label + relabel a protected option's display (code stays frozen)
    submitted.item[0].item![0].text = 'Legal first name';
    submitted.item[0].item![1].answerOption = [
      { valueCoding: { code: 'Male', display: 'Man' } },
      { valueCoding: { code: 'Female', display: 'Woman' } },
      { valueCoding: { code: 'Intersex', display: 'Intersex' } },
    ];
    // free field can be renamed/removed/retyped freely
    submitted.item[0].item![2].text = 'Best color';

    expect(validateEditsAgainstLocks(submitted, base)).toEqual([]);
  });

  it('rejects removing a locked field', () => {
    const base = makeBase();
    const submitted = makeBase();
    submitted.item[0].item!.splice(0, 1); // drop patient-first-name

    const violations = validateEditsAgainstLocks(submitted, base);
    expect(violations.some((v) => v.includes('patient-first-name'))).toBe(true);
  });

  it('rejects retyping or changing required on a locked field', () => {
    const base = makeBase();
    const retyped = makeBase();
    retyped.item[0].item![0].type = 'text';
    expect(validateEditsAgainstLocks(retyped, base).some((v) => v.includes('type'))).toBe(true);

    const requiredChanged = makeBase();
    requiredChanged.item[0].item![0].required = false;
    expect(validateEditsAgainstLocks(requiredChanged, base).some((v) => v.includes('required'))).toBe(true);
  });

  it('rejects removing/changing a protected option code', () => {
    const base = makeBase();
    const submitted = makeBase();
    // drop the 'Intersex' protected code
    submitted.item[0].item![1].answerOption = [
      { valueCoding: { code: 'Male', display: 'Male' } },
      { valueCoding: { code: 'Female', display: 'Female' } },
    ];

    const violations = validateEditsAgainstLocks(submitted, base);
    expect(violations.some((v) => v.includes('Intersex'))).toBe(true);
  });

  it('rejects removing a harvested page', () => {
    const base = makeBase();
    const submitted = { item: [] as PracticeManagedQuestionnaireItem[] };

    const violations = validateEditsAgainstLocks(submitted, base);
    expect(violations.some((v) => v.includes('contact-information-page'))).toBe(true);
  });
});
