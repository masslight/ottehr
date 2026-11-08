// ONE-OFF (synth): add a head-circumference Observation to each of the flowsheet seed patient's seeded visits
// in the first 24 months of life, so the Growth flowsheet's head-circumference rows have data. Written in the
// shape the Vitals page writes (vital tag first, seed tag LAST — Ottehr reads meta.tag[0]). Idempotent: a visit
// that already has a head circumference is skipped.
//
//   npx tsx scripts/flowsheets/seed-head-circumference.ts --env synth --patient <id> [--execute]
//
// Without --execute it is a dry run that prints the plan.

import { Encounter, FhirResource, Observation, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { VITAL_HEAD_CIRCUMFERENCE_LOINC_CODE } from 'utils/lib/fhir/vitals';
import { VitalFieldNames } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { arg, flag } from '../synthetic-patient-data/shared/cli';
import { createOystehrFromEnvFile } from '../synthetic-patient-data/shared/oystehr-client';

const ENV = arg('--env', 'synth');
const PATIENT = arg('--patient', '');
const EXECUTE = flag('--execute');
// Seeds demo data only: refuse every other env before authenticating (as synth-daily-census does).
const ALLOWED_ENVS = ['synth', 'local'];
if (!ALLOWED_ENVS.includes(ENV)) {
  throw new Error(`Refusing to run against env "${ENV}": this script only writes to ${ALLOWED_ENVS.join(' or ')}.`);
}

// Same tag as scripts/flowsheets/seed-longitudinal-patient.ts, so `--cleanup` there removes these too.
const SEED_TAG = { system: 'https://fhir.ottehr.com/sid/synth-flowsheet-seed', code: 'flowsheet-seed' };
const PRIVATE = 'https://fhir.zapehr.com/r4/StructureDefinitions';
const LOINC = 'http://loinc.org';
const UCUM = 'http://unitsofmeasure.org';
const DAYS_PER_MONTH = 30.4375;

// Head circumference (cm) by age in months for the seed girl, a little above the WHO girls median (M at 0, 6,
// 12 and 24 months: 33.9, 42.2, 44.8, 47.2) and rounded to the half centimetre a tape gives. The 2-year well
// visit (just past 24 months) gets a value too, which the flowsheet shows without a percentile.
const HEAD_CIRCUMFERENCE_CM: [maxAgeMonths: number, cm: number][] = [
  [1, 34.5],
  [4, 40.0],
  [8, 43.0],
  [13, 45.5],
  [19, 46.5],
  [25, 47.5],
];

const headCircumferenceFor = (ageMonths: number): number | undefined =>
  HEAD_CIRCUMFERENCE_CM.find(([maxAge]) => ageMonths <= maxAge)?.[1];

async function main(): Promise<void> {
  if (!PATIENT) throw new Error('--patient <id> is required');
  const { oystehr } = await createOystehrFromEnvFile(`packages/zambdas/.env/${ENV}.json`);

  const patient = await oystehr.fhir.get<Patient>({ resourceType: 'Patient', id: PATIENT });
  if (!patient.birthDate) throw new Error('the patient has no birth date');
  const birth = DateTime.fromISO(patient.birthDate, { zone: 'utc' });

  // The seeded visits' encounters and the vitals already on them.
  const seeded = (
    await oystehr.fhir.search<FhirResource>({
      resourceType: 'Encounter',
      params: [
        { name: 'patient', value: `Patient/${PATIENT}` },
        { name: '_tag', value: `${SEED_TAG.system}|${SEED_TAG.code}` },
        { name: '_revinclude', value: 'Observation:encounter' },
        { name: '_count', value: '500' },
      ],
    })
  ).unbundle();
  const encounters = seeded.filter((r): r is Encounter => r.resourceType === 'Encounter');
  const observations = seeded.filter((r): r is Observation => r.resourceType === 'Observation');

  const plan: { encounter: Encounter; at: string; cm: number }[] = [];
  let skipped = 0;
  for (const encounter of encounters) {
    const vitals = observations.filter((o) => o.encounter?.reference === `Encounter/${encounter.id}`);
    const weight = vitals.find((o) => o.meta?.tag?.[0]?.code === VitalFieldNames.VitalWeight);
    const at = weight?.effectiveDateTime ?? encounter.period?.start;
    if (!at) continue;
    const ageMonths = DateTime.fromISO(at, { setZone: true }).startOf('day').diff(birth, 'days').days / DAYS_PER_MONTH;
    const cm = headCircumferenceFor(ageMonths);
    if (cm === undefined) continue;
    if (vitals.some((o) => o.meta?.tag?.[0]?.code === VitalFieldNames.VitalHeadCircumference)) {
      skipped++;
      continue;
    }
    plan.push({ encounter, at, cm });
  }

  console.log(
    `Patient ${patient.name?.[0]?.given?.join(' ')} ${patient.name?.[0]?.family} (DOB ${patient.birthDate}): ` +
      `${encounters.length} seeded visits, ${plan.length} to add a head circumference to, ${skipped} already have one` +
      (EXECUTE ? '' : '   [DRY RUN — pass --execute to write]')
  );
  plan.sort((a, b) => a.at.localeCompare(b.at));
  for (const { encounter, at, cm } of plan) {
    console.log(`${at.slice(0, 10)}  Encounter/${encounter.id}  head circumference ${cm} cm`);
  }
  if (!EXECUTE || plan.length === 0) return;

  const performer = encounters[0].participant?.[0]?.individual?.reference;
  let created = 0;
  for (const { encounter, at, cm } of plan) {
    const observation = await oystehr.fhir.create<Observation>({
      resourceType: 'Observation',
      meta: {
        tag: [{ code: VitalFieldNames.VitalHeadCircumference, system: `${PRIVATE}/patient-vitals-field` }, SEED_TAG],
      },
      status: 'final',
      subject: { reference: `Patient/${PATIENT}` },
      encounter: { reference: `Encounter/${encounter.id}` },
      ...(performer ? { performer: [{ reference: performer }] } : {}),
      effectiveDateTime: DateTime.fromISO(at).plus({ minutes: 1 }).toUTC().toISO()!,
      code: {
        coding: [
          { system: LOINC, code: VITAL_HEAD_CIRCUMFERENCE_LOINC_CODE, display: 'Head Occipital-frontal circumference' },
        ],
        text: VitalFieldNames.VitalHeadCircumference,
      },
      valueQuantity: { value: cm, system: UCUM, unit: 'cm' },
    });
    console.log(`created Observation/${observation.id}`);
    created++;
  }
  console.log(`\ncreated ${created} head-circumference observations`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
