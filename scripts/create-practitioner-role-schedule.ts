/**
 * Test-data helper: creates a PractitionerRole and a Schedule whose actor is
 * that PractitionerRole, so the new PractitionerRole-as-schedule-actor flow
 * can be exercised end-to-end without the provider admin UI (Phase 2) yet.
 *
 * Usage:
 *   npx env-cmd -f apps/ehr/env/tests.local.json npx tsx scripts/create-practitioner-role-schedule.ts \
 *     --practitioner <practitioner-id> \
 *     --location <location-id> \
 *     --categories <category-code>,<category-code> \
 *     [--group <group-healthcareservice-id>]
 *
 * What it does:
 *   1. Finds (or reuses) a PractitionerRole for the given (practitioner, location).
 *   2. Sets PractitionerRole.healthcareService[] to the HealthcareService resources
 *      that are tagged 'booking-service-category' and whose type coding matches
 *      each of the requested category codes. Optionally also appends the group
 *      HealthcareService so the role is recognized as a group member.
 *   3. Creates a Schedule with:
 *        actor:    [PractitionerRole/<id>]
 *        extension: a stub schedule-extension JSON (Mon-Fri 9-5, capacity 1/hr).
 *
 * Not idempotent on Schedule creation — running twice makes two Schedules.
 * Feel free to delete the prior Schedule before re-running.
 */

import Oystehr from '@oystehr/sdk';
import { HealthcareService, PractitionerRole, Schedule } from 'fhir/r4b';
import { createClinicalOystehrClient } from '../packages/zambdas/src/shared';

// ── Auth ──
async function getAuthToken(): Promise<string> {
  const { AUTH0_ENDPOINT, AUTH0_CLIENT, AUTH0_SECRET, AUTH0_AUDIENCE } = process.env;
  if (!AUTH0_ENDPOINT || !AUTH0_CLIENT || !AUTH0_SECRET || !AUTH0_AUDIENCE) {
    throw new Error('Missing auth env vars (AUTH0_ENDPOINT, AUTH0_CLIENT, AUTH0_SECRET, AUTH0_AUDIENCE)');
  }
  const response = await fetch(AUTH0_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: AUTH0_CLIENT,
      client_secret: AUTH0_SECRET,
      audience: AUTH0_AUDIENCE,
    }),
  });
  if (!response.ok) {
    throw new Error(`Auth failed: HTTP ${response.status}`);
  }
  return (await response.json()).access_token;
}

interface Args {
  practitionerId: string;
  locationId: string;
  categoryCodes: string[];
  groupId?: string;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const get = (name: string): string | undefined => {
    const idx = args.indexOf(`--${name}`);
    if (idx < 0) return undefined;
    return args[idx + 1];
  };
  const practitionerId = get('practitioner');
  const locationId = get('location');
  const categoriesRaw = get('categories');
  const groupId = get('group');
  if (!practitionerId || !locationId || !categoriesRaw) {
    console.error('Missing required args.');
    console.error('Usage: --practitioner <id> --location <id> --categories <code1>,<code2> [--group <id>]');
    process.exit(2);
  }
  return {
    practitionerId,
    locationId,
    categoryCodes: categoriesRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    groupId,
  };
}

const DEFAULT_SCHEDULE_EXTENSION = {
  schedule: {
    monday: { open: 9, close: 17, openingBuffer: 0, closingBuffer: 0, workingDay: true, hours: buildHours() },
    tuesday: { open: 9, close: 17, openingBuffer: 0, closingBuffer: 0, workingDay: true, hours: buildHours() },
    wednesday: { open: 9, close: 17, openingBuffer: 0, closingBuffer: 0, workingDay: true, hours: buildHours() },
    thursday: { open: 9, close: 17, openingBuffer: 0, closingBuffer: 0, workingDay: true, hours: buildHours() },
    friday: { open: 9, close: 17, openingBuffer: 0, closingBuffer: 0, workingDay: true, hours: buildHours() },
    saturday: { open: 0, close: 0, openingBuffer: 0, closingBuffer: 0, workingDay: false, hours: [] },
    sunday: { open: 0, close: 0, openingBuffer: 0, closingBuffer: 0, workingDay: false, hours: [] },
  },
  scheduleOverrides: {},
  closures: [],
};

function buildHours(): Array<{ hour: number; capacity: number; providers: number }> {
  // 1 provider on shift this hour. `providers: 1` is what slot generation
  // actually reads. The legacy `capacity: 4` is kept because the Capacity
  // type requires it; it's set to `providers * 4` so legacy fallback math
  // (capacity / 4 = effective providers) returns the same 1 — internally
  // consistent rather than a coincidentally-equal magic number.
  const hours = [];
  for (let h = 9; h < 17; h++) {
    hours.push({ hour: h, providers: 1, capacity: 1 * 4 });
  }
  return hours;
}

async function main(): Promise<void> {
  const { FHIR_API, PROJECT_API } = process.env;
  if (!FHIR_API || !PROJECT_API) {
    throw new Error('Missing FHIR_API / PROJECT_API env vars');
  }
  const args = parseArgs();
  const token = await getAuthToken();
  const oystehr = createClinicalOystehrClient(
    token,
    {},
    { services: { fhirApiUrl: FHIR_API, projectApiUrl: PROJECT_API } }
  );

  // 1. Resolve category-tagged HealthcareService resources for the requested codes.
  const allCategories = (
    await oystehr.fhir.search<HealthcareService>({
      resourceType: 'HealthcareService',
      params: [
        { name: '_tag', value: 'booking-service-category' },
        { name: 'active', value: 'true' },
      ],
    })
  ).unbundle();
  const serviceRefs: { reference: string }[] = [];
  for (const code of args.categoryCodes) {
    const hit = allCategories.find((hs) => hs.type?.[0]?.coding?.some((c) => c.code === code));
    if (!hit?.id) {
      console.error(`Could not find HealthcareService with service-category code "${code}"`);
      process.exit(2);
    }
    serviceRefs.push({ reference: `HealthcareService/${hit.id}` });
  }
  if (args.groupId) {
    serviceRefs.push({ reference: `HealthcareService/${args.groupId}` });
  }

  // 2. Find (or create) the PractitionerRole for this (practitioner, location).
  const existingRoles = (
    await oystehr.fhir.search<PractitionerRole>({
      resourceType: 'PractitionerRole',
      params: [
        { name: 'practitioner', value: `Practitioner/${args.practitionerId}` },
        { name: 'location', value: `Location/${args.locationId}` },
      ],
    })
  ).unbundle();

  let role: PractitionerRole;
  if (existingRoles.length > 0) {
    console.log(`Reusing existing PractitionerRole: ${existingRoles[0].id}`);
    role = existingRoles[0];
    // Merge in the new service refs (preserve existing ones that aren't ours).
    const existingSet = new Set((role.healthcareService || []).map((r) => r.reference));
    for (const ref of serviceRefs) {
      if (!existingSet.has(ref.reference)) {
        (role.healthcareService ||= []).push(ref);
      }
    }
    const updated = await oystehr.fhir.update(role);
    role = updated;
    console.log(`Updated PractitionerRole ${role.id} with healthcareService refs:`, role.healthcareService);
  } else {
    const created = await oystehr.fhir.create<PractitionerRole>({
      resourceType: 'PractitionerRole',
      practitioner: { reference: `Practitioner/${args.practitionerId}` },
      location: [{ reference: `Location/${args.locationId}` }],
      healthcareService: serviceRefs,
      active: true,
    });
    role = created;
    console.log(`Created PractitionerRole ${role.id}`);
  }

  // 3. Create a Schedule whose actor is the PractitionerRole.
  const schedule = await oystehr.fhir.create<Schedule>({
    resourceType: 'Schedule',
    active: true,
    actor: [{ reference: `PractitionerRole/${role.id}` }],
    extension: [
      {
        url: 'https://fhir.ottehr.com/StructureDefinitions/schedule',
        valueString: JSON.stringify(DEFAULT_SCHEDULE_EXTENSION),
      },
      {
        url: 'http://hl7.org/fhir/StructureDefinition/timezone',
        valueString: 'America/New_York',
      },
    ],
  });
  console.log(`Created Schedule ${schedule.id} on PractitionerRole/${role.id}`);

  console.log('\nNext steps:');
  console.log('  • Book via the existing booking URL — the Schedule with the PractitionerRole actor');
  console.log('    will be picked up by the group pool (if --group was provided) and slots will be');
  console.log('    filtered by the declared service categories.');
  console.log(`  • PractitionerRole: ${role.id}`);
  console.log(`  • Schedule:         ${schedule.id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
