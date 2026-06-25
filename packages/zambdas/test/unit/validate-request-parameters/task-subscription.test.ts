import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/subscriptions/task/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('task subscription - validateRequestParameters', () => {
  const validTask = {
    resourceType: 'Task',
    status: 'requested',
    intent: 'order',
  };
  const secrets = createMockSecrets();

  test('should return validated params with a valid Task', () => {
    const input = createMockZambdaInput(validTask, { secrets });
    const result = validateRequestParameters(input);

    expect(result.task.resourceType).toBe('Task');
    expect(result.task.status).toBe('requested');
    expect(result.secrets).toEqual(secrets);
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { body: '', secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when resourceType is not Task', () => {
    const input = createMockZambdaInput({ resourceType: 'Patient', status: 'active' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow('resourceType');
  });

  test('should throw when task status is completed', () => {
    const input = createMockZambdaInput({ ...validTask, status: 'completed' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow('completed');
  });

  test('should throw when task status is failed', () => {
    const input = createMockZambdaInput({ ...validTask, status: 'failed' }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow('failed');
  });

  test('should throw when secrets are null', () => {
    const input = createMockZambdaInput(validTask, { secrets: null });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should accept task with status "in-progress"', () => {
    const input = createMockZambdaInput({ ...validTask, status: 'in-progress' }, { secrets });
    const result = validateRequestParameters(input);
    expect(result.task.status).toBe('in-progress');
  });

  test('should accept task with status "ready"', () => {
    const input = createMockZambdaInput({ ...validTask, status: 'ready' }, { secrets });
    const result = validateRequestParameters(input);
    expect(result.task.status).toBe('ready');
  });

  test('should accept task with status "cancelled"', () => {
    const input = createMockZambdaInput({ ...validTask, status: 'cancelled' }, { secrets });
    const result = validateRequestParameters(input);
    expect(result.task.status).toBe('cancelled');
  });
});
