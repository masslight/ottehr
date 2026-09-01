import { Questionnaire } from 'fhir/r4b';
import { IntakeQuestionnaireItem } from 'utils/lib/types/data/paperwork/paperwork.types';
import { describe, expect, it } from 'vitest';
import { buildStubAnswersByPage, collectContextFields, ContextField } from './test-draft-utils';

const HIDDEN = { url: 'https://fhir.zapehr.com/r4/StructureDefinitions/disabled-display', valueString: 'hidden' };

const questionnaire: Questionnaire = {
  resourceType: 'Questionnaire',
  status: 'active',
  url: 'https://ottehr.com/FHIR/Questionnaire/test',
  version: '1.0.0',
  item: [
    {
      linkId: 'contact-information-page',
      type: 'group',
      text: 'Contact',
      item: [
        // readOnly + hidden + referenced (via dotted path) => context field
        { linkId: 'reason-for-visit', type: 'string', readOnly: true, required: true, extension: [HIDDEN] },
        // readOnly + hidden but only an autofill source, never referenced => excluded
        { linkId: 'patient-first-name', type: 'string', readOnly: true, extension: [HIDDEN] },
        // readOnly + referenced (bare) boolean => context field
        { linkId: 'is-new-qrs-patient', type: 'boolean', readOnly: true, extension: [HIDDEN] },
      ],
    },
    {
      linkId: 'attorney-mva-page',
      type: 'group',
      text: 'Attorney',
      enableWhen: [
        { question: 'contact-information-page.reason-for-visit', operator: '=', answerString: 'Auto accident' },
      ],
      item: [{ linkId: 'attorney-firm', type: 'string' }],
    },
    {
      linkId: 'discovery-page',
      type: 'group',
      text: 'Discovery',
      item: [
        {
          linkId: 'patient-point-of-discovery',
          type: 'choice',
          enableWhen: [{ question: 'is-new-qrs-patient', operator: '=', answerBoolean: true }],
          answerOption: [{ valueString: 'Friend' }],
        },
      ],
    },
    {
      linkId: 'consent-forms-page',
      type: 'group',
      text: 'Consent',
      enableWhen: [{ question: '$status', operator: '!=', answerString: 'completed' }],
      item: [{ linkId: 'signature', type: 'string' }],
    },
    {
      linkId: 'payment-option-page',
      type: 'group',
      text: 'Payment',
      item: [
        // referenced but NOT readOnly (tester sets it by clicking through) => excluded
        { linkId: 'payment-option', type: 'choice', answerOption: [{ valueString: 'I have insurance' }] },
        {
          linkId: 'insurance-carrier',
          type: 'string',
          enableWhen: [{ question: 'payment-option', operator: '=', answerString: 'I have insurance' }],
        },
      ],
    },
  ],
};

describe('collectContextFields', () => {
  it('returns only readOnly fields that a condition references, grouped by page', () => {
    const { contextFields, statusReferenced } = collectContextFields(questionnaire);
    const linkIds = contextFields.map((c) => c.field.linkId).sort();

    expect(linkIds).toEqual(['is-new-qrs-patient', 'reason-for-visit']);
    // excluded: patient-first-name (readOnly but unreferenced), payment-option (referenced but not readOnly)
    expect(linkIds).not.toContain('patient-first-name');
    expect(linkIds).not.toContain('payment-option');
    expect(contextFields.every((c) => c.pageLinkId === 'contact-information-page')).toBe(true);
    expect(statusReferenced).toBe(true);

    // suggestions = the exact answer values the conditions test each field against
    const reason = contextFields.find((c) => c.field.linkId === 'reason-for-visit');
    expect(reason?.suggestions).toEqual(['Auto accident']);
    const isNew = contextFields.find((c) => c.field.linkId === 'is-new-qrs-patient');
    expect(isNew?.suggestions).toEqual(['true']);
  });

  it('flags statusReferenced=false when no condition uses $status', () => {
    const noStatus: Questionnaire = {
      ...questionnaire,
      item: (questionnaire.item ?? []).filter((p) => p.linkId !== 'consent-forms-page'),
    };
    expect(collectContextFields(noStatus).statusReferenced).toBe(false);
  });
});

describe('buildStubAnswersByPage', () => {
  const fields: ContextField[] = [
    { pageLinkId: 'p', field: { linkId: 'b', type: 'boolean' } as IntakeQuestionnaireItem, suggestions: [] },
    { pageLinkId: 'p', field: { linkId: 'i', type: 'integer' } as IntakeQuestionnaireItem, suggestions: [] },
    { pageLinkId: 'p', field: { linkId: 'd', type: 'decimal' } as IntakeQuestionnaireItem, suggestions: [] },
    { pageLinkId: 'p', field: { linkId: 'dt', type: 'date' } as IntakeQuestionnaireItem, suggestions: [] },
    { pageLinkId: 'other', field: { linkId: 's', type: 'string' } as IntakeQuestionnaireItem, suggestions: [] },
  ];

  it('builds the right value key per field type and groups by page', () => {
    const byPage = buildStubAnswersByPage(fields, {
      b: 'true',
      i: '42',
      d: '3.5',
      dt: '2020-01-01',
      s: 'Auto accident',
    });

    expect(byPage['p']).toEqual([
      { linkId: 'b', answer: [{ valueBoolean: true }] },
      { linkId: 'i', answer: [{ valueInteger: 42 }] },
      { linkId: 'd', answer: [{ valueDecimal: 3.5 }] },
      { linkId: 'dt', answer: [{ valueDate: '2020-01-01' }] },
    ]);
    expect(byPage['other']).toEqual([{ linkId: 's', answer: [{ valueString: 'Auto accident' }] }]);
  });

  it('omits unset/empty values and unparseable numbers', () => {
    const byPage = buildStubAnswersByPage(fields, { b: 'false', i: 'not-a-number', s: '' });
    expect(byPage['p']).toEqual([{ linkId: 'b', answer: [{ valueBoolean: false }] }]);
    expect(byPage['other']).toBeUndefined();
  });
});
