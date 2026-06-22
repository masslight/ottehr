import Oystehr from '@oystehr/sdk';
import { Task } from 'fhir/r4b';
import { FHIR_CODE_REGEX, isApiError } from 'utils';
import { describe, expect, test, vi } from 'vitest';
import { patchTaskStatus } from '../../src/subscriptions/helpers';

const makeOystehr = (patch: ReturnType<typeof vi.fn>): Oystehr =>
  ({
    fhir: {
      patch,
    },
  }) as unknown as Oystehr;

describe('patchTaskStatus', () => {
  test('sanitizes a multi-line reason into a valid FHIR code and preserves the full reason in text', async () => {
    const patch = vi.fn().mockResolvedValue({} as Task);
    const oystehr = makeOystehr(patch);
    const reason = 'Candid sync failed: Error\n  {\n    "detail": "breaks"\n  }';

    await patchTaskStatus(
      {
        task: {
          id: 'task-1',
        },
        taskStatusToUpdate: 'failed',
        statusReasonToUpdate: reason,
      },
      oystehr
    );

    const statusReason = patch.mock.calls[0][0].operations.find(
      (op: { path: string }) => op.path === '/statusReason'
    ).value;
    expect(statusReason.coding[0].code).toMatch(FHIR_CODE_REGEX);
    expect(statusReason.text).toBe(reason);
  });

  test('throws an APIError without patching when the task has no id', async () => {
    const patch = vi.fn();
    const oystehr = makeOystehr(patch);

    const error = await patchTaskStatus(
      {
        task: {
          id: undefined,
        },
        taskStatusToUpdate: 'failed',
        statusReasonToUpdate: 'some reason',
      },
      oystehr
    ).catch((e) => e);

    expect(isApiError(error)).toBe(true);
    expect(patch).not.toHaveBeenCalled();
  });
});
