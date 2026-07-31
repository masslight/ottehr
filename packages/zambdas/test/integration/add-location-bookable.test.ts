import Oystehr from '@oystehr/sdk';
import { Location } from 'fhir/r4b';
import {
  isValidSlug,
  LOCATION_FORM_EXTENSION_URL,
  LOCATION_IN_PERSON_CODE,
  LOCATION_MANUALLY_CREATED_EXTENSION_URL,
  LOCATION_PHYSICAL_TYPE_SYSTEM,
  M2MClientMockType,
  SLUG_SYSTEM,
  slugFromName,
  TIMEZONE_EXTENSION_URL,
  TIMEZONES,
} from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Regression guard for OTR-2884: the EHR "Add location" page used to create a
// bare `{ resourceType: 'Location', name }`, which stayed invisible to patients
// (no status → inactive, no slug, no address). AddSchedulePage now creates a
// fully-formed, in-person, active Location with a slug derived from the name.
//
// This exercises the real end-to-end contract: create a Location exactly as the
// Add flow does (plus the address the admin fills in on the Location tab), then
// assert it surfaces in the patient-facing list-bookables zambda — and that a
// bare Location (the old behavior) does NOT.
describe('add-location → patient bookability integration', () => {
  let oystehr: Oystehr; // admin FHIR client — creates and cleans up resources
  let oystehrPatient: Oystehr; // patient M2M client — calls the public zambda
  let cleanup: () => Promise<void>;

  const suffix = `${Date.now()}`;
  const fullLocationName = `Add Location Full ${suffix}`;
  const fullLocationSlug = slugFromName(fullLocationName);
  let fullLocationId: string | undefined;
  let bareLocationId: string | undefined;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('add-location-bookable.test.ts', M2MClientMockType.patient);
    oystehr = setup.oystehr;
    oystehrPatient = setup.oystehrTestUserM2M;
    const processId = setup.processId;

    // Sanity: the slug the Add flow would derive from this name must be valid,
    // otherwise the rest of the assertions are meaningless.
    expect(isValidSlug(fullLocationSlug)).toBe(true);

    // A Location built exactly like AddSchedulePage builds it: active, in-person
    // coding, timezone, slug, and the manually-created marker — PLUS an address
    // (city required by the in-person booking search `address-city:missing=false`,
    // configured by the admin on the Location tab after creation).
    const fullLocation = (await oystehr.fhir.create<Location>(
      addProcessIdMetaTagToResource(
        {
          resourceType: 'Location',
          name: fullLocationName,
          status: 'active',
          address: { city: `Testville ${suffix}`, state: 'NY' },
          identifier: [{ system: SLUG_SYSTEM, value: fullLocationSlug }],
          extension: [
            { url: TIMEZONE_EXTENSION_URL, valueString: TIMEZONES[0] },
            {
              url: LOCATION_FORM_EXTENSION_URL,
              valueCoding: {
                system: LOCATION_PHYSICAL_TYPE_SYSTEM,
                code: LOCATION_IN_PERSON_CODE,
                display: 'In Person',
              },
            },
            { url: LOCATION_MANUALLY_CREATED_EXTENSION_URL, valueBoolean: true },
          ],
        } as Location,
        processId
      ) as Location
    )) as Location;
    fullLocationId = fullLocation.id;

    // The old "Add location" output: bare Location with only resourceType + name.
    // No status, slug, or address — must not reach patients.
    const bareLocation = (await oystehr.fhir.create<Location>(
      addProcessIdMetaTagToResource(
        { resourceType: 'Location', name: `Add Location Bare ${suffix}` } as Location,
        processId
      ) as Location
    )) as Location;
    bareLocationId = bareLocation.id;

    // cleanAppointmentGraph (setup.cleanup) does not delete standalone Locations,
    // so delete them explicitly here to keep the suite-wide leak gate green.
    cleanup = async (): Promise<void> => {
      for (const id of [fullLocationId, bareLocationId]) {
        if (!id) continue;
        try {
          await oystehr.fhir.delete({ resourceType: 'Location', id });
        } catch (e) {
          console.error(`[add-location-bookable] failed to delete Location/${id}: ${e}`);
        }
      }
      await setup.cleanup();
    };
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('offers a fully-formed manually-created Location to patients (in-person)', async () => {
    const response = await oystehrPatient.zambda.executePublic({ id: 'list-bookables', serviceMode: 'in-person' });
    const output = response.output as { items: Array<{ resourceId: string; slug: string; resourceType: string }> };
    const match = output.items.find((item) => item.resourceId === fullLocationId);
    expect(match).toBeDefined();
    expect(match?.resourceType).toBe('Location');
    expect(match?.slug).toBe(fullLocationSlug);
  });

  it('does NOT offer a bare Location (old add-flow output) to patients', async () => {
    const response = await oystehrPatient.zambda.executePublic({ id: 'list-bookables', serviceMode: 'in-person' });
    const output = response.output as { items: Array<{ resourceId: string }> };
    expect(output.items.some((item) => item.resourceId === bareLocationId)).toBe(false);
  });
});
