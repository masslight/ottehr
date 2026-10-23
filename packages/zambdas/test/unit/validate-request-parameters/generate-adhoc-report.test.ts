import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/generate-adhoc-report/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

const secrets = createMockSecrets();
const inputWith = (body: unknown): ReturnType<typeof createMockZambdaInput> => createMockZambdaInput(body, { secrets });

const GENERATE_BODY = {
  schema: { datasetId: 'encounters-comprehensive', label: 'Encounters', description: '', rowCount: 1, fields: [] },
  request: 'count of encounters',
};

describe('generate-adhoc-report - validateRequestParameters', () => {
  test('a body with taskId is a status poll', () => {
    expect(validateRequestParameters(inputWith({ taskId: 'task-1' }))).toEqual({ taskId: 'task-1', secrets });
  });

  test('a body without taskId starts a generation', () => {
    const result = validateRequestParameters(inputWith({ ...GENERATE_BODY, model: 'claudeOpus_5_5_low' }));

    expect(result).toMatchObject({ request: 'count of encounters', model: 'claudeOpus_5_5_low' });
    expect('taskId' in result).toBe(false);
  });

  test('an empty taskId is rejected, not treated as a new generation', () => {
    expect(() => validateRequestParameters(inputWith({ ...GENERATE_BODY, taskId: '' }))).toThrow();
  });

  test.each([null, 1, 'text', []])('a JSON body that is not an object (%j) is invalid input', (body) => {
    const input = { ...inputWith(undefined), body: JSON.stringify(body) };

    expect(() => validateRequestParameters(input)).toThrow(
      expect.objectContaining({ message: 'Request body must be a JSON object' })
    );
  });

  test('an unknown model is rejected', () => {
    expect(() => validateRequestParameters(inputWith({ ...GENERATE_BODY, model: 'gpt-5' }))).toThrow();
  });
});
