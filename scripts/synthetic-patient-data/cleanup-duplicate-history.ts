/**
 * cleanup-duplicate-history.ts — one-time cleanup of duplicate chart-data
 * history resources accumulated by repeated synth runs before
 * `filterPreExistingHistory` was added to Phase 3.
 *
 * `save-chart-data` writes Patient-bound resources (AllergyIntolerance,
 * MedicationStatement, Condition, Procedure[surgical-history], EpisodeOfCare)
 * without dedup, so each synth rerun for the same Patient previously created
 * duplicate copies of every history item. Phase 3 now filters out items the
 * Patient already has on file, but pre-existing duplicates from older runs
 * stick around until cleaned up.
 *
 * This script groups each tagged resource by a pragmatic dedup key (mirrors
 * `filterPreExistingHistory`), keeps the oldest member of each group (sorted
 * by `meta.lastUpdated` ascending), and deletes the rest. Dry-run by default;
 * pass --execute to actually delete.
 *
 * Usage:
 *   npx env-cmd -f packages/zambdas/.env/synth.json \
 *     npx tsx scripts/synthetic-patient-data/cleanup-duplicate-history.ts \
 *     <patientId> [--execute]
 *
 *   --all  — operate on every Patient tagged with the synth identifier
 *            system (https://synth.ottehr.com/patient). Use with care.
 */
import Oystehr from '@oystehr/sdk';
import type { AllergyIntolerance, Condition, EpisodeOfCare, MedicationStatement, Patient, Procedure } from 'fhir/r4b';
import { SYNTHETIC_PATIENT_ID_SYSTEM as SYNTH_PATIENT_ID_SYSTEM } from './shared/constants';
import { createOystehrFromEnv, searchAllPages } from './shared/oystehr-client';

const args = process.argv.slice(2);
const isExecute = args.includes('--execute');
const all = args.includes('--all');
const positional = args.filter((a) => !a.startsWith('--'));
if (!all && positional.length !== 1) {
  console.error('Usage: tsx cleanup-duplicate-history.ts <patientId> [--execute]');
  console.error('       tsx cleanup-duplicate-history.ts --all [--execute]');
  process.exit(1);
}

const norm = (s: string | undefined): string => (s ?? '').trim().toLowerCase();

interface Category<T> {
  label: string;
  resourceType: T extends { resourceType: infer R } ? R : never;
  tag: string;
  patientParam: 'patient' | 'subject';
  keyOf: (r: T) => string;
}

// One category per chart-data history type.
const CATEGORIES: [
  Category<AllergyIntolerance>,
  Category<MedicationStatement>,
  Category<Condition>,
  Category<Procedure>,
  Category<EpisodeOfCare>,
] = [
  {
    label: 'AllergyIntolerance',
    resourceType: 'AllergyIntolerance',
    tag: 'known-allergy',
    patientParam: 'patient',
    keyOf: (a) => norm(a.code?.coding?.[0]?.display) || norm(a.code?.text),
  },
  {
    label: 'MedicationStatement',
    resourceType: 'MedicationStatement',
    tag: 'current-medication',
    patientParam: 'subject',
    keyOf: (m) => norm(m.medicationCodeableConcept?.coding?.[0]?.display),
  },
  {
    label: 'Condition (medical-condition)',
    resourceType: 'Condition',
    tag: 'medical-condition',
    patientParam: 'subject',
    keyOf: (c) => norm(c.code?.coding?.[0]?.code) || norm(c.code?.coding?.[0]?.display) || norm(c.code?.text),
  },
  {
    label: 'Procedure (surgical-history)',
    resourceType: 'Procedure',
    tag: 'surgical-history',
    patientParam: 'subject',
    keyOf: (p) => norm(p.code?.coding?.[0]?.code) || norm(p.code?.coding?.[0]?.display) || norm(p.note?.[0]?.text),
  },
  {
    label: 'EpisodeOfCare (hospitalization)',
    resourceType: 'EpisodeOfCare',
    tag: 'hospitalization',
    patientParam: 'patient',
    keyOf: (e) => norm(e.type?.[0]?.text),
  },
];

async function cleanupForPatient(oystehr: Oystehr, patientId: string): Promise<void> {
  console.log(`\n── Patient/${patientId} ──`);
  let totalDeleted = 0;
  let totalKept = 0;

  for (const cat of CATEGORIES) {
    const result = await oystehr.fhir.search<unknown>({
      resourceType: cat.resourceType as 'AllergyIntolerance',
      params: [
        { name: cat.patientParam, value: `Patient/${patientId}` },
        { name: '_tag', value: cat.tag },
        { name: '_count', value: '500' },
      ],
    });
    const resources = result.unbundle() as Array<{
      id?: string;
      meta?: { lastUpdated?: string };
    }>;

    const groups = new Map<string, typeof resources>();
    for (const r of resources) {
      const key = (cat.keyOf as (r: unknown) => string)(r);
      if (!key) continue; // skip unkeyable rows
      const list = groups.get(key) ?? [];
      list.push(r);
      groups.set(key, list);
    }

    let catDeleted = 0;
    let catKept = 0;
    for (const [key, members] of groups) {
      members.sort((a, b) => (a.meta?.lastUpdated ?? '').localeCompare(b.meta?.lastUpdated ?? ''));
      const [keeper, ...dupes] = members;
      catKept += 1;
      if (dupes.length === 0) continue;
      console.log(`  ${cat.label} "${key}": keeping ${keeper.id}, deleting ${dupes.length} duplicate(s)`);
      for (const d of dupes) {
        if (!d.id) continue;
        if (isExecute) {
          try {
            await oystehr.fhir.delete({ resourceType: cat.resourceType as 'AllergyIntolerance', id: d.id });
            catDeleted += 1;
          } catch (err) {
            console.warn(`    ✗ delete ${cat.label}/${d.id}: ${err instanceof Error ? err.message : err}`);
          }
        } else {
          catDeleted += 1;
        }
      }
    }

    if (catDeleted || catKept) {
      console.log(`  ${cat.label}: kept ${catKept}, ${isExecute ? 'deleted' : 'would delete'} ${catDeleted}`);
    }
    totalKept += catKept;
    totalDeleted += catDeleted;
  }

  console.log(`  TOTAL: kept ${totalKept}, ${isExecute ? 'deleted' : 'would delete'} ${totalDeleted}`);
}

async function main(): Promise<void> {
  console.log(`Mode: ${isExecute ? 'EXECUTE' : 'DRY RUN'}`);

  const oystehr = await createOystehrFromEnv();

  const patientIds: string[] = [];
  if (all) {
    // Paginate — the synth population can be thousands of patients; a fixed cap
    // would silently de-dupe only the first page.
    const synthPatients = await searchAllPages<Patient>(oystehr, 'Patient', [
      { name: 'identifier', value: `${SYNTH_PATIENT_ID_SYSTEM}|` },
    ]);
    for (const p of synthPatients) if (p.id) patientIds.push(p.id);
    console.log(`Found ${patientIds.length} synth-tagged Patient(s)`);
  } else {
    patientIds.push(positional[0]);
  }

  for (const pid of patientIds) {
    await cleanupForPatient(oystehr, pid);
  }

  if (!isExecute) {
    console.log('\nDry-run only. Re-run with --execute to actually delete.');
  }
}

main().catch((err) => {
  console.error('Fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
