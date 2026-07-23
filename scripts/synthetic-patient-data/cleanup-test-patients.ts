/**
 * cleanup-test-patients.ts — delete test patients and their related resources.
 *
 * Finds Patients matching --email or --identifier and deletes them along with
 * everything that references them: Appointments, Encounters, Coverages,
 * RelatedPersons, QuestionnaireResponses, AllergyIntolerances,
 * MedicationStatements, Conditions, Observations, Communications.
 *
 * Defaults to dry-run. Requires --execute to actually delete.
 *
 * Usage:
 *   npx env-cmd -f packages/zambdas/.env/<env>.json \
 *     npx tsx scripts/synthetic-patient-data/cleanup-test-patients.ts \
 *     --email jane.doe.synth@example.com [--execute]
 *
 *   npx env-cmd -f packages/zambdas/.env/<env>.json \
 *     npx tsx scripts/synthetic-patient-data/cleanup-test-patients.ts \
 *     --identifier 'https://fhir.ottehr.com/sid/synthetic-patient-id|jane-doe-1990-05-15' [--execute]
 *
 * Env (required): AUTH0_ENDPOINT, AUTH0_CLIENT, AUTH0_SECRET, AUTH0_AUDIENCE,
 * PROJECT_ID, PROJECT_API.
 */
import Oystehr from '@oystehr/sdk';
import type { Patient, Resource } from 'fhir/r4b';
import { arg, flag } from './shared/cli';
import { SYNTHETIC_PATIENT_ID_SYSTEM } from './shared/constants';
import { createOystehrFromEnv, need } from './shared/oystehr-client';
import { PATIENT_CASCADE_TIERS } from './shared/patient-cascade';

const email = arg('--email');
const identifier = arg('--identifier');
const isExecute = flag('--execute');
// By default only delete patients confirmed synthetic (carry the synthetic
// identifier). --email can match real/shared addresses, so without --force a
// non-synthetic match is skipped rather than wiped.
const force = flag('--force');

if (!email && !identifier) {
  console.error('Usage: tsx cleanup-test-patients.ts --email <email> | --identifier <system|value> [--execute]');
  process.exit(1);
}

// Resource types that point to a Patient, with the search param to use — the
// shared delete-cascade table, flattened (innermost types first, Patient last).
// Previously this file kept its own narrower list, which drifted from
// cleanup-synth-patient's (missing ServiceRequest, DiagnosticReport, Task, …).
const RELATED_TYPES: Array<{ resourceType: string; param: string }> = PATIENT_CASCADE_TIERS.flat().map(
  ({ rt, param }) => ({ resourceType: rt, param })
);

async function findRelatedResources(oystehr: Oystehr, patientId: string): Promise<Resource[]> {
  const all: Resource[] = [];
  for (const { resourceType, param } of RELATED_TYPES) {
    try {
      const result = await oystehr.fhir.search({
        resourceType: resourceType as Parameters<typeof oystehr.fhir.search>[0]['resourceType'],
        params: [
          { name: param, value: `Patient/${patientId}` },
          { name: '_count', value: '500' },
        ],
      });
      all.push(...result.unbundle());
    } catch (err) {
      console.warn(
        `  warn: search ${resourceType}?${param}=Patient/${patientId} failed: ${
          err instanceof Error ? err.message : err
        }`
      );
    }
  }
  return all;
}

async function main(): Promise<void> {
  console.log(`Mode: ${isExecute ? 'EXECUTE' : 'DRY RUN'}`);
  console.log(`Project: ${need('PROJECT_ID')}`);
  console.log(`Match: ${email ? `email="${email}"` : `identifier="${identifier}"`}`);
  console.log('');

  const oystehr = await createOystehrFromEnv();

  // Find target Patients
  const params: Array<{ name: string; value: string }> = [{ name: '_count', value: '100' }];
  if (email) params.push({ name: 'email', value: email });
  if (identifier) params.push({ name: 'identifier', value: identifier });
  const patientResult = await oystehr.fhir.search<Patient>({ resourceType: 'Patient', params });
  const patients = patientResult.unbundle();
  console.log(`Found ${patients.length} matching Patients.`);
  if (patients.length === 0) return;

  let totalDeleted = 0;
  let totalFailed = 0;

  let skippedNonSynth = 0;
  for (const patient of patients) {
    if (!patient.id) continue;
    console.log('');
    const isSynthetic = (patient.identifier ?? []).some((i) => i.system === SYNTHETIC_PATIENT_ID_SYSTEM);
    console.log(`── Patient ${patient.id}${isSynthetic ? ' [synthetic]' : ''}`);
    if (!isSynthetic && !force) {
      console.warn(
        `  ⛔ SKIPPING: not confirmed synthetic (${SYNTHETIC_PATIENT_ID_SYSTEM}) — looks like real data. ` +
          `Pass --force to delete anyway.`
      );
      skippedNonSynth += 1;
      continue;
    }
    const related = await findRelatedResources(oystehr, patient.id);
    const byType: Record<string, number> = {};
    for (const r of related) byType[r.resourceType] = (byType[r.resourceType] ?? 0) + 1;
    for (const [t, n] of Object.entries(byType)) console.log(`  ${t}: ${n}`);

    if (!isExecute) {
      console.log(`  (dry-run — would delete ${related.length} related resource(s) + the Patient)`);
      continue;
    }

    // Delete related first
    for (const r of related) {
      try {
        await oystehr.fhir.delete({ resourceType: r.resourceType as 'Patient', id: r.id! });
        totalDeleted += 1;
      } catch (err) {
        console.warn(`  ✗ delete ${r.resourceType}/${r.id} failed: ${err instanceof Error ? err.message : err}`);
        totalFailed += 1;
      }
    }
    // Then the Patient
    try {
      await oystehr.fhir.delete({ resourceType: 'Patient', id: patient.id });
      totalDeleted += 1;
      console.log(`  ✓ deleted Patient ${patient.id} + ${related.length} related`);
    } catch (err) {
      console.warn(`  ✗ delete Patient/${patient.id} failed: ${err instanceof Error ? err.message : err}`);
      totalFailed += 1;
    }
  }

  console.log('');
  console.log(`-- summary --`);
  console.log(`Patients matched: ${patients.length}`);
  if (skippedNonSynth) console.log(`Skipped (not synthetic, no --force): ${skippedNonSynth}`);
  console.log(`Resources deleted: ${totalDeleted}`);
  console.log(`Failures: ${totalFailed}`);
  if (!isExecute) console.log('Dry-run only. Re-run with --execute to actually delete.');
}

main().catch((err) => {
  console.error('Fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
