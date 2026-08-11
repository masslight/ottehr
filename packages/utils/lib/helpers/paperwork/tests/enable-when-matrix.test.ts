import {
  Extension,
  QuestionnaireItem,
  QuestionnaireItemEnableWhen,
  QuestionnaireResponse,
  QuestionnaireResponseItem,
} from 'fhir/r4b';
import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest';
import { OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS } from '../../../fhir/constants';
import { IntakeQuestionnaireItem } from '../../../types/data/paperwork/paperwork.types';
import { mapQuestionnaireAndValueSetsToItemsList, structureExtension } from '../paperwork';
import { evalEnableWhen, evalRequired } from '../validation';

/**
 * Operator × value-type matrix for the enableWhen engine, plus pins for the engine's sharp
 * edges. Complements the scenario-style coverage in paperwork-engine.test.ts: this file
 * certifies the primitive semantics every conditional-paperwork mechanism (page gating,
 * requireWhen, harvest filtering) is built on, so the behaviors are locked down explicitly
 * rather than implied by whole-form fixtures.
 */

const TRIGGER = {
  bool: 'trigger-bool',
  string: 'trigger-string',
  choice: 'trigger-choice',
  openChoice: 'trigger-open-choice',
  date: 'trigger-date',
};

const DEPENDENT_LINK_ID = 'dependent-item';

const QUESTION_ITEMS: QuestionnaireItem[] = [
  { linkId: TRIGGER.bool, type: 'boolean' },
  { linkId: TRIGGER.string, type: 'string' },
  { linkId: TRIGGER.choice, type: 'choice' },
  { linkId: TRIGGER.openChoice, type: 'open-choice' },
  { linkId: TRIGGER.date, type: 'date' },
];

type AnswerList = QuestionnaireResponseItem['answer'];

const valuesFor = (entries: Record<string, AnswerList>): { [linkId: string]: QuestionnaireResponseItem } => {
  return Object.fromEntries(
    Object.entries(entries).map(([linkId, answer]) => [linkId, { linkId, ...(answer ? { answer } : {}) }])
  );
};

const evalDependent = (
  enableWhen: QuestionnaireItemEnableWhen[],
  values: { [linkId: string]: QuestionnaireResponseItem },
  options: {
    enableBehavior?: 'all' | 'any';
    questionnaireResponse?: QuestionnaireResponse;
    items?: QuestionnaireItem[];
    itemsMap?: boolean;
  } = {}
): boolean => {
  const rawItems: QuestionnaireItem[] = [
    ...(options.items ?? QUESTION_ITEMS),
    {
      linkId: DEPENDENT_LINK_ID,
      type: 'string',
      enableWhen,
      ...(options.enableBehavior ? { enableBehavior: options.enableBehavior } : {}),
    },
  ];
  const structuredItems = mapQuestionnaireAndValueSetsToItemsList(rawItems, []);
  const dependent = structuredItems.find((i) => i.linkId === DEPENDENT_LINK_ID);
  assert(dependent !== undefined);
  const itemsMap = options.itemsMap
    ? new Map<string, IntakeQuestionnaireItem>(structuredItems.map((i) => [i.linkId, i]))
    : undefined;
  return evalEnableWhen(dependent, structuredItems, values, options.questionnaireResponse, itemsMap);
};

describe('evalEnableWhen operator matrix', () => {
  describe('boolean questions', () => {
    const cases: {
      label: string;
      operator: string;
      answerBoolean: boolean;
      response: AnswerList;
      expected: boolean;
    }[] = [
      {
        label: '= true matches a true answer',
        operator: '=',
        answerBoolean: true,
        response: [{ valueBoolean: true }],
        expected: true,
      },
      {
        label: '= true rejects a false answer',
        operator: '=',
        answerBoolean: true,
        response: [{ valueBoolean: false }],
        expected: false,
      },
      {
        label: '= false matches a false answer',
        operator: '=',
        answerBoolean: false,
        response: [{ valueBoolean: false }],
        expected: true,
      },
      {
        label: '!= true matches a false answer',
        operator: '!=',
        answerBoolean: true,
        response: [{ valueBoolean: false }],
        expected: true,
      },
      {
        label: '!= true rejects a true answer',
        operator: '!=',
        answerBoolean: true,
        response: [{ valueBoolean: true }],
        expected: false,
      },
      // With no answer present, '=' is a non-match and '!=' matches — an unanswered
      // trigger enables every "!=" condition hanging off it.
      {
        label: '= true is false when the question is unanswered',
        operator: '=',
        answerBoolean: true,
        response: undefined,
        expected: false,
      },
      {
        label: '!= true is true when the question is unanswered',
        operator: '!=',
        answerBoolean: true,
        response: undefined,
        expected: true,
      },
      {
        label: 'exists true matches when any answer is present',
        operator: 'exists',
        answerBoolean: true,
        response: [{ valueBoolean: false }],
        expected: true,
      },
      {
        label: 'exists true rejects when no answer is present',
        operator: 'exists',
        answerBoolean: true,
        response: undefined,
        expected: false,
      },
      {
        label: 'exists false matches when no answer is present',
        operator: 'exists',
        answerBoolean: false,
        response: undefined,
        expected: true,
      },
      {
        label: 'exists false rejects when an answer is present',
        operator: 'exists',
        answerBoolean: false,
        response: [{ valueBoolean: true }],
        expected: false,
      },
    ];

    for (const { label, operator, answerBoolean, response, expected } of cases) {
      it(label, () => {
        const enableWhen = [{ question: TRIGGER.bool, operator, answerBoolean } as QuestionnaireItemEnableWhen];
        expect(evalDependent(enableWhen, valuesFor({ [TRIGGER.bool]: response }))).toBe(expected);
      });
    }

    it('throws on a comparison operator when a boolean answer is present', () => {
      const enableWhen = [
        { question: TRIGGER.bool, operator: '>', answerBoolean: true } as QuestionnaireItemEnableWhen,
      ];
      expect(() => evalDependent(enableWhen, valuesFor({ [TRIGGER.bool]: [{ valueBoolean: true }] }))).toThrow(
        /Unexpected operator/
      );
    });

    it('returns a non-match instead of throwing when the comparison operator meets no answer', () => {
      const enableWhen = [
        { question: TRIGGER.bool, operator: '>', answerBoolean: true } as QuestionnaireItemEnableWhen,
      ];
      expect(evalDependent(enableWhen, valuesFor({ [TRIGGER.bool]: undefined }))).toBe(false);
    });
  });

  describe('string, choice, and open-choice questions', () => {
    const questionTypes = [
      ['string', TRIGGER.string],
      ['choice', TRIGGER.choice],
      ['open-choice', TRIGGER.openChoice],
    ] as const;

    for (const [typeName, question] of questionTypes) {
      it(`= matches an equal ${typeName} answer and rejects a different one`, () => {
        const enableWhen = [{ question, operator: '=', answerString: 'foo' } as QuestionnaireItemEnableWhen];
        expect(evalDependent(enableWhen, valuesFor({ [question]: [{ valueString: 'foo' }] }))).toBe(true);
        expect(evalDependent(enableWhen, valuesFor({ [question]: [{ valueString: 'bar' }] }))).toBe(false);
      });

      it(`!= matches a different ${typeName} answer and an unanswered question`, () => {
        const enableWhen = [{ question, operator: '!=', answerString: 'foo' } as QuestionnaireItemEnableWhen];
        expect(evalDependent(enableWhen, valuesFor({ [question]: [{ valueString: 'bar' }] }))).toBe(true);
        expect(evalDependent(enableWhen, valuesFor({ [question]: undefined }))).toBe(true);
        expect(evalDependent(enableWhen, valuesFor({ [question]: [{ valueString: 'foo' }] }))).toBe(false);
      });
    }

    it('exists with an answerString matches on answer presence, not content', () => {
      const enableWhen = [
        { question: TRIGGER.string, operator: 'exists', answerString: 'anything' } as QuestionnaireItemEnableWhen,
      ];
      expect(evalDependent(enableWhen, valuesFor({ [TRIGGER.string]: [{ valueString: 'foo' }] }))).toBe(true);
      expect(evalDependent(enableWhen, valuesFor({ [TRIGGER.string]: undefined }))).toBe(false);
    });

    it('throws on a comparison operator when a string answer is present', () => {
      const enableWhen = [
        { question: TRIGGER.string, operator: '>', answerString: 'foo' } as QuestionnaireItemEnableWhen,
      ];
      expect(() => evalDependent(enableWhen, valuesFor({ [TRIGGER.string]: [{ valueString: 'zzz' }] }))).toThrow(
        /Unexpected operator/
      );
    });

    // Sharp edge: an empty answerString falls out of the string branch entirely, so the
    // condition can never match — even a response of '' does not satisfy "= ''".
    it('= with an empty answerString never matches, even against an empty response', () => {
      const enableWhen = [{ question: TRIGGER.string, operator: '=', answerString: '' } as QuestionnaireItemEnableWhen];
      expect(evalDependent(enableWhen, valuesFor({ [TRIGGER.string]: [{ valueString: '' }] }))).toBe(false);
    });
  });

  describe('date questions with answerDate', () => {
    // Direction pin: the implementation compares the enableWhen answerDate (left operand)
    // against the response value (right operand). '>' means "answerDate is after the
    // response", which is the reverse of the FHIR enableWhen reading ("response > answer").
    const ANSWER_DATE = '2020-06-15';
    const BEFORE = '2019-01-01';
    const AFTER = '2021-12-31';

    const cases: { label: string; operator: string; response: string; expected: boolean }[] = [
      { label: '= matches the same date', operator: '=', response: ANSWER_DATE, expected: true },
      { label: '= rejects a different date', operator: '=', response: BEFORE, expected: false },
      { label: '!= rejects the same date', operator: '!=', response: ANSWER_DATE, expected: false },
      { label: '!= matches a different date', operator: '!=', response: AFTER, expected: true },
      {
        label: '> matches when the response is before the answerDate',
        operator: '>',
        response: BEFORE,
        expected: true,
      },
      { label: '> rejects when the response is after the answerDate', operator: '>', response: AFTER, expected: false },
      { label: '< matches when the response is after the answerDate', operator: '<', response: AFTER, expected: true },
      {
        label: '< rejects when the response is before the answerDate',
        operator: '<',
        response: BEFORE,
        expected: false,
      },
      { label: '>= matches the same date', operator: '>=', response: ANSWER_DATE, expected: true },
      { label: '<= matches the same date', operator: '<=', response: ANSWER_DATE, expected: true },
    ];

    for (const { label, operator, response, expected } of cases) {
      it(label, () => {
        const enableWhen = [
          { question: TRIGGER.date, operator, answerDate: ANSWER_DATE } as QuestionnaireItemEnableWhen,
        ];
        expect(evalDependent(enableWhen, valuesFor({ [TRIGGER.date]: [{ valueString: response }] }))).toBe(expected);
      });
    }

    it('returns false for an unanswered or unparseable date instead of throwing', () => {
      const enableWhen = [
        { question: TRIGGER.date, operator: '=', answerDate: ANSWER_DATE } as QuestionnaireItemEnableWhen,
      ];
      expect(evalDependent(enableWhen, valuesFor({ [TRIGGER.date]: undefined }))).toBe(false);
      expect(evalDependent(enableWhen, valuesFor({ [TRIGGER.date]: [{ valueString: 'not-a-date' }] }))).toBe(false);
    });
  });

  describe('date questions with answerInteger (age gating)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-11T12:00:00'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    // answerInteger N resolves to the date exactly N years ago (2008-08-11 here), which is
    // then compared with the same left/right convention as answerDate: '>' matches DOBs
    // before the cutoff (older than N), '<' matches DOBs after it (younger than N).
    const withAge = (operator: string, dob: string): boolean => {
      const enableWhen = [{ question: TRIGGER.date, operator, answerInteger: 18 } as QuestionnaireItemEnableWhen];
      return evalDependent(enableWhen, valuesFor({ [TRIGGER.date]: [{ valueString: dob }] }));
    };

    it('> matches a patient older than the threshold', () => {
      expect(withAge('>', '2000-03-05')).toBe(true);
      expect(withAge('>', '2015-10-20')).toBe(false);
    });

    it('< matches a patient younger than the threshold', () => {
      expect(withAge('<', '2015-10-20')).toBe(true);
      expect(withAge('<', '2000-03-05')).toBe(false);
    });

    it('= and the inclusive operators match a birth date exactly on the cutoff', () => {
      expect(withAge('=', '2008-08-11')).toBe(true);
      expect(withAge('>=', '2008-08-11')).toBe(true);
      expect(withAge('<=', '2008-08-11')).toBe(true);
    });

    it('returns false for a negative answerInteger', () => {
      const enableWhen = [{ question: TRIGGER.date, operator: '=', answerInteger: -1 } as QuestionnaireItemEnableWhen];
      expect(evalDependent(enableWhen, valuesFor({ [TRIGGER.date]: [{ valueString: '2008-08-11' }] }))).toBe(false);
    });
  });

  describe('missing question references', () => {
    // Sharp edge: when the referenced question does not exist in the questionnaire, the
    // condition evaluates to (operator === '!='). A '!=' condition against a typo'd or
    // removed linkId silently passes — config lint, not the engine, has to catch that.
    it("'=' against a nonexistent question is false", () => {
      const enableWhen = [
        { question: 'no-such-question', operator: '=', answerString: 'foo' } as QuestionnaireItemEnableWhen,
      ];
      expect(evalDependent(enableWhen, valuesFor({}))).toBe(false);
    });

    it("'!=' against a nonexistent question is true", () => {
      const enableWhen = [
        { question: 'no-such-question', operator: '!=', answerString: 'foo' } as QuestionnaireItemEnableWhen,
      ];
      expect(evalDependent(enableWhen, valuesFor({}))).toBe(true);
    });

    it("'exists' against a nonexistent question is false", () => {
      const enableWhen = [
        { question: 'no-such-question', operator: 'exists', answerBoolean: true } as QuestionnaireItemEnableWhen,
      ];
      expect(evalDependent(enableWhen, valuesFor({}))).toBe(false);
    });
  });

  describe('unsupported question/answer pairings resolve to false', () => {
    it('string question with a boolean answer definition', () => {
      const enableWhen = [
        { question: TRIGGER.string, operator: '=', answerBoolean: true } as QuestionnaireItemEnableWhen,
      ];
      expect(evalDependent(enableWhen, valuesFor({ [TRIGGER.string]: [{ valueString: 'true' }] }))).toBe(false);
    });

    it('date question with a string answer definition', () => {
      const enableWhen = [
        { question: TRIGGER.date, operator: '=', answerString: '2020-06-15' } as QuestionnaireItemEnableWhen,
      ];
      expect(evalDependent(enableWhen, valuesFor({ [TRIGGER.date]: [{ valueString: '2020-06-15' }] }))).toBe(false);
    });

    it('boolean question with a string answer definition', () => {
      const enableWhen = [
        { question: TRIGGER.bool, operator: '=', answerString: 'true' } as QuestionnaireItemEnableWhen,
      ];
      expect(evalDependent(enableWhen, valuesFor({ [TRIGGER.bool]: [{ valueBoolean: true }] }))).toBe(false);
    });
  });

  describe('enableBehavior', () => {
    const bothConditions: QuestionnaireItemEnableWhen[] = [
      { question: TRIGGER.bool, operator: '=', answerBoolean: true },
      { question: TRIGGER.string, operator: '=', answerString: 'foo' },
    ];
    const oneHolds = valuesFor({
      [TRIGGER.bool]: [{ valueBoolean: true }],
      [TRIGGER.string]: [{ valueString: 'bar' }],
    });
    const bothHold = valuesFor({
      [TRIGGER.bool]: [{ valueBoolean: true }],
      [TRIGGER.string]: [{ valueString: 'foo' }],
    });

    it("'all' requires every condition to hold", () => {
      expect(evalDependent(bothConditions, bothHold, { enableBehavior: 'all' })).toBe(true);
      expect(evalDependent(bothConditions, oneHolds, { enableBehavior: 'all' })).toBe(false);
    });

    it("'any' is satisfied by a single holding condition", () => {
      expect(evalDependent(bothConditions, oneHolds, { enableBehavior: 'any' })).toBe(true);
    });

    it("defaults to 'all' when enableBehavior is not set", () => {
      expect(evalDependent(bothConditions, oneHolds)).toBe(false);
      expect(evalDependent(bothConditions, bothHold)).toBe(true);
    });

    it('an item with no enableWhen at all is enabled', () => {
      expect(evalDependent([], valuesFor({}))).toBe(true);
    });
  });

  describe('question path resolution', () => {
    const PAGE_ITEMS: QuestionnaireItem[] = [{ linkId: 'page-one', type: 'group', item: QUESTION_ITEMS }];
    const dottedCondition = [
      { question: `page-one.${TRIGGER.string}`, operator: '=', answerString: 'foo' } as QuestionnaireItemEnableWhen,
    ];

    it('resolves a dotted page.child path against nested values', () => {
      const nestedValues = {
        'page-one': {
          linkId: 'page-one',
          item: [{ linkId: TRIGGER.string, answer: [{ valueString: 'foo' }] }],
        },
      };
      expect(evalDependent(dottedCondition, nestedValues, { items: PAGE_ITEMS })).toBe(true);
    });

    it('falls back to a flat lookup by final linkId when the dotted path finds nothing', () => {
      const flatValues = valuesFor({ [TRIGGER.string]: [{ valueString: 'foo' }] });
      expect(evalDependent(dottedCondition, flatValues, { items: PAGE_ITEMS })).toBe(true);
    });

    it('produces the same verdict with and without the itemsMap fast path', () => {
      const enableWhen = [
        { question: TRIGGER.string, operator: '=', answerString: 'foo' } as QuestionnaireItemEnableWhen,
      ];
      const values = valuesFor({ [TRIGGER.string]: [{ valueString: 'foo' }] });
      expect(evalDependent(enableWhen, values, { itemsMap: true })).toBe(evalDependent(enableWhen, values));
    });
  });

  describe('$status pseudo-question', () => {
    const qr = (status: QuestionnaireResponse['status']): QuestionnaireResponse => ({
      resourceType: 'QuestionnaireResponse',
      status,
    });
    const statusCondition = (operator: string, answerString: string): QuestionnaireItemEnableWhen[] => [
      { question: '$status', operator, answerString } as QuestionnaireItemEnableWhen,
    ];

    it("'=' matches the response status", () => {
      expect(
        evalDependent(statusCondition('=', 'completed'), valuesFor({}), { questionnaireResponse: qr('completed') })
      ).toBe(true);
      expect(
        evalDependent(statusCondition('=', 'completed'), valuesFor({}), { questionnaireResponse: qr('in-progress') })
      ).toBe(false);
    });

    it("'!=' rejects the matching status", () => {
      expect(
        evalDependent(statusCondition('!=', 'completed'), valuesFor({}), { questionnaireResponse: qr('in-progress') })
      ).toBe(true);
      expect(
        evalDependent(statusCondition('!=', 'completed'), valuesFor({}), { questionnaireResponse: qr('completed') })
      ).toBe(false);
    });

    it("'in' matches against a comma-separated status list", () => {
      expect(
        evalDependent(statusCondition('in', 'completed, amended'), valuesFor({}), {
          questionnaireResponse: qr('amended'),
        })
      ).toBe(true);
      expect(
        evalDependent(statusCondition('in', 'completed, amended'), valuesFor({}), {
          questionnaireResponse: qr('in-progress'),
        })
      ).toBe(false);
    });

    it("'exists' reflects whether any response was provided", () => {
      const existsCondition = [{ question: '$status', operator: 'exists' } as QuestionnaireItemEnableWhen];
      expect(evalDependent(existsCondition, valuesFor({}), { questionnaireResponse: qr('in-progress') })).toBe(true);
      expect(evalDependent(existsCondition, valuesFor({}))).toBe(false);
    });

    // The consent-page pattern: "$status != completed" must hold before the first submit,
    // when no QuestionnaireResponse exists yet.
    it("'!=' is true and '=' is false when no QuestionnaireResponse is passed", () => {
      expect(evalDependent(statusCondition('!=', 'completed'), valuesFor({}))).toBe(true);
      expect(evalDependent(statusCondition('=', 'completed'), valuesFor({}))).toBe(false);
    });
  });
});

describe('evalRequired', () => {
  const structuredWith = (
    overrides: Partial<QuestionnaireItem> & { extension?: Extension[] }
  ): IntakeQuestionnaireItem => {
    const raw: QuestionnaireItem[] = [...QUESTION_ITEMS, { linkId: DEPENDENT_LINK_ID, type: 'string', ...overrides }];
    const structured = mapQuestionnaireAndValueSetsToItemsList(raw, []);
    const dependent = structured.find((i) => i.linkId === DEPENDENT_LINK_ID);
    assert(dependent !== undefined);
    return dependent;
  };

  const requireWhenExtension = (question: string, operator: string, answerString: string): Extension => ({
    url: OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.requireWhen.extension,
    extension: [
      { url: OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.requireWhen.question, valueString: question },
      { url: OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.requireWhen.operator, valueString: operator },
      { url: OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.requireWhen.answer, valueString: answerString },
    ],
  });

  it('a statically required item is required regardless of context', () => {
    const item = structuredWith({ required: true });
    expect(evalRequired(item, valuesFor({}))).toBe(true);
  });

  it('an item with no requireWhen is not required', () => {
    const item = structuredWith({});
    expect(evalRequired(item, valuesFor({}))).toBe(false);
  });

  it('requireWhen makes the item required exactly when its condition holds', () => {
    const item = structuredWith({ extension: [requireWhenExtension(TRIGGER.string, '=', 'yes')] });
    expect(evalRequired(item, valuesFor({ [TRIGGER.string]: [{ valueString: 'yes' }] }))).toBe(true);
    expect(evalRequired(item, valuesFor({ [TRIGGER.string]: [{ valueString: 'no' }] }))).toBe(false);
  });

  // Sharp edge: structureExtension keeps only the FIRST require-when extension. A second
  // condition on the same item is silently dropped rather than AND-ed or OR-ed.
  it('only the first of multiple require-when extensions survives parsing', () => {
    const item = structuredWith({
      extension: [
        requireWhenExtension(TRIGGER.string, '=', 'yes'),
        requireWhenExtension(TRIGGER.choice, '=', 'also-required-when-this'),
      ],
    });
    expect(item.requireWhen).toBeDefined();
    expect(item.requireWhen?.question).toBe(TRIGGER.string);
    expect(item.requireWhen?.answerString).toBe('yes');

    // The dropped second condition has no effect even when it holds.
    expect(evalRequired(item, valuesFor({ [TRIGGER.choice]: [{ valueString: 'also-required-when-this' }] }))).toBe(
      false
    );
  });

  it('structureExtension parses the require-when tuple faithfully', () => {
    const rawItem: QuestionnaireItem = {
      linkId: 'raw-item',
      type: 'string',
      extension: [requireWhenExtension(TRIGGER.bool, '!=', 'no')],
    };
    const parsed = structureExtension(rawItem);
    expect(parsed.requireWhen).toEqual({
      question: TRIGGER.bool,
      operator: '!=',
      answerString: 'no',
      answerBoolean: undefined,
      answerInteger: undefined,
      answerDate: undefined,
    });
  });
});
