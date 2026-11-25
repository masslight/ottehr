import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Device, Location } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import {
  SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL,
  STRIPE_TERMINAL_LOCATION_DEVICE_TYPE_CODE,
  STRIPE_TERMINAL_LOCATION_DEVICE_TYPE_SYSTEM,
  STRIPE_TERMINAL_LOCATION_IDENTIFIER_SYSTEM,
} from 'utils/lib/fhir/constants';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { GetPatientPaymentTerminalConfigResponse } from 'utils/lib/types/api/patient-payment-types';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { index } from '../../src/ehr/patient-payments/terminal/get-config/index';
import {
  addProcessIdMetaTagToResource,
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';
import { invokeZambdaHandler } from '../helpers/invoke-zambda-handler';

vi.hoisted(() => vi.resetModules());

const stripe = vi.hoisted(() => ({ terminal: { readers: { list: vi.fn() } } }));

vi.mock('../../src/shared/stripeIntegration', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/shared/stripeIntegration')>()),
  getStripeClient: () => stripe,
}));

describe('patient-payments-terminal-get-config integration', () => {
  let oystehr: Oystehr;
  let token: string;
  let cleanup: () => Promise<void>;
  let base: InsertFullAppointmentDataBaseResult;
  let device: Device;
  const stripeAccount = `acct_it_${randomUUID().slice(0, 8)}`;
  const terminalLocationId = `tml_it_${randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'patient-payments-terminal-get-config.test.ts',
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

  it("lists the online readers at the encounter location's terminal location", async () => {
    stripe.terminal.readers.list.mockResolvedValueOnce({
      data: [{ id: 'tmr_it_front_desk', label: 'Front desk', device_type: 'bbpos_wisepos_e', status: 'online' }],
    });

    const { statusCode, output } = await invokeZambdaHandler<GetPatientPaymentTerminalConfigResponse>(
      index,
      { encounterId: base.encounter.id },
      { token }
    );

    expect(statusCode).toBe(200);
    expect(stripe.terminal.readers.list).toHaveBeenCalledWith(
      { location: terminalLocationId, limit: 100, status: 'online' },
      { stripeAccount }
    );
    expect(output).toEqual({
      terminalConfigured: true,
      terminalLocationId,
      terminalSimulatorMode: false,
      readers: [
        {
          id: 'tmr_it_front_desk',
          label: 'Front desk',
          deviceType: 'bbpos_wisepos_e',
          status: 'online',
          simulated: false,
        },
      ],
    });
  });
});
