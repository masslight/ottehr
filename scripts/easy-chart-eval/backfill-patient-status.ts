/**
 * backfill-patient-status.ts — idempotently backfills `meta.patientStatus` into existing
 * harvested `caseNNN.json` files (cases harvested before the patientStatus fix, or where the
 * derivation previously failed).
 *
 * Case files store only an opaque sha256 `encounterHash` (no FHIR ids), so the mapping is
 * recovered by re-running the ai-assisted-encounters report over a window (same chunked/retry
 * fetch as the harvester), resolving each appointmentId -> Encounter, hashing the encounter id,
 * and matching manifest records by encounterHash. Matches missing `meta.patientStatus` get it
 * derived with the fixed logic (appointmentStart anchor fallback, no server-side `date` param)
 * and patched in place. Cases already carrying `patientStatus` are skipped.
 *
 * Env: identical to harvest-prod-cases.ts — OYSTEHR_ACCESS_TOKEN / OYSTEHR_PROJECT_ID /
 * OYSTEHR_ZAMBDA_API_URL / OYSTEHR_FHIR_API_URL required; HARVEST_OUT_DIR, HARVEST_DAYS,
 * HARVEST_CHUNK_DAYS, HARVEST_LOCATION_IDS honored. Set HARVEST_DAYS to cover the window the
 * target cases were harvested from.
 *
 * PHI safety: stdout carries only counts, dates, caseIds, and statuses — never ids or content.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Encounter } from 'fhir/r4b';
import {
  AMBIENT_SCRIBE_MARKER,
  buildReportChunks,
  derivePatientStatus,
  describeError,
  fetchReportChunked,
  guarded,
  hashId,
  initFromEnv,
  loadManifest,
  resolveHarvestWindow,
  UnauthorizedError,
} from './harvest-prod-cases';

async function main(): Promise<void> {
  const { oystehr, outDir, days, chunkDays, locationIds } = initFromEnv();

  if (!existsSync(join(outDir, 'manifest.json'))) {
    console.error('No manifest.json in the output directory — nothing to backfill');
    process.exit(1);
  }
  const manifest = loadManifest(outDir);

  // hash -> caseId for cases whose file exists and lacks meta.patientStatus. Keyed by BOTH
  // encounterHash and (when present) appointmentHash: Encounters can be recreated between
  // harvest and backfill, changing their ids, while appointment ids stay stable.
  const pending = new Map<string, string>();
  let alreadySet = 0;
  let missingFile = 0;
  for (const rec of manifest) {
    const path = join(outDir, `${rec.caseId}.json`);
    if (!existsSync(path)) {
      missingFile += 1;
      continue;
    }
    const caseFile = JSON.parse(readFileSync(path, 'utf-8'));
    if (caseFile?.meta?.patientStatus) {
      alreadySet += 1;
      continue;
    }
    pending.set(rec.encounterHash, rec.caseId);
    if (rec.appointmentHash) pending.set(rec.appointmentHash, rec.caseId);
  }
  const pendingCases = new Set(pending.values()).size;
  console.log(
    `Cases: ${manifest.length} in manifest, ${alreadySet} already set, ${pendingCases} pending` +
      `${missingFile ? `, ${missingFile} missing case files` : ''}`
  );
  if (pending.size === 0) {
    console.log('Nothing to backfill.');
    return;
  }

  const { start, end } = resolveHarvestWindow(days);
  console.log(
    `Backfill window: ${start.toFormat('yyyy-LL-dd')} .. ${end.toFormat('yyyy-LL-dd')} ` +
      `(${buildReportChunks(start, end, chunkDays).length} chunk(s) of <=${chunkDays}d)` +
      `${locationIds.length ? ` (locations: ${locationIds.length})` : ''}`
  );

  const { items, failedChunks, totalChunks } = await fetchReportChunked(oystehr, {
    start,
    end,
    chunkDays,
    locationIds,
  });
  if (totalChunks > 0 && failedChunks === totalChunks) {
    console.error(`All ${totalChunks} report chunks failed — aborting`);
    process.exit(1);
  }
  if (failedChunks > 0) {
    console.log(`Continuing with a PARTIAL backfill: ${failedChunks}/${totalChunks} chunks failed`);
  }

  const ambient = items.filter((e) => (e.aiType ?? '').toLowerCase().includes(AMBIENT_SCRIBE_MARKER));
  console.log(`Report returned ${items.length} encounters, ${ambient.length} with ambient scribe`);

  const tally = { patched: 0, unresolved: 0, unmatched: 0, error: 0 };

  for (const item of ambient) {
    if (pending.size === 0) break; // everything matched — stop resolving encounters
    try {
      const encBundle = await guarded(() =>
        oystehr.fhir.search<Encounter>({
          resourceType: 'Encounter',
          params: [{ name: 'appointment', value: `Appointment/${item.appointmentId}` }],
        })
      );
      const encounter = encBundle.unbundle()[0];
      if (!encounter?.id) {
        tally.unmatched += 1;
        continue;
      }
      // match by either key (see pending-map comment)
      const caseId =
        pending.get(hashId(encounter.id)) ??
        (item.appointmentId ? pending.get(hashId(String(item.appointmentId))) : undefined);
      if (!caseId) {
        tally.unmatched += 1;
        continue;
      }

      const patientStatus = await derivePatientStatus(oystehr, encounter, item.appointmentStart);
      if (!patientStatus) {
        tally.unresolved += 1;
        console.log(`${caseId}: status unresolved`);
        continue;
      }

      const path = join(outDir, `${caseId}.json`);
      const caseFile = JSON.parse(readFileSync(path, 'utf-8'));
      caseFile.meta = { ...(caseFile.meta ?? {}), patientStatus };
      writeFileSync(path, JSON.stringify(caseFile, null, 2));
      // drop every key pointing at this case (it may be registered under both hashes)
      for (const [key, value] of pending) {
        if (value === caseId) pending.delete(key);
      }
      tally.patched += 1;
      console.log(`${caseId}: patched (${patientStatus})`);
    } catch (err) {
      if (err instanceof UnauthorizedError) throw err;
      tally.error += 1;
      // no describeError here: per-encounter FHIR errors can embed id-bearing request URLs
      console.log('skipped: error (unexpected failure)');
    }
  }

  console.log(
    `Done. patched=${tally.patched} unresolved=${tally.unresolved} unmatchedItems=${tally.unmatched} ` +
      `errors=${tally.error} stillPending=${new Set(pending.values()).size}`
  );
}

// Run only when executed directly (mirrors harvest-prod-cases.ts).
const isDirectRun = process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch((err) => {
    if (err instanceof UnauthorizedError) {
      console.error('Access token expired or unauthorized — re-extract the token and re-run');
      process.exit(1);
    }
    // Keep top-level failures free of patient content.
    console.error(`Fatal: ${describeError(err)}`);
    process.exit(1);
  });
}
