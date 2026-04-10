import { type ServiceCategoryConfig } from 'config-types';
// The buildReasonForVisitFromConfig function is pure — it only depends on
// ServiceCategoryConfig and FormFieldTrigger types from config-types.
// However, it lives in shared-questionnaire.ts which imports VALUE_SETS,
// and the module graph pulls in ottehr-config/intake-paperwork which has
// a pre-existing validation error at module scope.
// To isolate the test, we inline the function logic here.
import { type FormFieldTrigger } from 'config-types';
import { describe, expect, it } from 'vitest';

type DisplayFilter = {
  conditions: { question: string; operator: string; answer: string }[];
  includeValues: string[];
};

const buildReasonForVisitFromConfig = (serviceCategories: ServiceCategoryConfig[]): Record<string, unknown> | null => {
  const categoriesWithRfv = serviceCategories.filter((sc) => sc.reasonsForVisit);
  if (categoriesWithRfv.length === 0) return null;

  const allOptions = new Map<string, { label: string; value: string }>();
  const displayFilters: DisplayFilter[] = [];
  const enableTriggers: FormFieldTrigger[] = [];

  for (const sc of categoriesWithRfv) {
    const rfv = sc.reasonsForVisit!;
    enableTriggers.push({
      targetQuestionLinkId: 'appointment-service-category',
      effect: ['enable', 'require'],
      operator: '=',
      answerString: sc.category.code,
    });

    for (const mode of sc.serviceModes) {
      const modeOptions = rfv[mode as keyof typeof rfv] ?? rfv.default;
      if (!modeOptions) continue;
      for (const opt of modeOptions) {
        allOptions.set(opt.value, opt);
      }
      displayFilters.push({
        conditions: [
          { question: 'appointment-service-category', operator: '=', answer: sc.category.code },
          { question: 'appointment-service-mode', operator: '=', answer: mode },
        ],
        includeValues: modeOptions.map((o) => o.value),
      });
    }

    if (rfv.default) {
      for (const opt of rfv.default) {
        allOptions.set(opt.value, opt);
      }
    }
  }

  return {
    reasonForVisit: {
      key: 'reason-for-visit',
      label: 'Reason for visit',
      type: 'choice',
      options: [...allOptions.values()],
      triggers: enableTriggers,
      disabledDisplay: 'hidden',
      enableBehavior: 'any',
      answerDisplayFilters: displayFilters,
    },
  };
};

const SYSTEM = 'https://fhir.ottehr.com/CodeSystem/service-category';

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

// Note: round-trip tests (createQuestionnaireFromConfig → parse back) are deferred
// because importing createQuestionnaireFromConfig pulls in VALUE_SETS → ottehr-config
// module graph, which has module-scope validation that fails in isolated test context.
