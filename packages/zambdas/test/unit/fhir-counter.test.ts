import Oystehr from '@oystehr/sdk';
import { Basic } from 'fhir/r4b';
import { describe, expect, it, vi } from 'vitest';
import {
  FHIR_COUNTER_CODE_SYSTEM,
  FHIR_COUNTER_LAST_ISSUED_EXTENSION_URL,
  nextCounterValue,
} from '../../src/shared/fhir-counter';

const counter = (lastIssued: number, versionId: string): Basic & { id: string } => ({
  resourceType: 'Basic',
  id: 'counter-1',
  meta: {
    versionId,
  },
  code: {
    coding: [
      {
        system: FHIR_COUNTER_CODE_SYSTEM,
        code: 'widget-number',
      },
    ],
  },
  extension: [
    {
      url: FHIR_COUNTER_LAST_ISSUED_EXTENSION_URL,
      valueInteger: lastIssued,
    },
  ],
});

const versionConflict = (): Error =>
  Object.assign(new Error('Precondition Failed'), {
    code: 412,
  });

function makeClient(stored: Basic): Oystehr {
  return {
    fhir: {
      create: vi.fn().mockResolvedValue(stored),
      get: vi.fn(),
      patch: vi.fn(),
    },
  } as unknown as Oystehr;
}

describe('nextCounterValue', () => {
  it('creates the counter only when none exists for the key', async () => {
    const oystehr = makeClient(counter(0, '1'));

    expect(await nextCounterValue(oystehr, 'widget-number')).toBe(1);
    expect(oystehr.fhir.create).toHaveBeenCalledWith(expect.objectContaining({ resourceType: 'Basic' }), {
      ifNoneExist: [
        {
          name: 'code',
          value: `${FHIR_COUNTER_CODE_SYSTEM}|widget-number`,
        },
      ],
    });
  });

  it('takes the value after the last issued one, guarded by the counter version', async () => {
    const oystehr = makeClient(counter(41, '7'));

    expect(await nextCounterValue(oystehr, 'widget-number')).toBe(42);
    expect(oystehr.fhir.patch).toHaveBeenCalledWith(
      {
        resourceType: 'Basic',
        id: 'counter-1',
        operations: [
          {
            op: 'replace',
            path: '/extension',
            value: [
              {
                url: FHIR_COUNTER_LAST_ISSUED_EXTENSION_URL,
                valueInteger: 42,
              },
            ],
          },
        ],
      },
      {
        optimisticLockingVersionId: '7',
      }
    );
  });

  it('rereads the counter and takes the next value when another caller got there first', async () => {
    const oystehr = makeClient(counter(41, '7'));
    vi.mocked(oystehr.fhir.patch).mockRejectedValueOnce(versionConflict());
    vi.mocked(oystehr.fhir.get).mockResolvedValueOnce(counter(42, '8'));

    expect(await nextCounterValue(oystehr, 'widget-number')).toBe(43);
    expect(oystehr.fhir.patch).toHaveBeenLastCalledWith(expect.anything(), {
      optimisticLockingVersionId: '8',
    });
  });

  it('gives up after the allowed attempts', async () => {
    const oystehr = makeClient(counter(41, '7'));
    vi.mocked(oystehr.fhir.patch).mockRejectedValue(versionConflict());
    vi.mocked(oystehr.fhir.get).mockResolvedValue(counter(42, '8'));

    await expect(
      nextCounterValue(oystehr, 'widget-number', {
        maxAttempts: 2,
      })
    ).rejects.toThrow('Precondition Failed');
    expect(oystehr.fhir.patch).toHaveBeenCalledTimes(2);
  });

  it.each([
    [
      'no last issued value',
      {
        ...counter(0, '1'),
        extension: undefined,
      },
    ],
    [
      'no version',
      {
        ...counter(0, '1'),
        meta: undefined,
      },
    ],
  ])('rejects a counter with %s without writing', async (_label, stored) => {
    const oystehr = makeClient(stored);

    await expect(nextCounterValue(oystehr, 'widget-number')).rejects.toThrow();
    expect(oystehr.fhir.patch).not.toHaveBeenCalled();
  });
});
