import { Questionnaire } from 'fhir/r4b';
import { mapQuestionnaireAndValueSetsToItemsList } from '../paperwork';
import { assert } from 'vitest';

const KEYS = {
  triggers: {
    boolean: {
      primary: 'conditional-bool-question',
      secondary: 'conditional-bool-question-secondary',
    },
    string: {
      primary: 'conditional-string-question',
      secondary: 'conditional-string-question-secondary',
    },
    date: {
      primary: 'conditional-date-question',
      secondary: 'conditional-date-question-secondary',
    },
  },
  dependents: {
    bool: {
      primaryTrue: 'enable-when-conditional-bool-true',
      secondaryFalse: 'enable-when-conditional-bool-false',
    },
    string: 'enable-when-conditional-string-question-foo',
    date: {
      over: 'enable-when-conditional-date-question-over',
      under: 'conditional-date-question-under',
      exactly: 'conditional-date-question-exactly',
    },
  },
};

const BASE_FORM_VALUES = [
  {
    linkId: KEYS.triggers.boolean.primary,
    answer: [{ valueBoolean: false }],
  },
  {
    linkId: 'conditional-bool-question-secondary',
    answer: [{ valueBoolean: false }],
  },
  {
    linkId: KEYS.triggers.string.primary,
    answer: [{ valueString: 'foo' }],
  },
  {
    linkId: KEYS.triggers.string.secondary,
    answer: [{ valueString: 'foo' }],
  },
  {
    linkId: KEYS.triggers.date.primary,
    answer: [{ valueString: '2001-01-01' }],
  },
  {
    linkId: KEYS.triggers.date.secondary,
    answer: [{ valueString: '2021-01-01' }],
  },
];

const BASE_QUESTIONNAIRE: Questionnaire = {
  resourceType: 'Questionnaire',
  status: 'active',
  url: 'some-url',
  version: '1.0.0',
  item: [
    {
      linkId: 'page-one',
      type: 'group',
      item: [
        {
          linkId: KEYS.triggers.boolean.primary,
          type: 'boolean',
        },
        {
          linkId: KEYS.triggers.boolean.secondary,
          type: 'boolean',
        },
        {
          linkId: KEYS.triggers.string.primary,
          type: 'string',
        },
        {
          linkId: KEYS.triggers.string.secondary,
          type: 'string',
        },
        {
          linkId: KEYS.triggers.date.primary,
          type: 'date',
        },
        {
          linkId: KEYS.triggers.date.secondary,
          type: 'date',
        },
        {
          linkId: KEYS.dependents.bool.primaryTrue,
          type: 'string',
          enableWhen: [
            {
              question: KEYS.triggers.boolean.primary,
              operator: '=',
              answerBoolean: true,
            },
          ],
        },
        {
          linkId: 'enable-when-conditional-bool-false',
          type: 'boolean',
          enableWhen: [
            {
              question: KEYS.triggers.boolean.primary,
              operator: '=',
              answerBoolean: false,
            },
          ],
        },
        {
          linkId: 'enable-when-conditional-bool-not-true',
          type: 'boolean',
          enableWhen: [
            {
              question: KEYS.triggers.boolean.primary,
              operator: '!=',
              answerBoolean: true,
            },
          ],
        },
        {
          linkId: 'enable-when-conditional-bool-not-false',
          type: 'boolean',
          enableWhen: [
            {
              question: KEYS.triggers.boolean.primary,
              operator: '!=',
              answerBoolean: false,
            },
          ],
        },
        {
          linkId: KEYS.dependents.string,
          text: 'This is the default text a user sees above my input',
          type: 'string',
          enableWhen: [
            {
              question: KEYS.triggers.string.primary,
              operator: '=',
              answerString: 'foo',
            },
          ],
        },
        {
          linkId: KEYS.dependents.date.over,
          type: 'date',
          enableWhen: [
            {
              question: KEYS.triggers.date.primary,
              operator: '>',
              answerInteger: 18,
            },
          ],
        },
        {
          linkId: KEYS.dependents.date.under,
          type: 'date',
          enableWhen: [
            {
              question: KEYS.triggers.date.primary,
              operator: '<',
              answerInteger: 18,
            },
          ],
        },
        {
          linkId: KEYS.dependents.date.exactly,
          type: 'date',
          enableWhen: [
            {
              question: KEYS.triggers.date.primary,
              operator: '=',
              answerInteger: 18,
            },
          ],
        },
      ],
    },
  ],
};

const PAGE_ONE_ITEMS = (BASE_QUESTIONNAIRE.item ?? [])[0].item ?? [];

describe('Recursive group transform', () => {
  it('secondary insurance coverage values survive transform', () => {
    const structuredItems = mapQuestionnaireAndValueSetsToItemsList(PAGE_ONE_ITEMS, []);
    const formValues = BASE_FORM_VALUES.reduce((accum, item) => {
      accum[item.linkId] = { ...item };
      return accum;
    }, {} as any);
    formValues[KEYS.triggers.boolean.primary] = {
      linkId: KEYS.triggers.boolean.primary,
      answer: [{ valueBoolean: true }],
    };
    const conditionalBoolTrueItem = structuredItems.find((i) => i.linkId === KEYS.dependents.bool.primaryTrue);
    expect(conditionalBoolTrueItem).toBeDefined();
    assert(conditionalBoolTrueItem != undefined);
  });
});
