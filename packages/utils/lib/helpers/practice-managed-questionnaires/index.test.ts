import { Questionnaire, QuestionnaireResponseItem } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import {
  OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS,
  PRACTICE_DEFAULT_QUESTIONNAIRE_TAG,
  PRACTICE_MANAGED_QUESTIONNAIRE_TAG,
  QR_DISTRIBUTION_TAG,
} from '../../fhir/constants';
import {
  PracticeManagedQuestionnaire,
  PracticeManagedQuestionnaireItem,
} from '../../types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';
import {
  fhirQuestionnaireItemToManaged,
  fhirQuestionnaireToPracticeManaged,
  formatQuestionnaireItemValueToString,
  generatePracticeManagedQuestionnaireItemKey,
  isPortalManagedQ,
  isPracticeDefaultQ,
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

  it('removes the item with empty answerOption', () => {
    const questionnaire = baseManagedQuestionnaire({
      item: [managedItem({ answerOption: [{ valueString: '' }] })],
    });

    const fhir = practiceManagedQuestionnaireToFhir(questionnaire);

    expect(fhir.item?.[0]).toBeUndefined();
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

describe('managed item extension round-trip (WS1.1 fields)', () => {
  const URLS = OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS;

  it('emits the new simple fields as Ottehr extensions and strips the managed-only keys', () => {
    const questionnaire = baseManagedQuestionnaire({
      item: [
        managedItem({
          type: 'text',
          infoText: 'why we ask',
          secondaryInfoText: 'more detail',
          preferredElement: 'Radio',
          attachmentText: 'upload the front',
          minRows: 4,
        }),
      ],
    });

    const item = practiceManagedQuestionnaireToFhir(questionnaire).item?.[0];

    expect(item).not.toHaveProperty('infoText');
    expect(item).not.toHaveProperty('secondaryInfoText');
    expect(item).not.toHaveProperty('preferredElement');
    expect(item).not.toHaveProperty('attachmentText');
    expect(item).not.toHaveProperty('minRows');
    expect(item?.extension).toEqual(
      expect.arrayContaining([
        { url: URLS.infoText, valueString: 'why we ask' },
        { url: URLS.secondaryInfoText, valueString: 'more detail' },
        { url: URLS.preferredElement, valueString: 'Radio' },
        { url: URLS.attachmentText, valueString: 'upload the front' },
        { url: URLS.minRows, valuePositiveInt: 4 },
      ])
    );
  });

  it('parses the new simple extensions back into typed managed fields', () => {
    const item = fhirQuestionnaireItemToManaged({
      linkId: 'item-1',
      type: 'text',
      extension: [
        { url: URLS.infoText, valueString: 'why we ask' },
        { url: URLS.secondaryInfoText, valueString: 'more detail' },
        { url: URLS.preferredElement, valueString: 'Radio List' },
        { url: URLS.attachmentText, valueString: 'front of card' },
        { url: URLS.minRows, valuePositiveInt: 3 },
      ],
    });

    expect(item.infoText).toBe('why we ask');
    expect(item.secondaryInfoText).toBe('more detail');
    expect(item.preferredElement).toBe('Radio List');
    expect(item.attachmentText).toBe('front of card');
    expect(item.minRows).toBe(3);
    expect(item.extension).toBeUndefined();
  });

  it('keeps an unrecognized preferred-element value as a raw extension', () => {
    const ext = { url: URLS.preferredElement, valueString: 'NotAnElement' };
    const item = fhirQuestionnaireItemToManaged({ linkId: 'i', type: 'choice', extension: [ext] });

    expect(item.preferredElement).toBeUndefined();
    expect(item.extension).toEqual([ext]);
  });

  it('parses a native enableWhen into an enable trigger and strips the native field', () => {
    const managed = fhirQuestionnaireItemToManaged({
      linkId: 'child-city',
      type: 'string',
      enableWhen: [{ question: 'has-address', operator: '=', answerBoolean: true }],
    });

    // enableWhen is now owned by the triggers model: it is consumed on parse and regenerated on emit
    expect(managed.enableWhen).toBeUndefined();
    expect(managed.triggers).toEqual([
      { targetQuestionLinkId: 'has-address', effect: ['enable'], operator: '=', answerBoolean: true },
    ]);

    const back = practiceManagedQuestionnaireToFhir(baseManagedQuestionnaire({ item: [managed] })).item?.[0];
    expect(back?.enableWhen).toEqual([{ question: 'has-address', operator: '=', answerBoolean: true }]);
    // a single enable condition does not emit enableBehavior
    expect(back?.enableBehavior).toBeUndefined();
  });

  it('round-trips an attachment item with an Image data type and attachment text', () => {
    const managed = managedItem({
      linkId: 'photo-id-front',
      type: 'attachment',
      dataType: 'Image',
      attachmentText: 'Take a picture of the front',
    });

    const fhir = practiceManagedQuestionnaireToFhir(baseManagedQuestionnaire({ item: [managed] })).item?.[0];
    expect(fhir?.type).toBe('attachment');
    expect(fhir?.extension).toEqual(
      expect.arrayContaining([
        { url: URLS.dataType, valueString: 'Image' },
        { url: URLS.attachmentText, valueString: 'Take a picture of the front' },
      ])
    );

    const roundTripped = fhirQuestionnaireItemToManaged(fhir!);
    expect(roundTripped.type).toBe('attachment');
    expect(roundTripped.dataType).toBe('Image');
    expect(roundTripped.attachmentText).toBe('Take a picture of the front');
  });
});

describe('conditional-behavior round-trip (triggers / dynamicPopulation / disabledDisplay / hideControlLabel)', () => {
  const URLS = OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS;
  const emit = (
    item: PracticeManagedQuestionnaireItem
  ): ReturnType<typeof practiceManagedQuestionnaireToFhir>['item'] =>
    practiceManagedQuestionnaireToFhir(baseManagedQuestionnaire({ item: [item] })).item;
  const findExt = (item: any, url: string): any => (item?.extension ?? []).find((e: any) => e.url === url);

  it('compiles multiple enable triggers to enableWhen + enableBehavior and back', () => {
    const managed = managedItem({
      type: 'string',
      enableBehavior: 'any',
      triggers: [
        { targetQuestionLinkId: 'q1', effect: ['enable'], operator: '=', answerString: 'a' },
        { targetQuestionLinkId: 'q2', effect: ['enable'], operator: '=', answerBoolean: true },
      ],
    });

    const fhir = emit(managed)?.[0];
    expect(fhir?.enableWhen).toEqual([
      { question: 'q1', operator: '=', answerString: 'a' },
      { question: 'q2', operator: '=', answerBoolean: true },
    ]);
    expect(fhir?.enableBehavior).toBe('any');
    expect(fhir).not.toHaveProperty('triggers');

    const back = fhirQuestionnaireItemToManaged(fhir!);
    expect(back.triggers).toEqual(managed.triggers);
    expect(back.enableBehavior).toBe('any');
    expect(back.enableWhen).toBeUndefined();
  });

  it('compiles a require trigger to a require-when extension and back', () => {
    const managed = managedItem({
      type: 'string',
      triggers: [{ targetQuestionLinkId: 'q1', effect: ['require'], operator: '=', answerString: 'Yes' }],
    });

    const fhir = emit(managed)?.[0];
    const requireExt = findExt(fhir, URLS.requireWhen.extension);
    expect(requireExt?.extension).toEqual([
      { url: URLS.requireWhen.question, valueString: 'q1' },
      { url: URLS.requireWhen.operator, valueString: '=' },
      { url: URLS.requireWhen.answer, valueString: 'Yes' },
    ]);
    expect(fhir?.enableWhen).toBeUndefined();

    const back = fhirQuestionnaireItemToManaged(fhir!);
    expect(back.triggers).toEqual(managed.triggers);
    expect(back.extension).toBeUndefined();
  });

  it('compiles a filter trigger to a filter-when extension and back', () => {
    const managed = managedItem({
      type: 'choice',
      answerOption: [{ valueString: 'a' }],
      triggers: [{ targetQuestionLinkId: 'q1', effect: ['filter'], operator: '=', answerString: 'a' }],
    });

    const fhir = emit(managed)?.[0];
    const filterExt = findExt(fhir, URLS.filterWhen.extension);
    expect(filterExt?.extension).toEqual([
      { url: URLS.filterWhen.question, valueString: 'q1' },
      { url: URLS.filterWhen.operator, valueString: '=' },
      { url: URLS.filterWhen.answer, valueString: 'a' },
    ]);

    const back = fhirQuestionnaireItemToManaged(fhir!);
    expect(back.triggers).toEqual(managed.triggers);
  });

  it('compiles a sub-text trigger to a text-when extension (with substituteText) and back', () => {
    const managed = managedItem({
      type: 'string',
      triggers: [
        {
          targetQuestionLinkId: 'q1',
          effect: ['sub-text'],
          operator: '=',
          answerString: 'a',
          substituteText: 'New helper copy',
        },
      ],
    });

    const fhir = emit(managed)?.[0];
    const textWhenExt = findExt(fhir, URLS.textWhen.extension);
    expect(textWhenExt?.extension).toEqual(
      expect.arrayContaining([
        { url: URLS.textWhen.question, valueString: 'q1' },
        { url: URLS.textWhen.operator, valueString: '=' },
        { url: URLS.textWhen.answer, valueString: 'a' },
        { url: URLS.textWhen.substituteText, valueString: 'New helper copy' },
      ])
    );

    const back = fhirQuestionnaireItemToManaged(fhir!);
    expect(back.triggers).toEqual(managed.triggers);
  });

  it('round-trips disabledDisplay: protected', () => {
    const managed = managedItem({ type: 'string', disabledDisplay: 'protected' });

    const fhir = emit(managed)?.[0];
    expect(findExt(fhir, URLS.disabledDisplay)).toEqual({ url: URLS.disabledDisplay, valueString: 'protected' });
    expect(fhir).not.toHaveProperty('disabledDisplay');

    const back = fhirQuestionnaireItemToManaged(fhir!);
    expect(back.disabledDisplay).toBe('protected');
  });

  it('round-trips hideControlLabel: true (emitted only when true)', () => {
    const managed = managedItem({ type: 'boolean', hideControlLabel: true });

    const fhir = emit(managed)?.[0];
    expect(findExt(fhir, URLS.hideControlLabel)).toEqual({ url: URLS.hideControlLabel, valueBoolean: true });

    const back = fhirQuestionnaireItemToManaged(fhir!);
    expect(back.hideControlLabel).toBe(true);
  });

  it('compiles dynamicPopulation to fill-from-when-disabled and forces protected display', () => {
    const managed = managedItem({ type: 'string', dynamicPopulation: { sourceLinkId: 'patient-dob' } });

    const fhir = emit(managed)?.[0];
    expect(findExt(fhir, URLS.autofillFromWhenDisabled)).toEqual({
      url: URLS.autofillFromWhenDisabled,
      valueString: 'patient-dob',
    });
    // the autofill runtime only copies while hidden/protected, so protected is forced when unset
    expect(findExt(fhir, URLS.disabledDisplay)).toEqual({ url: URLS.disabledDisplay, valueString: 'protected' });

    const back = fhirQuestionnaireItemToManaged(fhir!);
    expect(back.dynamicPopulation).toEqual({ sourceLinkId: 'patient-dob' });
    expect(back.disabledDisplay).toBe('protected');
  });

  it('drops the stale native enableWhen when a form is re-saved from a triggers-based item', () => {
    // an item that somehow still carries a native enableWhen alongside triggers must not double-emit
    const managed = managedItem({
      type: 'string',
      enableWhen: [{ question: 'stale', operator: '=', answerBoolean: true }],
      triggers: [{ targetQuestionLinkId: 'q1', effect: ['enable'], operator: '=', answerBoolean: true }],
    } as Partial<PracticeManagedQuestionnaireItem>);

    const fhir = emit(managed)?.[0];
    expect(fhir?.enableWhen).toEqual([{ question: 'q1', operator: '=', answerBoolean: true }]);
  });

  it('round-trips a page-level (group) enable trigger with a dotted cross-page target', () => {
    const managed = managedItem({
      linkId: 'attorney-mva-page',
      type: 'group',
      text: 'Attorney for Motor Vehicle Accident',
      item: [managedItem({ linkId: 'attorney-mva-firm', type: 'string', text: 'Firm' })],
      triggers: [
        {
          targetQuestionLinkId: 'contact-information-page.reason-for-visit',
          effect: ['enable'],
          operator: '=',
          answerString: 'Auto accident',
        },
      ],
    });

    const fhir = emit(managed)?.[0];
    // the page's trigger compiles to a group-level enableWhen keeping the dotted cross-page question verbatim
    expect(fhir?.type).toBe('group');
    expect(fhir?.enableWhen).toEqual([
      { question: 'contact-information-page.reason-for-visit', operator: '=', answerString: 'Auto accident' },
    ]);
    expect(fhir?.item?.[0].linkId).toBe('attorney-mva-firm');
    expect(fhir).not.toHaveProperty('triggers');

    const back = fhirQuestionnaireItemToManaged(fhir!);
    expect(back.triggers).toEqual(managed.triggers);
    expect(back.enableWhen).toBeUndefined();
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

describe('practice-default detection + tag preservation', () => {
  it('isPracticeDefaultQ / isPortalManagedQ recognize the practice-default tag', () => {
    const dflt = baseFhirQuestionnaire({ meta: { tag: [PRACTICE_DEFAULT_QUESTIONNAIRE_TAG] } });
    expect(isPracticeDefaultQ(dflt)).toBe(true);
    expect(isPracticeManagedQ(dflt)).toBe(false);
    expect(isPortalManagedQ(dflt)).toBe(true);

    const managed = baseFhirQuestionnaire({ meta: { tag: [PRACTICE_MANAGED_QUESTIONNAIRE_TAG] } });
    expect(isPracticeDefaultQ(managed)).toBe(false);
    expect(isPortalManagedQ(managed)).toBe(true);

    expect(isPortalManagedQ(baseFhirQuestionnaire())).toBe(false);
  });

  it('does not force-add the practice-managed tag onto a practice-default questionnaire on serialize', () => {
    const questionnaire = baseManagedQuestionnaire({
      meta: { tag: [PRACTICE_DEFAULT_QUESTIONNAIRE_TAG] },
    });

    const fhir = practiceManagedQuestionnaireToFhir(questionnaire);

    expect(fhir.meta?.tag).toEqual([PRACTICE_DEFAULT_QUESTIONNAIRE_TAG]);
    expect(fhir.meta?.tag?.some((t) => t.code === PRACTICE_MANAGED_QUESTIONNAIRE_TAG.code)).toBe(false);
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
