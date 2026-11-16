import { describe, expect, it } from 'vitest';
import { validateRequestParameters } from '../src/ehr/complete-erx-task/validateRequestParameters';
import { ZambdaInput } from '../src/shared/types/common';

const zambdaInput = (body: unknown): ZambdaInput => ({ body: JSON.stringify(body), secrets: null }) as ZambdaInput;

describe('complete-erx-task: request', () => {
  const taskId = '5f1c3c3e-7a1e-4f3b-9d1e-2a6b8c9d0e1f';
  const requestId = '7a2d4e6f-8b1c-4d3e-9f2a-1b3c5d7e9f00';

  it('takes the task id and the id of the request answered', () => {
    expect(validateRequestParameters(zambdaInput({ taskId, requestId }))).toEqual({ taskId, requestId, secrets: null });
  });

  it('refuses a missing or malformed task or request id', () => {
    expect(() => validateRequestParameters(zambdaInput({}))).toThrow();
    expect(() => validateRequestParameters(zambdaInput({ taskId }))).toThrow();
    expect(() => validateRequestParameters(zambdaInput({ taskId: 'Task/1', requestId }))).toThrow();
    expect(() => validateRequestParameters(zambdaInput({ taskId, requestId: 'Task/1' }))).toThrow();
  });
});
