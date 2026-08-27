import Oystehr from '@oystehr/sdk';
import { DocumentReference } from 'fhir/r4b';
import { DateTime } from 'luxon';
import Stripe from 'stripe';
import { describe, expect, it, vi } from 'vitest';
import { gunzipSync, gzipSync } from 'zlib';
import { lookupCardsWithDirectory } from '../../../src/billing/reports/card-directory';

const freshISO = DateTime.now().minus({ hours: 1 }).toUTC().toISO() ?? '';
const staleISO = DateTime.now().minus({ hours: 48 }).toUTC().toISO() ?? '';

const visaCard = { id: 'pm_visa', brand: 'visa', last4: '4242' };

const directoryDocument = (entries: Record<string, unknown>): DocumentReference => ({
  resourceType: 'DocumentReference',
  id: 'dir-doc',
  status: 'current',
  content: [
    {
      attachment: {
        contentType: 'application/gzip',
        data: gzipSync(
          new Uint8Array(Buffer.from(JSON.stringify({ generatedAt: freshISO, entries }), 'utf8'))
        ).toString('base64'),
      },
    },
  ],
});

const savedEntries = (saved: { content?: { attachment?: { data?: string } }[] }): Record<string, any> =>
  JSON.parse(
    gunzipSync(new Uint8Array(Buffer.from(saved.content?.[0]?.attachment?.data ?? '', 'base64'))).toString('utf8')
  ).entries;

const clientWith = (
  document: DocumentReference | undefined
): {
  oystehr: Oystehr;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
} => {
  const create = vi.fn().mockResolvedValue({});
  const update = vi.fn().mockResolvedValue({});
  const search = vi.fn().mockResolvedValue({ unbundle: () => (document ? [document] : []) });
  return { oystehr: { fhir: { search, create, update } } as unknown as Oystehr, create, update };
};

const stripeWith = (methods: Stripe.PaymentMethod[]): { stripe: Stripe; list: ReturnType<typeof vi.fn> } => {
  const list = vi.fn().mockResolvedValue({ data: methods });
  return { stripe: { paymentMethods: { list } } as unknown as Stripe, list };
};

describe('lookupCardsWithDirectory', () => {
  it('serves fresh entries without calling Stripe', async () => {
    const { oystehr } = clientWith(directoryDocument({ cus_1: { card: visaCard, resolvedAt: freshISO } }));
    const { stripe, list } = stripeWith([]);

    const cards = await lookupCardsWithDirectory(oystehr, stripe, [{ customerId: 'cus_1', stripeAccount: undefined }]);
    expect(cards.get('cus_1')).toEqual(visaCard);
    expect(list).not.toHaveBeenCalled();
  });

  it('serves fresh negative entries (no card) without calling Stripe', async () => {
    const { oystehr } = clientWith(directoryDocument({ cus_1: { resolvedAt: freshISO } }));
    const { stripe, list } = stripeWith([]);

    const cards = await lookupCardsWithDirectory(oystehr, stripe, [{ customerId: 'cus_1', stripeAccount: undefined }]);
    expect(cards.has('cus_1')).toBe(false);
    expect(list).not.toHaveBeenCalled();
  });

  it('looks up stale entries and writes the refreshed directory back', async () => {
    const { oystehr, update } = clientWith(directoryDocument({ cus_1: { resolvedAt: staleISO } }));
    const { stripe, list } = stripeWith([
      { id: 'pm_visa', card: { brand: 'visa', last4: '4242' } } as Stripe.PaymentMethod,
    ]);

    const cards = await lookupCardsWithDirectory(oystehr, stripe, [{ customerId: 'cus_1', stripeAccount: 'acct_1' }]);
    expect(cards.get('cus_1')).toEqual(visaCard);
    expect(list).toHaveBeenCalledWith({ customer: 'cus_1', type: 'card', limit: 1 }, { stripeAccount: 'acct_1' });
    expect(update).toHaveBeenCalledTimes(1);
    const entries = savedEntries(update.mock.calls[0][0]);
    expect(entries.cus_1.card).toEqual(visaCard);
  });

  it('merges lookups into existing entries instead of replacing the directory', async () => {
    const { oystehr, update } = clientWith(directoryDocument({ cus_keep: { card: visaCard, resolvedAt: freshISO } }));
    const { stripe } = stripeWith([]);

    await lookupCardsWithDirectory(oystehr, stripe, [{ customerId: 'cus_new', stripeAccount: undefined }]);
    const entries = savedEntries(update.mock.calls[0][0]);
    expect(entries.cus_keep.card).toEqual(visaCard);
    expect(entries.cus_new.card).toBeUndefined();
    expect(entries.cus_new.resolvedAt).toBeTruthy();
  });

  it('does nothing for an empty lookup list', async () => {
    const { oystehr, create, update } = clientWith(undefined);
    const { stripe, list } = stripeWith([]);

    const cards = await lookupCardsWithDirectory(oystehr, stripe, []);
    expect(cards.size).toBe(0);
    expect(list).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});
