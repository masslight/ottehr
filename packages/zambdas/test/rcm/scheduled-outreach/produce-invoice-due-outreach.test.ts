import type Oystehr from '@oystehr/sdk';
import { DateTime } from 'luxon';
import type { Secrets } from 'utils/lib/secrets';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { produceInvoiceDueOutreach } from '../../../src/rcm/scheduled-outreach/producers/shared/produce-invoice-due-outreach';
import type { OutreachAction } from '../../../src/rcm/scheduled-outreach-config/helpers';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockInvoicesList = vi.fn();
const mockListStripeAccounts = vi.fn();
const mockProduceOutreachTasks = vi.fn();
const mockGetOrCreateOutreachConfig = vi.fn();
const mockParsePlanDefinitionToActions = vi.fn();

const mockFhirGet = vi.fn();
const mockFhirSearch = vi.fn();
const mockFhirPatch = vi.fn();

const mockOystehr = {
  fhir: { get: mockFhirGet, search: mockFhirSearch, patch: mockFhirPatch },
} as unknown as Oystehr;

vi.mock('../../../src/rcm/scheduled-outreach/producers/shared/list-outreach-stripe-accounts', () => ({
  listOutreachStripeAccounts: (...args: unknown[]) => mockListStripeAccounts(...args),
}));

vi.mock('../../../src/shared/stripeIntegration', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    getStripeClient: () => ({ invoices: { list: mockInvoicesList } }),
  };
});

vi.mock('../../../src/rcm/scheduled-outreach-config/helpers', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    getOrCreateOutreachConfig: (...args: unknown[]) => mockGetOrCreateOutreachConfig(...args),
    parsePlanDefinitionToActions: (...args: unknown[]) => mockParsePlanDefinitionToActions(...args),
    parseConfiguredAt: () => '2026-01-01T00:00:00Z',
  };
});

vi.mock('../../../src/rcm/scheduled-outreach/producers/shared/produce-outreach-tasks', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    produceOutreachTasks: (...args: unknown[]) => mockProduceOutreachTasks(...args),
  };
});

// ── Fixtures ───────────────────────────────────────────────────────────────

const chargeCardAction: OutreachAction = {
  id: 'action-1',
  enabled: true,
  trigger: { event: 'invoice-due', daysAfter: 0 },
  actionType: 'charge-card',
};

const pastDueUnix = Math.floor(DateTime.now().minus({ days: 2 }).toSeconds());

function makeInvoice(id: string, encounterId: string): Record<string, unknown> {
  return {
    id,
    due_date: pastDueUnix,
    created: pastDueUnix,
    metadata: { oystehr_patient_id: `patient-for-${encounterId}`, oystehr_encounter_id: encounterId },
  };
}

function emptyInvoicePage(): { data: unknown[]; has_more: boolean } {
  return { data: [], has_more: false };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetOrCreateOutreachConfig.mockResolvedValue({ meta: { lastUpdated: '2026-01-01T00:00:00Z' } });
  mockParsePlanDefinitionToActions.mockReturnValue([chargeCardAction]);
  mockProduceOutreachTasks.mockResolvedValue({ created: [{ id: 'task-x' }], skipped: [] });
  mockFhirGet.mockResolvedValue({ resourceType: 'Encounter', appointment: [] });
  mockFhirSearch.mockResolvedValue({ unbundle: () => [] });
  mockFhirPatch.mockResolvedValue({});
});

const secrets = {} as Secrets;

describe('produceInvoiceDueOutreach Stripe account fan-out', () => {
  it('queries every Stripe account returned by listOutreachStripeAccounts and aggregates their invoices', async () => {
    mockListStripeAccounts.mockResolvedValue([undefined, 'acct_A', 'acct_B']);
    mockInvoicesList.mockImplementation((_params: unknown, options: { stripeAccount?: string }) => {
      if (options.stripeAccount === 'acct_A') {
        return Promise.resolve({ data: [makeInvoice('in_a', 'enc-a')], has_more: false });
      }
      if (options.stripeAccount === 'acct_B') {
        return Promise.resolve({ data: [makeInvoice('in_b', 'enc-b')], has_more: false });
      }
      return Promise.resolve(emptyInvoicePage());
    });

    const result = await produceInvoiceDueOutreach(mockOystehr, secrets);

    const queriedAccounts = mockInvoicesList.mock.calls.map(([, options]) => options.stripeAccount);
    expect(queriedAccounts).toEqual(expect.arrayContaining([undefined, 'acct_A', 'acct_B']));
    expect(result.invoicesEvaluated).toBe(2);

    const taskParams = mockProduceOutreachTasks.mock.calls.map(([params]) => ({
      focus: params.focus.reference,
      stripeAccount: params.stripeAccount,
    }));
    expect(taskParams).toEqual(
      expect.arrayContaining([
        { focus: 'Encounter/enc-a', stripeAccount: 'acct_A' },
        { focus: 'Encounter/enc-b', stripeAccount: 'acct_B' },
      ])
    );
  });

  it('works on a single-account project (platform only)', async () => {
    mockListStripeAccounts.mockResolvedValue([undefined]);
    mockInvoicesList.mockResolvedValue({ data: [makeInvoice('in_p', 'enc-p')], has_more: false });

    const result = await produceInvoiceDueOutreach(mockOystehr, secrets);

    expect(mockInvoicesList).toHaveBeenCalledTimes(1);
    expect(mockInvoicesList.mock.calls[0][1]).toEqual({ stripeAccount: undefined });
    expect(result.invoicesEvaluated).toBe(1);
    expect(mockProduceOutreachTasks).toHaveBeenCalledWith(
      // Platform ownership is recorded explicitly, not left blank
      expect.objectContaining({ focus: { reference: 'Encounter/enc-p' }, stripeAccount: 'platform' })
    );
  });

  it('does not cancel pending tasks whose open invoice lives on a connected account', async () => {
    mockListStripeAccounts.mockResolvedValue([undefined, 'acct_A']);
    mockInvoicesList.mockImplementation((_params: unknown, options: { stripeAccount?: string }) => {
      if (options.stripeAccount === 'acct_A') {
        return Promise.resolve({ data: [makeInvoice('in_a', 'enc-connected')], has_more: false });
      }
      return Promise.resolve(emptyInvoicePage());
    });
    mockFhirSearch.mockResolvedValue({
      unbundle: () => [
        { resourceType: 'Task', id: 'task-live', status: 'draft', focus: { reference: 'Encounter/enc-connected' } },
        { resourceType: 'Task', id: 'task-stale', status: 'draft', focus: { reference: 'Encounter/enc-paid' } },
      ],
    });

    const result = await produceInvoiceDueOutreach(mockOystehr, secrets);

    expect(result.tasksCancelled).toBe(1);
    expect(mockFhirPatch).toHaveBeenCalledTimes(1);
    expect(mockFhirPatch.mock.calls[0][0]).toMatchObject({ resourceType: 'Task', id: 'task-stale' });
  });

  it('does not cancel tasks stamped with an account that was not scanned this run', async () => {
    mockListStripeAccounts.mockResolvedValue([undefined, 'acct_B']);
    mockInvoicesList.mockResolvedValue(emptyInvoicePage());
    const stamp = (account: string): unknown[] => [{ type: { text: 'stripe-account' }, valueString: account }];
    mockFhirSearch.mockResolvedValue({
      unbundle: () => [
        {
          resourceType: 'Task',
          id: 'task-unscanned',
          status: 'draft',
          focus: { reference: 'Encounter/enc-1' },
          input: stamp('acct_A'),
        },
        {
          resourceType: 'Task',
          id: 'task-scanned',
          status: 'draft',
          focus: { reference: 'Encounter/enc-2' },
          input: stamp('acct_B'),
        },
        {
          resourceType: 'Task',
          id: 'task-platform',
          status: 'draft',
          focus: { reference: 'Encounter/enc-3' },
          input: stamp('platform'),
        },
        { resourceType: 'Task', id: 'task-legacy', status: 'draft', focus: { reference: 'Encounter/enc-4' } },
      ],
    });

    const result = await produceInvoiceDueOutreach(mockOystehr, secrets);

    const cancelledIds = mockFhirPatch.mock.calls.map(([params]) => params.id);
    expect(cancelledIds).toEqual(expect.arrayContaining(['task-scanned', 'task-platform', 'task-legacy']));
    expect(cancelledIds).not.toContain('task-unscanned');
    expect(result.tasksCancelled).toBe(3);
  });

  it('skips invoices missing oystehr metadata without failing the run', async () => {
    mockListStripeAccounts.mockResolvedValue([undefined]);
    mockInvoicesList.mockResolvedValue({
      data: [{ id: 'in_no_meta', due_date: pastDueUnix, created: pastDueUnix, metadata: {} }],
      has_more: false,
    });

    const result = await produceInvoiceDueOutreach(mockOystehr, secrets);

    expect(result.errors).toBe(0);
    expect(result.tasksCreated).toBe(0);
    expect(mockProduceOutreachTasks).not.toHaveBeenCalled();
  });
});
