import Oystehr from '@oystehr/sdk';
import { OperationOutcome, Task } from 'fhir/r4b';
import { isApiError } from 'utils';
import { describe, expect, test, vi } from 'vitest';
import { patchTaskStatus } from '../src/subscriptions/helpers';

const makeOystehr = (patch: ReturnType<typeof vi.fn>): Oystehr =>
  ({
    fhir: {
      patch,
    },
  }) as unknown as Oystehr;

const input = {
  task: {
    id: 'task-1',
  },
  taskStatusToUpdate: 'completed' as Task['status'],
  statusReasonToUpdate: 'done',
};

const fhirError = (code: number, text: string): Oystehr.OystehrFHIRError => {
  const operationOutcome: OperationOutcome = {
    resourceType: 'OperationOutcome',
    issue: [
      {
        severity: 'error',
        code: 'invalid',
        details: {
          text,
        },
      },
    ],
  };
  return new Oystehr.OystehrFHIRError({
    error: operationOutcome,
    code,
  });
};

describe('patchTaskStatus', () => {
  test('converts a 4xx FHIR error into an APIError carrying the real status and FHIR message', async () => {
    const oystehr = makeOystehr(vi.fn().mockRejectedValue(fhirError(400, 'Task.status: invalid transition')));

    const error = await patchTaskStatus(input, oystehr).catch((e) => e);

    expect(isApiError(error)).toBe(true);
    expect(error.statusCode).toBe(400);
    expect(error.message).toContain('Task.status: invalid transition');
  });

  test('propagates a 5xx FHIR error unchanged so it stays a 500 at the handler', async () => {
    const thrown = fhirError(500, 'server boom');
    const oystehr = makeOystehr(vi.fn().mockRejectedValue(thrown));

    const error = await patchTaskStatus(input, oystehr).catch((e) => e);

    expect(error).toBe(thrown);
    expect(isApiError(error)).toBe(false);
  });

  test('propagates a non-FHIR error unchanged', async () => {
    const thrown = new Error('network down');
    const oystehr = makeOystehr(vi.fn().mockRejectedValue(thrown));

    const error = await patchTaskStatus(input, oystehr).catch((e) => e);

    expect(error).toBe(thrown);
  });

  test('returns the patched Task on success', async () => {
    const patched = {
      resourceType: 'Task',
      id: 'task-1',
      status: 'completed',
    } as Task;
    const oystehr = makeOystehr(vi.fn().mockResolvedValue(patched));

    await expect(patchTaskStatus(input, oystehr)).resolves.toBe(patched);
  });
});
