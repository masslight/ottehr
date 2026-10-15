import { Questionnaire, QuestionnaireItem, QuestionnaireResponseItem } from 'fhir/r4b';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS } from '../../../fhir/constants';
import { extractAnswerReferences, formatCalculatedValue } from '../calculated-answers';
import { buildAnswersMap, evaluateCalculatedItems } from '../calculated-expressions';
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
