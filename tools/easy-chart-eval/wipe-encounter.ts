/**
 * wipe-encounter.ts — delete every chart-data FHIR resource
 * for ONE encounter so an empty easy-chart view can be re-populated from a
 * narrative. Leaves Patient, Encounter, Appointment, Coverage, RelatedPerson,
 * QuestionnaireResponse, Account intact so the visit can still be viewed
 * in the regular EHR.
 *
 * Resources wiped (all filtered by encounter or patient+encounter):
 *   - Condition (PMH + encounter diagnoses)
 *   - Observation (vitals + exam findings)
 *   - Procedure (encounter procedures + surgical history)
 *   - AllergyIntolerance (patient-bound — only wiped when --include-patient-bound)
 *   - MedicationStatement (patient-bound — same)
 *   - EpisodeOfCare (patient-bound — same)
 *   - DocumentReference (encounter only)
 *   - List (chart-data lists for the encounter)
 *   - ChargeItem (encounter E&M + CPTs)
 *   - Communication (narrative free-text)
 *
 * Usage:
 *   npx env-cmd -f packages/zambdas/.env/zambda-secrets-local.json \
 *     npx tsx tools/easy-chart-eval/wipe-encounter.ts <encounterId> [--execute] [--include-patient-bound]
 *
 * DRY RUN BY DEFAULT — it prints what it would delete and changes nothing until --execute. Manual UI
 * testing without this leaves the encounter carrying every previous run's rows, and the next run's output
 * is then impossible to read: a stale exam finding and a freshly charted one look identical in the note.
 */
import Oystehr from '@oystehr/sdk';
import { apiUrls, mintToken } from './token';

const args = process.argv.slice(2);
const encounterId = args.find((a) => !a.startsWith('--'));
const isExecute = args.includes('--execute');
const includePatientBound = args.includes('--include-patient-bound');

if (!encounterId) {
  console.error(
    'Usage: tsx tools/easy-chart-eval/wipe-encounter.ts <encounterId> [--execute] [--include-patient-bound]'
  );
  process.exit(1);
}

// All chart-data resource types — the easy-chart view aggregates patient-level history (PMH
// conditions, allergies, meds, surgical history, hospitalizations) AND encounter-specific
// items (current diagnoses, exam findings, procedures done this visit), but the underlying
// FHIR resources don't always carry the right `encounter` ref for filtering. Synth test
// patients accumulate prior-encounter data across runs, so to get a clean easy-chart view
// we delete ALL of these by patient.
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
  // Same auth and URL derivation as the eval runners, so one secrets file drives every tool here and
  // this script needs no PROJECT_ID/PROJECT_API of its own.
  const oystehr = new Oystehr({ accessToken: await mintToken(), services: apiUrls() });

  // Resolve patient from the encounter
  const enc = (await oystehr.fhir.get({ resourceType: 'Encounter', id: encounterId })) as {
    subject?: { reference?: string };
  };
  const patientRef = enc.subject?.reference;
  if (!patientRef) throw new Error('Encounter has no subject');
  const patientId = patientRef.split('/')[1];
  console.log(`Encounter ${encounterId} → Patient ${patientId}`);
  console.log(isExecute ? 'MODE: execute' : 'MODE: dry-run');
  console.log(`Patient-bound types: ${includePatientBound ? 'INCLUDED' : 'skipped'}`);
  console.log('');

  const buckets: Array<{ type: string; ids: string[] }> = [];

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
