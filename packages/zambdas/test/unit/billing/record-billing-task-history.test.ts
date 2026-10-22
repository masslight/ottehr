import Oystehr from '@oystehr/sdk';
import { Claim, Provenance, Task } from 'fhir/r4b';
import { RcmTaskCodings } from 'utils/lib/fhir/constants';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import {
  INVOICE_TASK_CLAIM_ID_IDENTIFIER_SYSTEM,
  INVOICE_TASK_SOURCE_SYSTEM,
} from 'utils/lib/types/api/invoicing.types';
import {
  CLAIM_PROVENANCE_ACTIVITY,
  CLAIM_PROVENANCE_SOURCE_TAG_SYSTEM,
} from 'utils/lib/types/data/billing/claim-history';
import { NOT_AUTHORIZED } from 'utils/lib/types/errors';
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { complexValidation, performEffect } from '../../../src/billing/record-billing-task-history';
import { validateRequestParameters } from '../../../src/billing/record-billing-task-history/validateRequestParameters';
import { ZambdaInput } from '../../../src/shared/types/common';
import { provenanceChanges } from './claim-history-fixtures';

const SYSTEM_AGENT = {
  who: {
    reference: 'Device/system',
  },
};

vi.mock('../../../src/billing/provenance', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  resolveClaimActor: vi.fn(async () => SYSTEM_AGENT),
}));

const base64Url = (value: object): string => Buffer.from(JSON.stringify(value)).toString('base64url');
const jwt = (sub: string): string => `${base64Url({ alg: 'none' })}.${base64Url({ sub })}.signature`;

const invoiceTask = (overrides: Partial<Task> = {}): Task => ({
  resourceType: 'Task',
  id: 't1',
  meta: {
    versionId: '2',
    tag: [
      {
        system: INVOICE_TASK_SOURCE_SYSTEM,
        code: 'ottehr-billing',
      },
    ],
  },
  status: 'requested',
  intent: 'order',
  code: RcmTaskCodings.sendInvoiceToPatient,
  identifier: [
    {
      system: INVOICE_TASK_CLAIM_ID_IDENTIFIER_SYSTEM,
      value: 'claim-1',
    },
  ],
  encounter: {
    reference: 'Encounter/enc-1',
  },
  ...overrides,
});

const cardChargeTask: Task = {
  resourceType: 'Task',
  id: 't2',
  meta: {
    versionId: '1',
  },
  status: 'draft',
  intent: 'order',
  code: {
    coding: [
      {
        system: 'https://ottehr.com/CodeSystem/outreach-action-type',
        code: 'charge-card',
      },
    ],
  },
  focus: {
    reference: 'Encounter/enc-1',
  },
};

function makeOystehr({
  claims = [],
  provenances = [],
}: {
  claims?: Claim[];
  provenances?: Provenance[];
} = {}): { oystehr: Oystehr; search: Mock; create: Mock } {
  const search = vi.fn(async ({ resourceType }: { resourceType: string }) => ({
    unbundle: () => (resourceType === 'Claim' ? claims : provenances),
  }));
  const create = vi.fn(async (resource: Provenance) => resource);
  return {
    oystehr: {
      fhir: {
        search,
        create,
      },
    } as unknown as Oystehr,
    search,
    create,
  };
}

const input = (token: string, body: object): ZambdaInput =>
  ({
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${token}`,
    },
    secrets: {},
  }) as unknown as ZambdaInput;

describe('record-billing-task-history validateRequestParameters', () => {
  it('refuses a user, who could otherwise put made-up entries in a claim history', () => {
    expect(() =>
      validateRequestParameters(
        input(jwt('auth0|user-1'), {
          task: invoiceTask(),
        })
      )
    ).toThrow(expect.objectContaining(NOT_AUTHORIZED));
  });

  it("accepts the clinical subscription's machine client", () => {
    const params = validateRequestParameters(
      input(jwt('client-1@clients'), {
        task: invoiceTask(),
      })
    );
    expect(params.task.id).toBe('t1');
  });

  it('refuses a Task without a version, which could not be recorded once', () => {
    const { meta: _meta, ...unversioned } = invoiceTask();
    expect(() =>
      validateRequestParameters(
        input(jwt('client-1@clients'), {
          task: unversioned,
        })
      )
    ).toThrow();
  });
});

describe('record-billing-task-history complexValidation', () => {
  it('takes the claim an Ottehr billing invoice task names', async () => {
    const { oystehr, search } = makeOystehr();

    const { claimId } = await complexValidation(oystehr, {
      task: invoiceTask(),
      secrets: {},
    });

    expect(claimId).toBe('claim-1');
    expect(search).not.toHaveBeenCalled();
  });

  it('finds no claim for an invoice Candid sent', async () => {
    const { oystehr } = makeOystehr();
    const candidInvoice = invoiceTask({
      meta: {
        versionId: '2',
      },
    });

    const { claimId } = await complexValidation(oystehr, {
      task: candidInvoice,
      secrets: {},
    });

    expect(claimId).toBeUndefined();
  });

  it("finds an outreach task's claim through its encounter", async () => {
    const { oystehr, search } = makeOystehr({
      claims: [
        {
          resourceType: 'Claim',
          id: 'claim-9',
        } as Claim,
      ],
    });

    const { claimId } = await complexValidation(oystehr, {
      task: cardChargeTask,
      secrets: {},
    });

    expect(claimId).toBe('claim-9');
    expect(search).toHaveBeenCalledWith({
      resourceType: 'Claim',
      params: [
        {
          name: 'identifier',
          value: `${ottehrIdentifierSystem('claim-encounter-id')}|enc-1`,
        },
      ],
    });
  });
});

describe('record-billing-task-history performEffect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('records a status change in the claim history, named by its step', async () => {
    const { oystehr, create } = makeOystehr();

    const result = await performEffect(oystehr, {
      task: invoiceTask(),
      previousTask: invoiceTask({
        meta: {
          versionId: '1',
        },
        status: 'ready',
      }),
      claimId: 'claim-1',
      secrets: {},
    });

    expect(result).toEqual({
      recorded: true,
    });
    const provenance: Provenance = create.mock.calls[0][0];
    expect(provenance).toMatchObject({
      target: [
        {
          reference: 'Task/t1',
          display: 'Invoice',
        },
        {
          reference: 'Claim/claim-1',
        },
      ],
      activity: {
        coding: [CLAIM_PROVENANCE_ACTIVITY.update],
      },
      agent: [SYSTEM_AGENT],
    });
    expect(provenance.entity).toContainEqual({
      role: 'source',
      what: {
        reference: 'Task/t1/_history/2',
      },
    });
    expect(provenanceChanges(provenance)).toEqual([
      {
        field: 'status',
        label: 'Status',
        previousValue: 'ready',
        newValue: 'requested',
      },
    ]);
  });

  it('creates the entry only while no entry carries its Task version', async () => {
    const { oystehr, create } = makeOystehr();

    await performEffect(oystehr, {
      task: invoiceTask(),
      previousTask: invoiceTask({
        meta: {
          versionId: '1',
        },
        status: 'ready',
      }),
      claimId: 'claim-1',
      secrets: {},
    });

    const [provenance, options] = create.mock.calls[0];
    expect(provenance.meta.tag).toContainEqual({
      system: CLAIM_PROVENANCE_SOURCE_TAG_SYSTEM,
      code: 'Task/t1/_history/2',
    });
    expect(options).toEqual({
      ifNoneExist: [
        {
          name: '_tag',
          value: `${CLAIM_PROVENANCE_SOURCE_TAG_SYSTEM}|Task/t1/_history/2`,
        },
      ],
    });
  });

  it('records a new task as created', async () => {
    const { oystehr, create } = makeOystehr();

    await performEffect(oystehr, {
      task: cardChargeTask,
      claimId: 'claim-9',
      secrets: {},
    });

    expect(create.mock.calls[0][0]).toMatchObject({
      target: [
        {
          reference: 'Task/t2',
          display: 'Card Charge',
        },
        {
          reference: 'Claim/claim-9',
        },
      ],
      activity: {
        coding: [CLAIM_PROVENANCE_ACTIVITY.create],
      },
    });
  });

  it('records a redelivered version once', async () => {
    const { oystehr, create } = makeOystehr({
      provenances: [
        {
          resourceType: 'Provenance',
          target: [
            {
              reference: 'Task/t1',
            },
            {
              reference: 'Claim/claim-1',
            },
          ],
          entity: [
            {
              role: 'source',
              what: {
                reference: 'Task/t1/_history/2',
              },
            },
          ],
        } as Provenance,
      ],
    });

    const result = await performEffect(oystehr, {
      task: invoiceTask(),
      previousTask: invoiceTask({
        meta: {
          versionId: '1',
        },
        status: 'ready',
      }),
      claimId: 'claim-1',
      secrets: {},
    });

    expect(result).toEqual({
      recorded: false,
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('records nothing for a version that changes nothing the history tracks', async () => {
    const { oystehr, create } = makeOystehr();

    const result = await performEffect(oystehr, {
      task: invoiceTask(),
      previousTask: invoiceTask({
        meta: {
          versionId: '1',
        },
      }),
      claimId: 'claim-1',
      secrets: {},
    });

    expect(result).toEqual({
      recorded: false,
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('records nothing for a task that belongs to no claim', async () => {
    const { oystehr, search, create } = makeOystehr();

    const result = await performEffect(oystehr, {
      task: invoiceTask(),
      claimId: undefined,
      secrets: {},
    });

    expect(result).toEqual({
      recorded: false,
    });
    expect(search).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
});
