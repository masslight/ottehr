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
  body: JSON.stringify({ questionnaireJson: JSON.stringify(questionnaire) }),
  headers: { Authorization: 'Bearer test-token' },
  secrets: null,
});

describe('practice managed questionnaire import-json: calculated expressions', () => {
  test('accepts the CAGE questionnaire', () => {
    const { questionnaire } = validateRequestParameters(inputFor(cage()));
    expect(questionnaire.url).toBe('https://ottehr.com/FHIR/Questionnaire/cage-alcohol-screening');
  });
});

describe('practice managed questionnaire import-json: the uploaded json', () => {
  const errorMessageForJson = (questionnaireJson: string): string => {
    try {
      validateRequestParameters({ ...inputFor(cage()), body: JSON.stringify({ questionnaireJson }) });
    } catch (error) {
      return (error as { message?: string }).message ?? String(error);
    }
    throw new Error('expected the import to be rejected');
  };

  test('rejects empty json', () => {
    expect(errorMessageForJson('  ')).toBe('Please upload a file or paste JSON');
  });

  test('rejects json that does not parse', () => {
    expect(errorMessageForJson('{ "resourceType": ')).toMatch(/^Invalid JSON: /);
  });

  test('rejects json that is not a single object', () => {
    expect(errorMessageForJson(JSON.stringify([cage()]))).toBe('JSON must be a single FHIR Questionnaire object');
  });

  test('rejects a resource that is not a Questionnaire', () => {
    expect(errorMessageForJson(JSON.stringify({ ...cage(), resourceType: 'Patient' }))).toBe(
      'resourceType must be "Questionnaire"'
    );
  });
});
