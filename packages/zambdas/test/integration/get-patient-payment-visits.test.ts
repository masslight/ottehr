import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Account, Location, PaymentNotice, Practitioner } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import {
  ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE,
  ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE_ACCOUNT,
  SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL,
} from 'utils/lib/fhir/constants';
import { getPaymentNoticeSubmitterRef } from 'utils/lib/fhir/payments';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { GetPatientPaymentVisitsResponse } from 'utils/lib/types/api/patient-payment-visits.types';
import { ServiceMode } from 'utils/lib/types/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildPaymentNotice } from '../../src/billing/payments';
import { STRIPE_PAYMENT_ID_SYSTEM } from '../../src/shared/stripeIntegration';
import {
  addProcessIdMetaTagToResource,
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

describe('get-patient-payment-visits integration', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let base: InsertFullAppointmentDataBaseResult;
  let practitioner: Practitioner;
  let paymentNotice: PaymentNotice;
  const stripeAccount = `acct_it_${randomUUID().slice(0, 8)}`;
  const stripeCustomerId = `cus_it_${randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('get-patient-payment-visits.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);

    const locationId = getIdFromReference(
      base.appointment.participant.find((participant) => participant.actor?.reference?.startsWith('Location/'))?.actor
        ?.reference,
      'Location'
    )!;
    const [account] = (
      await oystehrAdmin.fhir.search<Account>({
        resourceType: 'Account',
        params: [{ name: 'subject', value: `Patient/${base.patient.id}` }],
      })
    ).unbundle();

    [practitioner] = await Promise.all([
      oystehrAdmin.fhir.create<Practitioner>(
        addProcessIdMetaTagToResource(
          { resourceType: 'Practitioner', name: [{ given: ['Payment'], family: `Taker-${randomUUID().slice(0, 8)}` }] },
          setup.processId
        ) as Practitioner
      ),
      oystehrAdmin.fhir.patch<Location>({
        resourceType: 'Location',
        id: locationId,
        operations: [
          {
            op: 'add',
            path: '/extension',
            value: [{ url: SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL, valueString: stripeAccount }],
          },
        ],
      }),
      oystehrAdmin.fhir.patch<Account>({
        resourceType: 'Account',
        id: account.id!,
        operations: [
          {
            op: 'add',
            path: '/identifier',
            value: [
              {
                system: ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE,
                value: stripeCustomerId,
                extension: [{ url: ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE_ACCOUNT, valueString: stripeAccount }],
              },
            ],
          },
        ],
      }),
    ]);

    const now = DateTime.now().toUTC().toISO()!;
    paymentNotice = await oystehrAdmin.fhir.create<PaymentNotice>(
      addProcessIdMetaTagToResource(
        buildPaymentNotice({
          request: { reference: `Encounter/${base.encounter.id}` },
          payee: { display: 'Integration Test Clinic' },
          amountInCents: 1500,
          paymentMethod: 'card-reader',
          identifier: { system: STRIPE_PAYMENT_ID_SYSTEM, value: `pi_it_${randomUUID()}` },
          paymentDate: now.slice(0, 10),
          createdISO: now,
          disposition: 'card-reader collected from patient',
          reconciliation: {
            detail: [{ type: { text: 'payment' }, submitter: { reference: `Practitioner/${practitioner.id}` } }],
          },
        }),
        setup.processId
      ) as PaymentNotice
    );
  }, 60_000);

  afterAll(async () => {
    await Promise.all([
      paymentNotice &&
        oystehrAdmin.fhir
          .delete({ resourceType: 'PaymentNotice', id: paymentNotice.id! })
          .catch((error) => console.warn(error)),
      practitioner &&
        oystehrAdmin.fhir
          .delete({ resourceType: 'Practitioner', id: practitioner.id! })
          .catch((error) => console.warn(error)),
    ]);
    await cleanup();
  });

  it("returns the patient's visit with its schedule owner, named legacy payments and Stripe customers", async () => {
    const { output } = await oystehrZambdas.zambda.execute({
      id: 'get-patient-payment-visits',
      patientId: base.patient.id,
    });
    const { visits, stripeCustomers } = output as GetPatientPaymentVisitsResponse;

    expect(visits).toHaveLength(1);
    const [visit] = visits;
    expect(visit).toMatchObject({
      encounterId: base.encounter.id,
      appointmentId: base.appointment.id,
      visitDateISO: base.appointment.start,
      serviceMode: ServiceMode['in-person'],
      followUp: false,
      locationName: 'Integration Test Location',
      scheduleOwner: { stripeAccount },
    });
    expect(visit.legacyPaymentNotices.map((notice) => notice.id)).toEqual([paymentNotice.id]);
    expect(getPaymentNoticeSubmitterRef(visit.legacyPaymentNotices[0])).toEqual({
      reference: `Practitioner/${practitioner.id}`,
      display: `Payment ${practitioner.name![0].family}`,
    });
    expect(stripeCustomers).toEqual([{ stripeAccount, customerId: stripeCustomerId }]);
  });
});
