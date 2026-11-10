import Oystehr from '@oystehr/sdk';
import { Task } from 'fhir/r4b';
import type Stripe from 'stripe';
import type { ChargeCardConfig } from 'utils/lib/types/api/scheduled-outreach.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  claimOutreachTask,
  payOpenStripeInvoice,
  runChargeCardTask,
} from '../../../src/rcm/scheduled-outreach/executors/outreach-task-execution';

const mockPatch = vi.fn();
const mockOystehrClient = { fhir: { patch: mockPatch } };

const onSuccess = { enabled: true, mediums: ['email'], smsTemplate: '', emailTemplate: 'Paid' } as const;
const onFailure = { enabled: true, mediums: ['sms'], smsTemplate: 'Failed', emailTemplate: '' } as const;

function makeChargeTask(config: Partial<ChargeCardConfig>, output?: Task['output']): Task {
  return {
    resourceType: 'Task',
    id: 'task-1',
    status: 'in-progress',
    intent: 'order',
    for: { reference: 'Patient/pat-1' },
    focus: { reference: 'Encounter/enc-1' },
    input: [
      {
        type: { text: 'charge-card-config' },
        valueString: JSON.stringify({ retryAttempts: 0, retryIntervalDays: 0, onSuccess, onFailure, ...config }),
      },
    ],
    output,
  };
}

const operations = (call: number): any[] => mockPatch.mock.calls[call][0].operations;
const outputs = (call: number): any[] => operations(call).find((op) => op.path === '/output').value;

describe('claimOutreachTask', () => {
  const task: Task = { resourceType: 'Task', id: 'task-1', status: 'requested', intent: 'order' };

  it('returns false when another invocation already claimed the task', async () => {
    mockPatch.mockRejectedValueOnce(
      new Oystehr.OystehrFHIRError({ code: 412, error: { resourceType: 'OperationOutcome', issue: [] } })
    );

    expect(await claimOutreachTask(mockOystehrClient as any, task)).toBe(false);
  });

  it('rethrows other errors', async () => {
    const error = new Error('boom');
    mockPatch.mockRejectedValueOnce(error);

    await expect(claimOutreachTask(mockOystehrClient as any, task)).rejects.toBe(error);
  });
});

describe('runChargeCardTask', () => {
  const notify = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    notify.mockResolvedValue([{ medium: 'email', success: true }]);
  });

  it('completes the task and sends success notifications when the charge succeeds', async () => {
    const chargeResult = { success: true, transactionId: 'ch_1' };

    const result = await runChargeCardTask({
      oystehr: mockOystehrClient as any,
      task: makeChargeTask({}),
      charge: async () => chargeResult,
      notify,
    });

    expect(result.status).toBe('completed');
    expect(mockPatch).toHaveBeenCalledTimes(1);
    expect(operations(0)).toContainEqual({ op: 'replace', path: '/status', value: 'completed' });
    expect(outputs(0)).toContainEqual({ type: { text: 'attempt-count' }, valueInteger: 1 });
    expect(outputs(0)).toContainEqual({ type: { text: 'charge-result' }, valueString: JSON.stringify(chargeResult) });
    expect(notify).toHaveBeenCalledWith(onSuccess, chargeResult);
  });

  it('schedules a retry when the charge fails and retries remain', async () => {
    const result = await runChargeCardTask({
      oystehr: mockOystehrClient as any,
      task: makeChargeTask({ retryAttempts: 2, retryIntervalDays: 3 }),
      charge: async () => ({ success: false, error: 'declined' }),
      notify,
    });

    expect(result.status).toBe('retry-scheduled');
    expect(operations(0)).toContainEqual({ op: 'replace', path: '/status', value: 'draft' });
    expect(operations(0)).toContainEqual(expect.objectContaining({ op: 'replace', path: '/executionPeriod/start' }));
    expect(notify).not.toHaveBeenCalled();
  });

  it('fails the task and sends failure notifications when no retries remain', async () => {
    const chargeResult = { success: false, error: 'declined' };
    const task = makeChargeTask({ retryAttempts: 2, retryIntervalDays: 3 }, [
      { type: { text: 'attempt-count' }, valueInteger: 2 },
      { type: { text: 'attempt-1-result' }, valueString: 'declined' },
      { type: { text: 'attempt-2-result' }, valueString: 'declined' },
    ]);

    const result = await runChargeCardTask({
      oystehr: mockOystehrClient as any,
      task,
      charge: async () => chargeResult,
      notify,
    });

    expect(result.status).toBe('failed');
    expect(operations(0)).toContainEqual({ op: 'replace', path: '/status', value: 'failed' });
    expect(outputs(0)).toEqual(
      expect.arrayContaining([
        { type: { text: 'attempt-1-result' }, valueString: 'declined' },
        { type: { text: 'attempt-2-result' }, valueString: 'declined' },
        { type: { text: 'attempt-3-result' }, valueString: 'declined' },
      ])
    );
    expect(notify).toHaveBeenCalledWith(onFailure, chargeResult);
  });
});

describe('payOpenStripeInvoice', () => {
  function makeStripe(paidInvoice: Partial<Stripe.Invoice>): { stripe: Stripe; pay: ReturnType<typeof vi.fn> } {
    const pay = vi.fn().mockResolvedValue(paidInvoice);
    const stripe = {
      customers: {
        retrieve: vi.fn().mockResolvedValue({ invoice_settings: { default_payment_method: 'pm_1' } }),
      },
      invoices: { pay },
    } as unknown as Stripe;
    return { stripe, pay };
  }

  it('returns a failure without paying when the invoice is not open', async () => {
    const { stripe, pay } = makeStripe({ status: 'paid' });
    const invoice = { id: 'in_1', status: 'draft', amount_due: 1000 } as Stripe.Invoice;

    const result = await payOpenStripeInvoice(stripe, invoice, 'cus_1', undefined);

    expect(result.success).toBe(false);
    expect(pay).not.toHaveBeenCalled();
  });

  it('pays an open invoice with the default payment method', async () => {
    const { stripe, pay } = makeStripe({ status: 'paid', charge: 'ch_1' });
    const invoice = { id: 'in_1', status: 'open', amount_due: 1000 } as Stripe.Invoice;

    const result = await payOpenStripeInvoice(stripe, invoice, 'cus_1', 'acct_1');

    expect(pay).toHaveBeenCalledWith('in_1', { stripeAccount: 'acct_1' });
    expect(result).toEqual(expect.objectContaining({ success: true, transactionId: 'ch_1', amountCents: 1000 }));
  });
});
