import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Account, Device, Location } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import {
  ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE,
  ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE_ACCOUNT,
  SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL,
  STRIPE_TERMINAL_LOCATION_DEVICE_TYPE_CODE,
  STRIPE_TERMINAL_LOCATION_DEVICE_TYPE_SYSTEM,
  STRIPE_TERMINAL_LOCATION_IDENTIFIER_SYSTEM,
} from 'utils/lib/fhir/constants';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { InitiatePatientPaymentTerminalResponse } from 'utils/lib/types/api/patient-payment-types';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { index } from '../../src/ehr/patient-payments/terminal/initiate-payment/index';
import { stripeEncounterMetadata } from '../../src/shared/stripeIntegration';
import {
  addProcessIdMetaTagToResource,
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';
import { invokeZambdaHandler } from '../helpers/invoke-zambda-handler';

vi.hoisted(() => vi.resetModules());

const stripe = vi.hoisted(() => ({
  terminal: { readers: { retrieve: vi.fn(), processPaymentIntent: vi.fn() } },
  paymentIntents: { create: vi.fn() },
}));

vi.mock('../../src/shared/stripeIntegration', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/shared/stripeIntegration')>()),
  getStripeClient: () => stripe,
}));

describe('patient-payments-terminal-initiate-payment integration', () => {
  let oystehr: Oystehr;
  let token: string;
  let cleanup: () => Promise<void>;
  let base: InsertFullAppointmentDataBaseResult;
  let device: Device;
  const stripeAccount = `acct_it_${randomUUID().slice(0, 8)}`;
  const stripeCustomerId = `cus_it_${randomUUID().slice(0, 8)}`;
  const terminalLocationId = `tml_it_${randomUUID().slice(0, 8)}`;
  const readerId = `tmr_it_${randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'patient-payments-terminal-initiate-payment.test.ts',
      M2MClientMockType.provider
    );
    oystehr = setup.oystehr;
    token = setup.testUserM2MToken;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(oystehr, setup.processId);

    const locationId = getIdFromReference(base.encounter.location?.[0]?.location?.reference, 'Location')!;
    await oystehr.fhir.patch<Location>({
      resourceType: 'Location',
      id: locationId,
      operations: [
        {
          op: 'add',
          path: '/extension',
          value: [{ url: SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL, valueString: stripeAccount }],
        },
      ],
    });
    const [account] = (
      await oystehr.fhir.search<Account>({
        resourceType: 'Account',
        params: [{ name: 'patient', value: `Patient/${base.patient.id}` }],
      })
    ).unbundle();
    await oystehr.fhir.patch<Account>({
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
    });
    device = await oystehr.fhir.create<Device>(
      addProcessIdMetaTagToResource(
        {
          resourceType: 'Device',
          status: 'active',
          type: {
            coding: [
              { system: STRIPE_TERMINAL_LOCATION_DEVICE_TYPE_SYSTEM, code: STRIPE_TERMINAL_LOCATION_DEVICE_TYPE_CODE },
            ],
          },
          location: { reference: `Location/${locationId}` },
          identifier: [{ system: STRIPE_TERMINAL_LOCATION_IDENTIFIER_SYSTEM, value: terminalLocationId }],
        },
        setup.processId
      ) as Device
    );
  }, 60_000);

  afterAll(async () => {
    if (device?.id) await oystehr.fhir.delete({ resourceType: 'Device', id: device.id }).catch(() => undefined);
    await cleanup();
  });

  it("charges the patient's Stripe customer on a reader at the encounter's terminal location", async () => {
    stripe.terminal.readers.retrieve.mockResolvedValueOnce({
      id: readerId,
      device_type: 'bbpos_wisepos_e',
      location: terminalLocationId,
    });
    stripe.paymentIntents.create.mockResolvedValueOnce({ id: 'pi_it_terminal' });
    stripe.terminal.readers.processPaymentIntent.mockResolvedValueOnce({
      id: readerId,
      action: { status: 'in_progress' },
    });

    const { statusCode, output } = await invokeZambdaHandler<InitiatePatientPaymentTerminalResponse>(
      index,
      { patientId: base.patient.id, encounterId: base.encounter.id, amountInCents: 2500, readerId },
      { token }
    );

    expect(statusCode).toBe(200);
    expect(output).toEqual({ paymentIntentId: 'pi_it_terminal', readerId, readerActionStatus: 'in_progress' });
    expect(stripe.terminal.readers.retrieve).toHaveBeenCalledWith(readerId, { stripeAccount });
    expect(stripe.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 2500,
        currency: 'usd',
        customer: stripeCustomerId,
        payment_method_types: ['card_present'],
        metadata: stripeEncounterMetadata({ encounterId: base.encounter.id!, patientId: base.patient.id! }),
      }),
      { stripeAccount }
    );
    expect(stripe.terminal.readers.processPaymentIntent).toHaveBeenCalledWith(
      readerId,
      { payment_intent: 'pi_it_terminal' },
      { stripeAccount }
    );
  });
});
