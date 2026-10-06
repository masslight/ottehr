/**
 * Deletes chart data so an easy-chart view can be re-populated from a narrative: the encounter's ChargeItems
 * and every chart-data resource of its patient, across all of that patient's encounters. Patient, Encounter,
 * Appointment, Coverage, RelatedPerson, QuestionnaireResponse and Account are kept.
 *
 * Dry run by default: prints what it would delete and changes nothing until --execute.
 *
 * Usage:
 *   npx env-cmd -f packages/zambdas/.env/zambda-secrets-local.json \
 *     npx tsx tools/easy-chart-eval/wipe-encounter.ts <encounterId> [--execute]
 */
import Oystehr from '@oystehr/sdk';
import { apiUrls, mintToken } from './token';

const args = process.argv.slice(2);
const encounterIdArg = args.find((a) => !a.startsWith('--'));
const isExecute = args.includes('--execute');

if (!encounterIdArg) {
  console.error('Usage: tsx tools/easy-chart-eval/wipe-encounter.ts <encounterId> [--execute]');
  process.exit(1);
}
const encounterId: string = encounterIdArg;

// Deleted by patient, not encounter: the easy-chart view also shows patient-level history, and not every
// chart resource carries a usable `encounter` reference.
const PATIENT_BOUND_TYPES = [
  'Condition',
  'Observation',
  'Procedure',
  'DocumentReference',
  'List',
  'Communication',
  'ClinicalImpression', // MDM lives here
  'ServiceRequest', // easy-chart "procedures" (e.g. Laceration Repair) live here, not in Procedure
  'AllergyIntolerance',
  'MedicationStatement', // in-house / dictated meds
  'MedicationRequest', // eRx prescriptions charted by easy-chart (e.g. amoxicillin-clavulanate)
  'MedicationAdministration', // administered meds
  'EpisodeOfCare',
] as const;

const ENCOUNTER_BOUND_TYPES = ['ChargeItem'] as const;

async function main(): Promise<void> {
  // Same auth and URL derivation as the eval runners, so one secrets file drives every tool here.
  const oystehr = new Oystehr({ accessToken: await mintToken(), services: apiUrls() });

  const enc = (await oystehr.fhir.get({ resourceType: 'Encounter', id: encounterId })) as {
    subject?: { reference?: string };
  };
  const patientRef = enc.subject?.reference;
  if (!patientRef) throw new Error('Encounter has no subject');
  const patientId = patientRef.split('/')[1];
  console.log(`Encounter ${encounterId} → Patient ${patientId}`);
  console.log(isExecute ? 'MODE: execute' : 'MODE: dry-run');
  console.log('');

  const buckets: {
    type: (typeof PATIENT_BOUND_TYPES)[number] | (typeof ENCOUNTER_BOUND_TYPES)[number];
    ids: string[];
  }[] = [];

  // ChargeItem uses "context" for the Encounter reference in FHIR R4.
  for (const type of ENCOUNTER_BOUND_TYPES) {
    const results = (
      await oystehr.fhir.search({
        resourceType: type,
        params: [{ name: 'context', value: `Encounter/${encounterId}` }],
      })
    ).unbundle() as Array<{ id?: string }>;
    buckets.push({ type, ids: results.map((r) => r.id).filter((x): x is string => !!x) });
  }

  for (const type of PATIENT_BOUND_TYPES) {
    const results = (
      await oystehr.fhir.search({
        resourceType: type,
        params: [{ name: 'patient', value: `Patient/${patientId}` }],
      })
    ).unbundle() as Array<{ id?: string }>;
    buckets.push({ type, ids: results.map((r) => r.id).filter((x): x is string => !!x) });
  }

  console.log('Resources to delete:');
  let total = 0;
  for (const b of buckets) {
    console.log(`  ${b.type}: ${b.ids.length}`);
    total += b.ids.length;
  }
  console.log(`  TOTAL: ${total}`);

  if (!isExecute) {
    console.log('\n(dry-run — pass --execute to actually delete)');
    return;
  }

  console.log('\nDeleting...');
  let deleted = 0;
  let failed = 0;
  for (const b of buckets) {
    for (const id of b.ids) {
      try {
        await oystehr.fhir.delete({ resourceType: b.type, id });
        deleted++;
      } catch (e) {
        failed++;
        console.error(`  FAILED ${b.type}/${id}: ${e instanceof Error ? e.message : e}`);
      }
    }
  }
  console.log(`Done. deleted=${deleted} failed=${failed}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
