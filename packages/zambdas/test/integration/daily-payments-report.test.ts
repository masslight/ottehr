import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { PaymentNotice } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { DailyPaymentsReportZambdaOutput } from 'utils/lib/types/api/daily-payments-report.types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildPaymentNotice, claimRequestFor, MANUAL_PAYMENT_IDEMPOTENCY_KEY_SYSTEM } from '../../src/billing/payments';
import { STRIPE_PAYMENT_ID_SYSTEM } from '../../src/shared/stripeIntegration';
import {
  addProcessIdMetaTagToResource,
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

describe('daily-payments-report integration', () => {
  let oystehrAdmin: Oystehr;
  let oystehrBilling: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let base: InsertFullAppointmentDataBaseResult;
  let locationId: string;
  let billingNotice: PaymentNotice;
  let legacyNotice: PaymentNotice;
  const now = DateTime.now().toUTC();

  beforeAll(async () => {
    const setup = await setupIntegrationTest('daily-payments-report.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrBilling = setup.oystehrBilling;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
    locationId = getIdFromReference(
      base.appointment.participant.find((participant) => participant.actor?.reference?.startsWith('Location/'))?.actor
        ?.reference,
      'Location'
    )!;

    const createdISO = now.toISO()!;
    const paymentDate = now.toISODate()!;
    [billingNotice, legacyNotice] = await Promise.all([
      oystehrBilling.fhir.create<PaymentNotice>(
        addProcessIdMetaTagToResource(
          buildPaymentNotice({
            request: claimRequestFor(undefined, base.encounter.id!),
            payee: { display: 'Integration Test Clinic' },
            amountInCents: 2500,
            paymentMethod: 'cash',
            identifier: { system: MANUAL_PAYMENT_IDEMPOTENCY_KEY_SYSTEM, value: randomUUID() },
            paymentDate,
            createdISO,
            disposition: 'cash payment collected manually',
          }),
          setup.processId
        ) as PaymentNotice
      ),
      oystehrAdmin.fhir.create<PaymentNotice>(
        addProcessIdMetaTagToResource(
          buildPaymentNotice({
            request: { reference: `Encounter/${base.encounter.id}` },
            payee: { display: 'Integration Test Clinic' },
            amountInCents: 1000,
            paymentMethod: 'card-reader',
            identifier: { system: STRIPE_PAYMENT_ID_SYSTEM, value: `pi_it_${randomUUID()}` },
            paymentDate,
            createdISO,
            disposition: 'card-reader collected from patient',
          }),
          setup.processId
        ) as PaymentNotice
      ),
    ]);
  }, 60_000);

  afterAll(async () => {
    await Promise.all([
      billingNotice &&
        oystehrBilling.fhir
          .delete({ resourceType: 'PaymentNotice', id: billingNotice.id! })
          .catch((error) => console.warn(error)),
      legacyNotice &&
        oystehrAdmin.fhir
          .delete({ resourceType: 'PaymentNotice', id: legacyNotice.id! })
          .catch((error) => console.warn(error)),
    ]);
    await cleanup();
  });

  it("reports the location's billing and legacy EHR payments in the date range, grouped by method", async () => {
    const { output } = await oystehrZambdas.zambda.execute({
      id: 'daily-payments-report',
      dateRange: { start: now.minus({ minutes: 10 }).toISO(), end: now.plus({ minutes: 10 }).toISO() },
      locationId,
    });
    const report = output as DailyPaymentsReportZambdaOutput;

    expect(report).toMatchObject({ totalAmount: 35, totalTransactions: 2, currencies: ['USD'] });
    expect(report.paymentMethods).toEqual([
      expect.objectContaining({
        paymentMethod: 'card-reader',
        totalAmount: 10,
        transactionCount: 1,
        payments: [expect.objectContaining({ id: legacyNotice.id, amount: 10, currency: 'USD' })],
      }),
      expect.objectContaining({
        paymentMethod: 'cash',
        totalAmount: 25,
        transactionCount: 1,
        payments: [expect.objectContaining({ id: billingNotice.id, amount: 25, currency: 'USD' })],
      }),
    ]);
  });
});
