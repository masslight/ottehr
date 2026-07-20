import { Questionnaire, QuestionnaireResponseItem } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import {
  OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS,
  PRACTICE_MANAGED_QUESTIONNAIRE_TAG,
  QR_DISTRIBUTION_TAG,
} from '../../fhir';
import { PracticeManagedQuestionnaire, PracticeManagedQuestionnaireItem } from '../../types';
import {
  fhirQuestionnaireItemToManaged,
  fhirQuestionnaireToPracticeManaged,
  formatQuestionnaireItemValueToString,
  generatePracticeManagedQuestionnaireItemKey,
  isPracticeManagedQ,
  makePracticeManagedUrl,
  makeStandaloneFormDTO,
  PRACTICE_MANAGED_QUESTIONNAIRE_BASE_VERSION,
  practiceManagedQuestionnaireToFhir,
  qrSentManually,
} from './index';

const DATA_TYPE_URL = OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.dataType;
const INPUT_WIDTH_URL = OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.inputWidth;

const baseManagedQuestionnaire = (
  overrides: Partial<PracticeManagedQuestionnaire> = {}
): PracticeManagedQuestionnaire =>
  ({
    resourceType: 'Questionnaire',
    status: 'active',
    name: 'test-form',
    title: 'Test Form',
    url: 'https://ottehr.com/FHIR/Questionnaire/test-form',
    version: '1.0.0',
    item: [],
    ...overrides,
  }) as PracticeManagedQuestionnaire;

const managedItem = (overrides: Partial<PracticeManagedQuestionnaireItem> = {}): PracticeManagedQuestionnaireItem =>
  ({
    linkId: 'item-1',
    type: 'string',
    _key: 'abcd1234',
    ...overrides,
  }) as PracticeManagedQuestionnaireItem;

const baseFhirQuestionnaire = (overrides: Partial<Questionnaire> = {}): Questionnaire =>
  ({
    resourceType: 'Questionnaire',
    status: 'active',
    name: 'test-form',
    title: 'Test Form',
    item: [],
    ...overrides,
  }) as Questionnaire;

describe('practiceManagedQuestionnaireToFhir', () => {
  it('converts dataType and inputWidth fields to extensions and strips managed-only fields', () => {
    const questionnaire = baseManagedQuestionnaire({
      item: [managedItem({ dataType: 'Email', inputWidth: 's' })],
    });

    const fhir = practiceManagedQuestionnaireToFhir(questionnaire);

    expect(fhir.item?.[0]).not.toHaveProperty('_key');
    expect(fhir.item?.[0]).not.toHaveProperty('dataType');
    expect(fhir.item?.[0]).not.toHaveProperty('inputWidth');
    expect(fhir.item?.[0].extension).toEqual(
      expect.arrayContaining([
        { url: DATA_TYPE_URL, valueString: 'Email' },
        { url: INPUT_WIDTH_URL, valueString: 's' },
      ])
    );
  });

  it('preserves non-ottehr extensions already present on the item', () => {
    const otherExt = { url: 'https://example.com/some-other-extension', valueString: 'keep-me' };
    const questionnaire = baseManagedQuestionnaire({
      item: [managedItem({ extension: [otherExt] })],
    });

    const fhir = practiceManagedQuestionnaireToFhir(questionnaire);

    expect(fhir.item?.[0].extension).toEqual([otherExt]);
  });

  it('omits an empty string text field', () => {
    const questionnaire = baseManagedQuestionnaire({
      item: [managedItem({ text: '' })],
    });

    const fhir = practiceManagedQuestionnaireToFhir(questionnaire);

    expect(fhir.item?.[0]).not.toHaveProperty('text');
  });

  it('filters out answerOption entries that are entirely empty strings', () => {
    const questionnaire = baseManagedQuestionnaire({
      item: [
        managedItem({
          answerOption: [{ valueString: '' }, { valueString: 'keep' }],
        }),
      ],
    });

    const fhir = practiceManagedQuestionnaireToFhir(questionnaire);

    expect(fhir.item?.[0].answerOption).toEqual([{ valueString: 'keep' }]);
  });

  it('removes the answerOption array entirely when every option is empty', () => {
    const questionnaire = baseManagedQuestionnaire({
      item: [managedItem({ answerOption: [{ valueString: '' }] })],
    });

    const fhir = practiceManagedQuestionnaireToFhir(questionnaire);

    expect(fhir.item?.[0]).not.toHaveProperty('answerOption');
  });

  it('recursively converts nested items', () => {
    const questionnaire = baseManagedQuestionnaire({
      item: [
        managedItem({
          type: 'group',
          item: [managedItem({ linkId: 'child-1', dataType: 'SSN' })],
        }),
      ],
    });

    const fhir = practiceManagedQuestionnaireToFhir(questionnaire);

    const child = fhir.item?.[0].item?.[0];
    expect(child).not.toHaveProperty('_key');
    expect(child?.extension).toEqual([{ url: DATA_TYPE_URL, valueString: 'SSN' }]);
  });

  it('adds the practice-managed tag when not already present', () => {
    const questionnaire = baseManagedQuestionnaire();

    const fhir = practiceManagedQuestionnaireToFhir(questionnaire);

    expect(fhir.meta?.tag).toEqual(
      expect.arrayContaining([expect.objectContaining(PRACTICE_MANAGED_QUESTIONNAIRE_TAG)])
    );
  });

  it('does not duplicate the tag if it is already present', () => {
    const questionnaire = baseManagedQuestionnaire({
      meta: { tag: [PRACTICE_MANAGED_QUESTIONNAIRE_TAG] },
    });

    const fhir = practiceManagedQuestionnaireToFhir(questionnaire);

    expect(fhir.meta?.tag?.filter((t) => t.code === PRACTICE_MANAGED_QUESTIONNAIRE_TAG.code)).toHaveLength(1);
  });

  it('preserves other existing tags', () => {
    const otherTag = { system: 'https://example.com/other', code: 'other-tag' };
    const questionnaire = baseManagedQuestionnaire({ meta: { tag: [otherTag] } });

    const fhir = practiceManagedQuestionnaireToFhir(questionnaire);

    expect(fhir.meta?.tag).toEqual(
      expect.arrayContaining([otherTag, expect.objectContaining(PRACTICE_MANAGED_QUESTIONNAIRE_TAG)])
    );
  });
});

describe('fhirQuestionnaireToPracticeManaged', () => {
  it('assigns an 8-character _key to each item, including nested items', () => {
    const questionnaire = baseFhirQuestionnaire({
      item: [{ linkId: 'parent', type: 'group', item: [{ linkId: 'child', type: 'string' }] }],
    });

    const managed = fhirQuestionnaireToPracticeManaged(questionnaire);

    expect(managed.item?.[0]._key).toHaveLength(8);
  });

  it('defaults the version when none is provided', () => {
    const questionnaire = baseFhirQuestionnaire();

    const managed = fhirQuestionnaireToPracticeManaged(questionnaire);

    expect(managed.version).toBe(PRACTICE_MANAGED_QUESTIONNAIRE_BASE_VERSION);
  });

  it('preserves an explicit version', () => {
    const questionnaire = baseFhirQuestionnaire({ version: '2.3.1' });

    const managed = fhirQuestionnaireToPracticeManaged(questionnaire);

    expect(managed.version).toBe('2.3.1');
  });

  it('generates a url from the slugified title when none is provided', () => {
    const questionnaire = baseFhirQuestionnaire({ title: 'My Cool Form!' });

    const managed = fhirQuestionnaireToPracticeManaged(questionnaire);

    expect(managed.url).toBe(makePracticeManagedUrl('my-cool-form'));
  });

  it('preserves an explicit url', () => {
    const questionnaire = baseFhirQuestionnaire({ url: 'https://example.com/custom-url' });

    const managed = fhirQuestionnaireToPracticeManaged(questionnaire);

    expect(managed.url).toBe('https://example.com/custom-url');
  });

  it('throws when required fields like title are missing', () => {
    const questionnaire = baseFhirQuestionnaire({ title: undefined });

    expect(() => fhirQuestionnaireToPracticeManaged(questionnaire)).toThrow(/Questionnaire is missing required fields/);
  });

  it('throws when status is missing', () => {
    const questionnaire = baseFhirQuestionnaire({ status: undefined });

    expect(() => fhirQuestionnaireToPracticeManaged(questionnaire)).toThrow();
  });
});

describe('generatePracticeManagedQuestionnaireItemKey', () => {
  it('returns an 8-character string', () => {
    expect(generatePracticeManagedQuestionnaireItemKey()).toHaveLength(8);
  });

  it('returns a different value on each call', () => {
    const first = generatePracticeManagedQuestionnaireItemKey();
    const second = generatePracticeManagedQuestionnaireItemKey();
    expect(first).not.toBe(second);
  });
});

describe('fhirQuestionnaireItemToManaged', () => {
  it('extracts a valid dataType extension into the dataType field', () => {
    const item = fhirQuestionnaireItemToManaged({
      linkId: 'item-1',
      type: 'string',
      extension: [{ url: DATA_TYPE_URL, valueString: 'Email' }],
    });

    expect(item.dataType).toBe('Email');
    expect(item.extension).toBeUndefined();
  });

  it('leaves dataType undefined when the extension value is not a recognized data type', () => {
    const item = fhirQuestionnaireItemToManaged({
      linkId: 'item-1',
      type: 'string',
      extension: [{ url: DATA_TYPE_URL, valueString: 'not-a-real-type' }],
    });

    expect(item.dataType).toBeUndefined();
  });

  it('extracts a valid inputWidth extension into the inputWidth field', () => {
    const item = fhirQuestionnaireItemToManaged({
      linkId: 'item-1',
      type: 'string',
      extension: [{ url: INPUT_WIDTH_URL, valueString: 'm' }],
    });

    expect(item.inputWidth).toBe('m');
  });

  it('preserves non-ottehr extensions', () => {
    const otherExt = { url: 'https://example.com/other', valueString: 'value' };
    const item = fhirQuestionnaireItemToManaged({
      linkId: 'item-1',
      type: 'string',
      extension: [otherExt],
    });

    expect(item.extension).toEqual([otherExt]);
  });

  it('assigns an 8-character _key', () => {
    const item = fhirQuestionnaireItemToManaged({ linkId: 'item-1', type: 'string' });

    expect(item._key).toHaveLength(8);
  });

  it('recursively converts nested items', () => {
    const item = fhirQuestionnaireItemToManaged({
      linkId: 'parent',
      type: 'group',
      item: [{ linkId: 'child', type: 'string' }],
    });

    expect(item.item?.[0]._key).toHaveLength(8);
    expect(item.item?.[0].linkId).toBe('child');
  });

  it('throws when required fields are missing', () => {
    expect(() => fhirQuestionnaireItemToManaged({} as any)).toThrow(/Questionnaire item is missing required fields/);
  });
});

describe('isPracticeManagedQ', () => {
  it('returns false for undefined', () => {
    expect(isPracticeManagedQ(undefined)).toBe(false);
  });

  it('returns false when the tag is absent', () => {
    expect(isPracticeManagedQ(baseFhirQuestionnaire())).toBe(false);
  });

  it('returns true when the practice-managed tag is present', () => {
    const questionnaire = baseFhirQuestionnaire({ meta: { tag: [PRACTICE_MANAGED_QUESTIONNAIRE_TAG] } });

    expect(isPracticeManagedQ(questionnaire)).toBe(true);
  });

  it('returns false for a tag with a matching code but different system', () => {
    const questionnaire = baseFhirQuestionnaire({
      meta: { tag: [{ system: 'https://example.com/other', code: PRACTICE_MANAGED_QUESTIONNAIRE_TAG.code }] },
    });

    expect(isPracticeManagedQ(questionnaire)).toBe(false);
  });
});

describe('qrSentManually', () => {
  it('returns false for undefined', () => {
    expect(qrSentManually(undefined)).toBe(false);
  });

  it('returns true when the qr-distribution tag is present', () => {
    expect(
      qrSentManually({
        resourceType: 'QuestionnaireResponse',
        status: 'completed',
        meta: { tag: [QR_DISTRIBUTION_TAG] },
      })
    ).toBe(true);
  });

  it('returns false when the tag is absent', () => {
    expect(qrSentManually({ resourceType: 'QuestionnaireResponse', status: 'completed' })).toBe(false);
  });
});

describe('formatQuestionnaireItemValueToString', () => {
  it('returns an empty string for an undefined item', () => {
    expect(formatQuestionnaireItemValueToString(undefined)).toBe('');
  });

  it('returns an empty string when there is no answer', () => {
    expect(formatQuestionnaireItemValueToString({ linkId: 'item-1' })).toBe('');
  });

  it('prefers valueCoding.display', () => {
    const item: QuestionnaireResponseItem = {
      linkId: 'item-1',
      answer: [{ valueCoding: { display: 'Yes' } }],
    };

    expect(formatQuestionnaireItemValueToString(item)).toBe('Yes');
  });

  it('formats valueString, including an empty string', () => {
    expect(formatQuestionnaireItemValueToString({ linkId: 'item-1', answer: [{ valueString: 'hello' }] })).toBe(
      'hello'
    );
    expect(formatQuestionnaireItemValueToString({ linkId: 'item-1', answer: [{ valueString: '' }] })).toBe('');
  });

  it('formats valueBoolean as Positive/Negative', () => {
    expect(formatQuestionnaireItemValueToString({ linkId: 'item-1', answer: [{ valueBoolean: true }] })).toBe(
      'Positive'
    );
    expect(formatQuestionnaireItemValueToString({ linkId: 'item-1', answer: [{ valueBoolean: false }] })).toBe(
      'Negative'
    );
  });

  it('formats valueInteger, including zero', () => {
    expect(formatQuestionnaireItemValueToString({ linkId: 'item-1', answer: [{ valueInteger: 42 }] })).toBe('42');
    expect(formatQuestionnaireItemValueToString({ linkId: 'item-1', answer: [{ valueInteger: 0 }] })).toBe('0');
  });

  it('formats valueDecimal', () => {
    expect(formatQuestionnaireItemValueToString({ linkId: 'item-1', answer: [{ valueDecimal: 1.5 }] })).toBe('1.5');
  });

  it('formats valueDate and valueDateTime', () => {
    expect(formatQuestionnaireItemValueToString({ linkId: 'item-1', answer: [{ valueDate: '2024-01-01' }] })).toBe(
      '2024-01-01'
    );
    expect(
      formatQuestionnaireItemValueToString({
        linkId: 'item-1',
        answer: [{ valueDateTime: '2024-01-01T00:00:00Z' }],
      })
    ).toBe('2024-01-01T00:00:00Z');
  });

  it('returns an empty string for an unrecognized answer type', () => {
    expect(
      formatQuestionnaireItemValueToString({ linkId: 'item-1', answer: [{ valueReference: { reference: 'x' } }] })
    ).toBe('');
  });
});

describe('makePracticeManagedUrl', () => {
  it('builds the expected url from a slug', () => {
    expect(makePracticeManagedUrl('my-form')).toBe('https://ottehr.com/FHIR/Questionnaire/my-form');
  });
});

describe('makeStandaloneFormDTO', () => {
  it('falls back to default title and empty id when missing', () => {
    const dto = makeStandaloneFormDTO(baseFhirQuestionnaire({ title: undefined, id: undefined, item: undefined }), {
      resourceType: 'QuestionnaireResponse',
      status: 'completed',
    });

    expect(dto.questionnaireTitle).toBe('A form');
    expect(dto.questionnaireId).toBe('');
    expect(dto.allItems).toEqual([]);
  });

  it('uses the provided title, id, and questionnaireResponse', () => {
    const questionnaireResponse = { resourceType: 'QuestionnaireResponse' as const, status: 'completed' as const };
    const dto = makeStandaloneFormDTO(
      baseFhirQuestionnaire({ title: 'Intake Form', id: 'q-123' }),
      questionnaireResponse
    );

    expect(dto.questionnaireTitle).toBe('Intake Form');
    expect(dto.questionnaireId).toBe('q-123');
    expect(dto.questionnaireResponse).toBe(questionnaireResponse);
  });

  it('does not mutate the original questionnaire item array', () => {
    const questionnaire = baseFhirQuestionnaire({
      item: [{ linkId: 'parent', type: 'group', item: [{ linkId: 'child', type: 'string' }] }],
    });
    const originalNestedItem = questionnaire.item?.[0];

    makeStandaloneFormDTO(questionnaire, { resourceType: 'QuestionnaireResponse', status: 'completed' });

    expect(questionnaire.item?.[0]).toBe(originalNestedItem);
    expect(questionnaire.item?.[0].item?.[0].linkId).toBe('child');
  });
});
