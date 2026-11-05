import Oystehr from '@oystehr/sdk';
import { Extension, FhirResource } from 'fhir/r4b';
import {
  ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE,
  ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE_ACCOUNT,
  SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL,
} from 'utils/lib/fhir/constants';
import { getPaymentNoticeSubmitterRef } from 'utils/lib/fhir/payments';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/ehr/shared/harvest', () => ({
  getAccountAndCoverageResourcesForPatient: vi.fn(),
}));

import { getPatientPaymentVisits } from '../../src/ehr/get-patient-payment-visits';
import { getAccountAndCoverageResourcesForPatient } from '../../src/ehr/shared/harvest';

const searchClient = (byType: Record<string, FhirResource[]>): Oystehr =>
  ({
    fhir: {
      search: vi.fn(async ({ resourceType }: { resourceType: string }) => ({
        link: [],
        unbundle: () => byType[resourceType] ?? [],
      })),
    },
  }) as unknown as Oystehr;

const withStripeAccount = (stripeAccount: string): { extension: Extension[] } => ({
  extension: [{ url: SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL, valueString: stripeAccount }],
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAccountAndCoverageResourcesForPatient).mockResolvedValue({
    account: {
      resourceType: 'Account',
      status: 'active',
      identifier: [
        { system: ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE, value: 'cus_platform' },
        {
          system: ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE,
          value: 'cus_clinic',
          extension: [{ url: ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE_ACCOUNT, valueString: 'acct_clinic' }],
        },
      ],
    },
  } as unknown as Awaited<ReturnType<typeof getAccountAndCoverageResourcesForPatient>>);
});

describe('getPatientPaymentVisits', () => {
  it("lists each visit with its schedule owner's Stripe account and its EHR payments", async () => {
    const oystehr = searchClient({
      // _include brings the appointments and their actors back alongside the encounters
      Encounter: [
        {
          resourceType: 'Encounter',
          id: 'enc-1',
          status: 'finished',
          class: { code: 'AMB' },
          appointment: [{ reference: 'Appointment/appt-1' }],
        },
        {
          resourceType: 'Encounter',
          id: 'enc-2',
          status: 'finished',
          class: { code: 'AMB' },
          appointment: [{ reference: 'Appointment/appt-2' }],
        },
        {
          resourceType: 'Encounter',
          id: 'enc-3',
          status: 'finished',
          class: { code: 'AMB' },
          period: { start: '2026-08-01T10:00:00.000Z' },
        },
        {
          resourceType: 'Appointment',
          id: 'appt-1',
          status: 'fulfilled',
          start: '2026-10-01T14:00:00.000Z',
          participant: [
            { actor: { reference: 'Practitioner/doc' }, status: 'accepted' },
            { actor: { reference: 'Location/clinic' }, status: 'accepted' },
          ],
        },
        // a visit whose only actor is the patient has no schedule owner
        {
          resourceType: 'Appointment',
          id: 'appt-2',
          status: 'fulfilled',
          start: '2026-09-01T14:00:00.000Z',
          participant: [{ actor: { reference: 'Patient/patient-1' }, status: 'accepted' }],
        },
        { resourceType: 'Practitioner', id: 'doc', ...withStripeAccount('acct_doc') },
        { resourceType: 'Location', id: 'clinic', ...withStripeAccount('acct_clinic') },
        { resourceType: 'Patient', id: 'patient-1' },
      ],
      PaymentNotice: [
        {
          resourceType: 'PaymentNotice',
          id: 'pn-1',
          status: 'active',
          created: '',
          request: { reference: 'Encounter/enc-1' },
          payment: {},
          recipient: {},
          amount: { value: 10 },
        },
        // recorded before the submitter's name was stamped on its reference
        {
          resourceType: 'PaymentNotice',
          id: 'pn-2',
          status: 'active',
          created: '',
          request: { reference: 'Encounter/enc-1' },
          payment: {},
          recipient: {},
          amount: { value: 5 },
          contained: [
            {
              resourceType: 'PaymentReconciliation',
              status: 'active',
              created: '',
              paymentDate: '',
              paymentAmount: { value: 5 },
              detail: [{ type: {}, submitter: { reference: 'Practitioner/fd' } }],
            },
          ],
        },
      ],
      Practitioner: [{ resourceType: 'Practitioner', id: 'fd', name: [{ given: ['Front'], family: 'Desk' }] }],
    });

    const { visits, stripeCustomers } = await getPatientPaymentVisits(oystehr, 'patient-1');

    expect(visits).toEqual([
      {
        encounterId: 'enc-1',
        appointmentId: 'appt-1',
        visitDateISO: '2026-10-01T14:00:00.000Z',
        // a Location owner wins over the appointment's practitioner
        scheduleOwner: { stripeAccount: 'acct_clinic' },
        legacyPaymentNotices: [expect.objectContaining({ id: 'pn-1' }), expect.objectContaining({ id: 'pn-2' })],
      },
      {
        encounterId: 'enc-2',
        appointmentId: 'appt-2',
        visitDateISO: '2026-09-01T14:00:00.000Z',
        legacyPaymentNotices: [],
      },
      {
        encounterId: 'enc-3',
        appointmentId: undefined,
        visitDateISO: '2026-08-01T10:00:00.000Z',
        legacyPaymentNotices: [],
      },
    ]);
    expect(getPaymentNoticeSubmitterRef(visits[0].legacyPaymentNotices[1])).toEqual({
      reference: 'Practitioner/fd',
      display: 'Front Desk',
    });
    expect(stripeCustomers).toEqual([
      { stripeAccount: undefined, customerId: 'cus_platform' },
      { stripeAccount: 'acct_clinic', customerId: 'cus_clinic' },
    ]);
  });

  it("finds a schedule owner linked only through the appointment's slot schedule", async () => {
    const oystehr = searchClient({
      Encounter: [
        {
          resourceType: 'Encounter',
          id: 'enc-1',
          status: 'finished',
          class: { code: 'AMB' },
          appointment: [{ reference: 'Appointment/appt-1' }],
        },
        // the practitioner is an actor, but the location only comes through slot -> schedule
        {
          resourceType: 'Appointment',
          id: 'appt-1',
          status: 'fulfilled',
          start: '2026-10-01T14:00:00.000Z',
          slot: [{ reference: 'Slot/slot-1' }],
          participant: [{ actor: { reference: 'Practitioner/doc' }, status: 'accepted' }],
        },
        {
          resourceType: 'Slot',
          id: 'slot-1',
          status: 'busy',
          start: '2026-10-01T14:00:00.000Z',
          end: '2026-10-01T14:15:00.000Z',
          schedule: { reference: 'Schedule/sched-1' },
        },
        { resourceType: 'Schedule', id: 'sched-1', actor: [{ reference: 'Location/clinic' }] },
        { resourceType: 'Practitioner', id: 'doc', ...withStripeAccount('acct_doc') },
        { resourceType: 'Location', id: 'clinic', ...withStripeAccount('acct_clinic') },
      ],
    });

    const { visits } = await getPatientPaymentVisits(oystehr, 'patient-1');

    // as in getScheduleOwnerFromAppointmentOrEncounter, the schedule's Location wins over the practitioner actor
    expect(visits).toEqual([
      expect.objectContaining({ encounterId: 'enc-1', scheduleOwner: { stripeAccount: 'acct_clinic' } }),
    ]);
  });

  it('looks up no payments for a patient with no visits', async () => {
    const oystehr = searchClient({});

    await expect(getPatientPaymentVisits(oystehr, 'patient-1')).resolves.toEqual({
      visits: [],
      stripeCustomers: [
        { stripeAccount: undefined, customerId: 'cus_platform' },
        { stripeAccount: 'acct_clinic', customerId: 'cus_clinic' },
      ],
    });
    expect(vi.mocked(oystehr.fhir.search).mock.calls.map(([params]) => params.resourceType)).toEqual(['Encounter']);
  });
});
