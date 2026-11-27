import { randomUUID } from 'node:crypto';
import Oystehr, { BatchInputDeleteRequest } from '@oystehr/sdk';
import { Claim, FhirResource, Invoice, Patient, Task } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { buildBillingInvoice } from 'utils/lib/fhir/billing-invoice';
import { BILLING_OUTREACH_TASK_CODE_SYSTEM } from 'utils/lib/types/data/billing/billing.constants';
import { ListBillingOutreachTasksResponse } from 'utils/lib/types/data/billing/billing.types';
import { AR_STAGE, claimStatusValuesToTags } from 'utils/lib/types/data/billing/claim-status';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { index } from '../../../src/billing/list-billing-outreach-tasks/index';
import { OUTREACH_TASK_TAG_SYSTEM } from '../../../src/rcm/scheduled-outreach/producers/shared/produce-outreach-tasks';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../../helpers/integration-test-seed-data-setup';
import { invokeZambdaHandler, loadZambdaSecrets } from '../../helpers/invoke-zambda-handler';

vi.hoisted(() => vi.resetModules());

describe('list-billing-outreach-tasks', () => {
  let oystehrBilling: Oystehr;
  let token: string;
  let cleanup: () => Promise<void>;
  let processId: string;

  const seededDeletes: BatchInputDeleteRequest[] = [];
  const patientFamily = `Outreach${randomUUID().slice(0, 8)}`;
  let patientId: string;
  let claimId: string;
  let invoice: Invoice;
  let taskId: string;

  const seed = async <T extends FhirResource>(resource: T): Promise<T> => {
    const created = await oystehrBilling.fhir.create<T>(addProcessIdMetaTagToResource(resource, processId) as T);
    seededDeletes.unshift({ method: 'DELETE', url: `${created.resourceType}/${created.id}` });
    return created as T;
  };

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'integration/billing/list-billing-outreach-tasks.test.ts',
      M2MClientMockType.provider
    );
    oystehrBilling = setup.oystehrBilling;
    token = setup.testUserM2MToken;
    cleanup = setup.cleanup;
    processId = setup.processId;

    patientId = (
      await seed<Patient>({
        resourceType: 'Patient',
        active: true,
        name: [{ family: patientFamily, given: ['Riley'] }],
        birthDate: '1979-02-21',
      })
    ).id!;
    claimId = (
      await seed<Claim>({
        resourceType: 'Claim',
        status: 'active',
        use: 'claim',
        type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'professional' }] },
        created: '2026-07-01',
        priority: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/processpriority', code: 'normal' }] },
        insurance: [{ sequence: 1, focal: true, coverage: { display: 'Self-pay' } }],
        patient: { reference: `Patient/${patientId}` },
        provider: { display: 'Integration Medical Group' },
        total: { value: 125, currency: 'USD' },
        meta: { tag: claimStatusValuesToTags({ arStage: AR_STAGE.patient, patientArStatus: 'invoiced' }) },
      })
    ).id!;
    invoice = await seed<Invoice>(
      buildBillingInvoice({
        status: 'issued',
        date: '2026-07-02T14:00:00.000Z',
        dueDate: '2026-08-01',
        recipient: { reference: `Patient/${patientId}` },
        subject: { reference: `Patient/${patientId}` },
        claims: [{ claimId, amountCents: 12500 }],
      })
    );
    taskId = (
      await seed<Task>({
        resourceType: 'Task',
        status: 'completed',
        intent: 'order',
        code: { coding: [{ system: BILLING_OUTREACH_TASK_CODE_SYSTEM, code: 'send-sms' }] },
        description: 'Outreach: Send SMS triggered by invoice-issued',
        for: { reference: `Patient/${patientId}` },
        focus: { reference: `Invoice/${invoice.id}` },
        executionPeriod: { start: '2026-07-03T14:00:00.000Z', end: '2026-07-03T14:00:05.000Z' },
        authoredOn: '2026-07-02T14:00:00.000Z',
        meta: { tag: [{ system: OUTREACH_TASK_TAG_SYSTEM, code: 'invoice-issued' }] },
        input: [
          { type: { text: 'action-type' }, valueString: 'send-sms' },
          { type: { text: 'mediums' }, valueString: 'sms' },
        ],
      })
    ).id!;
  }, 120_000);

  afterAll(async () => {
    try {
      if (seededDeletes.length > 0) await oystehrBilling.fhir.batch({ requests: seededDeletes });
    } catch (error) {
      console.error('Failed to clean up seeded fixtures; the run-tag sweep will retry:', error);
    }
    await cleanup();
  }, 120_000);

  it("finds a claim's invoice outreach by the claim id and adds the invoice summary", async () => {
    const { statusCode, output } = await invokeZambdaHandler<ListBillingOutreachTasksResponse>(
      index,
      { searchText: claimId },
      { token, secrets: { ...loadZambdaSecrets(), INVOICING_IN_BILLING_APP: 'true' } }
    );

    expect(statusCode).toBe(200);
    expect(output.totalCount).toBe(1);
    expect(output.tasks).toHaveLength(1);
    expect(output.tasks[0]).toMatchObject({
      id: taskId,
      status: 'completed',
      actionType: 'send-sms',
      triggerEvent: 'invoice-issued',
      patientId,
      patientName: `Riley ${patientFamily}`,
      focusReference: `Invoice/${invoice.id}`,
      dueDateTime: '2026-07-03T14:00:00.000Z',
      mediums: 'sms',
      invoice: {
        id: invoice.id,
        status: 'issued',
        issueDate: '2026-07-02T14:00:00.000Z',
        dueDate: '2026-08-01',
        amount: 125,
        claimId,
      },
    });
  }, 120_000);
});
