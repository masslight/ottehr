import Oystehr from '@oystehr/sdk';
import { Appointment, Claim, Encounter, PaymentNotice } from 'fhir/r4b';
import Stripe from 'stripe';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { PatientPaymentDTO } from 'utils/lib/types/api/patient-payment-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/billing/patient-payments', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchEncounterPaymentNotices: vi.fn(),
}));
vi.mock('../../../src/billing/patient-payment-dtos', () => ({
  getPaymentsForEncounter: vi.fn(),
}));
vi.mock('../../../src/ehr/shared/harvest', () => ({
  getAccountAndCoverageResourcesForPatient: vi.fn().mockResolvedValue({ account: { resourceType: 'Account' } }),
}));

import { listAccountPayments } from '../../../src/billing/list-billing-patient-account-payments';
import { getPaymentsForEncounter } from '../../../src/billing/patient-payment-dtos';
import { fetchEncounterPaymentNotices } from '../../../src/billing/patient-payments';
import { STRIPE_PAYMENT_ID_SYSTEM } from '../../../src/shared/stripeIntegration';

const CLAIM_ENCOUNTER_ID_SYSTEM = ottehrIdentifierSystem('claim-encounter-id');

const encounter = (id: string, appointmentId?: string, start?: string): Encounter =>
  ({
    resourceType: 'Encounter',
    id,
    status: 'finished',
    ...(appointmentId ? { appointment: [{ reference: `Appointment/${appointmentId}` }] } : {}),
    ...(start ? { period: { start } } : {}),
  }) as Encounter;

const appointment = (id: string, start: string): Appointment =>
  ({ resourceType: 'Appointment', id, status: 'fulfilled', start, participant: [] }) as Appointment;

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

const list = (clinicalOystehr: Oystehr, billingOystehr: Oystehr): ReturnType<typeof listAccountPayments> =>
  listAccountPayments({
    clinicalOystehr,
    billingOystehr,
    clinicalPatientId: 'patient-1',
    stripeClient: {} as Stripe,
  });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listAccountPayments', () => {
  it('lists payments across visits newest first, with their visit, claim and method', async () => {
    const clinicalOystehr = searchClient({
      // _include brings the appointments back alongside the encounters
      Encounter: [
        encounter('enc-1', 'appt-1'),
        encounter('enc-2', undefined, '2026-09-01T10:00:00.000Z'),
        encounter('enc-unpaid', 'appt-3'),
        appointment('appt-1', '2026-10-01T14:00:00.000Z'),
      ],
    });
    const billingOystehr = searchClient({
      Claim: [claim('claim-1', 'enc-1', '2026-10-01')],
    });
    vi.mocked(fetchEncounterPaymentNotices).mockResolvedValue(
      new Map([
        [
          'enc-1',
          [
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
        ],
        ['enc-2', [notice('pn-cash')]],
        ['enc-unpaid', []],
      ])
    );
    vi.mocked(getPaymentsForEncounter).mockImplementation(async ({ encounterId }) =>
      encounterId === 'enc-1'
        ? [
            payment('pn-card', '2026-10-01T15:00:00.000Z', { paymentMethod: 'card', cardLast4: '4242' }),
            payment('pn-invoice', '2026-10-20T15:00:00.000Z', { paymentMethod: 'card' }),
          ]
        : [payment('pn-cash', '2026-09-01T11:00:00.000Z')]
    );

    const payments = await list(clinicalOystehr, billingOystehr);

    // only visits with payments are resolved against Stripe, with the notices already fetched
    expect(
      vi
        .mocked(getPaymentsForEncounter)
        .mock.calls.map(([input]) => input.encounterId)
        .sort()
    ).toEqual(['enc-1', 'enc-2']);
    expect(vi.mocked(getPaymentsForEncounter).mock.calls[0][0].fhirPaymentNotices).toBeDefined();

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
    vi.mocked(fetchEncounterPaymentNotices).mockResolvedValue(
      new Map([
        [
          'enc-1',
          [
            notice('pn-manual-evening', { paymentDate: '2026-10-05' }),
            notice('pn-stripe-morning'),
            // recorded the next day, backdated to the day before
            notice('pn-manual-backdated', { paymentDate: '2026-10-04' }),
          ],
        ],
      ])
    );
    vi.mocked(getPaymentsForEncounter).mockResolvedValue([
      payment('pn-stripe-morning', '2026-10-05T09:00:00.000Z', { paymentMethod: 'card' }),
      payment('pn-manual-backdated', '2026-10-06T10:00:00.000Z'),
      payment('pn-manual-evening', '2026-10-05T18:00:00.000Z'),
    ]);

    const payments = await list(searchClient({ Encounter: [encounter('enc-1')] }), searchClient({}));

    expect(payments.map((p) => [p.fhirPaymentNotificationId, p.dateISO])).toEqual([
      ['pn-manual-evening', '2026-10-05'],
      ['pn-stripe-morning', '2026-10-05T09:00:00.000Z'],
      ['pn-manual-backdated', '2026-10-04'],
    ]);
  });

  it('returns nothing without looking up payments when the patient has no visits', async () => {
    const payments = await list(searchClient({}), searchClient({}));

    expect(payments).toEqual([]);
    expect(fetchEncounterPaymentNotices).not.toHaveBeenCalled();
    expect(getPaymentsForEncounter).not.toHaveBeenCalled();
  });
});
