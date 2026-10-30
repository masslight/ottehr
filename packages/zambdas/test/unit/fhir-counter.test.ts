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
      get: vi.fn(),
      patch: vi.fn(),
    },
  } as unknown as Oystehr;
}

describe('nextCounterValue', () => {
  it('looks up the counter by its key', async () => {
    const oystehr = makeClient([counter(0, '1')]);

    expect(await nextCounterValue(oystehr, 'widget-number')).toBe(1);
    expect(oystehr.fhir.search).toHaveBeenCalledWith({
      resourceType: 'Basic',
      params: [
        {
          name: 'code',
          value: `${FHIR_COUNTER_CODE_SYSTEM}|widget-number`,
        },
      ],
    });
  });

  it.each([
    ['no counter', []],
    ['several counters', [counter(3, '4', 'counter-a'), counter(5, '6', 'counter-b')]],
  ])('rejects %s for the key without writing', async (_label, found) => {
    const oystehr = makeClient(found);

    await expect(nextCounterValue(oystehr, 'widget-number')).rejects.toThrow(
      `Expected exactly one counter for widget-number, found ${found.length}`
    );
    expect(oystehr.fhir.patch).not.toHaveBeenCalled();
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
            path: '/extension/0/valueInteger',
            value: 42,
          },
        ],
      },
      {
        optimisticLockingVersionId: '7',
      }
    );
  });

  it('updates only the last issued extension, leaving other extensions in place', async () => {
    const stored = counter(41, '7');
    const oystehr = makeClient([
      {
        ...stored,
        extension: [
          {
            url: 'https://example.com/other',
            valueString: 'kept',
          },
          ...(stored.extension ?? []),
        ],
      },
    ]);

    expect(await nextCounterValue(oystehr, 'widget-number')).toBe(42);
    expect(oystehr.fhir.patch).toHaveBeenCalledWith(
      expect.objectContaining({
        operations: [
          {
            op: 'replace',
            path: '/extension/1/valueInteger',
            value: 42,
          },
        ],
      }),
      expect.anything()
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
