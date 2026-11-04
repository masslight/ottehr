import { Questionnaire, QuestionnaireResponse } from 'fhir/r4b';
import { FORM_PLACEMENT_TAG_SYSTEM } from 'utils/lib/fhir/constants';
import { makeStandaloneFormDTO } from 'utils/lib/helpers/practice-managed-questionnaires';
import { describe, expect, it } from 'vitest';
import {
  composeAdditionalQuestions,
  createAdditionalQuestionsSection,
} from '../../src/shared/pdf/sections/visit-note/additionalQuestions';
import {
  composeFormResponses,
  createQuestionnairesSection,
} from '../../src/shared/pdf/sections/visit-note/formResponses';
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

const allChartData = {
  chartData: { observations: [] },
  additionalChartData: { notes: [] },
} as unknown as AllChartData;
const mainVisit = { encounter: { isFollowup: false } };
const followUp = { encounter: { isFollowup: true } };

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
    const screening = composeAdditionalQuestions({ allChartData, formResponses: responses });

    expect(screening.forms?.map((f) => f.title)).toEqual(['Staff screening']);
  });
});

describe('progress note form sections', () => {
  it('prints Clinical Forms on the visit note but not on a follow-up note, like the other intake sections', () => {
    const section = createQuestionnairesSection();
    const data = { forms: composeFormResponses(responses, 'questionnaires') };

    expect(section.shouldRender?.(data, mainVisit)).toBe(true);
    expect(section.shouldRender?.(data, followUp)).toBe(false);
  });

  // The screening data always carries an (empty) notes array and a keyed record, so presence checks on them
  // were always true and printed an empty "Additional questions" block on every note.
  it('prints Additional questions only when the visit has screening answers, notes or Screening forms', () => {
    const section = createAdditionalQuestionsSection();
    const empty = composeAdditionalQuestions({ allChartData, formResponses: [] });

    expect(section.shouldRender?.(empty, mainVisit)).toBe(false);
    expect(
      section.shouldRender?.(composeAdditionalQuestions({ allChartData, formResponses: responses }), mainVisit)
    ).toBe(true);
    expect(section.shouldRender?.({ ...empty, notes: ['Patient declined'] }, mainVisit)).toBe(true);
  });
});
