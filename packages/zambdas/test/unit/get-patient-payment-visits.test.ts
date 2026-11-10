import Oystehr from '@oystehr/sdk';
import { Extension, FhirResource } from 'fhir/r4b';
import {
  ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE,
  ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE_ACCOUNT,
  SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL,
} from 'utils/lib/fhir/constants';
import { FOLLOWUP_SYSTEMS } from 'utils/lib/fhir/encounter';
import { OTTEHR_MODULE } from 'utils/lib/fhir/moduleIdentification';
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

const encounterSearchParams = (oystehr: Oystehr): { name: string; value: string }[] =>
  (vi.mocked(oystehr.fhir.search).mock.calls.find(([params]) => params.resourceType === 'Encounter')?.[0].params ??
    []) as { name: string; value: string }[];

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
        {
          resourceType: 'PaymentNotice',
          id: 'pn-2',
          status: 'active',
          created: '',
          request: { reference: 'Encounter/enc-1' },
          payment: {},
          recipient: {},
          amount: { value: 5 },
        },
      ],
    });

    const { visits, stripeCustomers } = await getPatientPaymentVisits(oystehr, 'patient-1');

    expect(visits).toEqual([
      {
        encounterId: 'enc-1',
        appointmentId: 'appt-1',
        visitDateISO: '2026-10-01T14:00:00.000Z',
        serviceMode: 'in-person',
        followUp: false,
        // a Location owner wins over the appointment's practitioner
        scheduleOwner: { stripeAccount: 'acct_clinic' },
        legacyPaymentNotices: [expect.objectContaining({ id: 'pn-1' }), expect.objectContaining({ id: 'pn-2' })],
      },
      {
        encounterId: 'enc-2',
        appointmentId: 'appt-2',
        visitDateISO: '2026-09-01T14:00:00.000Z',
        serviceMode: 'in-person',
        followUp: false,
        legacyPaymentNotices: [],
      },
      {
        encounterId: 'enc-3',
        appointmentId: undefined,
        visitDateISO: '2026-08-01T10:00:00.000Z',
        followUp: false,
        legacyPaymentNotices: [],
      },
    ]);
    expect(stripeCustomers).toEqual([
      { stripeAccount: undefined, customerId: 'cus_platform' },
      { stripeAccount: 'acct_clinic', customerId: 'cus_clinic' },
    ]);
  });

  it('describes each visit by its type, location and reason', async () => {
    const oystehr = searchClient({
      Encounter: [
        {
          resourceType: 'Encounter',
          id: 'enc-telemed',
          status: 'finished',
          class: { code: 'AMB' },
          appointment: [{ reference: 'Appointment/appt-telemed' }],
        },
        // a follow-up has no appointment, so only its own location and reason describe it
        {
          resourceType: 'Encounter',
          id: 'enc-follow-up',
          status: 'finished',
          class: { code: 'AMB' },
          type: [{ coding: [{ system: FOLLOWUP_SYSTEMS.type.url, code: FOLLOWUP_SYSTEMS.type.code }] }],
          location: [{ location: { reference: 'Location/annex' } }],
          reasonCode: [{ text: 'Lab results' }],
        },
        {
          resourceType: 'Appointment',
          id: 'appt-telemed',
          status: 'fulfilled',
          meta: { tag: [{ code: OTTEHR_MODULE.TM }] },
          description: 'Fever,  Cough',
          participant: [{ actor: { reference: 'Location/clinic' }, status: 'accepted' }],
        },
        { resourceType: 'Location', id: 'clinic', name: 'Main Clinic' },
        { resourceType: 'Location', id: 'annex', name: 'Annex' },
      ],
    });

    const { visits } = await getPatientPaymentVisits(oystehr, 'patient-1');

    expect(visits).toEqual([
      expect.objectContaining({
        encounterId: 'enc-telemed',
        serviceMode: 'virtual',
        followUp: false,
        locationName: 'Main Clinic',
        visitReason: 'Fever, Cough',
      }),
      expect.objectContaining({
        encounterId: 'enc-follow-up',
        serviceMode: undefined,
        followUp: true,
        locationName: 'Annex',
        visitReason: 'Lab results',
      }),
    ]);
    expect(encounterSearchParams(oystehr)).toContainEqual({ name: '_include', value: 'Encounter:location' });
  });

  it('describes a follow-up by its own date, location and reason, not its initial visit appointment', async () => {
    const oystehr = searchClient({
      Encounter: [
        {
          resourceType: 'Encounter',
          id: 'enc-initial',
          status: 'finished',
          class: { code: 'AMB' },
          appointment: [{ reference: 'Appointment/appt-initial' }],
        },
        // the follow-up form keeps the initial visit's appointment on the follow-up it creates
        {
          resourceType: 'Encounter',
          id: 'enc-follow-up',
          status: 'finished',
          class: { code: 'AMB' },
          type: [{ coding: [{ system: FOLLOWUP_SYSTEMS.type.url, code: FOLLOWUP_SYSTEMS.type.code }] }],
          appointment: [{ reference: 'Appointment/appt-initial' }],
          period: { start: '2026-10-08T15:00:00.000Z' },
          location: [{ location: { reference: 'Location/annex' } }],
          reasonCode: [{ text: 'Lab results' }],
        },
        {
          resourceType: 'Appointment',
          id: 'appt-initial',
          status: 'fulfilled',
          start: '2026-10-01T10:00:00.000Z',
          description: 'Fever',
          participant: [{ actor: { reference: 'Location/clinic' }, status: 'accepted' }],
        },
        { resourceType: 'Location', id: 'clinic', name: 'Main Clinic' },
        { resourceType: 'Location', id: 'annex', name: 'Annex' },
      ],
    });

    const { visits } = await getPatientPaymentVisits(oystehr, 'patient-1');

    expect(visits).toEqual([
      expect.objectContaining({
        encounterId: 'enc-initial',
        visitDateISO: '2026-10-01T10:00:00.000Z',
        serviceMode: 'in-person',
        locationName: 'Main Clinic',
        visitReason: 'Fever',
      }),
      expect.objectContaining({
        encounterId: 'enc-follow-up',
        appointmentId: 'appt-initial',
        visitDateISO: '2026-10-08T15:00:00.000Z',
        serviceMode: undefined,
        followUp: true,
        locationName: 'Annex',
        visitReason: 'Lab results',
      }),
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

  it("narrows to one of the patient's visits and looks up only its payments", async () => {
    const encounter = (id: string): FhirResource => ({
      resourceType: 'Encounter',
      id,
      status: 'finished',
      class: { code: 'AMB' },
    });
    // what FHIR returns for the search narrowed to enc-2
    const oystehr = searchClient({
      Encounter: [encounter('enc-2')],
      PaymentNotice: [],
    });

    const { visits } = await getPatientPaymentVisits(oystehr, 'patient-1', 'enc-2');

    expect(visits.map((visit) => visit.encounterId)).toEqual(['enc-2']);
    // the visit is searched by id among the patient's, not picked out of their whole history
    expect(encounterSearchParams(oystehr)).toEqual(
      expect.arrayContaining([
        { name: 'subject', value: 'Patient/patient-1' },
        { name: '_id', value: 'enc-2' },
      ])
    );
    const noticeSearch = vi
      .mocked(oystehr.fhir.search)
      .mock.calls.find(([params]) => params.resourceType === 'PaymentNotice')?.[0];
    expect(noticeSearch?.params).toContainEqual({ name: 'request', value: 'Encounter/enc-2' });
  });

  it('names payment submitters stored without a display name', async () => {
    const legacyNotice = (id: string, submitter: { reference: string; display?: string }): FhirResource =>
      ({
        resourceType: 'PaymentNotice',
        id,
        status: 'active',
        created: '',
        request: { reference: 'Encounter/enc-1' },
        contained: [
          {
            resourceType: 'PaymentReconciliation',
            status: 'active',
            created: '',
            paymentDate: '',
            paymentAmount: { value: 1 },
            detail: [{ type: { text: 'payment' }, submitter }],
          },
        ],
      }) as FhirResource;
    const oystehr = searchClient({
      Encounter: [{ resourceType: 'Encounter', id: 'enc-1', status: 'finished', class: { code: 'AMB' } }],
      PaymentNotice: [
        legacyNotice('pn-old', { reference: 'Practitioner/doc' }),
        legacyNotice('pn-stamped', { reference: 'Practitioner/nurse', display: 'Stamped Name' }),
      ],
      Practitioner: [{ resourceType: 'Practitioner', id: 'doc', name: [{ given: ['Carolyn'], family: 'Demo' }] }],
    });

    const { visits } = await getPatientPaymentVisits(oystehr, 'patient-1');

    const submitters = visits[0].legacyPaymentNotices.map((notice) => getPaymentNoticeSubmitterRef(notice)?.display);
    expect(submitters).toEqual(['Carolyn Demo', 'Stamped Name']);
    // only the unnamed submitter is looked up
    const practitionerSearch = vi
      .mocked(oystehr.fhir.search)
      .mock.calls.find(([params]) => params.resourceType === 'Practitioner')?.[0];
    expect(practitionerSearch?.params).toContainEqual({ name: '_id', value: 'doc' });
  });

  it("returns no visit for an encounter that isn't the patient's", async () => {
    // FHIR matches no encounter with that id and this patient as subject
    const oystehr = searchClient({ Encounter: [] });

    const { visits } = await getPatientPaymentVisits(oystehr, 'patient-1', 'enc-other');

    expect(visits).toEqual([]);
    expect(encounterSearchParams(oystehr)).toEqual(
      expect.arrayContaining([
        { name: 'subject', value: 'Patient/patient-1' },
        { name: '_id', value: 'enc-other' },
      ])
    );
  });

  it('searches every encounter of the patient when no visit is named', async () => {
    const oystehr = searchClient({});

    await getPatientPaymentVisits(oystehr, 'patient-1');

    expect(encounterSearchParams(oystehr).some((param) => param.name === '_id')).toBe(false);
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
