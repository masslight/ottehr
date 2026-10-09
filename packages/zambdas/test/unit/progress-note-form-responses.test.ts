import { Questionnaire, QuestionnaireResponse } from 'fhir/r4b';
import { FORM_PLACEMENT_TAG_SYSTEM } from 'utils/lib/fhir/constants';
import { makeStandaloneFormDTO } from 'utils/lib/helpers/practice-managed-questionnaires';
import { describe, expect, it } from 'vitest';
import { composeAdditionalQuestions } from '../../src/shared/pdf/sections/visit-note/additionalQuestions';
import { composeFormResponses } from '../../src/shared/pdf/sections/visit-note/formResponses';
import { AllChartData } from '../../src/shared/pdf/visit-details-pdf/types';

const form = (title: string, placement: string): Questionnaire => ({
  resourceType: 'Questionnaire',
  status: 'active',
  url: title,
  version: '1.0.0',
  title,
  meta: { tag: [{ system: FORM_PLACEMENT_TAG_SYSTEM, code: placement }] },
  item: [
    {
      linkId: 'page',
      type: 'group',
      item: [
        { linkId: 'cig', type: 'string', text: 'Cigarettes' },
        { linkId: 'perday', type: 'string', text: 'How many per day' },
      ],
    },
  ],
});

const answered: QuestionnaireResponse = {
  resourceType: 'QuestionnaireResponse',
  status: 'completed',
  item: [{ linkId: 'page', item: [{ linkId: 'cig', answer: [{ valueString: 'Yes' }] }] }],
};

const responses = [
  makeStandaloneFormDTO(form('Staff screening', 'screening'), answered),
  makeStandaloneFormDTO(form('SDOH', 'questionnaires'), answered),
];

describe('progress note form responses', () => {
  it('prints each form of the requested placement with every question, blank when unanswered', () => {
    expect(composeFormResponses(responses, 'questionnaires')).toMatchObject([
      {
        title: 'SDOH',
        lines: [
          { question: 'Cigarettes', answer: 'Yes' },
          { question: 'How many per day', answer: '' },
        ],
      },
    ]);
  });

  it("adds this visit's Screening forms to the screening section", () => {
    const allChartData = {
      chartData: { observations: [] },
      additionalChartData: { notes: [] },
    } as unknown as AllChartData;

    const screening = composeAdditionalQuestions({ allChartData, formResponses: responses });

    expect(screening.forms?.map((f) => f.title)).toEqual(['Staff screening']);
  });
});
