import { Questionnaire, QuestionnaireResponse } from 'fhir/r4b';
import { APIErrorCode } from 'utils/lib/types/errors';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { populateQuestionnaireResponseItems } from '../../src/ehr/lab/shared/labs';

const questionnaire: Questionnaire = {
  resourceType: 'Questionnaire',
  status: 'active',
  item: [
    { linkId: 'free-text', type: 'text', text: 'Fasting notes' },
    { linkId: 'single-choice', type: 'choice', text: 'Source', answerOption: [{ valueString: 'Arm' }] },
    { linkId: 'yes-no', type: 'boolean', text: 'Fasting?' },
    { linkId: 'count', type: 'integer', text: 'Hours fasted' },
    { linkId: 'required-text', type: 'text', text: 'Collection site', required: true },
  ],
};

const questionnaireResponse: QuestionnaireResponse = {
  resourceType: 'QuestionnaireResponse',
  status: 'in-progress',
  questionnaire: 'https://fhir.example.com/Questionnaire/aoe',
};

describe('populateQuestionnaireResponseItems', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => questionnaire }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test.each(['', '   ', '\n\t'])(
    'drops a blank string answer (%j) instead of writing an empty valueString',
    async (blank) => {
      const { questionnaireResponseItems } = await populateQuestionnaireResponseItems(
        questionnaireResponse,
        { 'free-text': blank, 'single-choice': blank, 'yes-no': false, count: 0 },
        'token'
      );

      expect(questionnaireResponseItems).toEqual([
        { linkId: 'yes-no', answer: [{ valueBoolean: false }] },
        { linkId: 'count', answer: [{ valueInteger: 0 }] },
      ]);
    }
  );

  test('rejects a blank answer to a required question instead of submitting the order without it', async () => {
    await expect(
      populateQuestionnaireResponseItems(questionnaireResponse, { 'required-text': '  ', count: 1 }, 'token')
    ).rejects.toMatchObject({ code: APIErrorCode.INVALID_INPUT });
  });

  test('keeps a text answer with surrounding spaces as typed', async () => {
    const { questionnaireResponseItems } = await populateQuestionnaireResponseItems(
      questionnaireResponse,
      { 'free-text': '  since midnight ', 'single-choice': 'Arm' },
      'token'
    );

    expect(questionnaireResponseItems).toEqual([
      { linkId: 'free-text', answer: [{ valueString: '  since midnight ' }] },
      { linkId: 'single-choice', answer: [{ valueString: 'Arm' }] },
    ]);
  });
});
