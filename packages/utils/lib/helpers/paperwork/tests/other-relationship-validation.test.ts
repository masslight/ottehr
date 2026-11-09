import { QuestionnaireResponseItem } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { IN_PERSON_INTAKE_PAPERWORK_QUESTIONNAIRE } from '../../../ottehr-config/intake-paperwork';
import { VIRTUAL_INTAKE_PAPERWORK_QUESTIONNAIRE } from '../../../ottehr-config/intake-paperwork-virtual';
import { INSURANCE_PAY_OPTION } from '../../../ottehr-config/value-sets';
import { mapQuestionnaireAndValueSetsToItemsList } from '../paperwork';
import { makeValidationSchema } from '../validation';

type PageValues = Record<string, QuestionnaireResponseItem>;

const answer = (linkId: string, value: string | boolean): QuestionnaireResponseItem => ({
  linkId,
  answer: [typeof value === 'boolean' ? { valueBoolean: value } : { valueString: value }],
});

const insurancePageValues = (relationship: string, secondaryRelationship: string): PageValues => ({
  'payment-option': answer('payment-option', INSURANCE_PAY_OPTION),
  'patient-relationship-to-insured': answer('patient-relationship-to-insured', relationship),
  'display-secondary-insurance': answer('display-secondary-insurance', true),
  'secondary-insurance': {
    linkId: 'secondary-insurance',
    item: [answer('patient-relationship-to-insured-2', secondaryRelationship)],
  },
});

const responsiblePartyPageValues = (relationship: string): PageValues => ({
  'responsible-party-relationship': answer('responsible-party-relationship', relationship),
});

describe.each([
  ['in-person', IN_PERSON_INTAKE_PAPERWORK_QUESTIONNAIRE()],
  ['virtual', VIRTUAL_INTAKE_PAPERWORK_QUESTIONNAIRE()],
])('%s paperwork other relationship validation', (_mode, questionnaire) => {
  const pages = mapQuestionnaireAndValueSetsToItemsList(questionnaire.item ?? [], []);

  const secondaryOtherRelationshipIndex = (
    pages
      .find((page) => page.linkId === 'payment-option-page')
      ?.item?.find((item) => item.linkId === 'secondary-insurance')
      ?.item?.filter((item) => item.type !== 'display') ?? []
  ).findIndex((item) => item.linkId === 'patient-relationship-to-insured-other-2');
  const secondaryOtherRelationshipPath = `secondary-insurance.item[${secondaryOtherRelationshipIndex}]`;

  const getErrorPaths = async (pageId: string, values: PageValues): Promise<string[]> => {
    try {
      await makeValidationSchema(pages, pageId).validate(values, { abortEarly: false });
      return [];
    } catch (error: any) {
      return (error.inner ?? []).map((e: { path?: string }) => e.path ?? '');
    }
  };

  it('requires the other relationship to insured only when "Other" is selected', async () => {
    expect(secondaryOtherRelationshipIndex).toBeGreaterThan(-1);

    const withOther = await getErrorPaths('payment-option-page', insurancePageValues('Other', 'Other'));
    expect(withOther).toContain('patient-relationship-to-insured-other.answer');
    expect(withOther).toContain(secondaryOtherRelationshipPath);

    const withChild = await getErrorPaths('payment-option-page', insurancePageValues('Child', 'Child'));
    expect(withChild).not.toContain('patient-relationship-to-insured-other.answer');
    expect(withChild).not.toContain(secondaryOtherRelationshipPath);
  });

  it('exposes the "Please specify..." placeholder on the other relationship items', () => {
    const items = pages.flatMap((page) => page.item ?? []).flatMap((item) => [item, ...(item.item ?? [])]);
    const otherRelationshipLinkIds = [
      'patient-relationship-to-insured-other',
      'patient-relationship-to-insured-other-2',
      'responsible-party-relationship-other',
    ];

    otherRelationshipLinkIds.forEach((linkId) => {
      expect(items.find((item) => item.linkId === linkId)?.placeholder).toBe('Please specify...');
    });
  });

  it('requires the responsible party other relationship only when "Other" is selected', async () => {
    const withOther = await getErrorPaths('responsible-party-page', responsiblePartyPageValues('Other'));
    expect(withOther).toContain('responsible-party-relationship-other.answer');

    const withParent = await getErrorPaths('responsible-party-page', responsiblePartyPageValues('Parent'));
    expect(withParent).not.toContain('responsible-party-relationship-other.answer');
  });
});
