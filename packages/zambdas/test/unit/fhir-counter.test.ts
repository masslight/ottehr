import Oystehr from '@oystehr/sdk';
import { Basic } from 'fhir/r4b';
import { describe, expect, it, vi } from 'vitest';
import {
  FHIR_COUNTER_CODE_SYSTEM,
  FHIR_COUNTER_LAST_ISSUED_EXTENSION_URL,
  nextCounterValue,
} from '../../src/shared/fhir-counter';

const counter = (lastIssued: number, versionId: string, id = 'counter-1'): Basic & { id: string } => ({
  resourceType: 'Basic',
  id,
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

function makeClient(found: Basic[]): Oystehr {
  return {
    fhir: {
      search: vi.fn().mockResolvedValue({
        unbundle: () => found,
      }),
      create: vi.fn().mockResolvedValue(counter(0, '1')),
      get: vi.fn(),
      patch: vi.fn(),
    },
  } as unknown as Oystehr;
}

describe('nextCounterValue', () => {
  it('creates the counter when none exists for the key', async () => {
    const oystehr = makeClient([]);

    expect(await nextCounterValue(oystehr, 'widget-number')).toBe(1);
    expect(oystehr.fhir.create).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'Basic',
      }),
      {
        ifNoneExist: [
          {
            name: 'code',
            value: `${FHIR_COUNTER_CODE_SYSTEM}|widget-number`,
          },
        ],
      }
    );
  });

  it('uses the existing counter without creating one', async () => {
    const oystehr = makeClient([counter(41, '7')]);

    expect(await nextCounterValue(oystehr, 'widget-number')).toBe(42);
    expect(oystehr.fhir.create).not.toHaveBeenCalled();
  });

  it('keeps counting from the furthest counter when racing callers created several', async () => {
    const oystehr = makeClient([counter(3, '4', 'counter-a'), counter(5, '6', 'counter-b')]);

    expect(await nextCounterValue(oystehr, 'widget-number')).toBe(6);
    expect(oystehr.fhir.patch).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'counter-b',
      }),
      expect.anything()
    );
  });

  it('settles on the lowest id among counters that are equally far along', async () => {
    const oystehr = makeClient([counter(0, '1', 'counter-b'), counter(0, '1', 'counter-a')]);

    await nextCounterValue(oystehr, 'widget-number');
    expect(oystehr.fhir.patch).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'counter-a',
      }),
      expect.anything()
    );
  });

  it('takes the value after the last issued one, guarded by the counter version', async () => {
    const oystehr = makeClient([counter(41, '7')]);

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
    const oystehr = makeClient([counter(41, '7')]);
    vi.mocked(oystehr.fhir.patch).mockRejectedValueOnce(versionConflict());
    vi.mocked(oystehr.fhir.get).mockResolvedValueOnce(counter(42, '8'));

    expect(await nextCounterValue(oystehr, 'widget-number')).toBe(43);
    expect(oystehr.fhir.patch).toHaveBeenLastCalledWith(expect.anything(), {
      optimisticLockingVersionId: '8',
    });
  });

  it('gives up after the allowed attempts', async () => {
    const oystehr = makeClient([counter(41, '7')]);
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
    const oystehr = makeClient([stored]);

    await expect(nextCounterValue(oystehr, 'widget-number')).rejects.toThrow();
    expect(oystehr.fhir.patch).not.toHaveBeenCalled();
  });
});
