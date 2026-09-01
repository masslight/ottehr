import Oystehr from '@oystehr/sdk';
import { DateTime } from 'luxon';
import Stripe from 'stripe';
import { Secrets } from 'utils/lib/secrets';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { gunzipSync, gzipSync } from 'zlib';
import { lookupCardsWithDirectory } from '../../../src/billing/reports/card-directory';

const freshISO = DateTime.now().minus({ hours: 1 }).toUTC().toISO() ?? '';
const staleISO = DateTime.now().minus({ hours: 48 }).toUTC().toISO() ?? '';

const visaCard = { id: 'pm_visa', brand: 'visa', last4: '4242' };

const secrets = { PROJECT_ID: 'test-project' } as unknown as Secrets;
const DIRECTORY_PAYLOAD_PATH = 'billing-reports/card-directory:v1:all.json.gz';

interface Upload {
  path: string;
  file: Blob;
}

// Z3-backed cache: presigned download served via fetch, saves via z3.uploadFile
const clientWith = (
  entries: Record<string, unknown> | undefined
): {
  oystehr: Oystehr;
  uploads: Upload[];
  uploadFile: ReturnType<typeof vi.fn>;
  fetchMock: ReturnType<typeof vi.fn>;
} => {
  const uploads: Upload[] = [];
  const getPresignedUrl = vi.fn(async ({ 'objectPath+': path }: { 'objectPath+': string }) => ({
    signedUrl: `https://z3.test/${path}`,
  }));
  const uploadFile = vi.fn(async ({ 'objectPath+': path, file }: { 'objectPath+': string; file: Blob }) => {
    uploads.push({ path, file });
    return {};
  });
  const gz =
    entries !== undefined
      ? gzipSync(new Uint8Array(Buffer.from(JSON.stringify({ generatedAt: freshISO, entries }), 'utf8')))
      : undefined;
  const fetchMock = vi.fn(async (url: string) => {
    if (gz && String(url).endsWith(DIRECTORY_PAYLOAD_PATH)) {
      return { ok: true, status: 200, arrayBuffer: async () => Uint8Array.from(gz).buffer } as unknown as Response;
    }
    return { ok: false, status: 404, statusText: 'Not Found' } as unknown as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  const oystehr = { z3: { getPresignedUrl, uploadFile } } as unknown as Oystehr;
  return { oystehr, uploads, uploadFile, fetchMock };
};

const savedEntries = async (uploads: Upload[]): Promise<Record<string, any>> => {
  const payloadUpload = uploads.find((upload) => upload.path === DIRECTORY_PAYLOAD_PATH);
  expect(payloadUpload).toBeDefined();
  const bytes = Buffer.from(await payloadUpload!.file.arrayBuffer());
  return JSON.parse(gunzipSync(new Uint8Array(bytes)).toString('utf8')).entries;
};

const stripeWith = (methods: Stripe.PaymentMethod[]): { stripe: Stripe; list: ReturnType<typeof vi.fn> } => {
  const list = vi.fn().mockResolvedValue({ data: methods });
  return { stripe: { paymentMethods: { list } } as unknown as Stripe, list };
};

describe('lookupCardsWithDirectory', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('serves fresh entries without calling Stripe', async () => {
    const { oystehr } = clientWith({ cus_1: { card: visaCard, resolvedAt: freshISO } });
    const { stripe, list } = stripeWith([]);

    const cards = await lookupCardsWithDirectory(oystehr, secrets, stripe, [
      { customerId: 'cus_1', stripeAccount: undefined },
    ]);
    expect(cards.get('cus_1')).toEqual(visaCard);
    expect(list).not.toHaveBeenCalled();
  });

  it('serves fresh negative entries (no card) without calling Stripe', async () => {
    const { oystehr } = clientWith({ cus_1: { resolvedAt: freshISO } });
    const { stripe, list } = stripeWith([]);

    const cards = await lookupCardsWithDirectory(oystehr, secrets, stripe, [
      { customerId: 'cus_1', stripeAccount: undefined },
    ]);
    expect(cards.has('cus_1')).toBe(false);
    expect(list).not.toHaveBeenCalled();
  });

  it('looks up stale entries and writes the refreshed directory back', async () => {
    const { oystehr, uploads } = clientWith({ cus_1: { resolvedAt: staleISO } });
    const { stripe, list } = stripeWith([
      { id: 'pm_visa', card: { brand: 'visa', last4: '4242' } } as Stripe.PaymentMethod,
    ]);

    const cards = await lookupCardsWithDirectory(oystehr, secrets, stripe, [
      { customerId: 'cus_1', stripeAccount: 'acct_1' },
    ]);
    expect(cards.get('cus_1')).toEqual(visaCard);
    expect(list).toHaveBeenCalledWith({ customer: 'cus_1', type: 'card', limit: 1 }, { stripeAccount: 'acct_1' });
    const entries = await savedEntries(uploads);
    expect(entries.cus_1.card).toEqual(visaCard);
  });

  it('merges lookups into existing entries instead of replacing the directory', async () => {
    const { oystehr, uploads } = clientWith({ cus_keep: { card: visaCard, resolvedAt: freshISO } });
    const { stripe } = stripeWith([]);

    await lookupCardsWithDirectory(oystehr, secrets, stripe, [{ customerId: 'cus_new', stripeAccount: undefined }]);
    const entries = await savedEntries(uploads);
    expect(entries.cus_keep.card).toEqual(visaCard);
    expect(entries.cus_new.card).toBeUndefined();
    expect(entries.cus_new.resolvedAt).toBeTruthy();
  });

  it('does nothing for an empty lookup list', async () => {
    const { oystehr, uploadFile, fetchMock } = clientWith(undefined);
    const { stripe, list } = stripeWith([]);

    const cards = await lookupCardsWithDirectory(oystehr, secrets, stripe, []);
    expect(cards.size).toBe(0);
    expect(list).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(uploadFile).not.toHaveBeenCalled();
  });
});
