import { DateTime } from 'luxon';
import Stripe from 'stripe';
import { CardOnFileReportRow } from 'utils/lib/types/data/billing/billing.types';
import { describe, expect, it, vi } from 'vitest';
import {
  CardsBuildState,
  CardsOnFilePayload,
  finalizeBuild,
  listCustomersChunk,
} from '../../../src/billing/reports/definitions/cards-on-file.report';

const buildState = (overrides: Partial<CardsBuildState>): CardsBuildState => ({
  accounts: [null],
  accountIndex: 0,
  customersSeen: 0,
  rows: [],
  pendingLookups: [],
  openInvoices: {},
  startedAt: DateTime.now().toUTC().toISO() ?? '',
  ...overrides,
});

const row = (customerId: string, overrides: Partial<CardOnFileReportRow> = {}): CardOnFileReportRow => ({
  stripeCustomerId: customerId,
  customerName: `Customer ${customerId}`,
  stripeAccountId: '',
  livemode: false,
  patientId: '',
  patientName: '',
  cardId: '',
  cardBrand: '',
  cardLast4: '',
  lastVisitDate: '',
  lastVisitAppointmentId: '',
  openInvoiceCount: 0,
  openInvoiceAmount: 0,
  hasPastDueInvoice: false,
  ...overrides,
});

const customer = (id: string): Stripe.Customer => ({ id, object: 'customer' }) as Stripe.Customer;

const stripeWithPages = (
  pagesByAccount: Record<string, { data: Stripe.Customer[]; has_more: boolean }[]>
): {
  stripe: Stripe;
  list: ReturnType<typeof vi.fn>;
} => {
  const remaining = Object.fromEntries(Object.entries(pagesByAccount).map(([key, pages]) => [key, [...pages]]));
  const list = vi.fn().mockImplementation(async (_params, options: { stripeAccount?: string }) => {
    const pages = remaining[options?.stripeAccount ?? 'platform'];
    return pages?.shift() ?? { data: [], has_more: false };
  });
  return { stripe: { customers: { list } } as unknown as Stripe, list };
};

describe('listCustomersChunk', () => {
  it('advances the cursor within an account and moves to the next when a listing ends', async () => {
    const building = buildState({ accounts: [null, 'acct_1'] });
    const { stripe, list } = stripeWithPages({
      platform: [{ data: [customer('cus_a'), customer('cus_b')], has_more: false }],
      acct_1: [{ data: [customer('cus_c')], has_more: false }],
    });

    const customers = await listCustomersChunk(stripe, building);
    expect(customers.map((entry) => entry.customer.id)).toEqual(['cus_a', 'cus_b', 'cus_c']);
    expect(customers.map((entry) => entry.stripeAccount)).toEqual([undefined, undefined, 'acct_1']);
    expect(building.accountIndex).toBe(2);
    expect(building.cursor).toBeUndefined();
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('resumes from a persisted cursor', async () => {
    const building = buildState({ cursor: 'cus_b' });
    const { stripe, list } = stripeWithPages({
      platform: [{ data: [customer('cus_c')], has_more: false }],
    });

    await listCustomersChunk(stripe, building);
    expect(list.mock.calls[0][0]).toMatchObject({ starting_after: 'cus_b' });
  });

  it('stops at the per-run budget and checkpoints mid-account', async () => {
    const pageOf = (start: number): { data: Stripe.Customer[]; has_more: boolean } => ({
      data: Array.from({ length: 100 }, (_v, i) => customer(`cus_${start + i}`)),
      has_more: true,
    });
    const building = buildState({});
    // more pages than the 10000-customer budget consumes
    const { stripe } = stripeWithPages({ platform: Array.from({ length: 101 }, (_v, p) => pageOf(p * 100)) });

    const customers = await listCustomersChunk(stripe, building);
    expect(customers).toHaveLength(10000);
    expect(building.accountIndex).toBe(0);
    expect(building.cursor).toBe('cus_9999');
  });
});

describe('finalizeBuild', () => {
  const served: CardsOnFilePayload = {
    rows: [row('cus_old')],
    totals: { customers: 1, withCard: 0, withoutCard: 1, withOpenInvoices: 0 },
    pendingCardLookups: 0,
    generatedAt: '2026-08-01T00:00:00Z',
  };

  it('replaces the served rows with the deduped build, keeping the first duplicate', async () => {
    const building = buildState({
      rows: [row('cus_1', { cardId: 'pm_1' }), row('cus_1', { stripeAccountId: 'acct_1' }), row('cus_2')],
      pendingLookups: [{ customerId: 'cus_2', stripeAccount: undefined }],
    });

    const finalized = finalizeBuild(served, building);
    expect(finalized.rows.map((r) => r.stripeCustomerId).sort()).toEqual(['cus_1', 'cus_2']);
    expect(finalized.rows.find((r) => r.stripeCustomerId === 'cus_1')?.cardId).toBe('pm_1');
    expect(finalized.totals).toEqual({ customers: 2, withCard: 1, withoutCard: 1, withOpenInvoices: 0 });
    expect(finalized.pendingCardLookups).toBe(1);
    expect(finalized.building).toBeUndefined();
    expect(finalized.generatedAt).not.toBe(served.generatedAt);
  });

  it('drops queued lookups for customers that lost the dedupe', async () => {
    const building = buildState({
      rows: [row('cus_1')],
      pendingLookups: [
        { customerId: 'cus_1', stripeAccount: undefined },
        { customerId: 'cus_gone', stripeAccount: undefined },
      ],
    });

    const finalized = finalizeBuild(served, building);
    expect(finalized.pendingLookups).toEqual([{ customerId: 'cus_1', stripeAccount: undefined }]);
  });
});
