import Oystehr from '@oystehr/sdk';
import { Invoice, PlanDefinition, Task } from 'fhir/r4b';
import { buildBillingInvoice, withStripeInvoiceLink } from 'utils/lib/fhir/billing-invoice';
import { OutreachAction } from 'utils/lib/types/api/scheduled-outreach.types';
import { BILLING_OUTREACH_TASK_CODE_SYSTEM } from 'utils/lib/types/data/billing/billing.constants';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cancelPendingInvoiceOutreach,
  produceBillingInvoiceIssuedOutreach,
} from '../../../src/billing/invoice-outreach';
import {
  OUTREACH_STRIPE_ACCOUNT_INPUT,
  OUTREACH_TASK_TAG_SYSTEM,
} from '../../../src/rcm/scheduled-outreach/producers/shared/produce-outreach-tasks';
import { buildPlanDefinitionFromActions } from '../../../src/rcm/scheduled-outreach-config/helpers';

vi.mock('utils/lib/ottehr-config/feature-flags', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    FEATURE_FLAGS_CONFIG: {
      ...(actual.FEATURE_FLAGS_CONFIG as Record<string, unknown>),
      automatedPatientOutreachEnabled: true,
    },
  };
});

const notification = (id: string, event: 'invoice-issued' | 'invoice-due', daysAfter: number): OutreachAction => ({
  id,
  trigger: { event, daysAfter, timeUnit: 'days', direction: 'after' },
  actionType: 'send-notification',
  sendNotificationConfig: { mediums: ['sms'], smsTemplate: 'Your invoice is ready', emailTemplate: '' },
});
const planDefinition = {
  ...buildPlanDefinitionFromActions([
    notification('issued-3', 'invoice-issued', 3),
    notification('due-1', 'invoice-due', 1),
  ]),
  id: 'plan-1',
} as PlanDefinition;

const makeInvoice = (over: { recipient?: string; subject?: string | null; stripeAccount?: string } = {}): Invoice => {
  const { recipient = 'Patient/billing-pat-1', subject = 'Patient/billing-pat-1', stripeAccount } = over;
  return {
    ...withStripeInvoiceLink(
      buildBillingInvoice({
        status: 'issued',
        date: '2026-11-02T15:00:00.000Z',
        dueDate: '2026-11-30',
        recipient: { reference: recipient },
        subject: subject ? { reference: subject } : undefined,
        claims: [{ claimId: 'claim-1', amountCents: 9000 }],
      }),
      { stripeInvoiceId: 'in_1', stripeAccount }
    ),
    id: 'inv-1',
  };
};

const makeOystehr = (
  tasks: Task[] = []
): { oystehr: Oystehr; search: ReturnType<typeof vi.fn>; patch: ReturnType<typeof vi.fn>; created: Task[] } => {
  const created: Task[] = [];
  const search = vi.fn(async ({ resourceType }: { resourceType: string }) => ({
    unbundle: () => (resourceType === 'PlanDefinition' ? [planDefinition] : tasks),
  }));
  const transaction = vi.fn(async ({ requests }: { requests: { resource: Task }[] }) => {
    created.push(requests[0].resource);
    return { entry: [{ resource: { ...requests[0].resource, id: 'task-new' }, response: { status: '201 Created' } }] };
  });
  const get = vi.fn();
  const patch = vi.fn();
  return { oystehr: { fhir: { search, transaction, get, patch } } as unknown as Oystehr, search, patch, created };
};

const stripeAccountOf = (task: Task): string | undefined =>
  task.input?.find((input) => input.type?.text === OUTREACH_STRIPE_ACCOUNT_INPUT)?.valueString;

describe('billing invoice outreach', () => {
  beforeEach(() => vi.clearAllMocks());

  it('schedules the invoice-issued actions on the invoice, counted from the invoice date', async () => {
    const { oystehr, created } = makeOystehr();

    const result = await produceBillingInvoiceIssuedOutreach(oystehr, makeInvoice({ stripeAccount: 'acct_1' }));

    expect(result.created).toHaveLength(1);
    expect(created).toHaveLength(1);
    const [task] = created;
    expect(task.status).toBe('draft');
    expect(task.focus).toEqual({ reference: 'Invoice/inv-1' });
    expect(task.for).toEqual({ reference: 'Patient/billing-pat-1' });
    expect(task.code?.coding?.[0]).toMatchObject({
      system: BILLING_OUTREACH_TASK_CODE_SYSTEM,
      code: 'send-notification',
    });
    expect(task.meta?.tag).toContainEqual({ system: OUTREACH_TASK_TAG_SYSTEM, code: 'invoice-issued' });
    expect(new Date(task.executionPeriod!.start!).toISOString()).toBe('2026-11-05T15:00:00.000Z');
    expect(stripeAccountOf(task)).toBe('acct_1');
    // The billing patient copy is not checked for contact details.
    expect(oystehr.fhir.get).not.toHaveBeenCalled();
  });

  it('records the platform account when the invoice has no connected account', async () => {
    const { oystehr, created } = makeOystehr();

    await produceBillingInvoiceIssuedOutreach(oystehr, makeInvoice());

    expect(stripeAccountOf(created[0])).toBe('platform');
  });

  it('skips an action that already has a Task for the invoice', async () => {
    const existing = {
      resourceType: 'Task',
      id: 'task-1',
      meta: { tag: [{ system: `${OUTREACH_TASK_TAG_SYSTEM}/action-id`, code: 'issued-3' }] },
    } as Task;
    const { oystehr, created } = makeOystehr([existing]);

    const result = await produceBillingInvoiceIssuedOutreach(oystehr, makeInvoice());

    expect(created).toHaveLength(0);
    expect(result.skipped).toEqual([{ actionId: 'issued-3', reason: 'Task already exists' }]);
  });

  it('schedules nothing for an invoice billed to an organization', async () => {
    const { oystehr, search } = makeOystehr();

    const result = await produceBillingInvoiceIssuedOutreach(oystehr, makeInvoice({ recipient: 'Organization/org-1' }));

    expect(result).toEqual({ created: [], skipped: [] });
    expect(search).not.toHaveBeenCalled();
  });

  it('rejects a patient invoice with no patient or no date', async () => {
    const { oystehr } = makeOystehr();

    await expect(produceBillingInvoiceIssuedOutreach(oystehr, makeInvoice({ subject: null }))).rejects.toThrow(
      'Invoice inv-1 has no patient or date'
    );
    await expect(produceBillingInvoiceIssuedOutreach(oystehr, { ...makeInvoice(), date: undefined })).rejects.toThrow(
      'Invoice inv-1 has no patient or date'
    );
  });

  it('cancels the outreach Tasks that have not started', async () => {
    const pending = [
      { resourceType: 'Task', id: 'task-1', status: 'draft' },
      { resourceType: 'Task', id: 'task-2', status: 'requested' },
    ] as Task[];
    const { oystehr, search, patch } = makeOystehr(pending);

    await cancelPendingInvoiceOutreach(oystehr, 'inv-1', 'Invoice was paid');

    expect(search).toHaveBeenCalledWith({
      resourceType: 'Task',
      params: [
        { name: 'focus', value: 'Invoice/inv-1' },
        { name: '_tag', value: `${OUTREACH_TASK_TAG_SYSTEM}|` },
        { name: 'status', value: 'draft,requested' },
        { name: '_count', value: '1000' },
      ],
    });
    expect(patch.mock.calls.map(([input]) => input.id)).toEqual(['task-1', 'task-2']);
    expect(patch).toHaveBeenCalledWith({
      resourceType: 'Task',
      id: 'task-1',
      operations: [
        { op: 'replace', path: '/status', value: 'cancelled' },
        { op: 'add', path: '/statusReason', value: { text: 'Invoice was paid' } },
      ],
    });
  });
});
