import { QuestionnaireItem, QuestionnaireResponseItem } from 'fhir/r4b';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS } from '../../../fhir/constants';
import {
  applyCalculatedAnswers,
  coerceCalculatedValue,
  extractCalculatedItems,
  validateCalculatedAnswers,
} from '../calculated-answers';
import { buildCalculatedAnswers } from '../calculated-expressions';
import { mapQuestionnaireAndValueSetsToItemsList } from '../paperwork';

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

// the CAGE shape: answers on one page, a hidden results page that only holds calculated items
const cageItems = (): QuestionnaireItem[] => [
  { linkId: 'items', type: 'group', text: 'Items', item: [yesNo('q1'), yesNo('q2'), yesNo('q3'), yesNo('q4')] },
  {
    linkId: 'results',
    type: 'group',
    text: 'Results',
    readOnly: true,
    item: [
      {
        linkId: 'total',
        type: 'string',
        text: 'Total',
        extension: calculated('(answers["q1"]||0)+(answers["q2"]||0)+(answers["q3"]||0)+(answers["q4"]||0)'),
      },
      {
        linkId: 'positive-screen',
        type: 'boolean',
        text: 'Positive screen',
        extension: calculated('(answers["total"]||0) >= 2'),
      },
      {
        linkId: 'positive-screen-rationale',
        type: 'string',
        text: 'Rationale',
        extension: calculated("'endorsed ' + (answers[\"total\"]||0) + ' of 4'"),
      },
    ],
  },
];

const intake = (items: QuestionnaireItem[]): ReturnType<typeof mapQuestionnaireAndValueSetsToItemsList> =>
  mapQuestionnaireAndValueSetsToItemsList(structuredClone(items), []);

const coded = (linkId: string, code: string): QuestionnaireResponseItem => ({
  linkId,
  answer: [{ valueCoding: { code, display: code === '1' ? 'Yes' : 'No' } }],
});

const stubPages = (): QuestionnaireResponseItem[] => [
  { linkId: 'items', item: [] },
  { linkId: 'results', item: [] },
];

const answerOf = (entry: QuestionnaireResponseItem | undefined): unknown => entry?.answer?.[0];

describe('coerceCalculatedValue', () => {
  it('records a value as the type the item declares', () => {
    expect(coerceCalculatedValue({ type: 'string' }, 2)).toEqual({ valueString: '2' });
    expect(coerceCalculatedValue({ type: 'text' }, 'abc')).toEqual({ valueString: 'abc' });
    expect(coerceCalculatedValue({ type: 'date' }, '2026-01-02')).toEqual({ valueString: '2026-01-02' });
    expect(coerceCalculatedValue({ type: 'boolean' }, true)).toEqual({ valueBoolean: true });
    expect(coerceCalculatedValue({ type: 'integer' }, 3)).toEqual({ valueInteger: 3 });
    expect(coerceCalculatedValue({ type: 'decimal' }, 3.5)).toEqual({ valueDecimal: 3.5 });
  });

  it('records nothing for a value that does not fit the type', () => {
    expect(coerceCalculatedValue({ type: 'integer' }, 3.5)).toBeUndefined();
    expect(coerceCalculatedValue({ type: 'boolean' }, 1)).toBeUndefined();
    expect(coerceCalculatedValue({ type: 'string' }, true)).toBeUndefined();
    expect(coerceCalculatedValue({ type: 'group' }, 'x')).toBeUndefined();
    expect(coerceCalculatedValue({ type: 'string' }, undefined)).toBeUndefined();
  });

  it('accepts a numeric string for a numeric item', () => {
    expect(coerceCalculatedValue({ type: 'integer' }, '4')).toEqual({ valueInteger: 4 });
    expect(coerceCalculatedValue({ type: 'decimal' }, '4.5')).toEqual({ valueDecimal: 4.5 });
  });
});

describe('buildCalculatedAnswers', () => {
  const pageItems = intake(cageItems());
  const formValues = (...values: QuestionnaireResponseItem[]): Record<string, QuestionnaireResponseItem> =>
    Object.fromEntries(values.map((value) => [value.linkId, value]));

  it('works out the hidden results page from the answers on the page being saved', () => {
    const result = buildCalculatedAnswers({
      pageItems,
      formValues: formValues(coded('q1', '1'), coded('q2', '1'), coded('q3', '0'), coded('q4', '0')),
      savedPages: stubPages(),
    });

    expect(result).toEqual([
      {
        linkId: 'results',
        item: [
          { linkId: 'total', answer: [{ valueString: '2' }] },
          { linkId: 'positive-screen', answer: [{ valueBoolean: true }] },
          { linkId: 'positive-screen-rationale', answer: [{ valueString: 'endorsed 2 of 4' }] },
        ],
      },
    ]);
  });

  it('prefers the value just entered over the stored one', () => {
    const result = buildCalculatedAnswers({
      pageItems,
      formValues: formValues(coded('q1', '1'), coded('q2', '1')),
      savedPages: [
        { linkId: 'items', item: [coded('q1', '0'), coded('q2', '0')] },
        { linkId: 'results', item: [] },
      ],
    });
    expect(answerOf(result[0]?.item?.find((i) => i.linkId === 'total'))).toEqual({ valueString: '2' });
  });

  it('uses stored answers for pages that are not in the form', () => {
    const result = buildCalculatedAnswers({
      pageItems,
      formValues: {},
      savedPages: [
        { linkId: 'items', item: [coded('q1', '1'), coded('q4', '1')] },
        { linkId: 'results', item: [] },
      ],
    });
    expect(answerOf(result[0]?.item?.find((i) => i.linkId === 'total'))).toEqual({ valueString: '2' });
  });

  it('sends nothing when the stored values are already right', () => {
    const savedPages: QuestionnaireResponseItem[] = [
      { linkId: 'items', item: [coded('q1', '1'), coded('q2', '1')] },
      {
        linkId: 'results',
        item: [
          { linkId: 'total', answer: [{ valueString: '2' }] },
          { linkId: 'positive-screen', answer: [{ valueBoolean: true }] },
          { linkId: 'positive-screen-rationale', answer: [{ valueString: 'endorsed 2 of 4' }] },
        ],
      },
    ];
    expect(buildCalculatedAnswers({ pageItems, formValues: {}, savedPages })).toEqual([]);
  });

  it('sends only the values that changed', () => {
    const savedPages: QuestionnaireResponseItem[] = [
      { linkId: 'items', item: [coded('q1', '1'), coded('q2', '1')] },
      {
        linkId: 'results',
        item: [
          { linkId: 'total', answer: [{ valueString: '2' }] },
          { linkId: 'positive-screen', answer: [{ valueBoolean: true }] },
          { linkId: 'positive-screen-rationale', answer: [{ valueString: 'endorsed 2 of 4' }] },
        ],
      },
    ];
    // a third yes: the total and rationale move, the screen stays positive
    const result = buildCalculatedAnswers({ pageItems, formValues: formValues(coded('q3', '1')), savedPages });
    expect(result).toEqual([
      {
        linkId: 'results',
        item: [
          { linkId: 'total', answer: [{ valueString: '3' }] },
          { linkId: 'positive-screen-rationale', answer: [{ valueString: 'endorsed 3 of 4' }] },
        ],
      },
    ]);
  });

  it('keeps group nesting, and reaches a calculated item on a rendered page', () => {
    const items = intake([
      {
        linkId: 'page',
        type: 'group',
        item: [
          yesNo('a'),
          {
            linkId: 'inner',
            type: 'group',
            item: [{ linkId: 'doubled', type: 'integer', extension: calculated('answers["a"] * 2') }],
          },
        ],
      },
    ]);
    const result = buildCalculatedAnswers({
      pageItems: items,
      formValues: formValues(coded('a', '1')),
      savedPages: [{ linkId: 'page', item: [] }],
    });
    expect(result).toEqual([
      { linkId: 'page', item: [{ linkId: 'inner', item: [{ linkId: 'doubled', answer: [{ valueInteger: 2 }] }] }] },
    ]);
  });

  describe('clearing', () => {
    beforeEach(() => {
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    });
    afterEach(() => {
      vi.restoreAllMocks();
    });

    const brokenItems = intake([
      {
        linkId: 'page',
        type: 'group',
        item: [yesNo('a'), { linkId: 'score', type: 'string', extension: calculated('answers["a"].nope.nope') }],
      },
    ]);

    it('clears a stored value that can no longer be calculated', () => {
      const result = buildCalculatedAnswers({
        pageItems: brokenItems,
        formValues: {},
        savedPages: [{ linkId: 'page', item: [{ linkId: 'score', answer: [{ valueString: 'old' }] }] }],
      });
      expect(result).toEqual([{ linkId: 'page', item: [{ linkId: 'score' }] }]);
    });

    it('sends nothing for a value that cannot be calculated and was never stored', () => {
      expect(
        buildCalculatedAnswers({ pageItems: brokenItems, formValues: {}, savedPages: [{ linkId: 'page', item: [] }] })
      ).toEqual([]);
    });
  });

  it('does not calculate for a page that is not enabled, and clears what is stored there', () => {
    const savedPages: QuestionnaireResponseItem[] = [
      { linkId: 'items', item: [coded('q1', '1')] },
      { linkId: 'results', item: [{ linkId: 'total', answer: [{ valueString: '1' }] }] },
    ];
    const result = buildCalculatedAnswers({
      pageItems,
      formValues: {},
      savedPages,
      isPageEnabled: (page) => page.linkId !== 'results',
    });
    expect(result).toEqual([{ linkId: 'results', item: [{ linkId: 'total' }] }]);
  });

  it('does nothing for a questionnaire without calculated items', () => {
    expect(
      buildCalculatedAnswers({
        pageItems: intake([{ linkId: 'page', type: 'group', item: [yesNo('a')] }]),
        formValues: formValues(coded('a', '1')),
        savedPages: [{ linkId: 'page', item: [] }],
      })
    ).toEqual([]);
  });
});

describe('validateCalculatedAnswers', () => {
  const items = intake(cageItems());
  const valid: QuestionnaireResponseItem[] = [
    { linkId: 'results', item: [{ linkId: 'total', answer: [{ valueString: '2' }] }, { linkId: 'positive-screen' }] },
  ];

  it('accepts typed values for calculated items, and entries that clear a value', () => {
    expect(validateCalculatedAnswers(items, valid)).toEqual([]);
    expect(validateCalculatedAnswers(items, [])).toEqual([]);
  });

  it('rejects a page the questionnaire does not have', () => {
    expect(validateCalculatedAnswers(items, [{ linkId: 'nope', item: [] }])).toEqual([
      '"nope" is not a page of this questionnaire.',
    ]);
  });

  it('rejects an item that is not on the page it is sent for', () => {
    expect(validateCalculatedAnswers(items, [{ linkId: 'results', item: [{ linkId: 'q1' }] }])).toEqual([
      '"q1" is not an item of page "results".',
    ]);
  });

  it('rejects a value for an item that is not calculated', () => {
    const result = validateCalculatedAnswers(items, [
      { linkId: 'items', item: [{ linkId: 'q1', answer: [{ valueCoding: { code: '1' } }] }] },
    ]);
    expect(result).toEqual(['"q1" is not a calculated item, so its value cannot be set this way.']);
  });

  it('rejects a value of the wrong type', () => {
    const wrongType = validateCalculatedAnswers(items, [
      { linkId: 'results', item: [{ linkId: 'positive-screen', answer: [{ valueString: 'true' }] }] },
    ]);
    expect(wrongType).toEqual(['The value of "positive-screen" does not match its item type "boolean".']);

    const twoAnswers = validateCalculatedAnswers(items, [
      { linkId: 'results', item: [{ linkId: 'total', answer: [{ valueString: '1' }, { valueString: '2' }] }] },
    ]);
    expect(twoAnswers).toHaveLength(1);

    const twoValues = validateCalculatedAnswers(items, [
      { linkId: 'results', item: [{ linkId: 'total', answer: [{ valueString: '1', valueBoolean: true }] }] },
    ]);
    expect(twoValues).toHaveLength(1);
  });

  it('rejects an answer on a page', () => {
    expect(validateCalculatedAnswers(items, [{ linkId: 'results', answer: [{ valueString: 'x' }] }])).toEqual([
      '"results" is a page and cannot have an answer.',
    ]);
  });

  it('walks nested groups', () => {
    const nested = intake([
      {
        linkId: 'page',
        type: 'group',
        item: [
          { linkId: 'inner', type: 'group', item: [{ linkId: 'n', type: 'integer', extension: calculated('1') }] },
        ],
      },
    ]);
    expect(
      validateCalculatedAnswers(nested, [
        { linkId: 'page', item: [{ linkId: 'inner', item: [{ linkId: 'n', answer: [{ valueInteger: 1 }] }] }] },
      ])
    ).toEqual([]);
    expect(
      validateCalculatedAnswers(nested, [
        { linkId: 'page', item: [{ linkId: 'inner', item: [{ linkId: 'n', answer: [{ valueDecimal: 1.5 }] }] }] },
      ])
    ).toHaveLength(1);
  });
});

describe('applyCalculatedAnswers', () => {
  const [, results] = intake(cageItems());
  const definitions = results?.item ?? [];

  it('adds calculated values to an empty page', () => {
    const result = applyCalculatedAnswers(
      [],
      [
        { linkId: 'positive-screen', answer: [{ valueBoolean: true }] },
        { linkId: 'total', answer: [{ valueString: '2' }] },
      ],
      definitions
    );
    // kept in questionnaire order
    expect(result).toEqual([
      { linkId: 'total', answer: [{ valueString: '2' }] },
      { linkId: 'positive-screen', answer: [{ valueBoolean: true }] },
    ]);
  });

  it('replaces a stored value, removes a cleared one, and leaves other items alone', () => {
    const existing: QuestionnaireResponseItem[] = [
      { linkId: 'real-answer', answer: [{ valueString: 'keep me' }] },
      { linkId: 'total', answer: [{ valueString: '1' }] },
      { linkId: 'positive-screen', answer: [{ valueBoolean: false }] },
    ];
    const result = applyCalculatedAnswers(
      existing,
      [{ linkId: 'total', answer: [{ valueString: '2' }] }, { linkId: 'positive-screen' }],
      definitions
    );
    expect(result).toEqual([
      { linkId: 'total', answer: [{ valueString: '2' }] },
      { linkId: 'real-answer', answer: [{ valueString: 'keep me' }] },
    ]);
    // the input is not mutated
    expect(existing).toHaveLength(3);
  });

  it('creates and walks groups', () => {
    const nested = intake([
      {
        linkId: 'page',
        type: 'group',
        item: [
          yesNo('a'),
          { linkId: 'inner', type: 'group', item: [{ linkId: 'n', type: 'integer', extension: calculated('1') }] },
        ],
      },
    ]);
    const pageDefinitions = nested[0]?.item ?? [];

    const created = applyCalculatedAnswers(
      [{ linkId: 'a', answer: [{ valueCoding: { code: '1' } }] }],
      [{ linkId: 'inner', item: [{ linkId: 'n', answer: [{ valueInteger: 1 }] }] }],
      pageDefinitions
    );
    expect(created).toEqual([
      { linkId: 'a', answer: [{ valueCoding: { code: '1' } }] },
      { linkId: 'inner', item: [{ linkId: 'n', answer: [{ valueInteger: 1 }] }] },
    ]);

    const updated = applyCalculatedAnswers(
      created,
      [{ linkId: 'inner', item: [{ linkId: 'n', answer: [{ valueInteger: 5 }] }] }],
      pageDefinitions
    );
    expect(updated[1]).toEqual({ linkId: 'inner', item: [{ linkId: 'n', answer: [{ valueInteger: 5 }] }] });
  });
});

describe('extractCalculatedItems', () => {
  const pageDefinitions = intake([
    {
      linkId: 'page',
      type: 'group',
      item: [
        yesNo('a'),
        { linkId: 'subtotal', type: 'integer', extension: calculated('1') },
        {
          linkId: 'inner',
          type: 'group',
          item: [{ linkId: 'n', type: 'integer', extension: calculated('1') }, yesNo('b')],
        },
        { linkId: 'empty-group', type: 'group', item: [yesNo('c')] },
      ],
    },
  ])[0]?.item;

  it('picks out the stored calculated values, keeping groups that hold one, and nothing else', () => {
    const stored: QuestionnaireResponseItem[] = [
      coded('a', '1'),
      { linkId: 'subtotal', answer: [{ valueInteger: 1 }] },
      { linkId: 'inner', item: [{ linkId: 'n', answer: [{ valueInteger: 2 }] }, coded('b', '1')] },
      { linkId: 'empty-group', item: [coded('c', '1')] },
    ];
    expect(extractCalculatedItems(stored, pageDefinitions ?? [])).toEqual([
      { linkId: 'subtotal', answer: [{ valueInteger: 1 }] },
      { linkId: 'inner', item: [{ linkId: 'n', answer: [{ valueInteger: 2 }] }] },
    ]);
  });

  it('returns nothing for a page that stores no calculated values', () => {
    expect(extractCalculatedItems(undefined, pageDefinitions ?? [])).toEqual([]);
    expect(extractCalculatedItems([coded('a', '1')], pageDefinitions ?? [])).toEqual([]);
  });
});
