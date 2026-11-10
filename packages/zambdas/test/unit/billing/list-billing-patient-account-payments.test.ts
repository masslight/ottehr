import Oystehr from '@oystehr/sdk';
import { Claim, PaymentNotice } from 'fhir/r4b';
import Stripe from 'stripe';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { PatientPaymentDTO } from 'utils/lib/types/api/patient-payment-types';
import { PatientPaymentVisit } from 'utils/lib/types/api/patient-payment-visits.types';
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
import { listAccountPayments } from '../../../src/billing/list-billing-patient-account-payments';
import { listEncounterPayments } from '../../../src/billing/patient-payment-dtos';
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

const list = (billingOystehr: Oystehr): ReturnType<typeof listAccountPayments> =>
  listAccountPayments({ billingOystehr, clinicalPatientId: 'patient-1', stripeClient: {} as Stripe });

const givenVisits = (visits: PatientPaymentVisit[]): void => {
  vi.mocked(getPatientPaymentVisits).mockResolvedValue({ visits, stripeCustomers: [] });
};

const givenBillingNotices = (byEncounter: Record<string, PaymentNotice[]>): void => {
  vi.mocked(fetchPatientPaymentsByEncounterIds).mockResolvedValue(new Map(Object.entries(byEncounter)));
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listAccountPayments', () => {
  it('lists payments across visits newest first, with their visit, claim and method', async () => {
    givenVisits([
      visit('enc-1', { appointmentId: 'appt-1', visitDateISO: '2026-10-01T14:00:00.000Z' }),
      // an EHR payment recorded before payments moved to billing, on a visit with no appointment
      visit('enc-2', { visitDateISO: '2026-09-01T10:00:00.000Z', legacyPaymentNotices: [notice('pn-cash')] }),
      visit('enc-unpaid', { appointmentId: 'appt-3' }),
    ]);
    givenBillingNotices({
      'enc-1': [
        notice('pn-card', { request: { reference: 'Claim/claim-1' } }),
        // a charge that settled a Stripe invoice
        notice('pn-invoice', {
          identifier: [{ system: STRIPE_PAYMENT_ID_SYSTEM, value: 'ch_1' }],
          contained: [
            {
              resourceType: 'PaymentReconciliation',
              status: 'active',
              created: '',
              paymentDate: '',
              paymentAmount: { value: 1 },
              disposition: 'Stripe charge ch_1 succeeded for invoice in_123',
            },
          ],
        }),
      ],
    });
    vi.mocked(listEncounterPayments).mockImplementation(async ({ encounterId }) =>
      encounterId === 'enc-1'
        ? [
            payment('pn-card', '2026-10-01T15:00:00.000Z', { paymentMethod: 'card', cardLast4: '4242' }),
            payment('pn-invoice', '2026-10-20T15:00:00.000Z', { paymentMethod: 'card' }),
          ]
        : [payment('pn-cash', '2026-09-01T11:00:00.000Z')]
    );
    const billingOystehr = searchClient({ Claim: [claim('claim-1', 'enc-1', '2026-10-01')] });

    const payments = await list(billingOystehr);

    // the visits come from the EHR for the clinical patient
    expect(getPatientPaymentVisits).toHaveBeenCalledWith(billingOystehr, 'patient-1');
    // only visits with payments are resolved against Stripe, with billing and EHR notices merged
    const calls = vi.mocked(listEncounterPayments).mock.calls.map(([input]) => input);
    expect(calls.map((input) => input.encounterId).sort()).toEqual(['enc-1', 'enc-2']);
    expect(calls.find((input) => input.encounterId === 'enc-2')?.fhirPaymentNotices.map((n) => n.id)).toEqual([
      'pn-cash',
    ]);

    expect(payments.map((p) => p.fhirPaymentNotificationId)).toEqual(['pn-invoice', 'pn-card', 'pn-cash']);
    expect(payments[0]).toMatchObject({
      method: 'invoice',
      encounterId: 'enc-1',
      appointmentId: 'appt-1',
      visitDateISO: '2026-10-01T14:00:00.000Z',
      claimId: 'claim-1',
      claimServiceDate: '2026-10-01',
    });
    expect(payments[1]).toMatchObject({ method: 'card', cardLast4: '4242', claimId: 'claim-1' });
    // a visit with no claim and no appointment still shows its own date
    expect(payments[2]).toMatchObject({
      method: 'cash',
      encounterId: 'enc-2',
      appointmentId: undefined,
      visitDateISO: '2026-09-01T10:00:00.000Z',
      claimId: undefined,
      claimServiceDate: undefined,
    });
  });

  it("orders a manual payment's date-only paymentDate by its day, then by when it was recorded", async () => {
    givenVisits([visit('enc-1')]);
    givenBillingNotices({
      'enc-1': [
        notice('pn-manual-evening', { paymentDate: '2026-10-05' }),
        notice('pn-stripe-morning'),
        // recorded the next day, backdated to the day before
        notice('pn-manual-backdated', { paymentDate: '2026-10-04' }),
      ],
    });
    vi.mocked(listEncounterPayments).mockResolvedValue([
      payment('pn-stripe-morning', '2026-10-05T09:00:00.000Z', { paymentMethod: 'card' }),
      payment('pn-manual-backdated', '2026-10-06T10:00:00.000Z'),
      payment('pn-manual-evening', '2026-10-05T18:00:00.000Z'),
    ]);

    const payments = await list(searchClient({}));

    expect(payments.map((p) => [p.fhirPaymentNotificationId, p.dateISO])).toEqual([
      ['pn-manual-evening', '2026-10-05'],
      ['pn-stripe-morning', '2026-10-05T09:00:00.000Z'],
      ['pn-manual-backdated', '2026-10-04'],
    ]);
  });

  it("places a timestamped payment on the practice's local day, not the UTC one", async () => {
    givenVisits([visit('enc-1')]);
    givenBillingNotices({
      'enc-1': [
        // recorded two days later, backdated to Oct 5
        notice('pn-manual-backdated', { paymentDate: '2026-10-05' }),
        // 9pm Eastern on Oct 5, already Oct 6 in UTC
        notice('pn-card-reader-evening'),
      ],
    });
    vi.mocked(listEncounterPayments).mockResolvedValue([
      payment('pn-card-reader-evening', '2026-10-06T01:00:00.000Z', { paymentMethod: 'card-reader' }),
      payment('pn-manual-backdated', '2026-10-07T10:00:00.000Z'),
    ]);

    const payments = await list(searchClient({}));

    // both fall on Oct 5, so the later-recorded one comes first
    expect(payments.map((p) => [p.fhirPaymentNotificationId, p.dateISO])).toEqual([
      ['pn-manual-backdated', '2026-10-05'],
      ['pn-card-reader-evening', '2026-10-06T01:00:00.000Z'],
    ]);
  });

  it('returns nothing without looking up payments when the patient has no visits', async () => {
    givenVisits([]);

    const payments = await list(searchClient({}));

    expect(payments).toEqual([]);
    expect(fetchPatientPaymentsByEncounterIds).not.toHaveBeenCalled();
    expect(listEncounterPayments).not.toHaveBeenCalled();
  });
});
