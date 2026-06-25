import Oystehr, { BatchInputPostRequest, BatchInputRequest } from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Appointment, FhirResource, Location, Schedule, Slot } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  BOOKING_CONFIG,
  CreateAppointmentResponse,
  PatientInfo,
  SCHEDULE_EXTENSION_URL,
  SERVICE_CATEGORY_SYSTEM,
  ServiceMode,
  SlotServiceCategory,
  SLUG_SYSTEM,
  TIMEZONE_EXTENSION_URL,
} from 'utils';
import { afterAll, assert, beforeAll, describe, expect, inject, test } from 'vitest';
import { getAuth0Token } from '../../src/shared';
import { SECRETS } from '../data/secrets';
import { buildSimpleScheduleExt, cleanupTestScheduleResources, makeTestPatient } from '../helpers/testScheduleUtils';

// Pins the invariant "every persisted Slot — and therefore every created
// Appointment — must carry a SERVICE_CATEGORY_SYSTEM coding." Both zambdas in
// the booking write path enforce it with matching back-compat defaulting:
//
//   - create-slot: when no serviceCategoryCode is provided, falls back in
//     order to (a) the single-BOOKING_CONFIG-project default, then (b) the
//     urgent-care fallback if BOOKING_CONFIG includes it. Only refuses when
//     all three sources turn up nothing — a malformed config that has to
//     fail loudly rather than fabricate. The urgent-care fallback keeps the
//     patient flow uninterrupted; surfacing "pick a service category"
//     mid-booking is meaningless to the patient and a poor UX.
//   - create-appointment: same urgent-care back-compat for legacy Slots
//     already in FHIR that pre-date the create-slot fallbacks, or that were
//     written via raw FHIR. When the incoming Slot lacks a
//     SERVICE_CATEGORY_SYSTEM coding, the validator stamps urgent-care on
//     the in-memory slot so the derived Appointment isn't ambiguous.
//
// Catches the production bug observed at
// `/prebook/in-person?bookingOn=Commack-NY&scheduleType=location` — slots
// were vending and Appointments were being created with no service category
// coding because no URL param forced a choice and the back-end fallback only
// fired for single-BOOKING_CONFIG projects.
const hasUrgentCare = BOOKING_CONFIG.serviceCategories.some((sc) => sc.category.code === 'urgent-care');
const multiCategorySystem = BOOKING_CONFIG.serviceCategories.length >= 2;

describe('Appointment service category invariant', () => {
  let oystehr: Oystehr;
  let token: string | null = null;
  let processId: string | null = null;
  // Location-actored fixtures: cleanupTestScheduleResources sweeps the Schedule
  // and its `_include`d Location actor, so no extra resource tracking is
  // needed for Location/Schedule. The back-compat test additionally creates
  // a Slot via raw FHIR (to bypass create-slot's guard); track it explicitly
  // so cleanup catches it independent of any create-appointment fanout.
  const extraSlotIds: string[] = [];
  const extraAppointmentIds: string[] = [];

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
    // No-op cleanup if beforeAll didn't complete — avoid masking the real
    // setup failure with a misleading "oystehr is null" error in vitest.
    if (!oystehr || !processId) return;
    for (const id of extraAppointmentIds) {
      try {
        await oystehr.fhir.delete({ resourceType: 'Appointment', id });
      } catch {
        // best-effort
      }
    }
    for (const id of extraSlotIds) {
      try {
        await oystehr.fhir.delete({ resourceType: 'Slot', id });
      } catch {
        // best-effort
      }
    }
    await cleanupTestScheduleResources(processId, oystehr);
  });

  interface LocationFixture {
    slug: string;
    location: Location;
    schedule: Schedule;
  }

  // Location + Schedule via a single transaction. Schedule extension uses
  // buildSimpleScheduleExt() which opens 9–17 every day; tests pick slot
  // start times comfortably inside that window.
  const createLocationFixture = async (): Promise<LocationFixture> => {
    assert(processId);
    const slug = `svc-cat-inv-${randomUUID().slice(0, 8)}`;
    const locationUrn = `urn:uuid:${randomUUID()}`;
    const tag = { system: 'OTTEHR_AUTOMATED_TEST', code: `DELETE_ME-${processId}` };

    const requests: BatchInputRequest<FhirResource>[] = [
      {
        method: 'POST',
        url: 'Location',
        fullUrl: locationUrn,
        resource: {
          resourceType: 'Location',
          status: 'active',
          name: 'Svc Cat Invariant Location',
          identifier: [{ system: SLUG_SYSTEM, value: slug }],
          meta: { tag: [tag] },
        },
      } as BatchInputPostRequest<Location>,
      {
        method: 'POST',
        url: 'Schedule',
        resource: {
          resourceType: 'Schedule',
          active: true,
          actor: [{ reference: locationUrn }],
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
    const schedule = created.find((r): r is Schedule => r.resourceType === 'Schedule');
    assert(location?.id);
    assert(schedule?.id);
    return { slug, location, schedule };
  };

  // Slot start time inside the schedule's open window (9–17), positioned a
  // couple days ahead so create-slot's past-time guard doesn't trip and
  // capacity isn't contested.
  const futureSlotStart = (): string => {
    const start = DateTime.now().setZone('America/New_York').plus({ days: 2 }).set({ hour: 14, minute: 0 });
    const iso = start.toISO();
    assert(iso);
    return iso;
  };

  // -------- create-slot invariant --------

  // Only meaningful on multi-category systems that include urgent-care: in
  // single-category projects the single-BOOKING_CONFIG-default branch fires
  // before the urgent-care fallback can be exercised, so the "no code +
  // urgent-care defaulted" path can't be observed. Skipping keeps the test
  // honest under any configuration without hiding bugs.
  describe.skipIf(!multiCategorySystem || !hasUrgentCare)(
    'create-slot — multi-category system with urgent-care available',
    () => {
      test('defaults to urgent-care when no serviceCategoryCode is provided', async () => {
        // Reproduces the production scenario behind the Commack-NY URL:
        // /prebook/in-person?bookingOn=loc&scheduleType=location with no
        // serviceCategory param. Pre-fix, the patient saw an "Error reserving
        // time / pick a service category" dialog mid-flow. Post-fix, the
        // server quietly defaults to urgent-care so the booking proceeds and
        // the persisted Slot is well-formed.
        const fixture = await createLocationFixture();
        assert(fixture.schedule.id);

        const persistedSlot = (
          await oystehr.zambda.executePublic({
            id: 'create-slot',
            scheduleId: fixture.schedule.id,
            startISO: futureSlotStart(),
            serviceModality: ServiceMode['in-person'],
            lengthInMinutes: 15,
            status: 'busy-tentative',
          })
        ).output as Slot;
        assert(persistedSlot?.id);
        extraSlotIds.push(persistedSlot.id);

        const urgentCareCoding = (persistedSlot.serviceCategory ?? [])
          .flatMap((cc) => cc.coding ?? [])
          .find((c) => c.system === SERVICE_CATEGORY_SYSTEM && c.code === 'urgent-care');
        expect(urgentCareCoding).toBeDefined();
      });

      test('forwards an explicit serviceCategoryCode when provided (positive control)', async () => {
        const fixture = await createLocationFixture();
        assert(fixture.schedule.id);

        const persistedSlot = (
          await oystehr.zambda.executePublic({
            id: 'create-slot',
            scheduleId: fixture.schedule.id,
            startISO: futureSlotStart(),
            serviceModality: ServiceMode['in-person'],
            lengthInMinutes: 15,
            status: 'busy-tentative',
            serviceCategoryCode: 'urgent-care',
          })
        ).output as Slot;
        assert(persistedSlot?.id);
        extraSlotIds.push(persistedSlot.id);

        // Persisted Slot must carry a SERVICE_CATEGORY_SYSTEM coding for
        // the requested code — guards against any future change that drops
        // the stamping when an explicit code is provided.
        const hasCategoryCoding = (persistedSlot.serviceCategory ?? []).some((cc) =>
          (cc.coding ?? []).some((c) => c.system === SERVICE_CATEGORY_SYSTEM && c.code === 'urgent-care')
        );
        expect(hasCategoryCoding).toBe(true);
      });
    }
  );

  // -------- create-appointment back-compat default --------

  // Requires urgent-care in BOOKING_CONFIG (that's the system-wide default
  // create-appointment falls back to). All deployed customers carry it
  // today; the skip just keeps the test honest in any future project that
  // doesn't.
  describe.skipIf(!hasUrgentCare)('create-appointment — back-compat default for legacy slots', () => {
    test('stamps urgent-care on an Appointment whose source Slot has no service-category coding', async () => {
      const fixture = await createLocationFixture();
      assert(fixture.schedule.id);
      assert(processId);
      const tag = { system: 'OTTEHR_AUTOMATED_TEST', code: `DELETE_ME-${processId}` };

      // Plant a "legacy" Slot directly with raw FHIR — bypasses the
      // create-slot invariant guard so we can simulate a Slot persisted
      // before the guard landed. serviceCategory carries only the
      // service-mode coding; no SERVICE_CATEGORY_SYSTEM coding present.
      const startISO = futureSlotStart();
      const startDt = DateTime.fromISO(startISO, { setZone: true });
      const endISO = startDt.plus({ minutes: 15 }).toISO();
      assert(endISO);
      const legacySlot = await oystehr.fhir.create<Slot>({
        resourceType: 'Slot',
        status: 'busy-tentative',
        start: startISO,
        end: endISO,
        schedule: { reference: `Schedule/${fixture.schedule.id}` },
        serviceCategory: [SlotServiceCategory.inPersonServiceMode],
        meta: { tag: [tag] },
      });
      assert(legacySlot.id);
      extraSlotIds.push(legacySlot.id);

      const newPatient = makeTestPatient();
      const patientInfo: PatientInfo = {
        firstName: newPatient.name![0]!.given![0],
        lastName: newPatient.name![0]!.family,
        sex: 'female',
        dateOfBirth: newPatient.birthDate,
        newPatient: true,
        phoneNumber: '+12027139680',
        email: `svc-cat-invariant-${randomUUID()}@example.com`,
        tags: [tag],
      };

      const createApptResponse = (
        await oystehr.zambda.execute({
          id: 'create-appointment',
          patient: patientInfo,
          slotId: legacySlot.id,
        })
      ).output as CreateAppointmentResponse;
      assert(createApptResponse?.appointmentId);
      extraAppointmentIds.push(createApptResponse.appointmentId);

      // The Appointment derived from this categoryless Slot must carry the
      // urgent-care fallback — that's the back-compat default. Reading the
      // Appointment from the response (rather than the FHIR write path) so
      // the test isolates the validator's stamping behavior from any
      // downstream consumer that might re-derive category.
      const appointment = createApptResponse.resources.appointment as Appointment;
      const apptCategoryCoding = (appointment.serviceCategory ?? []).flatMap((cc) => cc.coding ?? []);
      const urgentCareEntry = apptCategoryCoding.find(
        (c) => c.system === SERVICE_CATEGORY_SYSTEM && c.code === 'urgent-care'
      );
      expect(urgentCareEntry).toBeDefined();
    });
  });
});
