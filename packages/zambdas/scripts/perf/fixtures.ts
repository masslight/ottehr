/**
 * Fixture data for the zambda perf bench (see ./bench.ts).
 *
 * The integration suite's happy-path fixtures are deliberately minimal — one appointment, and for
 * get-appointments an *empty* result is a valid happy path. That is fine for correctness but useless
 * for performance work: the patterns that dominate tracking-board latency (per-encounter searches,
 * per-patient searches) only show up once there are many appointments in the result set.
 *
 * So the bench seeds its own tracking-board-shaped graph: one Location, a handful of Practitioners,
 * and N appointments each with the satellite resources the real board renders from (Patient,
 * user-RelatedPerson with a phone, Encounter with practitioner participants, QuestionnaireResponse).
 *
 * Everything is stamped with a single meta tag so `teardownFixture` can find and delete it by tag,
 * and so a fixture can be seeded once and reused across many bench runs (ids are cached on disk).
 */
import Oystehr, { BatchInputPostRequest } from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import {
  Account,
  Appointment,
  Consent,
  DocumentReference,
  Encounter,
  FhirResource,
  Flag,
  Location,
  Patient,
  Practitioner,
  QuestionnaireResponse,
  RelatedPerson,
  Schedule,
  Slot,
} from 'fhir/r4b';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { DateTime } from 'luxon';
import { dirname, resolve } from 'path';
import {
  PATIENT_BILLING_ACCOUNT_TYPE,
  PRIVATE_EXTENSION_BASE_URL,
  TIMEZONE_EXTENSION_URL,
} from 'utils/lib/fhir/constants';
import { OTTEHR_MODULE } from 'utils/lib/fhir/moduleIdentification';
import { PAPERWORK_CONSENT_CODE_UNIQUE } from 'utils/lib/types/data/paperwork/paperwork.constants';
import { say } from './lib';

export const PERF_FIXTURE_TAG_SYSTEM = 'https://ottehr.org/perf-bench';

const FIXTURE_CACHE_PATH = resolve(__dirname, '../../.perf-bench/fixtures.json');

export interface TrackingBoardFixture {
  tagCode: string;
  locationId: string;
  practitionerIds: string[];
  appointmentIds: string[];
  encounterIds: string[];
  patientIds: string[];
  timezone: string;
  /** ISO date, in `timezone`, that the seeded appointments fall on */
  searchDate: string;
  appointmentCount: number;
}

const FIXTURE_TIMEZONE = 'America/New_York';

const tagFor = (tagCode: string): FhirResource['meta'] => ({
  tag: [{ system: PERF_FIXTURE_TAG_SYSTEM, code: tagCode }],
});

/** Resource types the fixture creates; teardown sweeps each by tag. */
const FIXTURE_RESOURCE_TYPES: FhirResource['resourceType'][] = [
  'Provenance',
  'ClinicalImpression',
  'Communication',
  'Observation',
  'MedicationStatement',
  'AllergyIntolerance',
  'Condition',
  'Procedure',
  'Consent',
  'DocumentReference',
  'Coverage',
  'Account',
  'Flag',
  'QuestionnaireResponse',
  'Appointment',
  'Slot',
  'Schedule',
  'Encounter',
  'RelatedPerson',
  'Patient',
  'Practitioner',
  'Location',
];

export const TRACKING_BOARD_FIXTURE_KIND = 'tracking-board';
export const VISIT_DETAILS_FIXTURE_KIND = 'visit-details';

type FixtureCache = Record<string, TrackingBoardFixture | VisitDetailsFixture>;

const readCache = (): FixtureCache => {
  if (!existsSync(FIXTURE_CACHE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(FIXTURE_CACHE_PATH, 'utf8')) as FixtureCache;
  } catch {
    return {};
  }
};

const writeCache = (cache: FixtureCache): void => {
  mkdirSync(dirname(FIXTURE_CACHE_PATH), { recursive: true });
  writeFileSync(FIXTURE_CACHE_PATH, JSON.stringify(cache, null, 2));
};

export const readCachedFixture = <T extends TrackingBoardFixture | VisitDetailsFixture>(kind: string): T | undefined =>
  readCache()[kind] as T | undefined;

export const writeCachedFixture = (kind: string, fixture: TrackingBoardFixture | VisitDetailsFixture): void => {
  writeCache({ ...readCache(), [kind]: fixture });
};

export const forgetCachedFixture = (kind: string): void => {
  const cache = readCache();
  delete cache[kind];
  writeCache(cache);
};

export const allCachedFixtures = (): { kind: string; fixture: TrackingBoardFixture | VisitDetailsFixture }[] =>
  Object.entries(readCache()).map(([kind, fixture]) => ({ kind, fixture }));

/**
 * Confirms a cached fixture still exists on the backend (someone may have swept the project) by
 * counting its appointments.
 */
export const fixtureIsAlive = async (oystehr: Oystehr, fixture: TrackingBoardFixture): Promise<boolean> => {
  try {
    const bundle = await oystehr.fhir.search<Appointment>({
      resourceType: 'Appointment',
      params: [
        { name: '_tag', value: `${PERF_FIXTURE_TAG_SYSTEM}|${fixture.tagCode}` },
        { name: '_count', value: '1' },
      ],
    });
    return (bundle.unbundle() ?? []).length > 0;
  } catch {
    return false;
  }
};

export const seedTrackingBoardFixture = async (
  oystehr: Oystehr,
  appointmentCount: number
): Promise<TrackingBoardFixture> => {
  const tagCode = `perf-bench-${randomUUID()}`;
  const meta = tagFor(tagCode);
  const searchDate = DateTime.now().setZone(FIXTURE_TIMEZONE).toISODate()!;

  const location = await oystehr.fhir.create<Location>({
    resourceType: 'Location',
    status: 'active',
    name: 'Perf Bench Location',
    meta,
    extension: [{ url: TIMEZONE_EXTENSION_URL, valueString: FIXTURE_TIMEZONE }],
  });

  // A few practitioners so Encounter.participant fans out the way it does on a real board (the
  // handler collects participant ids across all encounters and resolves them in one search).
  const practitioners = await Promise.all(
    [0, 1, 2].map((i) =>
      oystehr.fhir.create<Practitioner>({
        resourceType: 'Practitioner',
        active: true,
        name: [{ family: `PerfBench${i}`, given: ['Provider'] }],
        meta,
      })
    )
  );
  const practitionerIds = practitioners.map((p) => p.id!).filter(Boolean);

  // Statuses cycle so the result set lands across the board's queues rather than piling into one.
  const encounterStatuses: Encounter['status'][] = ['planned', 'arrived', 'in-progress', 'finished'];

  const appointmentIds: string[] = [];
  const encounterIds: string[] = [];
  const patientIds: string[] = [];

  const CHUNK = 10;
  for (let offset = 0; offset < appointmentCount; offset += CHUNK) {
    const size = Math.min(CHUNK, appointmentCount - offset);
    const requests: BatchInputPostRequest<FhirResource>[] = [];

    for (let i = 0; i < size; i++) {
      const n = offset + i;
      const patientRef = `urn:uuid:patient-${n}`;
      const appointmentRef = `urn:uuid:appointment-${n}`;
      const encounterRef = `urn:uuid:encounter-${n}`;
      const start = DateTime.now()
        .setZone(FIXTURE_TIMEZONE)
        .startOf('day')
        .plus({ hours: 9, minutes: 5 * n });
      const practitionerId = practitionerIds[n % practitionerIds.length];

      const patient: Patient = {
        resourceType: 'Patient',
        active: true,
        name: [{ use: 'official', given: ['Perf', `Bench${n}`], family: 'Patient' }],
        gender: 'male',
        birthDate: '1990-01-01',
        telecom: [
          { system: 'phone', value: `+1212555${String(1000 + n).slice(-4)}` },
          { system: 'email', value: `perf.bench.${n}@example.com` },
        ],
        address: [{ line: ['1 Perf Way'], city: 'New York', state: 'NY', postalCode: '10001' }],
        meta,
      };

      // The handler only counts RelatedPersons whose relationship coding is `user-relatedperson`;
      // those phone numbers drive the Communication (SMS) search, so the fixture must use that code.
      const relatedPerson: RelatedPerson = {
        resourceType: 'RelatedPerson',
        patient: { reference: patientRef },
        relationship: [
          { coding: [{ system: `${PRIVATE_EXTENSION_BASE_URL}/relationship`, code: 'user-relatedperson' }] },
        ],
        name: [{ given: ['Perf'], family: `Guardian${n}` }],
        // `system: 'sms'` (not 'phone') is what getSMSNumberForIndividual matches on; without it the
        // handler finds no SMS recipients and skips the Communication search entirely.
        telecom: [
          { system: 'sms', value: `+1212556${String(1000 + n).slice(-4)}` },
          { system: 'phone', value: `+1212556${String(1000 + n).slice(-4)}` },
        ],
        meta,
      };

      const appointment: Appointment = {
        resourceType: 'Appointment',
        status: n % 9 === 0 ? 'cancelled' : 'booked',
        start: start.toUTC().toISO()!,
        end: start.plus({ minutes: 15 }).toUTC().toISO()!,
        appointmentType: { text: n % 2 === 0 ? 'walkin' : 'walkin' },
        description: 'Perf bench visit',
        participant: [
          { actor: { reference: patientRef }, status: 'accepted' },
          { actor: { reference: `Location/${location.id}` }, status: 'accepted' },
        ],
        meta: { ...meta, tag: [...(meta?.tag ?? []), { code: OTTEHR_MODULE.IP }] },
      };

      const status = encounterStatuses[n % encounterStatuses.length];
      const encounter: Encounter = {
        resourceType: 'Encounter',
        status,
        statusHistory: [{ status, period: { start: start.toUTC().toISO()! } }],
        class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB', display: 'ambulatory' },
        subject: { reference: patientRef },
        appointment: [{ reference: appointmentRef }],
        location: [{ location: { reference: `Location/${location.id}` } }],
        participant: [
          {
            individual: { reference: `Practitioner/${practitionerId}` },
            type: [
              {
                coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType', code: 'ATND' }],
              },
            ],
          },
        ],
        extension: [{ url: 'patient-info-confirmed', valueBoolean: false }],
        meta,
      };

      const questionnaireResponse: QuestionnaireResponse = {
        resourceType: 'QuestionnaireResponse',
        status: 'completed',
        subject: { reference: patientRef },
        encounter: { reference: encounterRef },
        authored: start.toUTC().toISO()!,
        meta,
      };

      requests.push(
        { method: 'POST', url: '/Patient', fullUrl: patientRef, resource: patient },
        { method: 'POST', url: '/RelatedPerson', fullUrl: `urn:uuid:rp-${n}`, resource: relatedPerson },
        { method: 'POST', url: '/Appointment', fullUrl: appointmentRef, resource: appointment },
        { method: 'POST', url: '/Encounter', fullUrl: encounterRef, resource: encounter },
        { method: 'POST', url: '/QuestionnaireResponse', fullUrl: `urn:uuid:qr-${n}`, resource: questionnaireResponse }
      );
    }

    const created = (await oystehr.fhir.transaction<FhirResource>({ requests })).entry ?? [];
    created.forEach((entry) => {
      const resource = entry.resource;
      if (!resource?.id) return;
      if (resource.resourceType === 'Appointment') appointmentIds.push(resource.id);
      if (resource.resourceType === 'Encounter') encounterIds.push(resource.id);
      if (resource.resourceType === 'Patient') patientIds.push(resource.id);
    });
    say(`  seeded ${Math.min(offset + CHUNK, appointmentCount)}/${appointmentCount} appointments`);
  }

  const fixture: TrackingBoardFixture = {
    tagCode,
    locationId: location.id!,
    practitionerIds,
    appointmentIds,
    encounterIds,
    patientIds,
    timezone: FIXTURE_TIMEZONE,
    searchDate,
    appointmentCount,
  };
  writeCachedFixture(TRACKING_BOARD_FIXTURE_KIND, fixture);
  return fixture;
};

const deleteAll = async (oystehr: Oystehr, resources: FhirResource[]): Promise<void> => {
  for (let i = 0; i < resources.length; i += 50) {
    await oystehr.fhir.transaction({
      requests: resources
        .slice(i, i + 50)
        .map((resource) => ({ method: 'DELETE' as const, url: `/${resource.resourceType}/${resource.id}` })),
    });
  }
};

const searchByTag = async (
  oystehr: Oystehr,
  resourceType: FhirResource['resourceType'],
  tagValue: string
): Promise<FhirResource[]> => {
  const found: FhirResource[] = [];
  const PAGE = 200;
  for (;;) {
    const bundle = await oystehr.fhir.search<FhirResource>({
      resourceType: resourceType as any,
      params: [
        { name: '_tag', value: tagValue },
        { name: '_count', value: `${PAGE}` },
      ],
    });
    const page = bundle.unbundle() ?? [];
    found.push(...page);
    // A tag search returns everything matching; once a page comes back short there is no more.
    if (page.length < PAGE) break;
  }
  return found;
};

/** Deletes one fixture, identified by its own tag code. */
export const teardownFixture = async (
  oystehr: Oystehr,
  fixture: { tagCode: string },
  log: (line: string) => void = say
): Promise<void> => {
  const tagValue = `${PERF_FIXTURE_TAG_SYSTEM}|${fixture.tagCode}`;
  for (const resourceType of FIXTURE_RESOURCE_TYPES) {
    const found = await searchByTag(oystehr, resourceType, tagValue);
    if (!found.length) continue;
    // FIXTURE_RESOURCE_TYPES is ordered children-before-parents, so nothing is left referencing a
    // resource that has already been deleted.
    await deleteAll(oystehr, found);
    log(`  deleted ${found.length} ${resourceType}`);
  }
};

/**
 * Deletes everything this bench has ever created, found by the tag SYSTEM rather than by any one
 * fixture's tag code. This is what `--teardown` runs: a seed that throws partway through leaves
 * resources whose tag code was never cached, and per-fixture teardown can never reach those.
 */
export const teardownAllFixtures = async (oystehr: Oystehr, log: (line: string) => void = say): Promise<number> => {
  let total = 0;
  for (const resourceType of FIXTURE_RESOURCE_TYPES) {
    const found = await searchByTag(oystehr, resourceType, `${PERF_FIXTURE_TAG_SYSTEM}|`);
    if (!found.length) continue;
    await deleteAll(oystehr, found);
    total += found.length;
    log(`  deleted ${found.length} ${resourceType}`);
  }
  return total;
};

export interface VisitDetailsFixture {
  tagCode: string;
  appointmentId: string;
  encounterId: string;
  patientId: string;
  locationId: string;
  scheduleId: string;
  questionnaireCanonical: string;
}

/**
 * A single in-person visit with the satellite resources `ehr-get-visit-details` actually reads:
 * an intake QuestionnaireResponse pointed at the instance's active intake questionnaire, a
 * Slot/Schedule chain (that's where the visit timezone comes from), a consent DocumentReference +
 * Consent pair, an Account with an owner, and a Flag on the encounter.
 *
 * Insurance is deliberately absent: a patient with Coverages adds another serialized round trip
 * inside getAccountAndCoverageResourcesForPatient, so measurements here are the *optimistic* case.
 */
export const seedVisitDetailsFixture = async (
  oystehr: Oystehr,
  questionnaireCanonical: string
): Promise<VisitDetailsFixture> => {
  const tagCode = `perf-bench-${randomUUID()}`;
  const meta = tagFor(tagCode);
  const start = DateTime.now().setZone(FIXTURE_TIMEZONE).startOf('day').plus({ hours: 10 });

  // The Schedule's actor must be a real reference (the handler resolves the schedule owner out of
  // the same search bundle), so the Location has to exist first.
  const location = await oystehr.fhir.create<Location>({
    resourceType: 'Location',
    status: 'active',
    name: 'Perf Bench Visit Location',
    meta,
    extension: [{ url: TIMEZONE_EXTENSION_URL, valueString: FIXTURE_TIMEZONE }],
  });
  const schedule = await oystehr.fhir.create<Schedule>({
    resourceType: 'Schedule',
    active: true,
    meta,
    extension: [{ url: TIMEZONE_EXTENSION_URL, valueString: FIXTURE_TIMEZONE }],
    actor: [{ reference: `Location/${location.id}` }],
  });

  const patientRef = 'urn:uuid:patient';
  const appointmentRef = 'urn:uuid:appointment';
  const encounterRef = 'urn:uuid:encounter';
  const slotRef = 'urn:uuid:slot';
  const docRefRef = 'urn:uuid:consent-doc-ref';
  const relatedPersonRef = 'urn:uuid:related-person';

  const requests: BatchInputPostRequest<FhirResource>[] = [
    {
      method: 'POST',
      url: '/Patient',
      fullUrl: patientRef,
      resource: {
        resourceType: 'Patient',
        active: true,
        name: [{ use: 'official', given: ['Perf'], family: 'VisitDetails' }],
        gender: 'female',
        birthDate: '1995-05-05',
        telecom: [
          { system: 'phone', value: '+12125557777' },
          { system: 'email', value: 'perf.visit.details@example.com' },
        ],
        address: [{ line: ['2 Perf Way'], city: 'New York', state: 'NY', postalCode: '10001' }],
        meta,
      } as Patient,
    },
    {
      method: 'POST',
      url: '/RelatedPerson',
      fullUrl: relatedPersonRef,
      resource: {
        resourceType: 'RelatedPerson',
        patient: { reference: patientRef },
        name: [{ given: ['Perf'], family: 'Guarantor' }],
        telecom: [
          { system: 'phone', value: '+12125558888' },
          { system: 'email', value: 'perf.guarantor@example.com' },
        ],
        relationship: [
          { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0131', code: 'C', display: 'Emergency' }] },
        ],
        meta,
      } as RelatedPerson,
    },
    {
      method: 'POST',
      url: '/Slot',
      fullUrl: slotRef,
      resource: {
        resourceType: 'Slot',
        status: 'busy',
        schedule: { reference: `Schedule/${schedule.id}` },
        start: start.toUTC().toISO()!,
        end: start.plus({ minutes: 15 }).toUTC().toISO()!,
        meta,
      } as Slot,
    },
    {
      method: 'POST',
      url: '/Appointment',
      fullUrl: appointmentRef,
      resource: {
        resourceType: 'Appointment',
        status: 'booked',
        start: start.toUTC().toISO()!,
        end: start.plus({ minutes: 15 }).toUTC().toISO()!,
        appointmentType: { text: 'walkin' },
        description: 'Perf bench visit details',
        slot: [{ reference: slotRef }],
        participant: [
          { actor: { reference: patientRef }, status: 'accepted' },
          { actor: { reference: `Location/${location.id}` }, status: 'accepted' },
        ],
        meta: { ...meta, tag: [...(meta?.tag ?? []), { code: OTTEHR_MODULE.IP }] },
      } as Appointment,
    },
    {
      method: 'POST',
      url: '/Encounter',
      fullUrl: encounterRef,
      resource: {
        resourceType: 'Encounter',
        status: 'in-progress',
        class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB', display: 'ambulatory' },
        subject: { reference: patientRef },
        appointment: [{ reference: appointmentRef }],
        location: [{ location: { reference: `Location/${location.id}` } }],
        extension: [{ url: 'patient-info-confirmed', valueBoolean: false }],
        meta,
      } as Encounter,
    },
    {
      method: 'POST',
      url: '/QuestionnaireResponse',
      fullUrl: 'urn:uuid:qr',
      resource: {
        resourceType: 'QuestionnaireResponse',
        status: 'completed',
        questionnaire: questionnaireCanonical,
        subject: { reference: patientRef },
        encounter: { reference: encounterRef },
        authored: start.toUTC().toISO()!,
        item: [
          { linkId: 'signature', answer: [{ valueString: 'Perf Bench' }] },
          { linkId: 'full-name', answer: [{ valueString: 'Perf Bench' }] },
          { linkId: 'consent-form-signer-relationship', answer: [{ valueString: 'Self' }] },
        ],
        meta,
      } as QuestionnaireResponse,
    },
    {
      method: 'POST',
      url: '/Flag',
      fullUrl: 'urn:uuid:flag',
      resource: {
        resourceType: 'Flag',
        status: 'active',
        code: { text: 'Perf bench flag' },
        subject: { reference: patientRef },
        encounter: { reference: encounterRef },
        meta,
      } as Flag,
    },
    {
      method: 'POST',
      url: '/DocumentReference',
      fullUrl: docRefRef,
      resource: {
        resourceType: 'DocumentReference',
        status: 'current',
        type: { coding: [PAPERWORK_CONSENT_CODE_UNIQUE] },
        subject: { reference: patientRef },
        date: start.toUTC().toISO()!,
        content: [
          {
            attachment: {
              contentType: 'application/pdf',
              url: 'https://example.com/perf-bench-consent.pdf',
              title: 'Consent',
            },
          },
        ],
        context: { related: [{ reference: appointmentRef }] },
        meta,
      } as DocumentReference,
    },
    {
      method: 'POST',
      url: '/Consent',
      fullUrl: 'urn:uuid:consent',
      resource: {
        resourceType: 'Consent',
        status: 'active',
        dateTime: start.toUTC().toISO()!,
        patient: { reference: patientRef },
        scope: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/consentscope', code: 'patient-privacy' }] },
        category: [
          { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/consentcategorycodes', code: 'hipaa-ack' }] },
        ],
        policy: [{ uri: 'https://ottehr.com' }],
        sourceReference: { reference: docRefRef },
        meta,
      } as Consent,
    },
    {
      method: 'POST',
      url: '/Account',
      fullUrl: 'urn:uuid:account',
      resource: {
        resourceType: 'Account',
        status: 'active',
        type: PATIENT_BILLING_ACCOUNT_TYPE,
        name: 'Perf Bench Account',
        subject: [{ reference: patientRef }],
        // The handler resolves `responsiblePartyName`/`Email` from Account.guarantor[].party, not owner
        // (owner only accepts an Organization).
        guarantor: [{ party: { reference: relatedPersonRef } }],
        meta,
      } as Account,
    },
  ];

  const created = (await oystehr.fhir.transaction<FhirResource>({ requests })).entry ?? [];
  const idFor = (resourceType: FhirResource['resourceType']): string =>
    created.find((entry) => entry.resource?.resourceType === resourceType)?.resource?.id ?? '';

  const fixture: VisitDetailsFixture = {
    tagCode,
    appointmentId: idFor('Appointment'),
    encounterId: idFor('Encounter'),
    patientId: idFor('Patient'),
    locationId: location.id!,
    scheduleId: schedule.id!,
    questionnaireCanonical,
  };
  writeCachedFixture(VISIT_DETAILS_FIXTURE_KIND, fixture);
  return fixture;
};

export const visitDetailsFixtureIsAlive = async (oystehr: Oystehr, fixture: VisitDetailsFixture): Promise<boolean> => {
  if (!fixture.appointmentId) return false;
  try {
    await oystehr.fhir.get<Appointment>({ resourceType: 'Appointment', id: fixture.appointmentId });
    return true;
  } catch {
    return false;
  }
};
