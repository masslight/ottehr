import { Questionnaire, QuestionnaireItem, QuestionnaireResponseItem } from 'fhir/r4b';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS } from '../../../fhir/constants';
import {
  buildAnswersMap,
  collectCalculatedExpressionIssues,
  evaluateCalculatedItems,
  extractAnswerReferences,
  formatCalculatedValue,
} from '../calculated-expressions';
import { mapQuestionnaireAndValueSetsToItemsList } from '../paperwork';
import { evalEnableWhen, isPageHidden } from '../validation';

const calculated = (expression: string, language = 'text/javascript'): QuestionnaireItem['extension'] => [
  { url: OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.calculatedExpression, valueExpression: { language, expression } },
];

const yesNo = (linkId: string, text: string): QuestionnaireItem => ({
  linkId,
  type: 'choice',
  text,
  answerOption: [{ valueCoding: { code: '0', display: 'No' } }, { valueCoding: { code: '1', display: 'Yes' } }],
});

// mirrors the CAGE questionnaire the feature was built for
const cageItems = (): QuestionnaireItem[] => [
  {
    linkId: 'items',
    type: 'group',
    text: 'Items',
    item: [yesNo('q1', 'Cut down'), yesNo('q2', 'Annoyed'), yesNo('q3', 'Guilty'), yesNo('q4', 'Eye-opener')],
  },
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
        text: 'Positive screen (≥ 2)',
        extension: calculated('(answers["total"]||0) >= 2'),
      },
      {
        linkId: 'positive-screen-rationale',
        type: 'string',
        text: 'Screen rationale',
        extension: calculated("'endorsed ' + (answers[\"total\"]||0) + ' of 4 (≥2 = positive)'"),
      },
    ],
  },
];

const coded = (linkId: string, code: string, display: string): QuestionnaireResponseItem => ({
  linkId,
  answer: [{ valueCoding: { code, display } }],
});

const page = (linkId: string, ...item: QuestionnaireResponseItem[]): QuestionnaireResponseItem => ({ linkId, item });

const intakeItems = (items: QuestionnaireItem[]): ReturnType<typeof mapQuestionnaireAndValueSetsToItemsList> =>
  mapQuestionnaireAndValueSetsToItemsList(structuredClone(items), []);

describe('evaluateCalculatedItems', () => {
  it('sums coded answers as numbers, not strings', () => {
    const qr = [
      page('items', coded('q1', '1', 'Yes'), coded('q2', '1', 'Yes'), coded('q3', '0', 'No'), coded('q4', '0', 'No')),
    ];
    const result = evaluateCalculatedItems(intakeItems(cageItems()), qr);
    expect(result.total).toBe(2);
    expect(result['positive-screen']).toBe(true);
    expect(result['positive-screen-rationale']).toBe('endorsed 2 of 4 (≥2 = positive)');
  });

  it('treats unanswered items as absent', () => {
    const result = evaluateCalculatedItems(intakeItems(cageItems()), [page('items', coded('q1', '1', 'Yes'))]);
    expect(result.total).toBe(1);
    expect(result['positive-screen']).toBe(false);
    expect(evaluateCalculatedItems(intakeItems(cageItems()), []).total).toBe(0);
  });

  it('reads the raw items of a questionnaire as well as intake items', () => {
    const qr = [page('items', coded('q1', '1', 'Yes'), coded('q2', '1', 'Yes'))];
    expect(evaluateCalculatedItems(cageItems(), qr).total).toBe(2);
  });

  it('evaluates a calculated item after the ones it reads, wherever the author placed it', () => {
    const items = cageItems();
    const results = items[1]?.item ?? [];
    results.reverse();
    const qr = [page('items', coded('q1', '1', 'Yes'), coded('q4', '1', 'Yes'))];
    const result = evaluateCalculatedItems(intakeItems(items), qr);
    expect(result['positive-screen']).toBe(true);
    expect(result['positive-screen-rationale']).toBe('endorsed 2 of 4 (≥2 = positive)');
  });

  it('ignores a stale stored value for a calculated item', () => {
    const qr = [
      page('items', coded('q1', '1', 'Yes')),
      page('results', { linkId: 'total', answer: [{ valueString: '99' }] }),
    ];
    expect(evaluateCalculatedItems(intakeItems(cageItems()), qr).total).toBe(1);
  });

  it('finds answers in nested groups on any page', () => {
    const nested: QuestionnaireItem[] = [
      { linkId: 'page', type: 'group', item: [{ linkId: 'inner', type: 'group', item: [yesNo('deep', 'Deep')] }] },
      { linkId: 'out', type: 'string', extension: calculated('answers["deep"] + 10') },
    ];
    const qr = [page('page', page('inner', coded('deep', '5', 'Five')))];
    expect(evaluateCalculatedItems(intakeItems(nested), qr).out).toBe(15);
  });

  describe('failures never throw', () => {
    beforeEach(() => {
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    });
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('yields undefined for a circular reference', () => {
      const items: QuestionnaireItem[] = [
        { linkId: 'a', type: 'string', extension: calculated('answers["b"]') },
        { linkId: 'b', type: 'string', extension: calculated('answers["a"]') },
        { linkId: 'c', type: 'string', extension: calculated('1 + 1') },
      ];
      const result = evaluateCalculatedItems(intakeItems(items), []);
      expect(result.a).toBeUndefined();
      expect(result.b).toBeUndefined();
      expect(result.c).toBe(2);
    });

    it('yields undefined for an expression that does not compile or throws', () => {
      const items: QuestionnaireItem[] = [
        { linkId: 'bad-syntax', type: 'string', extension: calculated('(answers["q1"]||0)+') },
        { linkId: 'throws', type: 'string', extension: calculated('answers["missing"].length') },
        { linkId: 'nan', type: 'string', extension: calculated('answers["missing"] * 2') },
      ];
      const result = evaluateCalculatedItems(intakeItems(items), []);
      expect(result['bad-syntax']).toBeUndefined();
      expect(result.throws).toBeUndefined();
      expect(result.nan).toBeUndefined();
    });
  });
});

describe('buildAnswersMap / extractAnswerReferences / formatCalculatedValue', () => {
  it('exposes numeric codes as numbers and other codes as strings', () => {
    const map = buildAnswersMap([
      coded('a', '1', 'Yes'),
      coded('b', 'severe', 'Severe'),
      { linkId: 'c', answer: [{ valueBoolean: true }] },
      { linkId: 'd', answer: [{ valueString: 'text' }] },
      { linkId: 'e', answer: [{ valueString: 'x' }, { valueString: 'y' }] },
      { linkId: 'f' },
    ]);
    expect(map).toEqual({ a: 1, b: 'severe', c: true, d: 'text', e: ['x', 'y'] });
  });

  it('extracts bracket and dot references once each', () => {
    expect(extractAnswerReferences(`answers["a-b"] + answers['c'] + answers.d + answers["a-b"]`)).toEqual([
      'a-b',
      'c',
      'd',
    ]);
  });

  it('formats values for display', () => {
    expect(formatCalculatedValue(undefined)).toBe('');
    expect(formatCalculatedValue(true)).toBe('Yes');
    expect(formatCalculatedValue(false)).toBe('No');
    expect(formatCalculatedValue(3)).toBe('3');
    expect(formatCalculatedValue('text')).toBe('text');
  });
});

describe('collectCalculatedExpressionIssues', () => {
  it('finds nothing wrong with the CAGE questionnaire, even with a calculated item placed before what it reads', () => {
    expect(collectCalculatedExpressionIssues(cageItems())).toEqual([]);
    const items = cageItems();
    items[1]?.item?.reverse();
    expect(collectCalculatedExpressionIssues(items)).toEqual([]);
  });

  it('reports a missing expression', () => {
    const items: QuestionnaireItem[] = [
      {
        linkId: 'total',
        type: 'string',
        text: 'Total',
        extension: [{ url: OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.calculatedExpression, valueExpression: {} as never }],
      },
    ];
    expect(collectCalculatedExpressionIssues(items)).toEqual([
      '"total" (Total): the calculated-expression extension has no expression. Add valueExpression.expression, or remove the extension.',
    ]);
  });

  it('reports an unsupported or missing language', () => {
    const wrongLanguage = collectCalculatedExpressionIssues([
      { linkId: 'total', type: 'string', text: 'Total', extension: calculated('1', 'text/fhirpath') },
    ]);
    expect(wrongLanguage).toEqual([
      '"total" (Total): expression language "text/fhirpath" is not supported. Set valueExpression.language to "text/javascript".',
    ]);
    const noLanguage = collectCalculatedExpressionIssues([
      {
        linkId: 'total',
        type: 'string',
        extension: [
          {
            url: OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS.calculatedExpression,
            valueExpression: { expression: '1' } as never,
          },
        ],
      },
    ]);
    expect(noLanguage).toEqual([
      '"total": expression language is missing. Set valueExpression.language to "text/javascript".',
    ]);
  });

  it('reports a syntax error with the expression', () => {
    const [issue, ...rest] = collectCalculatedExpressionIssues([
      yesNo('q1', 'Cut down'),
      { linkId: 'total', type: 'string', text: 'Total', extension: calculated('(answers["q1"]||0)+') },
    ]);
    expect(rest).toEqual([]);
    expect(issue).toMatch(
      /^"total" \(Total\): the expression is not valid JavaScript \(.+\)\. Expression: \(answers\["q1"\]\|\|0\)\+ \. Fix the syntax and upload again\.$/
    );
  });

  it('reports an unknown reference with a suggestion and the available linkIds', () => {
    const items = cageItems();
    const total = items[1]?.item?.[0];
    if (total) total.extension = calculated('(answers["q1"]||0)+(answers["qq9"]||0)+(answers["q"]||0)');
    const issues = collectCalculatedExpressionIssues(items);
    expect(issues).toHaveLength(2);
    expect(issues[0]).toBe(
      '"total" (Total): the expression reads answers["qq9"], but no item has linkId "qq9". Did you mean "q1"? Available linkIds: items, q1, q2, q3, q4, results, positive-screen, positive-screen-rationale.'
    );
    expect(issues[1]).toContain('answers["q"], but no item has linkId "q"');
  });

  it('truncates the list of available linkIds', () => {
    const many: QuestionnaireItem[] = Array.from({ length: 14 }, (_, i) => ({
      linkId: `item-${i}`,
      type: 'string',
    }));
    many.push({ linkId: 'total', type: 'string', extension: calculated('answers["nope"]') });
    const [issue] = collectCalculatedExpressionIssues(many);
    expect(issue).toContain(
      'Available linkIds: item-0, item-1, item-2, item-3, item-4, item-5, item-6, item-7, item-8, item-9, ....'
    );
  });

  it('reports a self reference', () => {
    expect(
      collectCalculatedExpressionIssues([
        { linkId: 'total', type: 'string', text: 'Total', extension: calculated('answers["total"] + 1') },
      ])
    ).toEqual(['"total" (Total): the expression reads its own value. Remove answers["total"] from it.']);
  });

  it('reports a circular reference once', () => {
    const issues = collectCalculatedExpressionIssues([
      { linkId: 'a', type: 'string', extension: calculated('answers["b"]') },
      { linkId: 'b', type: 'string', extension: calculated('answers["a"]') },
    ]);
    expect(issues).toEqual([
      '"a" and "b" depend on each other (a -> b -> a), so none of their values can be calculated. Remove one of the references.',
    ]);
  });

  it('reports an unsupported item type', () => {
    const issues = collectCalculatedExpressionIssues([
      { linkId: 'results', type: 'group', text: 'Results', extension: calculated('1') },
    ]);
    expect(issues).toEqual([
      '"results" (Results): calculated expressions can only be used on string, text, boolean, integer, decimal and date items, not "group".',
    ]);
  });

  it('reports every problem together', () => {
    const issues = collectCalculatedExpressionIssues([
      { linkId: 'a', type: 'string', extension: calculated('answers["a"]') },
      { linkId: 'b', type: 'string', extension: calculated('answers["zzz"]', 'text/fhirpath') },
    ]);
    expect(issues).toHaveLength(3);
  });
});

describe('hidden calculated items and pages', () => {
  it('parses the extension onto the intake item', () => {
    const [, results] = intakeItems(cageItems());
    expect(results?.item?.[0]?.calculatedExpression).toEqual({
      language: 'text/javascript',
      expression: '(answers["q1"]||0)+(answers["q2"]||0)+(answers["q3"]||0)+(answers["q4"]||0)',
    });
  });

  it('hides a page only when it is readOnly and hidden', () => {
    expect(isPageHidden({ readOnly: true })).toBe(true);
    expect(isPageHidden({ readOnly: true, disabledDisplay: 'hidden' })).toBe(true);
    expect(isPageHidden({ readOnly: true, disabledDisplay: 'protected' })).toBe(false);
    expect(isPageHidden({ disabledDisplay: 'hidden' })).toBe(false);
    expect(isPageHidden({})).toBe(false);
  });
});

describe('coded answers in enableWhen', () => {
  const questionnaire: Pick<Questionnaire, 'item'> = {
    item: [
      yesNo('q1', 'Cut down'),
      {
        linkId: 'follow-up',
        type: 'string',
        enableWhen: [{ question: 'q1', operator: '=', answerCoding: { code: '1' } }],
      },
      {
        linkId: 'by-display',
        type: 'string',
        enableWhen: [{ question: 'q1', operator: '=', answerString: 'Yes' }],
      },
    ],
  };
  const items = intakeItems(questionnaire.item ?? []);
  const followUp = items[1];
  const byDisplay = items[2];

  it('matches a coded answer on its code (answerCoding) or its display (answerString)', () => {
    if (!followUp || !byDisplay) throw new Error('fixture');
    const yes = { q1: coded('q1', '1', 'Yes') };
    const no = { q1: coded('q1', '0', 'No') };
    expect(evalEnableWhen(followUp, items, yes)).toBe(true);
    expect(evalEnableWhen(followUp, items, no)).toBe(false);
    expect(evalEnableWhen(byDisplay, items, yes)).toBe(true);
    expect(evalEnableWhen(byDisplay, items, no)).toBe(false);
  });
});
