import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { HealthcareService, Location, Schedule } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  getScheduleExtension,
  GetScheduleResponse,
  getSlugForBookableResource,
  getTimezone,
  ScheduleOwnerFhirResource,
  SERVICE_CATEGORY_SYSTEM,
  SERVICE_CATEGORY_TAG,
  serviceCategoryCharacteristics,
  ServiceMode,
  ServiceVisitType,
  SLUG_SYSTEM,
} from 'utils';
import { afterAll, assert, beforeAll, describe, expect, inject, test } from 'vitest';
import { createClinicalOystehrClient, getAuth0Token } from '../../src/shared';
import { SECRETS } from '../data/secrets';
import {
  buildSimpleScheduleExt,
  cleanupTestScheduleResources,
  persistSchedule,
  startOfDayWithTimezone,
  tagForProcessId,
} from '../helpers/testScheduleUtils';

// End-to-end verification that a `service-category-cadence-minutes`
// characteristic configured on a FHIR-tagged HealthcareService actually
// reaches the slot generator inside the get-schedule zambda. The unit
// tests in packages/utils pin the slot-generator's cadence behavior;
// this test pins the plumbing — write the characteristic, hit the live
// endpoint, observe slot start times.
//
// Uses a unique synthetic category code per test run so the lookup goes
// through the FHIR-catalogue branch (not the BOOKING_CONFIG-wins branch
// that intentionally ignores cadence).
describe('get-schedule cadence plumbing', () => {
  let oystehr: Oystehr;
  let token: string | null = null;
  let processId: string | null = null;
  const createdHealthcareServiceIds: string[] = [];

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
    oystehr = createClinicalOystehrClient(
      token,
      {},
      {
        services: {
          fhirApiUrl: FHIR_API,
          projectApiUrl: EXECUTE_ZAMBDA_URL,
          zambdaApiUrl: EXECUTE_ZAMBDA_URL,
        },
        projectId: PROJECT_ID,
      }
    );
  });

  afterAll(async () => {
    if (!oystehr || !processId) {
      throw new Error('oystehr or processId is null! could not clean up!');
    }
    await cleanupTestScheduleResources(processId, oystehr);
    // cleanupTestScheduleResources doesn't reach HealthcareService records;
    // delete the per-test fixture HSs explicitly.
    for (const id of createdHealthcareServiceIds) {
      try {
        await oystehr.fhir.delete({ resourceType: 'HealthcareService', id });
      } catch (e) {
        console.error(`Failed to delete fixture HealthcareService/${id}:`, e);
      }
    }
  });

  const setUpLocationAndSchedule = async (): Promise<{
    schedule: Schedule;
    slug: string;
    scheduleOwnerType: ScheduleOwnerFhirResource['resourceType'];
  }> => {
    expect(oystehr).toBeDefined();
    // 24/7 open with one provider on shift every hour. Sidesteps the legacy
    // `capacity` field's `/4` semantic that `changeAllCapacities(_, 1)`
    // would trigger — which yields 0 bookings/hour for 90-min visits and
    // makes this test fail silently regardless of time of day.
    const adjustedScheduleJSON = buildSimpleScheduleExt();

    const ownerLocation: Location = {
      resourceType: 'Location',
      status: 'active',
      name: 'CadencePlumbingTestLocation',
      identifier: [{ system: SLUG_SYSTEM, value: `cadence-test-loc-${randomUUID()}` }],
      address: {
        use: 'work',
        type: 'physical',
        line: ['1 Test St'],
        city: 'Test City',
        state: 'Test State',
        postalCode: '12345',
      },
    };

    const { schedule, owner } = await persistSchedule(
      { scheduleExtension: adjustedScheduleJSON, processId, scheduleOwner: ownerLocation },
      oystehr
    );
    assert(schedule.id);
    const scheduleExt = getScheduleExtension(schedule);
    assert(scheduleExt);
    assert(owner);
    const slug = getSlugForBookableResource(owner);
    assert(slug);
    return { schedule, slug, scheduleOwnerType: owner.resourceType };
  };

  const createCategoryHS = async (input: {
    code: string;
    durationMinutes: number;
    cadenceMinutes?: number;
  }): Promise<HealthcareService> => {
    const persisted = await oystehr.fhir.create<HealthcareService>({
      resourceType: 'HealthcareService',
      active: true,
      name: input.code,
      meta: {
        tag: [
          { system: SERVICE_CATEGORY_TAG.system, code: SERVICE_CATEGORY_TAG.code },
          { system: 'OTTEHR_AUTOMATED_TEST', code: tagForProcessId(processId!) },
        ],
      },
      type: [{ coding: [{ system: SERVICE_CATEGORY_SYSTEM, code: input.code }], text: input.code }],
      characteristic: serviceCategoryCharacteristics({
        modes: [ServiceMode['in-person']],
        visitTypes: [ServiceVisitType.prebook],
        durationMinutes: input.durationMinutes,
        cadenceMinutes: input.cadenceMinutes,
      }),
    });
    assert(persisted.id);
    createdHealthcareServiceIds.push(persisted.id);
    return persisted;
  };

  test('cadence=15 on a FHIR-tagged 90-minute service is honored: vended slots are 15 min apart, not the gcd-default 30', async () => {
    assert(processId);
    const { schedule, slug } = await setUpLocationAndSchedule();

    // Unique code per run to dodge any BOOKING_CONFIG collision; the
    // BOOKING_CONFIG-first precedence in get-schedule would shadow this
    // category's cadence if the code happened to match a compiled-in entry.
    const uniqueCode = `cadence-plumbing-test-${randomUUID().slice(0, 8)}`;
    await createCategoryHS({ code: uniqueCode, durationMinutes: 90, cadenceMinutes: 15 });

    const timezone = getTimezone(schedule);
    const selectedDate = startOfDayWithTimezone({ timezone }).toISODate();

    const response = (
      await oystehr.zambda.executePublic({
        id: 'get-schedule',
        slug,
        scheduleType: 'location',
        serviceCategoryCode: uniqueCode,
        selectedDate,
      })
    ).output as GetScheduleResponse;

    expect(response).toBeDefined();
    expect(response.available.length).toBeGreaterThanOrEqual(2);

    // Sort slot starts and take the first two consecutive ones — under
    // honored cadence=15 the delta is 15 min; under the gcd fallback for
    // a 90-min slot the delta would be 30 min. This is the bug signal.
    const starts = response.available
      .map((sli) => DateTime.fromISO(sli.slot.start))
      .sort((a, b) => a.toMillis() - b.toMillis());
    const firstDeltaMinutes = starts[1].diff(starts[0], 'minutes').minutes;
    expect(firstDeltaMinutes).toBe(15);

    // And the slot length itself should be 90 min — the durationMinutes
    // characteristic should also have plumbed through.
    const firstSlot = response.available[0].slot;
    const slotDurationMin =
      (DateTime.fromISO(firstSlot.end).toMillis() - DateTime.fromISO(firstSlot.start).toMillis()) / 60000;
    expect(slotDurationMin).toBe(90);
  });

  test('no cadence characteristic on a FHIR-tagged 90-minute service: vended slots fall back to gcd(90,60) = 30 min apart', async () => {
    assert(processId);
    const { schedule, slug } = await setUpLocationAndSchedule();

    const uniqueCode = `cadence-default-test-${randomUUID().slice(0, 8)}`;
    await createCategoryHS({ code: uniqueCode, durationMinutes: 90 /* cadenceMinutes omitted */ });

    const timezone = getTimezone(schedule);
    const selectedDate = startOfDayWithTimezone({ timezone }).toISODate();

    const response = (
      await oystehr.zambda.executePublic({
        id: 'get-schedule',
        slug,
        scheduleType: 'location',
        serviceCategoryCode: uniqueCode,
        selectedDate,
      })
    ).output as GetScheduleResponse;

    expect(response).toBeDefined();
    expect(response.available.length).toBeGreaterThanOrEqual(2);

    const starts = response.available
      .map((sli) => DateTime.fromISO(sli.slot.start))
      .sort((a, b) => a.toMillis() - b.toMillis());
    const firstDeltaMinutes = starts[1].diff(starts[0], 'minutes').minutes;
    expect(firstDeltaMinutes).toBe(30);
  });
});
