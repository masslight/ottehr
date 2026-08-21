import { describe, expect, it } from 'vitest';
import {
  PracticeManagedQuestionnaire,
  PracticeManagedQuestionnaireItem,
} from '../../types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';
import { applyProtectedOptionCoding } from './protected-options';

const item = (overrides: Partial<PracticeManagedQuestionnaireItem>): PracticeManagedQuestionnaireItem =>
  ({ _key: 'k'.repeat(8), linkId: 'x', type: 'string', ...overrides }) as PracticeManagedQuestionnaireItem;

const makeQuestionnaire = (): PracticeManagedQuestionnaire =>
  ({
    resourceType: 'Questionnaire',
    status: 'active',
    name: 'default-intake',
    title: 'Default Intake',
    url: 'https://ottehr.com/FHIR/Questionnaire/default-intake',
    version: '1.0.0',
    item: [
      item({
        linkId: 'payment-option-page',
        type: 'group',
        item: [
          item({
            linkId: 'patient-birth-sex',
            type: 'choice',
            answerOption: [{ valueString: 'Male' }, { valueString: 'Female' }, { valueString: 'Intersex' }],
          }),
          item({
            linkId: 'favorite-color',
            type: 'choice',
            answerOption: [{ valueString: 'Blue' }, { valueString: 'Green' }],
          }),
        ],
      }),
    ],
  }) as PracticeManagedQuestionnaire;

describe('applyProtectedOptionCoding', () => {
  it('converts protected valueString options to frozen valueCoding, leaving non-protected untouched', () => {
    const next = applyProtectedOptionCoding(makeQuestionnaire());
    const birthSex = next.item[0].item![0];
    const color = next.item[0].item![1];

    expect(birthSex.answerOption).toEqual([
      { valueCoding: { code: 'Male', display: 'Male' } },
      { valueCoding: { code: 'Female', display: 'Female' } },
      { valueCoding: { code: 'Intersex', display: 'Intersex' } },
    ]);
    // non-harvested field's options stay plain valueString
    expect(color.answerOption).toEqual([{ valueString: 'Blue' }, { valueString: 'Green' }]);
  });

  it('does not mutate the input questionnaire', () => {
    const original = makeQuestionnaire();
    const before = JSON.stringify(original);
    applyProtectedOptionCoding(original);
    expect(JSON.stringify(original)).toBe(before);
  });

  it('leaves already-coded protected options as-is (preserving an edited display)', () => {
    const q = makeQuestionnaire();
    q.item[0].item![0].answerOption = [
      { valueCoding: { code: 'Male', display: 'Man' } },
      { valueString: 'Female' },
      { valueString: 'Intersex' },
    ];
    const next = applyProtectedOptionCoding(q);
    expect(next.item[0].item![0].answerOption).toEqual([
      { valueCoding: { code: 'Male', display: 'Man' } },
      { valueCoding: { code: 'Female', display: 'Female' } },
      { valueCoding: { code: 'Intersex', display: 'Intersex' } },
    ]);
  });
});
