import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../src/ehr/practice-managed-questionnaire/import-json/validateRequestParameters';
import { ZambdaInput } from '../../src/shared/types/common';

const CALCULATED_URL = 'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-calculatedExpression';

const calculated = (expression: string, language = 'text/javascript'): unknown[] => [
  { url: CALCULATED_URL, valueExpression: { language, expression } },
];

const yesNo = (linkId: string): Record<string, unknown> => ({
  linkId,
  type: 'choice',
  text: linkId,
  answerOption: [{ valueCoding: { code: '0', display: 'No' } }, { valueCoding: { code: '1', display: 'Yes' } }],
});

const cage = (): Record<string, unknown> => ({
  resourceType: 'Questionnaire',
  url: 'https://ottehr.com/FHIR/Questionnaire/cage-alcohol-screening',
  title: 'CAGE Questionnaire (Alcohol screening)',
  status: 'active',
  version: '1.0.0',
  item: [
    { linkId: 'items', type: 'group', item: [yesNo('q1'), yesNo('q2'), yesNo('q3'), yesNo('q4')] },
    {
      linkId: 'results',
      type: 'group',
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
      ],
    },
  ],
});

const inputFor = (questionnaire: Record<string, unknown>): ZambdaInput => ({
  body: JSON.stringify({ questionnaire }),
  headers: { Authorization: 'Bearer test-token' },
  secrets: null,
});

const errorMessageFor = (questionnaire: Record<string, unknown>): string => {
  try {
    validateRequestParameters(inputFor(questionnaire));
  } catch (error) {
    return (error as { message?: string }).message ?? String(error);
  }
  throw new Error('expected the import to be rejected');
};

describe('practice managed questionnaire import-json: calculated expressions', () => {
  test('accepts the CAGE questionnaire', () => {
    const { questionnaire } = validateRequestParameters(inputFor(cage()));
    expect(questionnaire.url).toBe('https://ottehr.com/FHIR/Questionnaire/cage-alcohol-screening');
  });

  test('reports an unknown reference with an actionable message', () => {
    const questionnaire = cage();
    const results = (questionnaire.item as any[])[1];
    results.item[0].extension = calculated('(answers["q1"]||0)+(answers["q9"]||0)');

    const message = errorMessageFor(questionnaire);
    expect(message).toContain('The questionnaire has 1 problem with its calculated items:');
    expect(message).toContain(
      '- "total" (Total): the expression reads answers["q9"], but no item has linkId "q9". Did you mean "q1"?'
    );
    expect(message).toContain('Available linkIds: ');
  });

  test('reports every problem together, one per line', () => {
    const questionnaire = cage();
    const results = (questionnaire.item as any[])[1];
    results.item[0].extension = calculated('answers["total"] + 1');
    results.item[1].extension = calculated('answers["nope"]', 'text/fhirpath');

    const lines = errorMessageFor(questionnaire).split('\n');
    expect(lines[0]).toBe('The questionnaire has 3 problems with its calculated items:');
    expect(lines.slice(1)).toHaveLength(3);
    lines.slice(1).forEach((line) => expect(line.startsWith('- ')).toBe(true));
  });

  test('reports a syntax error and a circular reference', () => {
    const questionnaire = cage();
    const results = (questionnaire.item as any[])[1];
    results.item[0].extension = calculated('answers["positive-screen"]');
    results.item[1].extension = calculated('answers["total"]');
    expect(errorMessageFor(questionnaire)).toContain(
      '"total" and "positive-screen" depend on each other (total -> positive-screen -> total)'
    );

    results.item[0].extension = calculated('(answers["q1"]||0)+');
    results.item[1].extension = undefined;
    expect(errorMessageFor(questionnaire)).toContain('the expression is not valid JavaScript');
  });
});
