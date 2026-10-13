import { Questionnaire, QuestionnaireItem, QuestionnaireResponse } from 'fhir/r4b';
import { OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS } from 'utils/lib/fhir/constants';
import { mapQuestionnaireAndValueSetsToItemsList } from 'utils/lib/helpers/paperwork/paperwork';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { validatePatchInputs, validateSubmitInputs } from '../../src/patient/paperwork/validateRequestParameters';
import { ZambdaInput } from '../../src/shared/types/common';

/**
 * Validation of the `calculatedAnswers` that the browser sends with a page save. The server never runs the
 * questionnaire's javascript, so what is checked is that each value belongs to a calculated item on the page it names,
 * typed as the item declares, and how the values are merged into the stored response.
 */

vi.mock('utils/lib/helpers/paperwork/paperwork', async (importOriginal) => {
  const original = await importOriginal<typeof import('utils/lib/helpers/paperwork/paperwork')>();
  return { ...original, getQuestionnaireItemsAndProgress: vi.fn() };
});

import { getQuestionnaireItemsAndProgress } from 'utils/lib/helpers/paperwork/paperwork';

const mockGetItemsAndProgress = vi.mocked(getQuestionnaireItemsAndProgress);

const QR_ID = '550e8400-e29b-41d4-a716-446655440000';

const calculated = (expression: string): QuestionnaireItem['extension'] => [
  {
    url: OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.calculatedExpression,
    valueExpression: { language: 'text/javascript', expression },
  },
];

const yesNo = (linkId: string): QuestionnaireItem => ({
  linkId,
  type: 'choice',
  text: linkId,
  answerOption: [{ valueCoding: { code: '0', display: 'No' } }, { valueCoding: { code: '1', display: 'Yes' } }],
});

const questionnaire: Pick<Questionnaire, 'item'> = {
  item: [
    // a page that has real answers and a calculated item of its own
    {
      linkId: 'items',
      type: 'group',
      text: 'Items',
      item: [
        yesNo('q1'),
        yesNo('q2'),
        { linkId: 'subtotal', type: 'integer', text: 'Subtotal', extension: calculated('answers["q1"]+answers["q2"]') },
      ],
    },
    // a hidden page that holds nothing but calculated items
    {
      linkId: 'results',
      type: 'group',
      text: 'Results',
      readOnly: true,
      item: [
        { linkId: 'total', type: 'string', text: 'Total', extension: calculated('answers["subtotal"]') },
        {
          linkId: 'positive-screen',
          type: 'boolean',
          text: 'Positive',
          extension: calculated('answers["subtotal"] >= 2'),
        },
      ],
    },
  ],
};

const yes = (linkId: string): { linkId: string; answer: { valueCoding: { code: string; display: string } }[] } => ({
  linkId,
  answer: [{ valueCoding: { code: '1', display: 'Yes' } }],
});

const storedResponse = (item: QuestionnaireResponse['item']): QuestionnaireResponse => ({
  resourceType: 'QuestionnaireResponse',
  id: QR_ID,
  status: 'in-progress',
  item,
});

const setUp = (stored: QuestionnaireResponse): void => {
  mockGetItemsAndProgress.mockResolvedValue({
    items: mapQuestionnaireAndValueSetsToItemsList(structuredClone(questionnaire.item ?? []), []),
    fullQRResource: stored,
  });
};

const validate = (body: Record<string, unknown>): ReturnType<typeof validatePatchInputs> =>
  validatePatchInputs(
    { body: JSON.stringify({ questionnaireResponseId: QR_ID, ...body }), headers: {}, secrets: null } as ZambdaInput,
    {} as never
  );

const PAGE_SAVE = { answers: { linkId: 'items', item: [yes('q1'), yes('q2')] } };

beforeEach(() => {
  mockGetItemsAndProgress.mockReset();
  setUp(
    storedResponse([
      { linkId: 'items', item: [] },
      { linkId: 'results', item: [] },
    ])
  );
});

describe('patch-paperwork calculatedAnswers', () => {
  test('is optional', async () => {
    const result = await validate(PAGE_SAVE);
    expect(result.calculatedPageUpdates).toEqual([]);
    expect(result.updatedAnswers.map((i) => i.linkId)).toEqual(['q1', 'q2']);
  });

  test('records a hidden page that is never saved itself, as an update to that page', async () => {
    const result = await validate({
      ...PAGE_SAVE,
      calculatedAnswers: [
        {
          linkId: 'results',
          item: [
            { linkId: 'total', answer: [{ valueString: '2' }] },
            { linkId: 'positive-screen', answer: [{ valueBoolean: true }] },
          ],
        },
      ],
    });

    expect(result.calculatedPageUpdates).toEqual([
      {
        linkId: 'results',
        qrIndex: 1,
        items: [
          { linkId: 'total', answer: [{ valueString: '2' }] },
          { linkId: 'positive-screen', answer: [{ valueBoolean: true }] },
        ],
      },
    ]);
    // the page being saved is unaffected
    expect(result.updatedAnswers.map((i) => i.linkId)).toEqual(['q1', 'q2']);
  });

  test('folds a calculated item on the page being saved into that page, keeping its real answers', async () => {
    const result = await validate({
      ...PAGE_SAVE,
      calculatedAnswers: [{ linkId: 'items', item: [{ linkId: 'subtotal', answer: [{ valueInteger: 2 }] }] }],
    });

    expect(result.calculatedPageUpdates).toEqual([]);
    expect(result.updatedAnswers).toEqual([
      expect.objectContaining({ linkId: 'q1' }),
      expect.objectContaining({ linkId: 'q2' }),
      { linkId: 'subtotal', answer: [{ valueInteger: 2 }] },
    ]);
  });

  test('carries over the calculated values already stored on the page being saved when none are sent', async () => {
    setUp(
      storedResponse([
        { linkId: 'items', item: [yes('q1'), { linkId: 'subtotal', answer: [{ valueInteger: 1 }] }] },
        { linkId: 'results', item: [] },
      ])
    );
    const result = await validate(PAGE_SAVE);
    expect(result.updatedAnswers).toEqual([
      expect.objectContaining({ linkId: 'q1' }),
      expect.objectContaining({ linkId: 'q2' }),
      { linkId: 'subtotal', answer: [{ valueInteger: 1 }] },
    ]);
  });

  test('merges into another page without losing the real answers already stored there', async () => {
    setUp(
      storedResponse([
        { linkId: 'items', item: [yes('q1')] },
        { linkId: 'results', item: [{ linkId: 'total', answer: [{ valueString: '1' }] }] },
      ])
    );
    const result = await validate({
      answers: { linkId: 'results', item: [] },
      calculatedAnswers: [{ linkId: 'items', item: [{ linkId: 'subtotal', answer: [{ valueInteger: 1 }] }] }],
    });

    expect(result.calculatedPageUpdates).toEqual([
      {
        linkId: 'items',
        qrIndex: 0,
        items: [yes('q1'), { linkId: 'subtotal', answer: [{ valueInteger: 1 }] }],
      },
    ]);
  });

  test('clears a stored value when the entry has no answer', async () => {
    setUp(
      storedResponse([
        { linkId: 'items', item: [] },
        { linkId: 'results', item: [{ linkId: 'total', answer: [{ valueString: '1' }] }] },
      ])
    );
    const result = await validate({
      ...PAGE_SAVE,
      calculatedAnswers: [{ linkId: 'results', item: [{ linkId: 'total' }] }],
    });
    expect(result.calculatedPageUpdates).toEqual([{ linkId: 'results', qrIndex: 1, items: [] }]);
  });

  test('skips a page whose stored items would not change', async () => {
    setUp(
      storedResponse([
        { linkId: 'items', item: [] },
        { linkId: 'results', item: [{ linkId: 'total', answer: [{ valueString: '2' }] }] },
      ])
    );
    const result = await validate({
      ...PAGE_SAVE,
      calculatedAnswers: [{ linkId: 'results', item: [{ linkId: 'total', answer: [{ valueString: '2' }] }] }],
    });
    expect(result.calculatedPageUpdates).toEqual([]);
  });

  test('appends the page when the stored response has no item for it yet', async () => {
    setUp(storedResponse([{ linkId: 'items', item: [] }]));
    const result = await validate({
      ...PAGE_SAVE,
      calculatedAnswers: [{ linkId: 'results', item: [{ linkId: 'total', answer: [{ valueString: '2' }] }] }],
    });
    expect(result.calculatedPageUpdates).toEqual([
      { linkId: 'results', qrIndex: undefined, items: [{ linkId: 'total', answer: [{ valueString: '2' }] }] },
    ]);
  });

  describe('rejects', () => {
    const rejects = async (calculatedAnswers: unknown, message: RegExp): Promise<void> => {
      await expect(validate({ ...PAGE_SAVE, calculatedAnswers })).rejects.toThrow(message);
    };

    test('a value for an item that is not calculated', async () => {
      await rejects(
        [{ linkId: 'items', item: [{ linkId: 'q1', answer: [{ valueCoding: { code: '0' } }] }] }],
        /"q1" is not a calculated item/
      );
    });

    test('a value of the wrong type', async () => {
      await rejects(
        [{ linkId: 'results', item: [{ linkId: 'positive-screen', answer: [{ valueString: 'true' }] }] }],
        /does not match its item type "boolean"/
      );
      await rejects(
        [{ linkId: 'items', item: [{ linkId: 'subtotal', answer: [{ valueDecimal: 1.5 }] }] }],
        /does not match its item type "integer"/
      );
    });

    test('a page or item the questionnaire does not have', async () => {
      await rejects([{ linkId: 'nope', item: [] }], /"nope" is not a page of this questionnaire/);
      await rejects([{ linkId: 'results', item: [{ linkId: 'q1' }] }], /"q1" is not an item of page "results"/);
    });

    test('a malformed calculatedAnswers', async () => {
      await rejects('results', /./);
      await rejects([{ item: [] }], /./);
    });
  });
});

describe('submit-paperwork and calculated values', () => {
  const stored = (): QuestionnaireResponse =>
    storedResponse([
      { linkId: 'items', item: [yes('q1'), yes('q2'), { linkId: 'subtotal', answer: [{ valueInteger: 2 }] }] },
      {
        linkId: 'results',
        item: [
          { linkId: 'total', answer: [{ valueString: '2' }] },
          { linkId: 'positive-screen', answer: [{ valueBoolean: true }] },
        ],
      },
    ]);

  const submit = (answers: unknown[]): ReturnType<typeof validateSubmitInputs> =>
    validateSubmitInputs(
      { body: JSON.stringify({ questionnaireResponseId: QR_ID, answers }), headers: {}, secrets: null } as ZambdaInput,
      {} as never
    );

  test('keeps the values stored by earlier page saves, hidden results page included', async () => {
    setUp(stored());
    const result = await submit([]);
    expect(result.updatedAnswers).toEqual(stored().item);
  });

  test('ignores calculated values in the submitted answers, so a submit cannot change a stored score', async () => {
    setUp(stored());
    const result = await submit([
      { linkId: 'results', item: [{ linkId: 'total', answer: [{ valueString: '99' }] }] },
      { linkId: 'items', item: [yes('q1'), yes('q2'), { linkId: 'subtotal', answer: [{ valueInteger: 99 }] }] },
    ]);

    const results = result.updatedAnswers.find((page) => page.linkId === 'results');
    expect(results?.item?.find((i) => i.linkId === 'total')?.answer).toEqual([{ valueString: '2' }]);
    const items = result.updatedAnswers.find((page) => page.linkId === 'items');
    expect(items?.item?.find((i) => i.linkId === 'subtotal')?.answer).toEqual([{ valueInteger: 2 }]);
  });
});
