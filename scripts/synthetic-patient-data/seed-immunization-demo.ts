/**
 * seed-immunization-demo.ts — the two demo patients of the vaccine-schedule mockups, each with an open in-person
 * visit today, plus the vaccine catalog and VFC / private lots on hand at the visit's location. For the synth
 * project only; idempotent (a re-run finds what it made before and prints the same visit URLs).
 *
 * Run from the repo root, with the synth zambdas reachable (dabrams's local zambda server on :3000 serves them;
 * pass --zambda-api to use another):
 *
 *   ENV=synth npx env-cmd -f packages/zambdas/.env/synth.json \
 *     npx tsx scripts/synthetic-patient-data/seed-immunization-demo.ts [--location "<Location name>"] \
 *     [--zambda-api http://localhost:3000/local]
 *
 * What it makes:
 *   - Catalog entries (type virtual-vaccine-inventory, one per CVX) for Pentacel, Prevnar 20, RotaTeq, Quadracel,
 *     MMR, Havrix, Varivax and Fluzone, with one VFC lot and one private lot on hand at the location (lot numbers
 *     DEMO-VFC-<cvx> / DEMO-PRV-<cvx>; the NDC, manufacturer and MVX come from the CDC crosswalk).
 *   - Maya Rivera, DOB 2026-07-08: Hep B birth dose administered externally at Mercy Hospital (from another
 *     provider's records); the 2-month doses (Pentacel, Prevnar 20, Hep B) given here on 2026-09-09, written as
 *     Immunization records only (no MedicationAdministration, so they show on the timeline, the Due today box and
 *     the record PDF, not in the MAR history); rotavirus marked Declined; Medicaid on the Patient so the VFC box
 *     derives V02, which the script also confirms for today's visit.
 *   - Leo Okafor, DOB 2021-09-14: the infant series from Lakeside Pediatrics (another provider's records) and one
 *     undated MMR from the family's recall; VFC eligibility confirmed V01 (private insurance). Due today: the 4–6
 *     year DTaP and polio doses (Quadracel), MMR 2, varicella 2 and flu.
 *   - One walk-in in-person appointment today per patient (reused when one exists), through create-slot and
 *     create-appointment like the other synth scripts.
 */
import Oystehr, { BatchInputPostRequest } from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import {
  Appointment,
  Encounter,
  Immunization,
  Location,
  Medication,
  Observation,
  Patient,
  Practitioner,
  Reference,
  Schedule,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  IMMUNIZATION_ADMINISTERING_PROVIDER_CODE,
  immunizationPerformer,
  isImmunizationMark,
} from 'utils/lib/fhir/immunization';
import { isLocationVirtual } from 'utils/lib/fhir/location';
import {
  INVENTORY_LOT_DRUG_IDENTIFIER_SYSTEM,
  INVENTORY_LOT_LOCATION_TAG_SYSTEM,
  makeInventoryLot,
  makeInventoryStockEntry,
  makeMedicationInventoryExtension,
  withLotOnHand,
} from 'utils/lib/fhir/medication-inventory';
import { makeVfcEligibilityObservation, VFC_ELIGIBILITY_LOINC } from 'utils/lib/fhir/vfc';
import { VACCINE_DEFAULT_INVENTORY } from 'utils/lib/types/api/config/in-house-medications';
import {
  CVX_CODE_SYSTEM_URL,
  INVENTORY_VACCINE_TYPE_CODE,
  MEDICATION_IDENTIFIER_NAME_SYSTEM,
  MEDICATION_TYPE_SYSTEM,
  MVX_CODE_SYSTEM_URL,
} from 'utils/lib/types/api/medication-administration.constants';
import { PATIENT_HAS_MEDICAID_URL } from 'utils/lib/types/constants';
import { NDC_VACCINE_PRODUCTS } from 'utils/lib/types/data/immunization/ndc-vaccines.generated';
import { ImmunizationOutsideSource } from 'utils/lib/types/data/immunization/types';
import { getCvxVaccine, getMvxManufacturer } from 'utils/lib/types/data/immunization/vaccine-lookup';
import { VaccineFundingSource, VfcEligibilityCode } from 'utils/lib/types/data/immunization/vfc';
import { buildImmunizationMark, buildOutsideImmunization } from '../../packages/zambdas/src/ehr/immunization/records';
import { arg } from './shared/cli';
import { SYNTHETIC_PATIENT_ID_SYSTEM } from './shared/constants';
import { createOystehrFromToken, mintAccessToken, need } from './shared/oystehr-client';
import { ZambdaCtx, zambdaExecute } from './shared/zambda';

/** Marks every Immunization this script writes, so a re-run finds it. */
const DEMO_IMMUNIZATION_SYSTEM = 'https://fhir.ottehr.com/sid/synth-immunization-demo';

const EHR_URL = 'http://localhost:4002';

/** The demo catalog: the CVX names the vaccine; the product picks the NDC from the CDC crosswalk. */
const DEMO_VACCINES: { cvx: string; product: RegExp }[] = [
  { cvx: '120', product: /pentacel/i },
  { cvx: '216', product: /prevnar 20/i },
  { cvx: '116', product: /rotateq/i },
  { cvx: '130', product: /quadracel/i },
  { cvx: '03', product: /m-m-r/i },
  { cvx: '83', product: /havrix/i },
  { cvx: '21', product: /varivax/i },
  { cvx: '150', product: /fluzone quadrivalent/i },
];

interface DemoPatient {
  key: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sex: 'female' | 'male';
  hasMedicaid: boolean;
  vfcEligibility: VfcEligibilityCode;
}

const MAYA: DemoPatient = {
  key: 'imm-demo-maya',
  firstName: 'Maya',
  lastName: 'Rivera',
  dateOfBirth: '2026-07-08',
  sex: 'female',
  hasMedicaid: true,
  vfcEligibility: 'V02',
};
const LEO: DemoPatient = {
  key: 'imm-demo-leo',
  firstName: 'Leo',
  lastName: 'Okafor',
  dateOfBirth: '2021-09-14',
  sex: 'male',
  hasMedicaid: false,
  vfcEligibility: 'V01',
};

interface OutsideDose {
  key: string;
  name: string;
  cvx: string;
  /** Absent for a dose whose date is not known. */
  dateGiven?: string;
  place: string;
  source: ImmunizationOutsideSource;
}

const LAKESIDE = 'Lakeside Pediatrics';
const fromLakeside = (key: string, name: string, cvx: string, dateGiven: string): OutsideDose => ({
  key,
  name,
  cvx,
  dateGiven,
  place: LAKESIDE,
  source: 'other-provider',
});

const MAYA_OUTSIDE: OutsideDose[] = [
  {
    key: 'maya-hepb-1',
    name: 'Hep B (Engerix-B)',
    cvx: '08',
    dateGiven: '2026-07-08',
    place: 'Mercy Hospital',
    source: 'other-provider',
  },
];

/** Maya's 2-month visit here. */
const MAYA_GIVEN_HERE: { key: string; name: string; cvx: string; lot: string; mvx: string }[] = [
  { key: 'maya-pentacel-1', name: 'Pentacel', cvx: '120', lot: 'U7421AA', mvx: 'PMC' },
  { key: 'maya-pcv-1', name: 'Prevnar 20', cvx: '216', lot: 'GK5112', mvx: 'PFR' },
  { key: 'maya-hepb-2', name: 'Hep B (Engerix-B)', cvx: '08', lot: 'ENG4471', mvx: 'SKB' },
];
const MAYA_TWO_MONTH_VISIT = '2026-09-09T10:15:00-04:00';

const LEO_OUTSIDE: OutsideDose[] = [
  fromLakeside('leo-hepb-1', 'Hep B', '08', '2021-09-14'),
  fromLakeside('leo-hepb-2', 'Hep B', '08', '2021-10-15'),
  fromLakeside('leo-hepb-3', 'Hep B', '08', '2022-03-16'),
  fromLakeside('leo-pentacel-1', 'Pentacel', '120', '2021-11-15'),
  fromLakeside('leo-pentacel-2', 'Pentacel', '120', '2022-01-17'),
  fromLakeside('leo-pentacel-3', 'Pentacel', '120', '2022-03-16'),
  fromLakeside('leo-pentacel-4', 'Pentacel', '120', '2023-01-20'),
  fromLakeside('leo-pcv-1', 'Prevnar 13', '133', '2021-11-15'),
  fromLakeside('leo-pcv-2', 'Prevnar 13', '133', '2022-01-17'),
  fromLakeside('leo-pcv-3', 'Prevnar 13', '133', '2022-03-16'),
  fromLakeside('leo-pcv-4', 'Prevnar 13', '133', '2022-09-20'),
  fromLakeside('leo-rota-1', 'RotaTeq', '116', '2021-11-15'),
  fromLakeside('leo-rota-2', 'RotaTeq', '116', '2022-01-17'),
  fromLakeside('leo-rota-3', 'RotaTeq', '116', '2022-03-16'),
  fromLakeside('leo-mmr-1', 'MMR', '03', '2022-09-20'),
  fromLakeside('leo-var-1', 'Varivax', '21', '2022-09-20'),
  fromLakeside('leo-hepa-1', 'Havrix', '83', '2022-09-20'),
  fromLakeside('leo-hepa-2', 'Havrix', '83', '2023-03-21'),
  // the family remembers a second MMR but not when: shown as "Date unknown", not counted by the forecast
  { key: 'leo-mmr-recall', name: 'MMR', cvx: '03', place: 'unknown', source: 'recall' },
];

const log = (message: string): void => console.log(message);

// ─── Location, schedule, practitioner ─────────────────────────────────────────

async function resolveLocation(oystehr: Oystehr, name: string | undefined): Promise<Location> {
  const locations = (
    await oystehr.fhir.search<Location>({
      resourceType: 'Location',
      params: [
        { name: 'status', value: 'active' },
        { name: '_count', value: '100' },
        ...(name ? [{ name: 'name', value: name }] : []),
      ],
    })
  )
    .unbundle()
    .filter((location) => location.id && !isLocationVirtual(location));
  const location = locations.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))[0];
  if (!location)
    throw new Error(name ? `No active in-person Location named "${name}"` : 'No active in-person Location');
  return location;
}

async function resolveSchedule(oystehr: Oystehr, locationId: string): Promise<Schedule> {
  const schedule = (
    await oystehr.fhir.search<Schedule>({
      resourceType: 'Schedule',
      params: [{ name: 'actor', value: `Location/${locationId}` }],
    })
  ).unbundle()[0];
  if (!schedule?.id) throw new Error(`No Schedule for Location/${locationId}`);
  return schedule;
}

/** Whoever receives the stock, confirms eligibility and records the history: the first active practitioner. */
async function resolvePractitioner(oystehr: Oystehr): Promise<Practitioner> {
  const practitioner = (
    await oystehr.fhir.search<Practitioner>({
      resourceType: 'Practitioner',
      params: [
        { name: 'active', value: 'true' },
        { name: '_count', value: '1' },
      ],
    })
  ).unbundle()[0];
  if (!practitioner?.id) throw new Error('No active Practitioner to record the demo history as');
  return practitioner;
}

// ─── Catalog and lots ─────────────────────────────────────────────────────────

/** As create-in-house-medication's createVaccine: one catalog entry per CVX, reactivated if switched off. */
async function ensureCatalogVaccine(oystehr: Oystehr, cvx: string): Promise<Medication & { id: string }> {
  const vaccine = getCvxVaccine(cvx);
  if (!vaccine) throw new Error(`CVX ${cvx} is not in the vaccine list`);
  const existing = (
    await oystehr.fhir.search<Medication>({
      resourceType: 'Medication',
      params: [
        { name: 'identifier', value: `${MEDICATION_TYPE_SYSTEM}|${INVENTORY_VACCINE_TYPE_CODE}` },
        { name: 'code', value: `${CVX_CODE_SYSTEM_URL}|${cvx}` },
      ],
    })
  )
    .unbundle()
    .find((medication) => medication.id);
  if (existing?.id) {
    if (existing.status === 'active') return existing as Medication & { id: string };
    return (await oystehr.fhir.patch<Medication>({
      resourceType: 'Medication',
      id: existing.id,
      operations: [{ op: existing.status ? 'replace' : 'add', path: '/status', value: 'active' }],
    })) as Medication & { id: string };
  }
  const created = await oystehr.fhir.create<Medication>({
    resourceType: 'Medication',
    identifier: [
      { system: MEDICATION_TYPE_SYSTEM, value: INVENTORY_VACCINE_TYPE_CODE },
      { system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: vaccine.name },
    ],
    status: 'active',
    code: { coding: [{ system: CVX_CODE_SYSTEM_URL, code: vaccine.cvx, display: vaccine.fullName }] },
    extension: [makeMedicationInventoryExtension(VACCINE_DEFAULT_INVENTORY)],
  });
  log(`  + catalog vaccine ${vaccine.name} (CVX ${cvx}) → Medication/${created.id}`);
  return created as Medication & { id: string };
}

/**
 * A lot received at the location, as receive-medication-shipment writes it: the lot with its on-hand cache and
 * the "received" stock entry in one transaction. Skipped when the lot number is already there.
 */
async function ensureLot(
  oystehr: Oystehr,
  catalog: Medication & { id: string },
  locationId: string,
  performerReference: string,
  input: { lotNumber: string; expirationDate: string; quantity: number; fundingSource: VaccineFundingSource },
  product: { saleNdc: string; mvx: string; labeler: string }
): Promise<void> {
  const existing = (
    await oystehr.fhir.search<Medication>({
      resourceType: 'Medication',
      params: [
        { name: 'identifier', value: `${INVENTORY_LOT_DRUG_IDENTIFIER_SYSTEM}|${catalog.id}` },
        { name: '_tag', value: `${INVENTORY_LOT_LOCATION_TAG_SYSTEM}|${locationId}` },
      ],
    })
  ).unbundle();
  if (existing.some((lot) => lot.batch?.lotNumber === input.lotNumber)) return;

  const lot = makeInventoryLot(catalog, {
    locationId,
    lotNumber: input.lotNumber,
    expirationDate: input.expirationDate,
    ndc: product.saleNdc,
    manufacturer: getMvxManufacturer(product.mvx)?.name ?? product.labeler,
    mvx: product.mvx,
    fundingSource: input.fundingSource,
    unit: VACCINE_DEFAULT_INVENTORY.countedAs,
  });
  const lotUrn = `urn:uuid:${randomUUID()}`;
  const createLot: BatchInputPostRequest<Medication> = {
    method: 'POST',
    url: '/Medication',
    fullUrl: lotUrn,
    resource: withLotOnHand(lot, input.quantity),
  };
  const createEntry: BatchInputPostRequest<Observation> = {
    method: 'POST',
    url: '/Observation',
    resource: makeInventoryStockEntry({
      locationId,
      type: 'received',
      quantity: input.quantity,
      unit: VACCINE_DEFAULT_INVENTORY.countedAs,
      performerReference,
      effectiveDateTime: DateTime.now().toUTC().toISO()!,
      lotReference: lotUrn,
    }),
  };
  await oystehr.fhir.transaction<Medication | Observation>({ requests: [createLot, createEntry] });
  log(`  + lot ${input.lotNumber} (${input.fundingSource}, ${input.quantity} doses, exp ${input.expirationDate})`);
}

async function seedCatalogAndLots(oystehr: Oystehr, locationId: string, performerReference: string): Promise<void> {
  log('Vaccine catalog and lots');
  const today = DateTime.now();
  for (const demo of DEMO_VACCINES) {
    const product = NDC_VACCINE_PRODUCTS.find(
      (candidate) => candidate.cvx === demo.cvx && demo.product.test(candidate.name)
    );
    if (!product) throw new Error(`No NDC product for CVX ${demo.cvx} matching ${demo.product}`);
    const catalog = await ensureCatalogVaccine(oystehr, demo.cvx);
    // the VFC lot expires sooner, so the tie rule and the lot pick have something to choose between
    await ensureLot(
      oystehr,
      catalog,
      locationId,
      performerReference,
      {
        lotNumber: `DEMO-VFC-${demo.cvx}`,
        expirationDate: today.plus({ months: 8 }).toISODate()!,
        quantity: 10,
        fundingSource: 'vfc',
      },
      product
    );
    await ensureLot(
      oystehr,
      catalog,
      locationId,
      performerReference,
      {
        lotNumber: `DEMO-PRV-${demo.cvx}`,
        expirationDate: today.plus({ months: 14 }).toISODate()!,
        quantity: 10,
        fundingSource: 'private',
      },
      product
    );
  }
}

// ─── Patients and visits ──────────────────────────────────────────────────────

interface DemoVisit {
  patient: Patient;
  appointmentId: string;
  encounterId: string;
}

async function findPatient(oystehr: Oystehr, demo: DemoPatient): Promise<Patient | undefined> {
  return (
    await oystehr.fhir.search<Patient>({
      resourceType: 'Patient',
      params: [{ name: 'identifier', value: `${SYNTHETIC_PATIENT_ID_SYSTEM}|${demo.key}` }],
    })
  ).unbundle()[0];
}

/** Today's open in-person appointment of the patient, if the script already booked one. */
async function findTodaysVisit(oystehr: Oystehr, patientId: string): Promise<DemoVisit | undefined> {
  const resources = (
    await oystehr.fhir.search<Appointment | Encounter>({
      resourceType: 'Appointment',
      params: [
        { name: 'patient', value: `Patient/${patientId}` },
        { name: 'date', value: `ge${DateTime.now().startOf('day').toISO()}` },
        { name: 'status:not', value: 'cancelled' },
        { name: '_revinclude', value: 'Encounter:appointment' },
      ],
    })
  ).unbundle();
  const appointment = resources.find((resource): resource is Appointment => resource.resourceType === 'Appointment');
  const encounter = resources.find(
    (resource): resource is Encounter =>
      resource.resourceType === 'Encounter' && resource.appointment?.[0]?.reference === `Appointment/${appointment?.id}`
  );
  if (!appointment?.id || !encounter?.id) return undefined;
  return {
    patient: { resourceType: 'Patient', id: patientId },
    appointmentId: appointment.id,
    encounterId: encounter.id,
  };
}

async function ensureVisit(
  oystehr: Oystehr,
  ctx: ZambdaCtx,
  scheduleId: string,
  demo: DemoPatient
): Promise<DemoVisit> {
  const existingPatient = await findPatient(oystehr, demo);
  if (existingPatient?.id) {
    const visit = await findTodaysVisit(oystehr, existingPatient.id);
    if (visit) {
      log(
        `  = ${demo.firstName} ${demo.lastName}: Patient/${existingPatient.id}, today's visit ${visit.appointmentId}`
      );
      return { ...visit, patient: existingPatient };
    }
  }

  // create-slot is registered as execute-public; a walk-in slot starting now
  const slot = await zambdaExecute<{ id?: string }>(
    ctx,
    'create-slot',
    {
      scheduleId,
      startISO: DateTime.now().toUTC().toISO(),
      lengthInMinutes: 15,
      serviceModality: 'in-person',
      serviceCategoryCode: 'urgent-care',
      walkin: true,
    },
    { execPublic: true }
  );
  if (!slot?.id) throw new Error('create-slot returned no slot id');

  const created = await zambdaExecute<{ appointmentId?: string; encounterId?: string; fhirPatientId?: string }>(
    ctx,
    'create-appointment',
    {
      patient: {
        newPatient: !existingPatient,
        ...(existingPatient?.id ? { id: existingPatient.id } : {}),
        firstName: demo.firstName,
        lastName: demo.lastName,
        dateOfBirth: demo.dateOfBirth,
        sex: demo.sex,
        email: `${demo.key}@example.com`,
        phoneNumber: '+16095550142',
        reasonForVisit: 'Well visit, vaccines due',
      },
      slotId: slot.id,
      language: 'en',
    }
  );
  const patientId = existingPatient?.id ?? created.fhirPatientId;
  if (!created.appointmentId || !created.encounterId || !patientId) {
    throw new Error(`create-appointment returned an incomplete result: ${JSON.stringify(created)}`);
  }

  let patient = await oystehr.fhir.get<Patient>({ resourceType: 'Patient', id: patientId });
  if (!existingPatient) {
    // the synth identifier dedupes the next run; Medicaid on the Patient is what the VFC box derives V02 from
    patient = await oystehr.fhir.update<Patient>({
      ...patient,
      identifier: [
        ...(patient.identifier ?? []),
        { use: 'secondary', system: SYNTHETIC_PATIENT_ID_SYSTEM, value: demo.key },
      ],
      extension: [
        ...(patient.extension ?? []).filter((extension) => extension.url !== PATIENT_HAS_MEDICAID_URL),
        ...(demo.hasMedicaid ? [{ url: PATIENT_HAS_MEDICAID_URL, valueBoolean: true }] : []),
      ],
    });
  }
  log(`  + ${demo.firstName} ${demo.lastName}: Patient/${patient.id}, visit ${created.appointmentId}`);
  return { patient, appointmentId: created.appointmentId, encounterId: created.encounterId };
}

// ─── Immunization history ─────────────────────────────────────────────────────

const demoIdentifier = (key: string): Immunization['identifier'] => [{ system: DEMO_IMMUNIZATION_SYSTEM, value: key }];

async function existingDemoImmunizations(oystehr: Oystehr, patientId: string): Promise<Set<string>> {
  const immunizations = (
    await oystehr.fhir.search<Immunization>({
      resourceType: 'Immunization',
      params: [
        { name: 'patient', value: `Patient/${patientId}` },
        { name: '_count', value: '200' },
      ],
    })
  ).unbundle();
  return new Set(
    immunizations.flatMap(
      (immunization) =>
        immunization.identifier?.flatMap((identifier) =>
          identifier.system === DEMO_IMMUNIZATION_SYSTEM && identifier.value ? [identifier.value] : []
        ) ?? []
    )
  );
}

/** A dose given here, as the Immunization alongside an administered order looks (without the order itself). */
const givenHereImmunization = (
  dose: { key: string; name: string; cvx: string; lot: string; mvx: string },
  occurrence: string,
  patient: Reference,
  recorder: Reference,
  locationName: string | undefined
): Immunization => ({
  resourceType: 'Immunization',
  identifier: demoIdentifier(dose.key),
  status: 'completed',
  primarySource: true,
  vaccineCode: { coding: [{ system: CVX_CODE_SYSTEM_URL, code: dose.cvx }], text: dose.name },
  patient,
  occurrenceDateTime: occurrence,
  recorded: occurrence,
  lotNumber: dose.lot,
  manufacturer: {
    display: getMvxManufacturer(dose.mvx)?.name,
    identifier: { system: MVX_CODE_SYSTEM_URL, value: dose.mvx },
  },
  ...(locationName && { location: { display: locationName } }),
  performer: [immunizationPerformer(recorder, IMMUNIZATION_ADMINISTERING_PROVIDER_CODE)],
});

async function seedHistory(
  oystehr: Oystehr,
  visit: DemoVisit,
  recorder: Reference,
  locationName: string | undefined,
  outside: OutsideDose[],
  givenHere: { key: string; name: string; cvx: string; lot: string; mvx: string }[],
  declined: { key: string; group: string; note: string; at: string } | undefined
): Promise<void> {
  const patient: Reference = { reference: `Patient/${visit.patient.id}` };
  const encounter: Reference = { reference: `Encounter/${visit.encounterId}` };
  const existing = await existingDemoImmunizations(oystehr, visit.patient.id!);
  const requests: BatchInputPostRequest<Immunization>[] = [];
  const post = (immunization: Immunization): void => {
    requests.push({ method: 'POST', url: '/Immunization', resource: immunization });
  };

  for (const dose of outside) {
    if (existing.has(dose.key)) continue;
    const recordedAt = DateTime.fromISO(dose.dateGiven ?? visit.patient.birthDate ?? '2026-01-01').plus({ days: 1 });
    post({
      ...buildOutsideImmunization(
        {
          vaccine: { name: dose.name },
          cvx: dose.cvx,
          dateGiven: dose.dateGiven,
          place: dose.place,
          source: dose.source,
        },
        patient,
        encounter,
        recorder,
        recordedAt
      ),
      identifier: demoIdentifier(dose.key),
    });
  }
  for (const dose of givenHere) {
    if (existing.has(dose.key)) continue;
    post(givenHereImmunization(dose, MAYA_TWO_MONTH_VISIT, patient, recorder, locationName));
  }
  if (declined && !existing.has(declined.key)) {
    post({
      ...buildImmunizationMark(
        { patientId: visit.patient.id!, vaccineGroup: declined.group, mark: 'declined', note: declined.note },
        patient,
        recorder,
        DateTime.fromISO(declined.at)
      ),
      identifier: demoIdentifier(declined.key),
    });
  }
  if (requests.length) {
    const result = await oystehr.fhir.transaction<Immunization>({ requests });
    const written = result.entry?.filter((entry) => entry.resource && isImmunizationMark(entry.resource)).length ?? 0;
    log(`  + ${requests.length} immunization records (${written} marks)`);
  } else {
    log('  = immunization history already there');
  }
}

async function ensureVfcEligibility(
  oystehr: Oystehr,
  visit: DemoVisit,
  code: VfcEligibilityCode,
  performerReference: string
): Promise<void> {
  const existing = (
    await oystehr.fhir.search<Observation>({
      resourceType: 'Observation',
      params: [
        { name: 'encounter', value: `Encounter/${visit.encounterId}` },
        { name: 'code', value: `http://loinc.org|${VFC_ELIGIBILITY_LOINC}` },
        { name: 'status', value: 'final' },
      ],
    })
  ).unbundle();
  if (existing.length) return;
  await oystehr.fhir.create<Observation>(
    makeVfcEligibilityObservation({
      encounterId: visit.encounterId,
      patientId: visit.patient.id!,
      code,
      performerReference,
      effectiveDateTime: DateTime.now().toUTC().toISO()!,
    })
  );
  log(`  + VFC eligibility ${code} confirmed for today's visit`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (process.env.ENV !== 'synth') {
    throw new Error('This seeds demo data on the synth project only: run with ENV=synth and the synth env file.');
  }
  const accessToken = await mintAccessToken();
  const oystehr = createOystehrFromToken(accessToken);
  const ctx: ZambdaCtx = {
    zambdaApi: arg('--zambda-api', process.env.ZAMBDA_API ?? 'http://localhost:3000/local'),
    accessToken,
    projectId: need('PROJECT_ID'),
  };

  const location = await resolveLocation(oystehr, arg('--location'));
  const schedule = await resolveSchedule(oystehr, location.id!);
  const practitioner = await resolvePractitioner(oystehr);
  const performerReference = `Practitioner/${practitioner.id}`;
  log(`Location ${location.name} (${location.id}), schedule ${schedule.id}, recorded by ${performerReference}`);

  await seedCatalogAndLots(oystehr, location.id!, performerReference);

  log('Patients and visits');
  const maya = await ensureVisit(oystehr, ctx, schedule.id!, MAYA);
  const leo = await ensureVisit(oystehr, ctx, schedule.id!, LEO);

  log('Immunization history');
  const recorder: Reference = { reference: performerReference };
  await seedHistory(oystehr, maya, recorder, location.name, MAYA_OUTSIDE, MAYA_GIVEN_HERE, {
    key: 'maya-rota-declined',
    group: 'rota',
    note: 'Parents declined',
    at: MAYA_TWO_MONTH_VISIT,
  });
  await seedHistory(oystehr, leo, recorder, location.name, LEO_OUTSIDE, [], undefined);
  await ensureVfcEligibility(oystehr, maya, MAYA.vfcEligibility, performerReference);
  await ensureVfcEligibility(oystehr, leo, LEO.vfcEligibility, performerReference);

  log('\nOpen in the EHR:');
  for (const [demo, visit] of [
    [MAYA, maya],
    [LEO, leo],
  ] as const) {
    log(`  ${demo.firstName} ${demo.lastName} (DOB ${demo.dateOfBirth})`);
    log(`    order screen   ${EHR_URL}/in-person/${visit.appointmentId}/immunization/order`);
    log(`    MAR            ${EHR_URL}/in-person/${visit.appointmentId}/immunization/mar`);
    log(`    schedule tab   ${EHR_URL}/in-person/${visit.appointmentId}/immunization/schedule`);
  }
  log(`  Admin › Inventory      ${EHR_URL}/admin/inventory`);
  log(`  Admin › Vaccine Schedule ${EHR_URL}/admin/vaccine-schedule`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
