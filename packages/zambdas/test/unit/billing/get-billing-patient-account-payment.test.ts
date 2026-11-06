import Oystehr from '@oystehr/sdk';
import { Claim, PaymentNotice } from 'fhir/r4b';
import Stripe from 'stripe';
import { PAYMENT_METHOD_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { PatientPaymentDTO } from 'utils/lib/types/api/patient-payment-types';
import { PatientPaymentVisit } from 'utils/lib/types/api/patient-payment-visits.types';
import { APIErrorCode } from 'utils/lib/types/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/billing/claim-amounts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchPatientPaymentsByEncounterIds: vi.fn(),
}));
vi.mock('../../../src/billing/patient-payment-dtos', () => ({
  listEncounterPayments: vi.fn(),
}));
vi.mock('../../../src/billing/ehr-payment-data', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getPatientPaymentVisits: vi.fn(),
}));

import { fetchPatientPaymentsByEncounterIds } from '../../../src/billing/claim-amounts';
import { getPatientPaymentVisits } from '../../../src/billing/ehr-payment-data';
import { getAccountPayment } from '../../../src/billing/get-billing-patient-account-payment';
import { listEncounterPayments } from '../../../src/billing/patient-payment-dtos';
import { CLINICAL_PAYMENT_NOTICE_ID_SYSTEM } from '../../../src/billing/payments';
import { STRIPE_PAYMENT_ID_SYSTEM } from '../../../src/shared/stripeIntegration';

const CLAIM_ENCOUNTER_ID_SYSTEM = ottehrIdentifierSystem('claim-encounter-id');

const visit = (encounterId: string, extra: Partial<PatientPaymentVisit> = {}): PatientPaymentVisit => ({
  encounterId,
  legacyPaymentNotices: [],
  ...extra,
});

const claim = (id: string, encounterId: string, serviceDate: string): Claim =>
  ({
    resourceType: 'Claim',
    id,
    identifier: [{ system: CLAIM_ENCOUNTER_ID_SYSTEM, value: encounterId }],
    item: [{ sequence: 1, servicedPeriod: { start: serviceDate } }],
  }) as Claim;

const notice = (id: string, extra: Partial<PaymentNotice> = {}): PaymentNotice =>
  ({
    resourceType: 'PaymentNotice',
    id,
    status: 'active',
    created: '',
    amount: { value: 1 },
    ...extra,
  }) as PaymentNotice;

const payment = (id: string, dateISO: string, extra: Partial<PatientPaymentDTO> = {}): PatientPaymentDTO =>
  ({
    paymentMethod: 'cash',
    amountInCents: 1000,
    dateISO,
    fhirPaymentNotificationId: id,
    ...extra,
  }) as PatientPaymentDTO;

const searchClient = (byType: Record<string, unknown[]>): Oystehr =>
  ({
    fhir: {
      search: vi.fn(async ({ resourceType }: { resourceType: string }) => ({
        link: [],
        unbundle: () => byType[resourceType] ?? [],
      })),
    },
  }) as unknown as Oystehr;

const get = (billingOystehr: Oystehr, paymentId: string, encounterId = 'enc-1'): ReturnType<typeof getAccountPayment> =>
  getAccountPayment({
    billingOystehr,
    clinicalPatientId: 'patient-1',
    encounterId,
    paymentId,
    stripeClient: {} as Stripe,
  });

const givenVisits = (visits: PatientPaymentVisit[]): void => {
  vi.mocked(getPatientPaymentVisits).mockResolvedValue({ visits, stripeCustomers: [] });
};

const givenBillingNotices = (byEncounter: Record<string, PaymentNotice[]>): void => {
  vi.mocked(fetchPatientPaymentsByEncounterIds).mockResolvedValue(new Map(Object.entries(byEncounter)));
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getAccountPayment', () => {
  it('resolves only the requested payment, with its visit, claim and method', async () => {
    givenVisits([visit('enc-1', { appointmentId: 'appt-1', visitDateISO: '2026-10-01T14:00:00.000Z' })]);
    givenBillingNotices({
      'enc-1': [
        notice('pn-other', { request: { reference: 'Claim/claim-1' } }),
        notice('pn-invoice', {
          identifier: [{ system: STRIPE_PAYMENT_ID_SYSTEM, value: 'in_123' }],
        }),
      ],
    });
    vi.mocked(listEncounterPayments).mockResolvedValue([
      payment('pn-invoice', '2026-10-20T15:00:00.000Z', { paymentMethod: 'card' }),
    ]);
    const billingOystehr = searchClient({ Claim: [claim('claim-1', 'enc-1', '2026-10-01')] });

    const result = await get(billingOystehr, 'pn-invoice');

    // the EHR is asked for the one visit, which it only returns when it is the patient's
    expect(getPatientPaymentVisits).toHaveBeenCalledWith(billingOystehr, 'patient-1', 'enc-1');
    // Stripe is queried for the requested payment alone
    expect(vi.mocked(listEncounterPayments).mock.calls[0][0].fhirPaymentNotices.map((n) => n.id)).toEqual([
      'pn-invoice',
    ]);
    // the claim is resolved against every notice on the visit, as in the account listing
    expect(result).toMatchObject({
      fhirPaymentNotificationId: 'pn-invoice',
      method: 'invoice',
      encounterId: 'enc-1',
      appointmentId: 'appt-1',
      visitDateISO: '2026-10-01T14:00:00.000Z',
      claimId: 'claim-1',
      claimServiceDate: '2026-10-01',
    });
  });

  it('finds a legacy EHR payment no billing notice shadows', async () => {
    givenVisits([visit('enc-1', { legacyPaymentNotices: [notice('pn-cash', { paymentDate: '2026-09-01' })] })]);
    givenBillingNotices({});
    vi.mocked(listEncounterPayments).mockResolvedValue([payment('pn-cash', '2026-09-01T11:00:00.000Z')]);

    const result = await get(searchClient({}), 'pn-cash');

    expect(result).toMatchObject({ fhirPaymentNotificationId: 'pn-cash', method: 'cash', dateISO: '2026-09-01' });
  });

  it('resolves a legacy payment id to the billing notice that adopted it on a refund or void', async () => {
    givenVisits([visit('enc-1', { legacyPaymentNotices: [notice('pn-legacy')] })]);
    givenBillingNotices({
      'enc-1': [
        notice('pn-adopted', { identifier: [{ system: CLINICAL_PAYMENT_NOTICE_ID_SYSTEM, value: 'pn-legacy' }] }),
      ],
    });
    vi.mocked(listEncounterPayments).mockResolvedValue([payment('pn-adopted', '2026-09-01T11:00:00.000Z')]);

    const result = await get(searchClient({}), 'pn-legacy');

    expect(vi.mocked(listEncounterPayments).mock.calls[0][0].fhirPaymentNotices.map((n) => n.id)).toEqual([
      'pn-adopted',
    ]);
    // the caller learns the payment's current id from the response
    expect(result.fhirPaymentNotificationId).toBe('pn-adopted');
  });

  describe('description', () => {
    const recorded = (method: string, disposition: string): PaymentNotice =>
      notice('pn-1', {
        extension: [{ url: PAYMENT_METHOD_EXTENSION_URL, valueString: method }],
        contained: [{ resourceType: 'PaymentReconciliation', id: 'contained-reconciliation', disposition } as never],
      });

    const descriptionOf = async (paymentNotice: PaymentNotice, dto: PatientPaymentDTO): Promise<string | undefined> => {
      givenVisits([visit('enc-1')]);
      givenBillingNotices({ 'enc-1': [paymentNotice] });
      vi.mocked(listEncounterPayments).mockResolvedValue([dto]);
      return (await get(searchClient({}), 'pn-1')).description;
    };

    it('shows the description entered for a manual payment', async () => {
      await expect(
        descriptionOf(recorded('check', 'Paid by spouse'), payment('pn-1', '2026-09-01T11:00:00.000Z'))
      ).resolves.toBe('Paid by spouse');
    });

    it.each(['cash payment collected manually', 'cash collected from patient'])(
      'hides the generated disposition "%s"',
      async (disposition) => {
        await expect(
          descriptionOf(recorded('cash', disposition), payment('pn-1', '2026-09-01T11:00:00.000Z'))
        ).resolves.toBeUndefined();
      }
    );

    it("keeps a card payment's Stripe description and never shows its processor log", async () => {
      const card = recorded('card', 'Stripe charge ch_1 succeeded');
      await expect(
        descriptionOf(card, payment('pn-1', '2026-09-01T11:00:00.000Z', { paymentMethod: 'card' }))
      ).resolves.toBeUndefined();
      await expect(
        descriptionOf(
          card,
          payment('pn-1', '2026-09-01T11:00:00.000Z', { paymentMethod: 'card', description: 'Copay' } as never)
        )
      ).resolves.toBe('Copay');
    });
  });

  it("rejects an encounter that isn't the patient's", async () => {
    givenVisits([]);

    await expect(get(searchClient({}), 'pn-1', 'enc-other')).rejects.toMatchObject({
      code: APIErrorCode.FHIR_RESOURCE_NOT_FOUND,
    });
    expect(listEncounterPayments).not.toHaveBeenCalled();
  });

  it("rejects a payment that isn't on the visit", async () => {
    givenVisits([visit('enc-1')]);
    givenBillingNotices({ 'enc-1': [notice('pn-1')] });

    await expect(get(searchClient({}), 'pn-missing')).rejects.toMatchObject({
      code: APIErrorCode.FHIR_RESOURCE_NOT_FOUND,
    });
    expect(listEncounterPayments).not.toHaveBeenCalled();
  });
});
