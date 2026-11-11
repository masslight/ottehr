import type { APIGatewayProxyResult } from 'aws-lambda';
import { Invoice, PlanDefinition, Task } from 'fhir/r4b';
import { buildBillingInvoice } from 'utils/lib/fhir/billing-invoice';
import { OutreachAction, TriggerEvent } from 'utils/lib/types/api/scheduled-outreach.types';
import { BILLING_OUTREACH_TASK_CODE_SYSTEM } from 'utils/lib/types/data/billing/billing.constants';
import { APIErrorCode } from 'utils/lib/types/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { index as getConfigIndex } from '../../../src/billing/get-billing-outreach-config/index';
import { index as saveConfigIndex } from '../../../src/billing/save-billing-outreach-config/index';
import { createBillingClient } from '../../../src/billing/shared';
import { index as invoiceDueIndex } from '../../../src/cron/produce-billing-invoice-due-outreach/index';
import { index as promoterIndex } from '../../../src/cron/promote-billing-outreach-tasks/index';
import { buildPlanDefinitionFromActions } from '../../../src/rcm/scheduled-outreach-config/helpers';
import { saveOutreachConfig } from '../../../src/rcm/scheduled-outreach-config/save-outreach-config';
import type { ZambdaInput } from '../../../src/shared/types/common';

const mockSearch = vi.fn();
const mockPatch = vi.fn();
const mockTransaction = vi.fn();
const mockBillingClient = { fhir: { search: mockSearch, patch: mockPatch, transaction: mockTransaction } };

vi.mock('utils/lib/ottehr-config/feature-flags', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    FEATURE_FLAGS_CONFIG: {
      ...(actual.FEATURE_FLAGS_CONFIG as Record<string, unknown>),
      ottehrBillingInvoicingEnabled: true,
      automatedPatientOutreachEnabled: true,
    },
  };
});

vi.mock('../../../src/shared/auth', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
}));

vi.mock('../../../src/shared/sentry', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  wrapHandler: (_name: string, fn: (...args: unknown[]) => unknown) => fn,
}));

vi.mock('../../../src/billing/shared', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createBillingClient: vi.fn(() => mockBillingClient),
}));

vi.mock('../../../src/rcm/scheduled-outreach-config/save-outreach-config', () => ({
  saveOutreachConfig: vi.fn(),
}));

type ZambdaHandler = (input: ZambdaInput) => Promise<APIGatewayProxyResult>;
const getConfig = getConfigIndex as ZambdaHandler;
const saveConfig = saveConfigIndex as ZambdaHandler;
const promoter = promoterIndex as ZambdaHandler;
const invoiceDue = invoiceDueIndex as ZambdaHandler;

const gateOn = { BILLING_INTEGRATION: 'ottehr', INVOICING_IN_BILLING_APP: 'true' };
const gateOff = { ...gateOn, INVOICING_IN_BILLING_APP: 'false' };

const action: OutreachAction = {
  id: 'action-1',
  trigger: { event: 'invoice-due', daysAfter: 7 },
  actionType: 'log',
};
const planDefinition = { ...buildPlanDefinitionFromActions([action]), id: 'plan-1' } as PlanDefinition;
const draftTask: Task = {
  resourceType: 'Task',
  id: 'task-1',
  status: 'draft',
  intent: 'order',
  executionPeriod: { start: '2024-01-01T00:00:00Z' },
};

const pastDueInvoice = (id: string, subject: string | undefined): Invoice => ({
  ...buildBillingInvoice({
    status: 'issued',
    date: '2024-01-01T00:00:00Z',
    dueDate: '2024-01-02',
    recipient: { reference: 'Patient/billing-pat-1' },
    subject: subject ? { reference: subject } : undefined,
    claims: [{ claimId: 'claim-1', amountCents: 9000 }],
  }),
  id,
});
let invoices: Invoice[] = [];

const saveInput = (actions: OutreachAction[], secrets: Record<string, string>): ZambdaInput => ({
  headers: null,
  body: JSON.stringify({ actions }),
  secrets,
});

describe('billing outreach', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invoices = [];
    mockSearch.mockImplementation(async ({ resourceType }: { resourceType: string }) => ({
      unbundle: () =>
        resourceType === 'PlanDefinition' ? [planDefinition] : resourceType === 'Invoice' ? invoices : [draftTask],
    }));
    mockTransaction.mockImplementation(async ({ requests }: { requests: { resource: Task }[] }) => ({
      entry: [{ resource: { ...requests[0].resource, id: 'task-new' }, response: { status: '201 Created' } }],
    }));
  });

  describe('get-billing-outreach-config', () => {
    it('returns the config read with the billing client', async () => {
      const result = await getConfig({ headers: null, body: null, secrets: gateOn });

      expect(JSON.parse(result.body).actions).toMatchObject([{ id: 'action-1', actionType: 'log' }]);
      expect(mockSearch).toHaveBeenCalledWith(expect.objectContaining({ resourceType: 'PlanDefinition' }));
    });

    it('rejects while the gate is off, without reading or creating a config', async () => {
      await expect(getConfig({ headers: null, body: null, secrets: gateOff })).rejects.toMatchObject({
        code: APIErrorCode.MISCONFIGURED_ENVIRONMENT,
      });
      expect(createBillingClient).not.toHaveBeenCalled();
    });
  });

  describe('save-billing-outreach-config', () => {
    it('saves with the billing client and the billing Task code system', async () => {
      const actions: OutreachAction[] = [
        action,
        { ...action, id: 'action-2', trigger: { event: 'invoice-issued', daysAfter: 0 } },
      ];
      const response = { planDefinition, actions };
      vi.mocked(saveOutreachConfig).mockResolvedValue(response as Awaited<ReturnType<typeof saveOutreachConfig>>);

      const result = await saveConfig(saveInput(actions, gateOn));

      expect(JSON.parse(result.body)).toEqual(response);
      expect(saveOutreachConfig).toHaveBeenCalledWith(
        mockBillingClient,
        actions,
        undefined,
        BILLING_OUTREACH_TASK_CODE_SYSTEM
      );
    });

    it.each<TriggerEvent>(['date-of-visit', 'discharge-time', 'patient-birthday'])(
      'rejects the %s trigger event',
      async (event) => {
        const otherAction: OutreachAction = { ...action, id: 'action-2', trigger: { event, daysAfter: 1 } };

        await expect(saveConfig(saveInput([action, otherAction], gateOn))).rejects.toMatchObject({
          code: APIErrorCode.INVALID_INPUT,
          message: expect.stringContaining('Billing outreach does not support'),
        });
        expect(saveOutreachConfig).not.toHaveBeenCalled();
      }
    );

    it('rejects while the gate is off', async () => {
      await expect(saveConfig(saveInput([action], gateOff))).rejects.toMatchObject({
        code: APIErrorCode.MISCONFIGURED_ENVIRONMENT,
      });
      expect(saveOutreachConfig).not.toHaveBeenCalled();
    });
  });

  describe('promote-billing-outreach-tasks', () => {
    it('promotes due Tasks with the billing client', async () => {
      const result = await promoter({ headers: null, body: null, secrets: gateOn });

      expect(JSON.parse(result.body)).toMatchObject({ promoted: 1, total: 1 });
      expect(mockPatch).toHaveBeenCalledTimes(1);
      expect(mockPatch).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'task-1',
          operations: [{ op: 'replace', path: '/status', value: 'requested' }],
        })
      );
    });

    it('does nothing while the gate is off', async () => {
      const result = await promoter({ headers: null, body: null, secrets: gateOff });

      expect(JSON.parse(result.body)).toEqual({ disabled: true });
      expect(createBillingClient).not.toHaveBeenCalled();
    });
  });

  describe('produce-billing-invoice-due-outreach', () => {
    it('produces invoice-due outreach for issued invoices with the billing client', async () => {
      invoices = [pastDueInvoice('inv-1', 'Patient/billing-pat-1')];

      const result = await invoiceDue({ headers: null, body: null, secrets: gateOn });

      expect(JSON.parse(result.body)).toEqual({ invoicesEvaluated: 1, tasksCreated: 1, tasksSkipped: 0, errors: 0 });
      expect(createBillingClient).toHaveBeenCalled();
      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceType: 'Invoice',
          params: expect.arrayContaining([{ name: 'status', value: 'issued' }]),
        })
      );
    });

    it('rejects after the run when an invoice fails', async () => {
      invoices = [pastDueInvoice('inv-1', undefined), pastDueInvoice('inv-2', 'Patient/billing-pat-1')];

      await expect(invoiceDue({ headers: null, body: null, secrets: gateOn })).rejects.toThrow(
        'produce-billing-invoice-due-outreach: 1 invoice(s) failed'
      );
      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceType: 'Task',
          params: expect.arrayContaining([{ name: 'focus', value: 'Invoice/inv-2' }]),
        })
      );
    });

    it('does nothing while the gate is off', async () => {
      const result = await invoiceDue({ headers: null, body: null, secrets: gateOff });

      expect(JSON.parse(result.body)).toEqual({ disabled: true });
      expect(createBillingClient).not.toHaveBeenCalled();
    });
  });
});
