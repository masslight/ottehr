import { type QuestionnaireConfigType, type ServiceCategoryConfig } from 'config-types';
import { describe, expect, it } from 'vitest';
import { mapQuestionnaireAndValueSetsToItemsList } from '../helpers/paperwork/paperwork';
import { buildReasonForVisitFromConfig, createQuestionnaireFromConfig } from './shared-questionnaire';

const SYSTEM = 'https://fhir.ottehr.com/CodeSystem/service-category';
const FILTER_EXT_URL = 'https://fhir.zapehr.com/r4/StructureDefinitions/answer-display-filter';
const FILTER_QUESTION_URL = 'https://fhir.zapehr.com/r4/StructureDefinitions/answer-display-filter-question';
const FILTER_ANSWER_URL = 'https://fhir.zapehr.com/r4/StructureDefinitions/answer-display-filter-answer';
const FILTER_INCLUDE_URL = 'https://fhir.zapehr.com/r4/StructureDefinitions/answer-display-filter-include';

const makeCategory = (
  code: string,
  display: string,
  overrides: Partial<ServiceCategoryConfig> = {}
): ServiceCategoryConfig => ({
  category: { code, display, system: SYSTEM },
  serviceModes: ['in-person', 'virtual'],
  visitTypes: ['prebook', 'walk-in'],
  ...overrides,
});

const makeQuestionnaireConfig = (rfvField: Record<string, unknown>): QuestionnaireConfigType =>
  ({
    questionnaireBase: {
      resourceType: 'Questionnaire',
      url: 'https://test.com/q',
      version: '1.0.0',
      name: 'Test',
      title: 'Test',
      status: 'active',
    },
    hiddenFormSections: [],
    FormFields: {
      testSection: {
        linkId: 'test-page',
        title: 'Test',
        items: rfvField,
        requiredFields: [],
        hiddenFields: [],
      },
    },
  }) as QuestionnaireConfigType;

describe('buildReasonForVisitFromConfig', () => {
  it('returns null when no categories have reasonsForVisit', () => {
    const categories = [makeCategory('urgent-care', 'Urgent Care'), makeCategory('workers-comp', 'Workers Comp')];
    expect(buildReasonForVisitFromConfig(categories)).toBeNull();
  });

  it('produces a single reason-for-visit field with correct key and type', () => {
    const categories = [
      makeCategory('urgent-care', 'Urgent Care', {
        reasonsForVisit: {
          default: [{ label: 'Fever', value: 'Fever' }],
        },
      }),
    ];
    const result = buildReasonForVisitFromConfig(categories);
    expect(result).not.toBeNull();
    const field = (result as any).reasonForVisit;
    expect(field.key).toBe('reason-for-visit');
    expect(field.type).toBe('choice');
    expect(field.disabledDisplay).toBe('hidden');
    expect(field.enableBehavior).toBe('any');
  });

  it('deduplicates options across categories and modes', () => {
    const categories = [
      makeCategory('urgent-care', 'Urgent Care', {
        reasonsForVisit: {
          'in-person': [
            { label: 'Fever', value: 'Fever' },
            { label: 'Cough', value: 'Cough' },
          ],
          virtual: [
            { label: 'Fever', value: 'Fever' }, // duplicate
            { label: 'Rash', value: 'Rash' },
          ],
        },
      }),
    ];
    const result = buildReasonForVisitFromConfig(categories);
    const field = (result as any).reasonForVisit;
    const values = field.options.map((o: any) => o.value);
    expect(values).toEqual(['Fever', 'Cough', 'Rash']);
  });

  it('includes default options in the superset', () => {
    const categories = [
      makeCategory('workers-comp', 'Workers Comp', {
        serviceModes: ['in-person'],
        reasonsForVisit: {
          default: [{ label: 'Injury', value: 'Injury' }],
        },
      }),
    ];
    const result = buildReasonForVisitFromConfig(categories);
    const field = (result as any).reasonForVisit;
    expect(field.options).toEqual([{ label: 'Injury', value: 'Injury' }]);
  });

  it('generates one enable trigger per category with reasonsForVisit', () => {
    const categories = [
      makeCategory('urgent-care', 'Urgent Care', {
        reasonsForVisit: { default: [{ label: 'Fever', value: 'Fever' }] },
      }),
      makeCategory('workers-comp', 'Workers Comp', {
        reasonsForVisit: { default: [{ label: 'Injury', value: 'Injury' }] },
      }),
      makeCategory('occ-med', 'Occ Med'), // no reasonsForVisit
    ];
    const result = buildReasonForVisitFromConfig(categories);
    const field = (result as any).reasonForVisit;
    expect(field.triggers).toHaveLength(2);
    expect(field.triggers[0].answerString).toBe('urgent-care');
    expect(field.triggers[1].answerString).toBe('workers-comp');
    field.triggers.forEach((t: any) => {
      expect(t.targetQuestionLinkId).toBe('appointment-service-category');
      expect(t.effect).toEqual(['enable', 'require']);
      expect(t.operator).toBe('=');
    });
  });

  it('generates one display filter per category+mode combo', () => {
    const categories = [
      makeCategory('urgent-care', 'Urgent Care', {
        serviceModes: ['in-person', 'virtual'],
        reasonsForVisit: {
          'in-person': [
            { label: 'Fever', value: 'Fever' },
            { label: 'Cough', value: 'Cough' },
          ],
          virtual: [{ label: 'Rash', value: 'Rash' }],
        },
      }),
    ];
    const result = buildReasonForVisitFromConfig(categories);
    const field = (result as any).reasonForVisit;
    expect(field.answerDisplayFilters).toHaveLength(2);

    const ipFilter = field.answerDisplayFilters[0];
    expect(ipFilter.conditions).toEqual([
      { question: 'appointment-service-category', operator: '=', answer: 'urgent-care' },
      { question: 'appointment-service-mode', operator: '=', answer: 'in-person' },
    ]);
    expect(ipFilter.includeValues).toEqual(['Fever', 'Cough']);

    const virtualFilter = field.answerDisplayFilters[1];
    expect(virtualFilter.conditions).toEqual([
      { question: 'appointment-service-category', operator: '=', answer: 'urgent-care' },
      { question: 'appointment-service-mode', operator: '=', answer: 'virtual' },
    ]);
    expect(virtualFilter.includeValues).toEqual(['Rash']);
  });

  it('uses default RFV when no mode-specific entry exists for a mode', () => {
    const categories = [
      makeCategory('aesthetics', 'Aesthetics', {
        serviceModes: ['in-person'],
        reasonsForVisit: {
          default: [
            { label: 'Botox', value: 'Botox' },
            { label: 'Filler', value: 'Filler' },
          ],
        },
      }),
    ];
    const result = buildReasonForVisitFromConfig(categories);
    const field = (result as any).reasonForVisit;

    // Should use default for the in-person mode filter
    expect(field.answerDisplayFilters).toHaveLength(1);
    expect(field.answerDisplayFilters[0].includeValues).toEqual(['Botox', 'Filler']);
    expect(field.answerDisplayFilters[0].conditions[1].answer).toBe('in-person');
  });

  it('handles multiple categories with mixed mode-specific and default RFV', () => {
    const categories = [
      makeCategory('urgent-care', 'Urgent Care', {
        serviceModes: ['in-person', 'virtual'],
        reasonsForVisit: {
          'in-person': [{ label: 'Fever', value: 'Fever' }],
          virtual: [{ label: 'Rash', value: 'Rash' }],
        },
      }),
      makeCategory('workers-comp', 'Workers Comp', {
        serviceModes: ['in-person'],
        reasonsForVisit: {
          default: [{ label: 'Injury', value: 'Injury' }],
        },
      }),
    ];
    const result = buildReasonForVisitFromConfig(categories);
    const field = (result as any).reasonForVisit;

    // 3 filters: UC in-person, UC virtual, WC in-person (using default)
    expect(field.answerDisplayFilters).toHaveLength(3);

    // Full superset: Fever, Rash, Injury
    const values = field.options.map((o: any) => o.value);
    expect(values).toEqual(['Fever', 'Rash', 'Injury']);

    // 2 enable triggers: UC and WC
    expect(field.triggers).toHaveLength(2);
  });
});

describe('display filter round-trip: config → questionnaire → parse', () => {
  it('generates questionnaire with correct answerOptions and display filter extensions', () => {
    const rfvField = buildReasonForVisitFromConfig([
      makeCategory('urgent-care', 'Urgent Care', {
        serviceModes: ['in-person', 'virtual'],
        reasonsForVisit: {
          'in-person': [
            { label: 'Fever', value: 'Fever' },
            { label: 'Cough', value: 'Cough' },
          ],
          virtual: [{ label: 'Rash', value: 'Rash' }],
        },
      }),
    ])!;

    const questionnaire = createQuestionnaireFromConfig(makeQuestionnaireConfig(rfvField));
    const rfvItem = questionnaire.item
      ?.find((i) => i.linkId === 'test-page')
      ?.item?.find((i) => i.linkId === 'reason-for-visit');

    expect(rfvItem).toBeDefined();

    // answerOptions contain the full superset
    const answerValues = rfvItem!.answerOption?.map((o) => o.valueString);
    expect(answerValues).toEqual(['Fever', 'Cough', 'Rash']);

    // Two display filter extensions (one per mode)
    const filterExts = rfvItem!.extension?.filter((e) => e.url === FILTER_EXT_URL);
    expect(filterExts).toHaveLength(2);

    // In-person filter
    const ipIncludes = filterExts![0].extension?.filter((e) => e.url === FILTER_INCLUDE_URL).map((e) => e.valueString);
    expect(ipIncludes).toEqual(['Fever', 'Cough']);

    // Virtual filter
    const virtualIncludes = filterExts![1].extension
      ?.filter((e) => e.url === FILTER_INCLUDE_URL)
      .map((e) => e.valueString);
    expect(virtualIncludes).toEqual(['Rash']);
  });

  it('preserves filter conditions through serialization', () => {
    const rfvField = buildReasonForVisitFromConfig([
      makeCategory('wellness', 'Wellness', {
        serviceModes: ['in-person', 'virtual'],
        reasonsForVisit: {
          'in-person': [{ label: 'Softwave', value: 'Softwave' }],
          virtual: [{ label: 'HRT', value: 'HRT' }],
        },
      }),
    ])!;

    const questionnaire = createQuestionnaireFromConfig(makeQuestionnaireConfig(rfvField));
    const rfvItem = questionnaire.item
      ?.find((i) => i.linkId === 'test-page')
      ?.item?.find((i) => i.linkId === 'reason-for-visit');
    const filterExts = rfvItem!.extension?.filter((e) => e.url === FILTER_EXT_URL);

    // Verify condition structure on first filter
    const questions = filterExts![0].extension?.filter((e) => e.url === FILTER_QUESTION_URL).map((e) => e.valueString);
    const answers = filterExts![0].extension?.filter((e) => e.url === FILTER_ANSWER_URL).map((e) => e.valueString);

    expect(questions).toEqual(['appointment-service-category', 'appointment-service-mode']);
    expect(answers).toEqual(['wellness', 'in-person']);
  });

  it('parses display filter extensions back into answerDisplayFilters via mapQuestionnaireAndValueSetsToItemsList', () => {
    const rfvField = buildReasonForVisitFromConfig([
      makeCategory('urgent-care', 'Urgent Care', {
        serviceModes: ['in-person', 'virtual'],
        reasonsForVisit: {
          'in-person': [{ label: 'Fever', value: 'Fever' }],
          virtual: [{ label: 'Rash', value: 'Rash' }],
        },
      }),
    ])!;

    const questionnaire = createQuestionnaireFromConfig(makeQuestionnaireConfig(rfvField));
    const items = mapQuestionnaireAndValueSetsToItemsList(questionnaire.item ?? [], []);
    const rfvItem = items.find((i) => i.linkId === 'test-page')?.item?.find((i) => i.linkId === 'reason-for-visit');

    expect(rfvItem).toBeDefined();
    expect(rfvItem!.answerDisplayFilters).toHaveLength(2);

    // In-person filter parsed correctly
    expect(rfvItem!.answerDisplayFilters![0]).toEqual({
      conditions: [
        { question: 'appointment-service-category', operator: '=', answer: 'urgent-care' },
        { question: 'appointment-service-mode', operator: '=', answer: 'in-person' },
      ],
      includeValues: ['Fever'],
    });

    // Virtual filter parsed correctly
    expect(rfvItem!.answerDisplayFilters![1]).toEqual({
      conditions: [
        { question: 'appointment-service-category', operator: '=', answer: 'urgent-care' },
        { question: 'appointment-service-mode', operator: '=', answer: 'virtual' },
      ],
      includeValues: ['Rash'],
    });
  });

  it('round-trips multiple categories with mixed default and mode-specific RFV', () => {
    const rfvField = buildReasonForVisitFromConfig([
      makeCategory('urgent-care', 'Urgent Care', {
        serviceModes: ['in-person', 'virtual'],
        reasonsForVisit: {
          'in-person': [{ label: 'Fever', value: 'Fever' }],
          virtual: [{ label: 'Rash', value: 'Rash' }],
        },
      }),
      makeCategory('workers-comp', 'Workers Comp', {
        serviceModes: ['in-person'],
        reasonsForVisit: {
          default: [{ label: 'Injury', value: 'Injury' }],
        },
      }),
    ])!;

    const questionnaire = createQuestionnaireFromConfig(makeQuestionnaireConfig(rfvField));
    const items = mapQuestionnaireAndValueSetsToItemsList(questionnaire.item ?? [], []);
    const rfvItem = items.find((i) => i.linkId === 'test-page')?.item?.find((i) => i.linkId === 'reason-for-visit');

    // Full superset preserved
    const answerValues = rfvItem!.answerOption?.map((o) => o.valueString);
    expect(answerValues).toEqual(['Fever', 'Rash', 'Injury']);

    // 3 filters: UC in-person, UC virtual, WC in-person
    expect(rfvItem!.answerDisplayFilters).toHaveLength(3);
    expect(rfvItem!.answerDisplayFilters![2]).toEqual({
      conditions: [
        { question: 'appointment-service-category', operator: '=', answer: 'workers-comp' },
        { question: 'appointment-service-mode', operator: '=', answer: 'in-person' },
      ],
      includeValues: ['Injury'],
    });
  });
});
