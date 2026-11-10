import Oystehr from '@oystehr/sdk';
import { ClaimResponse, PaymentReconciliation } from 'fhir/r4b';
import { BILLING_RESOURCE_TAG } from 'utils/lib/fhir/constants';
import { describe, expect, it, Mock, vi } from 'vitest';
import { markImportedEra } from '../../../src/billing/import-era';
import { ERA_SOURCE_EXTENSION, tagEraResources } from '../../../src/billing/shared';

const paymentReconciliation = (id?: string, tagged = false): PaymentReconciliation => ({
  resourceType: 'PaymentReconciliation',
  ...(id ? { id } : {}),
  status: 'active',
  created: '2026-01-14',
  paymentDate: '2026-01-15',
  paymentAmount: {
    value: 350,
    currency: 'USD',
  },
  ...(tagged
    ? {
        meta: {
          tag: [BILLING_RESOURCE_TAG],
        },
      }
    : {}),
});

const claimResponse = (id: string): ClaimResponse => ({
  resourceType: 'ClaimResponse',
  id,
  status: 'active',
  type: {
    coding: [
      {
        code: 'professional',
      },
    ],
  },
  use: 'claim',
  patient: {
    reference: 'Patient/p1',
  },
  created: '2026-01-14',
  insurer: {
    display: 'Test Payer',
  },
  outcome: 'complete',
});

describe('tagEraResources', () => {
  const makeOystehr = (): {
    oystehr: Oystehr;
    transaction: ReturnType<typeof vi.fn>;
  } => {
    const transaction = vi.fn().mockResolvedValue({ entry: [] });
    const oystehr = {
      fhir: {
        transaction,
      },
    } as unknown as Oystehr;
    return {
      oystehr,
      transaction,
    };
  };

  it('patches every untagged resource in one transaction and returns the count', async () => {
    const { oystehr, transaction } = makeOystehr();
    const pr = paymentReconciliation('pr1');
    const cr = claimResponse('cr1');

    const tagged = await tagEraResources({
      oystehr,
      resources: [pr, cr],
    });

    expect(tagged).toBe(2);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(transaction.mock.calls[0][0].requests).toHaveLength(2);
  });

  it('skips resources that already carry the billing tag', async () => {
    const { oystehr, transaction } = makeOystehr();
    const taggedPr = paymentReconciliation('pr1', true);
    const cr = claimResponse('cr1');

    const tagged = await tagEraResources({
      oystehr,
      resources: [taggedPr, cr],
    });

    expect(tagged).toBe(1);
    expect(transaction.mock.calls[0][0].requests).toHaveLength(1);
  });

  it('makes no transaction when nothing needs tagging', async () => {
    const { oystehr, transaction } = makeOystehr();

    const tagged = await tagEraResources({
      oystehr,
      resources: [paymentReconciliation('pr1', true)],
    });

    expect(tagged).toBe(0);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('patches a resource passed more than once only once', async () => {
    const { oystehr, transaction } = makeOystehr();
    const cr = claimResponse('cr1');

    const tagged = await tagEraResources({
      oystehr,
      resources: [cr, cr, paymentReconciliation('pr1')],
    });

    expect(tagged).toBe(2);
    expect(transaction.mock.calls[0][0].requests).toHaveLength(2);
  });
});

describe('markImportedEra', () => {
  const RAW_X12 = { url: 'https://extensions.fhir.oystehr.com/rcm-raw-x12', valueString: 'ISA*...' };
  const MARKER = { url: ERA_SOURCE_EXTENSION, valueCode: 'x12-import' };

  const makeClient = (stored: PaymentReconciliation): { oystehr: Oystehr; get: Mock; patch: Mock } => {
    const get = vi.fn().mockResolvedValue(stored);
    const patch = vi.fn().mockResolvedValue(stored);
    return { oystehr: { fhir: { get, patch } } as unknown as Oystehr, get, patch };
  };

  it('appends the X12-import marker next to the raw 835', async () => {
    const { oystehr, get, patch } = makeClient({ ...paymentReconciliation('pr1'), extension: [RAW_X12] });
    await markImportedEra(oystehr, {
      resourceType: 'Bundle',
      type: 'transaction-response',
      entry: [{ resource: paymentReconciliation('pr1') }],
    });
    expect(get).toHaveBeenCalledWith({ resourceType: 'PaymentReconciliation', id: 'pr1' });
    expect(patch).toHaveBeenCalledWith({
      resourceType: 'PaymentReconciliation',
      id: 'pr1',
      operations: [{ op: 'add', path: '/extension/-', value: MARKER }],
    });
  });

  it('finds the ERA by its response location and starts the extension list when there is none', async () => {
    const { oystehr, patch } = makeClient(paymentReconciliation('pr2'));
    await markImportedEra(oystehr, {
      resourceType: 'Bundle',
      type: 'transaction-response',
      entry: [{ response: { status: '201', location: 'PaymentReconciliation/pr2/_history/1' } }],
    });
    expect(patch).toHaveBeenCalledWith({
      resourceType: 'PaymentReconciliation',
      id: 'pr2',
      operations: [{ op: 'add', path: '/extension', value: [MARKER] }],
    });
  });

  it('leaves an already marked ERA alone and never fails the import', async () => {
    const marked = makeClient({ ...paymentReconciliation('pr1'), extension: [RAW_X12, MARKER] });
    await markImportedEra(marked.oystehr, {
      resourceType: 'Bundle',
      type: 'transaction-response',
      entry: [{ resource: paymentReconciliation('pr1') }],
    });
    expect(marked.patch).not.toHaveBeenCalled();

    const failing = makeClient(paymentReconciliation('pr1'));
    failing.get.mockRejectedValue(new Error('boom'));
    await expect(
      markImportedEra(failing.oystehr, {
        resourceType: 'Bundle',
        type: 'transaction-response',
        entry: [{ resource: paymentReconciliation('pr1') }],
      })
    ).resolves.toBeUndefined();
  });
});
