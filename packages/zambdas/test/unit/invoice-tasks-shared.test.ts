import { Encounter } from 'fhir/r4b';
import {
  INVOICE_TASK_CLAIM_ID_IDENTIFIER_SYSTEM,
  INVOICE_TASK_SOURCE_SYSTEM,
  parseInvoiceTaskInput,
  Secrets,
  ZERO_BALANCE_BUSINESS_STATUS,
} from 'utils';
import { describe, expect, it } from 'vitest';
import {
  buildInvoiceTask,
  isCandidInvoicingEnabled,
  isOttehrBillingInvoicingEnabled,
} from '../../src/shared/invoice-tasks';

const secretsWith = (billingIntegration?: string): Secrets =>
  (billingIntegration === undefined ? {} : { BILLING_INTEGRATION: billingIntegration }) as Secrets;

const encounter = (overrides: Partial<Encounter> = {}): Encounter => ({
  resourceType: 'Encounter',
  id: 'enc-1',
  status: 'finished',
  class: {
    code: 'AMB',
  },
  subject: {
    reference: 'Patient/pat-1',
  },
  period: {
    start: '2026-07-01T09:00:00Z',
  },
  ...overrides,
});

const config = {
  dueDaysFromGeneration: 30,
  defaultSmsTemplate: 'sms template',
  defaultInvoiceMemo: 'memo template',
};

const buildParams = {
  claimId: 'claim-1',
  finalizationDateIso: '2026-07-10T12:00:00.000Z',
  amountCents: 5000,
  encounter: encounter(),
  config,
};

describe('producer gates', () => {
  it('runs the candid producer for candid-integrated envs unless the flag turns it off', () => {
    for (const integration of ['candid', 'all', undefined]) {
      expect(isCandidInvoicingEnabled(secretsWith(integration), { candidInvoicingEnabled: true })).toBe(true);
      expect(isCandidInvoicingEnabled(secretsWith(integration), {})).toBe(true);
      expect(isCandidInvoicingEnabled(secretsWith(integration), { candidInvoicingEnabled: false })).toBe(false);
    }
    expect(isCandidInvoicingEnabled(secretsWith('ottehr'), { candidInvoicingEnabled: true })).toBe(false);
  });

  it('runs the billing producer only for ottehr-integrated envs with the flag explicitly on', () => {
    for (const integration of ['ottehr', 'all']) {
      expect(isOttehrBillingInvoicingEnabled(secretsWith(integration), { ottehrBillingInvoicingEnabled: true })).toBe(
        true
      );
      expect(isOttehrBillingInvoicingEnabled(secretsWith(integration), {})).toBe(false);
      expect(isOttehrBillingInvoicingEnabled(secretsWith(integration), { ottehrBillingInvoicingEnabled: false })).toBe(
        false
      );
    }
    for (const integration of ['candid', undefined]) {
      expect(isOttehrBillingInvoicingEnabled(secretsWith(integration), { ottehrBillingInvoicingEnabled: true })).toBe(
        false
      );
    }
  });
});

describe('buildInvoiceTask', () => {
  it('builds the same task shape as the candid cron, plus the candid source tag', () => {
    const task = buildInvoiceTask({
      ...buildParams,
      source: 'candid',
    });

    expect(task.status).toBe('ready');
    expect(task.intent).toBe('order');
    expect(task.description).toBe('Send invoice for $50.00');
    expect(task.encounter?.reference).toBe('Encounter/enc-1');
    expect(task.for?.reference).toBe('Patient/pat-1');
    expect(task.authoredOn).toBe('2026-07-10T12:00:00.000Z');
    expect(task.executionPeriod).toEqual({
      start: '2026-07-01T09:00:00Z',
      end: '2026-07-01T09:00:00Z',
    });
    expect(task.businessStatus).toBeUndefined();
    expect(task.meta?.tag).toEqual([
      {
        system: INVOICE_TASK_SOURCE_SYSTEM,
        code: 'candid',
      },
    ]);
    expect(task.identifier).toBeUndefined();

    const parsedInput = parseInvoiceTaskInput(task);
    expect(parsedInput.claimId).toBe('claim-1');
    expect(parsedInput.amountCents).toBe(5000);
    expect(parsedInput.finalizationDate).toBe('2026-07-10T12:00:00.000Z');
    expect(parsedInput.smsTextMessage).toBe('sms template');
    expect(parsedInput.memo).toBe('memo template');
    expect(parsedInput.dueDate).toBeDefined();
  });

  it('adds the searchable claim-id identifier for billing-sourced tasks', () => {
    const task = buildInvoiceTask({
      ...buildParams,
      source: 'ottehr-billing',
    });

    expect(task.meta?.tag).toEqual([
      {
        system: INVOICE_TASK_SOURCE_SYSTEM,
        code: 'ottehr-billing',
      },
    ]);
    expect(task.identifier).toEqual([
      {
        system: INVOICE_TASK_CLAIM_ID_IDENTIFIER_SYSTEM,
        value: 'claim-1',
      },
    ]);
  });

  it('marks zero balances with the zero-balance business status', () => {
    const task = buildInvoiceTask({
      ...buildParams,
      source: 'candid',
      amountCents: 0,
    });
    expect(task.businessStatus).toEqual(ZERO_BALANCE_BUSINESS_STATUS);
  });

  it('omits executionPeriod when the encounter has no period', () => {
    const task = buildInvoiceTask({
      ...buildParams,
      source: 'candid',
      encounter: encounter({ period: undefined }),
    });
    expect(task.executionPeriod).toBeUndefined();
  });

  it('throws when the encounter has no patient reference', () => {
    expect(() =>
      buildInvoiceTask({
        ...buildParams,
        source: 'candid',
        encounter: encounter({ subject: undefined }),
      })
    ).toThrow('Patient ID not found');
  });
});
