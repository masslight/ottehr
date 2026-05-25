import { DefaultExamComponentsConfig } from 'utils/lib/ottehr-config/examination/default-components.config';
import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../src/ehr/apply-template/validateRequestParameters';
import { ZambdaInput } from '../../src/shared';

const createInput = (body: Record<string, unknown>): ZambdaInput => ({
  body: JSON.stringify(body),
  headers: { Authorization: 'Bearer test-token' },
  secrets: { AUTH0_SECRET: 'test-secret' },
});

const baseBody = {
  encounterId: 'encounter-1',
  templateName: 'My Template',
  examType: DefaultExamComponentsConfig,
};

describe('Apply Template - validateRequestParameters', () => {
  test('accepts a request without sectionActions and defaults to an empty object', () => {
    const result = validateRequestParameters(createInput(baseBody));
    expect(result.sectionActions).toEqual({});
  });

  test('accepts valid sectionActions for every supported section', () => {
    const sectionActions = {
      hpi: 'append',
      moi: 'overwrite',
      ros: 'skip',
      examFindings: 'overwrite',
      mdm: 'append',
      diagnoses: 'append',
      patientInstructions: 'skip',
      cptCodes: 'overwrite',
      emCode: 'skip',
      accident: 'overwrite',
    };
    const result = validateRequestParameters(createInput({ ...baseBody, sectionActions }));
    expect(result.sectionActions).toEqual(sectionActions);
  });

  test('rejects an unknown section key', () => {
    const input = createInput({ ...baseBody, sectionActions: { totallyMadeUp: 'append' } });
    expect(() => validateRequestParameters(input)).toThrow(/Unknown template section/);
  });

  test('rejects an invalid action value', () => {
    const input = createInput({ ...baseBody, sectionActions: { hpi: 'merge' } });
    expect(() => validateRequestParameters(input)).toThrow(/Invalid action/);
  });

  test("rejects 'append' for examFindings", () => {
    const input = createInput({ ...baseBody, sectionActions: { examFindings: 'append' } });
    expect(() => validateRequestParameters(input)).toThrow(/does not support the 'append' action/);
  });

  test("rejects 'append' for emCode", () => {
    const input = createInput({ ...baseBody, sectionActions: { emCode: 'append' } });
    expect(() => validateRequestParameters(input)).toThrow(/does not support the 'append' action/);
  });

  test("rejects 'append' for accident", () => {
    const input = createInput({ ...baseBody, sectionActions: { accident: 'append' } });
    expect(() => validateRequestParameters(input)).toThrow(/does not support the 'append' action/);
  });

  test('rejects sectionActions that is not an object', () => {
    const input = createInput({ ...baseBody, sectionActions: 'not-an-object' });
    expect(() => validateRequestParameters(input)).toThrow(/must be an object/);
  });

  test('still throws when required fields are missing', () => {
    const input = createInput({ templateName: 'foo', examType: DefaultExamComponentsConfig });
    expect(() => validateRequestParameters(input)).toThrow(/encounterId/);
  });
});
