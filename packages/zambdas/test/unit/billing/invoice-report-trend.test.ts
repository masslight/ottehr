import { DateTime } from 'luxon';
import Stripe from 'stripe';
import { describe, expect, it } from 'vitest';
import {
  computeTrendPoint,
  snapshotISO,
  trendMonthEnds,
} from '../../../src/billing/reports/definitions/invoice.report';

const invoice = (overrides: Partial<Stripe.Invoice>): { invoice: Stripe.Invoice; stripeAccount: undefined } => ({
  invoice: { id: 'in_test', status: 'open', amount_due: 10000, created: 0, ...overrides } as Stripe.Invoice,
  stripeAccount: undefined,
});

describe('trendMonthEnds', () => {
  it('produces six month-ends, oldest first', () => {
    const now = DateTime.fromISO('2026-08-27T12:00:00Z', { zone: 'utc' });
    const ends = trendMonthEnds(now);
    expect(ends).toHaveLength(6);
    expect(ends[0].toFormat('MMM yyyy')).toBe('Feb 2026');
    expect(ends[5].toFormat('MMM yyyy')).toBe('Jul 2026');
    expect(ends.every((end) => end.equals(end.endOf('month')))).toBe(true);
  });

  it('is stable across the month — the cache reuse key never drifts', () => {
    const early = trendMonthEnds(DateTime.fromISO('2026-08-02T00:30:00Z', { zone: 'utc' }));
    const late = trendMonthEnds(DateTime.fromISO('2026-08-30T23:00:00Z', { zone: 'utc' }));
    expect(early.map(snapshotISO)).toEqual(late.map(snapshotISO));
  });
});

describe('computeTrendPoint', () => {
  const snapshot = DateTime.fromISO('2026-07-31T23:59:59Z', { zone: 'utc' });
  const t = Math.floor(snapshot.toSeconds());
  const day = 86400;

  it('counts an invoice finalized before and not closed by the snapshot', () => {
    const point = computeTrendPoint(
      [
        invoice({
          status_transitions: { finalized_at: t - 10 * day } as Stripe.Invoice.StatusTransitions,
          due_date: t - 5 * day,
        }),
      ],
      snapshot
    );
    expect(point.buckets['0-30']).toEqual({ count: 1, amountDue: 100 });
  });

  it('excludes invoices closed by the snapshot but keeps ones closed after', () => {
    const closedBefore = invoice({
      status_transitions: { finalized_at: t - 10 * day, paid_at: t - day } as Stripe.Invoice.StatusTransitions,
    });
    const closedAfter = invoice({
      status_transitions: { finalized_at: t - 10 * day, paid_at: t + day } as Stripe.Invoice.StatusTransitions,
      due_date: t - 40 * day,
    });
    const point = computeTrendPoint([closedBefore, closedAfter], snapshot);
    expect(point.buckets['0-30'].count).toBe(0);
    expect(point.buckets['30-60'].count).toBe(1);
  });

  it('files not-yet-due invoices under not-yet-due', () => {
    const point = computeTrendPoint(
      [
        invoice({
          status_transitions: { finalized_at: t - day } as Stripe.Invoice.StatusTransitions,
          due_date: t + 10 * day,
        }),
      ],
      snapshot
    );
    expect(point.buckets['not-yet-due'].count).toBe(1);
  });

  it('is deterministic for a fixed snapshot — past points can be reused verbatim', () => {
    const invoices = [
      invoice({
        status_transitions: { finalized_at: t - 100 * day } as Stripe.Invoice.StatusTransitions,
        due_date: t - 95 * day,
      }),
      invoice({
        status_transitions: { finalized_at: t - 2 * day } as Stripe.Invoice.StatusTransitions,
        due_date: t + day,
      }),
    ];
    expect(computeTrendPoint(invoices, snapshot)).toEqual(computeTrendPoint(invoices, snapshot));
    expect(computeTrendPoint(invoices, snapshot).snapshotDate).toBe(snapshotISO(snapshot));
  });
});
