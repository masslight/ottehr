import { describe, expect, it } from 'vitest';
import { validateRequestParameters } from '../src/ehr/complete-erx-task/validateRequestParameters';
import { ZambdaInput } from '../src/shared/types/common';

const zambdaInput = (body: unknown): ZambdaInput => ({ body: JSON.stringify(body), secrets: null }) as ZambdaInput;

describe('complete-erx-task: request', () => {
  it('takes the task id', () => {
    const taskId = '5f1c3c3e-7a1e-4f3b-9d1e-2a6b8c9d0e1f';
    expect(validateRequestParameters(zambdaInput({ taskId }))).toEqual({ taskId, secrets: null });
  });

  it('refuses a missing or malformed task id', () => {
    expect(() => validateRequestParameters(zambdaInput({}))).toThrow();
    expect(() => validateRequestParameters(zambdaInput({ taskId: 'Task/1' }))).toThrow();
  });
});
