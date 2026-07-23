/**
 * cleanup-synth-patient.ts — wipe one (or all) synth-tagged Patients and
 * every per-visit FHIR resource produced for them by the synthesize-visit
 * pipeline.
 *
 * Bootstrap-tier data is intentionally NOT touched — leaving these alone
 * means the next synth run can use them without re-bootstrapping:
 *   - Organizations (payers)
 *   - Practitioners (Demo Admin, role assignments)
 *   - Locations / Schedules
 *   - ChargeItemDefinitions (charge master, fee schedule)
 *   - Templates (canonical FHIR resources)
 *   - Medications (formulary)
 *
 * Patient-tier resources deleted, in this order (innermost first to minimise
 * dependency-conflict 409s):
 *
 *   1. Communication, MedicationAdministration, MedicationRequest,
 *      DiagnosticReport, Immunization, Task, ServiceRequest
 *   2. Procedure, Observation, Condition, MedicationStatement,
 *      AllergyIntolerance, EpisodeOfCare, ImagingStudy
 *   3. DocumentReference, List
 *   4. CoverageEligibilityResponse, CoverageEligibilityRequest,
 *      Account, Coverage, RelatedPerson
 *   5. QuestionnaireResponse, Encounter, Appointment
 *   6. Patient
 *
 * Slots themselves are not deleted — they belong to the Schedule, will
 * remain as "booked" but are harmless and the schedule has many of them.
 *
 * Usage:
 *   # Dry-run for a single patient
 *   npx env-cmd -f packages/zambdas/.env/synth.json \
 *     npx tsx scripts/synthetic-patient-data/cleanup-synth-patient.ts <patientId>
 *
 *   # Execute for a single patient
 *   ... <patientId> --execute
 *
 *   # Dry-run for every patient tagged with the synth identifier system
 *   ... --all
 *
 *   # Execute for every synth-tagged patient
 *   ... --all --execute
 *
 *   # Orphan-only mode: delete just the synth pipeline's failed-mid-flight
 *   # Appointments (status='booked' / EHR pre-booked tab), their Encounters,
 *   # QuestionnaireResponses, and harvest Tasks. Patient and other persistent
 *   # resources are left in place. Use this to clean up dashboard clutter
 *   # left by failed runs that predate the in-pipeline try/finally cleanup.
 *   ... <patientId> --orphan-cleanup [--execute]
 *   ... --all --orphan-cleanup [--execute]
 */
import Oystehr from '@oystehr/sdk';
import type { Appointment, Encounter, FhirResource, Patient, QuestionnaireResponse, Task } from 'fhir/r4b';
import { SYNTHETIC_PATIENT_ID_SYSTEM as SYNTH_PATIENT_ID_SYSTEM } from './shared/constants';
import { createOystehrFromEnv, need, searchAllPages } from './shared/oystehr-client';
import { PATIENT_CASCADE_TIERS, type ResourceTypeName } from './shared/patient-cascade';
import { isTransientNetworkError } from './shared/retry';

const args = process.argv.slice(2);
const isExecute = args.includes('--execute');
const all = args.includes('--all');
const orphanCleanup = args.includes('--orphan-cleanup');
// Escape hatch for deleting a Patient that lacks the synthetic identifier
// (e.g. a legacy synth patient created before the identifier system existed).
// Off by default: single-target deletes verify the synth marker first so a
// wrong/real id can never cascade-delete a real chart.
const force = args.includes('--force');
const positional = args.filter((a) => !a.startsWith('--'));
if (!all && positional.length !== 1) {
  console.error('Usage: tsx cleanup-synth-patient.ts <patientId> [--execute] [--orphan-cleanup]');
  console.error('       tsx cleanup-synth-patient.ts --all [--execute] [--orphan-cleanup]');
  process.exit(1);
}

// Search-by-patient surface for each resource type we wipe. Most R4 patient-
// bound resources accept `patient` as a search param; a few use `subject`.
// Tier order matches the deletion plan in the file header. The tier table
// lives in shared/patient-cascade.ts (also consumed by cleanup-test-patients).
const TIERS = PATIENT_CASCADE_TIERS;

interface Counts {
  found: number;
  deleted: number;
  failed: number;
}

async function deleteByPatient(
  oystehr: Oystehr,
  rt: ResourceTypeName,
  param: string,
  patientId: string
): Promise<Counts> {
  const counts: Counts = { found: 0, deleted: 0, failed: 0 };
  const result = await oystehr.fhir.search<FhirResource>({
    resourceType: rt as 'Patient',
    params: [
      { name: param, value: `Patient/${patientId}` },
      { name: '_count', value: '500' },
    ],
  });
  const resources = result.unbundle() as Array<{ id?: string }>;
  counts.found = resources.length;
  if (counts.found === 0) return counts;

  for (const r of resources) {
    if (!r.id) continue;
    if (!isExecute) {
      counts.deleted += 1;
      continue;
    }
    try {
      await oystehr.fhir.delete({ resourceType: rt as 'Patient', id: r.id });
      counts.deleted += 1;
    } catch (err) {
      counts.failed += 1;
      console.warn(`    ✗ delete ${rt}/${r.id}: ${err instanceof Error ? err.message : err}`);
    }
  }
  return counts;
}

/**
 * Orphan-only cleanup: deletes Appointments left at status='booked' (the
 * synth pipeline aborted before Phase 13 walked them to completed) plus
 * their Encounter, QuestionnaireResponse, and harvest Tasks. Patient and
 * everything else is left untouched.
 */
async function cleanupOrphansForPatient(oystehr: Oystehr, patientId: string): Promise<void> {
  console.log(`\n── Patient/${patientId} (orphan-cleanup) ──`);

  // Same safety gate as the full cascade: don't delete a non-synthetic patient's
  // booked appointments on a single-target run. --all is already synth-scoped.
  if (!force) {
    let isSynthetic = false;
    try {
      const p = await oystehr.fhir.get<Patient>({ resourceType: 'Patient', id: patientId });
      isSynthetic = (p.identifier ?? []).some((i) => i.system === SYNTH_PATIENT_ID_SYSTEM);
    } catch (err) {
      if (!isTransientNetworkError(err)) {
        console.warn(`  ⚠ Patient/${patientId} not found — nothing to clean up`);
        return;
      }
      // transient: can't confirm → fall through to the refusal below
    }
    if (!isSynthetic) {
      console.warn(
        `  ⛔ REFUSING orphan-cleanup for Patient/${patientId}: not confirmed synthetic ` +
          `(${SYNTH_PATIENT_ID_SYSTEM}). Pass --force to override.`
      );
      return;
    }
  }

  const tryDelete = async (rt: string, id: string): Promise<boolean> => {
    if (!isExecute) return true;
    try {
      await oystehr.fhir.delete({ resourceType: rt as 'Appointment', id });
      return true;
    } catch (err) {
      console.warn(`    ✗ delete ${rt}/${id}: ${err instanceof Error ? err.message : err}`);
      return false;
    }
  };

  const appts = (
    await oystehr.fhir.search<Appointment>({
      resourceType: 'Appointment',
      params: [
        { name: 'patient', value: `Patient/${patientId}` },
        { name: 'status', value: 'booked' },
        { name: '_count', value: '500' },
      ],
    })
  ).unbundle();

  if (appts.length === 0) {
    console.log('  no orphan (status=booked) Appointments found');
    return;
  }

  let totalDeleted = 0;
  for (const appt of appts) {
    if (!appt.id) continue;
    console.log(`  Appointment/${appt.id} (start=${appt.start ?? '?'})`);

    // Find associated Encounter(s).
    const encs = (
      await oystehr.fhir.search<Encounter>({
        resourceType: 'Encounter',
        params: [{ name: 'appointment', value: `Appointment/${appt.id}` }],
      })
    ).unbundle();

    // QRs by encounter.
    const qrs: QuestionnaireResponse[] = [];
    for (const e of encs) {
      if (!e.id) continue;
      const found = (
        await oystehr.fhir.search<QuestionnaireResponse>({
          resourceType: 'QuestionnaireResponse',
          params: [{ name: 'encounter', value: `Encounter/${e.id}` }],
        })
      ).unbundle();
      qrs.push(...found);
    }

    // Tasks by QR.
    const tasks: Task[] = [];
    for (const qr of qrs) {
      if (!qr.id) continue;
      const found = (
        await oystehr.fhir.search<Task>({
          resourceType: 'Task',
          params: [{ name: 'focus', value: `QuestionnaireResponse/${qr.id}` }],
        })
      ).unbundle();
      tasks.push(...found);
    }

    const verb = isExecute ? 'deleting' : 'would delete';
    if (tasks.length) console.log(`    ${verb} ${tasks.length} Task(s)`);
    for (const t of tasks) if (t.id && (await tryDelete('Task', t.id))) totalDeleted += 1;
    if (qrs.length) console.log(`    ${verb} ${qrs.length} QR(s)`);
    for (const qr of qrs) if (qr.id && (await tryDelete('QuestionnaireResponse', qr.id))) totalDeleted += 1;
    if (encs.length) console.log(`    ${verb} ${encs.length} Encounter(s)`);
    for (const e of encs) if (e.id && (await tryDelete('Encounter', e.id))) totalDeleted += 1;
    console.log(`    ${verb} Appointment`);
    if (await tryDelete('Appointment', appt.id)) totalDeleted += 1;
  }

  const verb = isExecute ? 'deleted' : 'would delete';
  console.log(`  TOTAL: found ${appts.length} orphan(s), ${verb} ${totalDeleted} resource(s)`);
}

async function cleanupForPatient(oystehr: Oystehr, patientId: string): Promise<void> {
  console.log(`\n── Patient/${patientId} ──`);

  // Confirm patient exists + display name for the log. Retry transient
  // network failures so a single fetch hiccup doesn't cause us to silently
  // skip ALL of this patient's resources (which would leave them tied to a
  // surviving Patient, since the synth dedup will reuse the patient on the
  // next run and pile new visits on top of the un-deleted old ones).
  let patientLabel = patientId;
  let patientFound = false;
  let isSynthetic = false;
  for (let attempt = 0; attempt < 3 && !patientFound; attempt++) {
    try {
      const p = await oystehr.fhir.get<Patient>({ resourceType: 'Patient', id: patientId });
      const name = p.name?.[0];
      if (name) {
        const given = (name.given ?? []).join(' ');
        patientLabel = `${given} ${name.family ?? ''}`.trim() || patientId;
      }
      isSynthetic = (p.identifier ?? []).some((i) => i.system === SYNTH_PATIENT_ID_SYSTEM);
      patientFound = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!isTransientNetworkError(err)) {
        console.warn(`  ⚠ Patient/${patientId} not found: ${msg}`);
        return;
      }
      if (attempt === 2) {
        console.warn(`  ⚠ Patient/${patientId} lookup failed after 3 attempts (${msg})`);
        // Can't verify the synthetic marker without the Patient — fall through;
        // the guard below refuses to delete an unverified patient unless --force.
        break;
      }
      const delayMs = 500 * Math.pow(2, attempt);
      console.warn(
        `  ⚠ Patient/${patientId} lookup transient error (attempt ${attempt + 1}/3), retrying in ${delayMs}ms...`
      );
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  console.log(`  patient: ${patientLabel}${isSynthetic ? ' [synthetic]' : ''}`);

  // Safety gate: never cascade-delete a Patient we can't confirm is synthetic.
  // --all already scopes the search to the synthetic identifier system, so those
  // always pass; this only blocks a single-target delete of a real/unknown id
  // (a typo'd or copy-pasted production id) unless the operator passes --force.
  if (!isSynthetic && !force) {
    if (!patientFound) {
      console.warn(
        `  ⛔ REFUSING to delete Patient/${patientId}: could not fetch it to confirm the synthetic ` +
          `identifier (${SYNTH_PATIENT_ID_SYSTEM}). Re-run when reachable, or pass --force to override.`
      );
    } else {
      console.warn(
        `  ⛔ REFUSING to delete Patient/${patientId}: it does NOT carry the synthetic identifier ` +
          `(${SYNTH_PATIENT_ID_SYSTEM}) — it looks like real data. Pass --force only if you are certain.`
      );
    }
    return;
  }

  let totalFound = 0;
  let totalDeleted = 0;
  let totalFailed = 0;

  // Walk each tier sequentially, AND delete types WITHIN a tier sequentially in
  // listed (referencer-before-referenced) order. Parallel within-tier deletes
  // raced reference chains — e.g. Encounter deleted while its QuestionnaireResponse
  // still pointed at it, or Coverage while its Account did — producing 409s that
  // left the parent (and then the Patient) undeleted. See PATIENT_CASCADE_TIERS.
  for (let i = 0; i < TIERS.length; i++) {
    const tier = TIERS[i];
    const tierResults: Array<{ rt: ResourceTypeName; param: string; counts: Counts }> = [];
    for (const t of tier) {
      tierResults.push({ ...t, counts: await deleteByPatient(oystehr, t.rt, t.param, patientId) });
    }
    for (const tr of tierResults) {
      if (tr.counts.found > 0) {
        const verb = isExecute ? 'deleted' : 'would delete';
        const failedNote = tr.counts.failed ? ` (${tr.counts.failed} failed)` : '';
        console.log(`  [tier ${i + 1}] ${tr.rt}: found ${tr.counts.found}, ${verb} ${tr.counts.deleted}${failedNote}`);
      }
      totalFound += tr.counts.found;
      totalDeleted += tr.counts.deleted;
      totalFailed += tr.counts.failed;
    }
  }

  // 6. Patient itself.
  if (isExecute) {
    try {
      await oystehr.fhir.delete({ resourceType: 'Patient', id: patientId });
      totalDeleted += 1;
      console.log(`  [tier 6] Patient: deleted`);
    } catch (err) {
      totalFailed += 1;
      console.warn(`  [tier 6] Patient: delete failed — ${err instanceof Error ? err.message : err}`);
    }
  } else {
    totalDeleted += 1;
    console.log(`  [tier 6] Patient: would delete`);
  }
  totalFound += 1;

  const verb = isExecute ? 'deleted' : 'would delete';
  console.log(`  TOTAL: found ${totalFound}, ${verb} ${totalDeleted}, failed ${totalFailed}`);
}

async function main(): Promise<void> {
  console.log(`Mode: ${isExecute ? 'EXECUTE' : 'DRY RUN'}${orphanCleanup ? ' (orphan-cleanup only)' : ''}`);
  console.log(`Project: ${need('PROJECT_ID')}`);

  const oystehr = await createOystehrFromEnv();

  const patientIds: string[] = [];
  if (all) {
    // Paginate — a population build creates ~2,560 synth patients, well past any
    // single-page cap. The old `_count:500` silently cleaned only the first 500
    // while logging "Found 500", reading as if the wipe were complete.
    const synthPatients = await searchAllPages<Patient>(oystehr, 'Patient', [
      { name: 'identifier', value: `${SYNTH_PATIENT_ID_SYSTEM}|` },
    ]);
    for (const p of synthPatients) if (p.id) patientIds.push(p.id);
    console.log(`Found ${patientIds.length} synth-tagged Patient(s)`);
  } else {
    patientIds.push(positional[0]);
  }

  if (!patientIds.length) {
    console.log('Nothing to clean up.');
    return;
  }

  for (const pid of patientIds) {
    if (orphanCleanup) {
      await cleanupOrphansForPatient(oystehr, pid);
    } else {
      await cleanupForPatient(oystehr, pid);
    }
  }

  if (!isExecute) {
    console.log('\nDry-run only. Re-run with --execute to actually delete.');
  }
}

main().catch((err) => {
  console.error('Fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
