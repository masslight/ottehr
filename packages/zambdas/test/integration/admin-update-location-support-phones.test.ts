import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Location } from 'fhir/r4b';
import { LOCATION_SUPPORT_PHONE_EXTENSION_URL, M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for admin-update-location-support-phones: set a support phone
// number on a Location (stored as an extension on the Location itself, not on
// shared config). Uses a throwaway Location so no shared state is touched.
describe('admin-update-location-support-phones integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let cleanup: () => Promise<void>;
  let locationId: string;

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'admin-update-location-support-phones.test.ts',
      M2MClientMockType.provider
    );
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    const location = await oystehrAdmin.fhir.create<Location>(
      addProcessIdMetaTagToResource(
        { resourceType: 'Location', status: 'active', name: `Support Phone Loc ${randomUUID().slice(0, 8)}` },
        setup.processId
      ) as Location
    );
    locationId = location.id!;
  }, 60_000);

  afterAll(async () => {
    try {
      await oystehrAdmin.fhir.delete({ resourceType: 'Location', id: locationId });
    } catch {
      // best-effort
    }
    await cleanup();
  });

  it('sets a support phone number on a location', async () => {
    const phoneNumber = '+12125551234';
    // Update returns 204 (SDK resolves null); assert the effect on the Location.
    await oystehrZambdas.zambda.execute({
      id: 'admin-update-location-support-phones',
      updates: [{ locationId, phoneNumber }],
    });
    const updated = await oystehrAdmin.fhir.get<Location>({ resourceType: 'Location', id: locationId });
    const ext = (updated.extension ?? []).find((e) => e.url === LOCATION_SUPPORT_PHONE_EXTENSION_URL);
    expect(ext?.valueString).toBe(phoneNumber);
  });
});
