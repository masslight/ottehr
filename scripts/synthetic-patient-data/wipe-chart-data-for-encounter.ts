/**
 * wipe-chart-data-for-encounter.ts — delete every chart-data FHIR resource
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
 *   npx env-cmd -f packages/zambdas/.env/local.json \
 *     npx tsx scripts/synthetic-patient-data/wipe-chart-data-for-encounter.ts \
 *     <encounterId> [--execute] [--include-patient-bound]
 */
import Oystehr from '@oystehr/sdk';

const args = process.argv.slice(2);
const encounterId = args.find((a) => !a.startsWith('--'));
const isExecute = args.includes('--execute');
const includePatientBound = args.includes('--include-patient-bound');

if (!encounterId) {
  console.error('Usage: tsx wipe-chart-data-for-encounter.ts <encounterId> [--execute] [--include-patient-bound]');
  process.exit(1);
}

function need(n: string): string {
  const v = process.env[n];
  if (!v) throw new Error(`Missing env: ${n}`);
  return v;
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
  'MedicationStatement',
  'EpisodeOfCare',
] as const;

const ENCOUNTER_BOUND_TYPES = ['ChargeItem'] as const;

async function main(): Promise<void> {
  const tokenRes = await fetch(need('AUTH0_ENDPOINT'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: need('AUTH0_CLIENT'),
      client_secret: need('AUTH0_SECRET'),
      audience: need('AUTH0_AUDIENCE'),
      grant_type: 'client_credentials',
    }),
  });
  if (!tokenRes.ok) throw new Error(`auth failed: ${tokenRes.status} ${await tokenRes.text()}`);
  const { access_token } = (await tokenRes.json()) as { access_token: string };
  const oystehr = new Oystehr({
    accessToken: access_token,
    projectId: need('PROJECT_ID'),
    services: { projectApiUrl: need('PROJECT_API') },
  });

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
