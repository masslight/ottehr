import Oystehr, { BatchInputPostRequest, BatchInputRequest } from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { FhirResource, Location, Practitioner, PractitionerRole, Schedule } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  APIErrorCode,
  BOOKING_CONFIG,
  GetScheduleResponse,
  PRACTITIONER_ROLE_ALL_CATEGORIES_EXTENSION_URL,
  SCHEDULE_EXTENSION_URL,
  ServiceMode,
  SLUG_SYSTEM,
  TIMEZONE_EXTENSION_URL,
} from 'utils';
import { afterAll, assert, beforeAll, describe, expect, inject, test } from 'vitest';
import { getAuth0Token } from '../../src/shared';
import { SECRETS } from '../data/secrets';
import { buildSimpleScheduleExt, cleanupTestScheduleResources } from '../helpers/testScheduleUtils';

// Pins the rule "PractitionerRole-owned Schedules never support BOOKING_CONFIG
// (compile-time) service categories." A BOOKING_CONFIG category is identified
// by code only — it has no FHIR HealthcareService to reference — so a PR
// cannot legitimately opt into one via healthcareService[], and the
// `allCategories` toggle's meaning collapses to "every FHIR-backed category."
// Two guards layered:
//   - get-schedule: drops PR-owned entries when the requested serviceCategoryCode
//     resolves to BOOKING_CONFIG, so the patient never sees provider-direct slots
//     for a system category — even with allCategories=true.
//   - create-slot: defense-in-depth that throws INVALID_INPUT_ERROR if a caller
//     hits the zambda directly with a known PR scheduleId + BOOKING_CONFIG code
//     (e.g. the /walkin/schedule/:id URL flow that takes scheduleId from the URL).
//
// Skipped when this deploy's BOOKING_CONFIG has no service categories — without
// a code in BOOKING_CONFIG there's nothing for `isBookingConfigServiceCategoryCode`
// to match against, so the guard can't be exercised.
describe.skipIf(BOOKING_CONFIG.serviceCategories.length === 0)(
  'PractitionerRole + BOOKING_CONFIG category invariant',
  () => {
    let oystehr: Oystehr;
    let token: string | null = null;
    let processId: string | null = null;
    // PR-actored fixtures only get Schedule + its `_include`d actor (the PR)
    // swept by cleanupTestScheduleResources. Practitioner + Location need
    // explicit tracking so they don't leak.
    const extraResourceCleanup: Array<{ resourceType: 'Practitioner' | 'Location'; id: string }> = [];

    beforeAll(async () => {
      processId = randomUUID();
      const { AUTH0_ENDPOINT, AUTH0_CLIENT_TESTS, AUTH0_SECRET_TESTS, AUTH0_AUDIENCE, FHIR_API, PROJECT_ID } = SECRETS;
      const EXECUTE_ZAMBDA_URL = inject('EXECUTE_ZAMBDA_URL');
      expect(EXECUTE_ZAMBDA_URL).toBeDefined();
      token = await getAuth0Token({
        AUTH0_ENDPOINT,
        AUTH0_CLIENT: AUTH0_CLIENT_TESTS,
        AUTH0_SECRET: AUTH0_SECRET_TESTS,
        AUTH0_AUDIENCE,
      });
      oystehr = new Oystehr({
        accessToken: token,
        fhirApiUrl: FHIR_API,
        projectApiUrl: EXECUTE_ZAMBDA_URL,
        services: { zambdaApiUrl: EXECUTE_ZAMBDA_URL },
        projectId: PROJECT_ID,
      });
    });

    afterAll(async () => {
      // No-op when beforeAll didn't complete: if oystehr/processId never got
      // initialized then no tagged fixtures could have been created, so there's
      // nothing to clean up. Throwing here would replace the real beforeAll
      // failure (e.g. auth or env-config issue) with a misleading "oystehr is
      // null" cleanup error in the vitest output.
      if (!oystehr || !processId) return;
      await cleanupTestScheduleResources(processId, oystehr);
      for (const { resourceType, id } of extraResourceCleanup) {
        try {
          await oystehr.fhir.delete({ resourceType, id });
        } catch (e) {
          console.error(`Failed to delete fixture ${resourceType}/${id}:`, e);
        }
      }
    });

    interface PrFixture {
      slug: string;
      location: Location;
      practitioner: Practitioner;
      pr: PractitionerRole;
      schedule: Schedule;
    }

    // PR + Schedule fixture with allCategories=true on the PR — that's the
    // state where the old behavior leaked BOOKING_CONFIG codes through the
    // per-category filter in get-schedule.
    const createPrFixtureWithAllCategories = async (): Promise<PrFixture> => {
      assert(processId);
      const slug = `pr-bc-${randomUUID().slice(0, 8)}`;
      const locationUrn = `urn:uuid:${randomUUID()}`;
      const practitionerUrn = `urn:uuid:${randomUUID()}`;
      const prUrn = `urn:uuid:${randomUUID()}`;
      const tag = { system: 'OTTEHR_AUTOMATED_TEST', code: `DELETE_ME-${processId}` };

      const requests: BatchInputRequest<FhirResource>[] = [
        {
          method: 'POST',
          url: 'Location',
          fullUrl: locationUrn,
          resource: { resourceType: 'Location', status: 'active', name: 'PR BC Location', meta: { tag: [tag] } },
        } as BatchInputPostRequest<Location>,
        {
          method: 'POST',
          url: 'Practitioner',
          fullUrl: practitionerUrn,
          resource: {
            resourceType: 'Practitioner',
            active: true,
            name: [{ family: 'Provider', given: ['BCTest'] }],
            meta: { tag: [tag] },
          },
        } as BatchInputPostRequest<Practitioner>,
        {
          method: 'POST',
          url: 'PractitionerRole',
          fullUrl: prUrn,
          resource: {
            resourceType: 'PractitionerRole',
            active: true,
            practitioner: { reference: practitionerUrn },
            location: [{ reference: locationUrn }],
            identifier: [{ system: SLUG_SYSTEM, value: slug }],
            // The opt-in toggle the old behavior keyed off of — meaning "every
            // category" before this change, now meaning "every FHIR-backed
            // category." Setting it explicitly so the test pins the leak case.
            extension: [{ url: PRACTITIONER_ROLE_ALL_CATEGORIES_EXTENSION_URL, valueBoolean: true }],
            meta: { tag: [tag] },
          },
        } as BatchInputPostRequest<PractitionerRole>,
        {
          method: 'POST',
          url: 'Schedule',
          resource: {
            resourceType: 'Schedule',
            active: true,
            actor: [{ reference: prUrn }],
            extension: [
              { url: TIMEZONE_EXTENSION_URL, valueString: 'America/New_York' },
              { url: SCHEDULE_EXTENSION_URL, valueString: JSON.stringify(buildSimpleScheduleExt()) },
            ],
            meta: { tag: [tag] },
          },
        } as BatchInputPostRequest<Schedule>,
      ];

      const tx = await oystehr.fhir.transaction({ requests });
      const created = (tx.entry ?? []).map((e) => e.resource).filter((r): r is FhirResource => !!r);
      const location = created.find((r): r is Location => r.resourceType === 'Location');
      const practitioner = created.find((r): r is Practitioner => r.resourceType === 'Practitioner');
      const pr = created.find((r): r is PractitionerRole => r.resourceType === 'PractitionerRole');
      const schedule = created.find((r): r is Schedule => r.resourceType === 'Schedule');
      assert(location?.id);
      assert(practitioner?.id);
      assert(pr?.id);
      assert(schedule?.id);
      extraResourceCleanup.push({ resourceType: 'Practitioner', id: practitioner.id });
      extraResourceCleanup.push({ resourceType: 'Location', id: location.id });
      return { slug, location, practitioner, pr, schedule };
    };

    // First BOOKING_CONFIG entry; the describe.skipIf above guarantees the
    // array is non-empty at this point.
    const bookingConfigCode = (): string => BOOKING_CONFIG.serviceCategories[0]!.category.code;

    test('get-schedule: PR-owned schedule does NOT vend slots for a BOOKING_CONFIG category', async () => {
      const fixture = await createPrFixtureWithAllCategories();

      // Positive control: without a category, the provider's schedule is
      // bookable and produces slots. Confirms the fixture is otherwise
      // healthy — so the negative case's empty `available` is the guard
      // firing, not a broken setup.
      const noCategory = (
        await oystehr.zambda.executePublic({
          id: 'get-schedule',
          slug: fixture.slug,
          scheduleType: 'provider',
        })
      ).output as GetScheduleResponse;
      expect(noCategory.available.length).toBeGreaterThan(0);

      // With a BOOKING_CONFIG category: the PR-owned schedule is dropped
      // before slot generation, so the response carries no available slots.
      // (The pre-fix behavior would have returned slots here because the
      // allCategories toggle waved the PR through the per-category filter.)
      const withBookingConfigCategory = (
        await oystehr.zambda.executePublic({
          id: 'get-schedule',
          slug: fixture.slug,
          scheduleType: 'provider',
          serviceCategoryCode: bookingConfigCode(),
        })
      ).output as GetScheduleResponse;
      expect(withBookingConfigCategory.available).toEqual([]);
    });

    test('create-slot: rejects a BOOKING_CONFIG serviceCategoryCode against a PR-owned Schedule', async () => {
      const fixture = await createPrFixtureWithAllCategories();
      assert(fixture.schedule.id);

      // Pick a start time inside the fixture's open hours so the failure
      // mode under test is the category-vs-actor guard, not a slot-time
      // validation. `buildSimpleScheduleExt` opens the schedule wide enough
      // that any near-future weekday afternoon is in-window; using +2 days
      // also avoids weekend/timezone edge cases.
      const startISO = DateTime.now()
        .setZone('America/New_York')
        .plus({ days: 2 })
        .set({ hour: 14, minute: 0 })
        .toISO();
      assert(startISO);

      let caught: unknown;
      try {
        await oystehr.zambda.executePublic({
          id: 'create-slot',
          scheduleId: fixture.schedule.id,
          startISO,
          serviceModality: ServiceMode['in-person'],
          lengthInMinutes: 15,
          status: 'busy-tentative',
          serviceCategoryCode: bookingConfigCode(),
        });
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeDefined();
      const err = caught as { code?: number; message?: string };
      expect(err.code).toBe(APIErrorCode.INVALID_INPUT);
      // The guard's message names the rejected category so the failure mode
      // is recognizable in logs — pin it loosely (substring) so wording
      // tweaks don't break the test.
      expect(err.message ?? '').toContain(bookingConfigCode());
    });
  }
);
