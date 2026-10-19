import Oystehr from '@oystehr/sdk';
import { PaymentReconciliation } from 'fhir/r4b';
import { ERA_SOURCE } from 'utils/lib/types/data/billing/billing.constants';
import { VoidEraInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ERA_SOURCE_EXTENSION, fetchById } from '../../../src/billing/shared';
import { performEffect } from '../../../src/billing/void-billing-era';

vi.mock('../../../src/billing/shared', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchById: vi.fn(),
}));

const actor = { reference: 'Practitioner/biller-1', display: 'biller@example.com' };
const now = '2026-10-15T12:00:00.000Z';
const params = { eraId: 'era-1', secrets: {} };
const era = {
  resourceType: 'PaymentReconciliation',
  id: 'era-1',
  meta: { versionId: '3' },
  status: 'active',
  created: '2026-09-01',
  paymentDate: '2026-09-01',
  paymentAmount: { value: 100, currency: 'USD' },
} satisfies PaymentReconciliation;
const transaction = vi.fn();
const oystehr = { fhir: { transaction } } as unknown as Oystehr;
const eraReadClient = {} as Oystehr;
const conflict = (): Error => new Oystehr.OystehrSdkError({ message: 'precondition failed', code: 412 });
const voidEra = (): ReturnType<typeof performEffect> => performEffect(oystehr, eraReadClient, params, actor, now);

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchById).mockResolvedValue(era);
});

describe('void-billing-era', () => {
  it.each(Object.values(ERA_SOURCE))('voids a %s ERA and records the caller in one transaction', async (source) => {
    vi.mocked(fetchById).mockResolvedValue({
      ...era,
      extension: [{ url: ERA_SOURCE_EXTENSION, valueCode: source }],
    });
    await expect(voidEra()).resolves.toEqual({ ok: true });
    expect(fetchById).toHaveBeenCalledWith(eraReadClient, 'PaymentReconciliation', 'era-1');
    // No ClaimResponse, Claim, invoice or patient-payment writes.
    expect(transaction).toHaveBeenCalledExactlyOnceWith({
      requests: [
        {
          method: 'PATCH',
          url: '/PaymentReconciliation/era-1',
          ifMatch: 'W/"3"',
          resource: {
            resourceType: 'Binary',
            contentType: 'application/json-patch+json',
            data: Buffer.from(JSON.stringify([{ op: 'replace', path: '/status', value: 'cancelled' }])).toString(
              'base64'
            ),
          },
        },
        {
          method: 'POST',
          url: '/Provenance',
          resource: {
            resourceType: 'Provenance',
            target: [{ reference: 'PaymentReconciliation/era-1' }],
            recorded: now,
            activity: { text: 'Void ERA' },
            agent: [{ who: actor }],
          },
        },
      ],
    });
  });

  it('preserves the version condition in the SDK-serialized FHIR transaction', async () => {
    const fetch = vi.fn(async (_request: Request) =>
      Response.json({ resourceType: 'Bundle', type: 'transaction-response', entry: [] })
    );
    const client = new Oystehr({ accessToken: 'test-token', fhirApiUrl: 'https://fhir.invalid', fetch });
    await performEffect(client, eraReadClient, params, actor, now);
    const body = await fetch.mock.calls[0][0].json();
    expect(body.entry[0].request).toMatchObject({
      method: 'PATCH',
      url: '/PaymentReconciliation/era-1',
      ifMatch: 'W/"3"',
    });
    expect(JSON.parse(Buffer.from(body.entry[0].resource.data, 'base64').toString())).toEqual([
      { op: 'replace', path: '/status', value: 'cancelled' },
    ]);
  });

  it('does not write a second audit record when the ERA is already voided', async () => {
    vi.mocked(fetchById).mockResolvedValue({ ...era, status: 'cancelled', meta: { versionId: '4' } });
    await expect(voidEra()).resolves.toEqual({ ok: true });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('reports an edit that wins the race with void', async () => {
    transaction.mockRejectedValueOnce(conflict());
    vi.mocked(fetchById)
      .mockResolvedValueOnce(era)
      .mockResolvedValueOnce({ ...era, meta: { versionId: '4' } });
    await expect(voidEra()).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('Reload') });
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('succeeds when another void wins the race, without retrying the audit write', async () => {
    transaction.mockRejectedValueOnce(conflict());
    vi.mocked(fetchById)
      .mockResolvedValueOnce(era)
      .mockResolvedValueOnce({ ...era, status: 'cancelled' });
    await expect(voidEra()).resolves.toEqual({ ok: true });
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('propagates other transaction failures', async () => {
    transaction.mockRejectedValueOnce(new Error('unavailable'));
    await expect(voidEra()).rejects.toThrow('unavailable');
  });

  it('does not write when the ERA cannot be found', async () => {
    vi.mocked(fetchById).mockRejectedValueOnce(new Error('not found'));
    await expect(voidEra()).rejects.toThrow('not found');
    expect(transaction).not.toHaveBeenCalled();
  });

  it.each([{}, { eraId: '' }])('requires an ERA id: %j', (input) =>
    expect(VoidEraInputSchema.safeParse(input).success).toBe(false)
  );
});
