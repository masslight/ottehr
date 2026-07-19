/**
 * backfill-appointment-hash.ts — best-effort backfill of the stable `appointmentHash` dedup key
 * into existing manifest records + caseNNN.json metas (records harvested before the dual-key fix).
 *
 * Why: some practice stacks replace/recreate Encounter resources (live probe: ~113/117 encounter
 * ids changed one day after harvest), so the stored encounterHash no longer resolves and repeat
 * harvests would re-import overlapping visits. Appointment ids are stable, so appointmentHash is
 * the forward-looking dedup key; this script retrofits it where it can:
 *
 *   Phase A (direct): re-run the report over a window, resolve each appointmentId -> Encounter,
 *     hash the encounter id — records whose stored encounterHash still resolves get patched
 *     directly.
 *   Phase B (unique-date): remaining records are matched to unconsumed report rows by
 *     (appointmentDate + aiType + visitType), but ONLY when that key is unique within both the
 *     pending records and the remaining rows; ambiguous keys are skipped and counted.
 *
 * Idempotent (records already carrying appointmentHash are skipped). Env: identical to
 * harvest-prod-cases.ts; set HARVEST_DAYS to cover the window the target cases came from.
 * PHI safety: stdout carries only counts, dates, and caseIds.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Encounter } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  AMBIENT_SCRIBE_MARKER,
  buildReportChunks,
  describeError,
  fetchReportChunked,
  guarded,
  hashId,
  initFromEnv,
  loadManifest,
  ManifestRecord,
  resolveHarvestWindow,
  UnauthorizedError,
} from './harvest-prod-cases';

interface DateMatchable {
  appointmentDate?: string;
  aiType?: string;
  visitType?: string;
}

function dateMatchKey(rec: DateMatchable): string | undefined {
  if (!rec.appointmentDate) return undefined;
  return `${rec.appointmentDate}|${rec.aiType ?? ''}|${rec.visitType ?? ''}`;
}

/**
 * Phase-B matcher: pair pending records with report rows by (appointmentDate|aiType|visitType),
 * only where the key is unique within BOTH sets. Pure; exported for tests.
 */
export function matchPendingByUniqueDate(
  pending: (DateMatchable & { caseId: string })[],
  rows: (DateMatchable & { appointmentId: string })[]
): { matches: { caseId: string; appointmentId: string }[]; ambiguous: string[]; unmatched: string[] } {
  const countByKey = (keys: (string | undefined)[]): Map<string, number> => {
    const counts = new Map<string, number>();
    for (const k of keys) {
      if (k == null) continue;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return counts;
  };
  const pendingCounts = countByKey(pending.map(dateMatchKey));
  const rowCounts = countByKey(rows.map(dateMatchKey));

  const matches: { caseId: string; appointmentId: string }[] = [];
  const ambiguous: string[] = [];
  const unmatched: string[] = [];
  for (const rec of pending) {
    const key = dateMatchKey(rec);
    if (key == null || (rowCounts.get(key) ?? 0) === 0) {
      unmatched.push(rec.caseId);
      continue;
    }
    if (pendingCounts.get(key) !== 1 || rowCounts.get(key) !== 1) {
      ambiguous.push(rec.caseId);
      continue;
    }
    const row = rows.find((r) => dateMatchKey(r) === key)!;
    matches.push({ caseId: rec.caseId, appointmentId: row.appointmentId });
  }
  return { matches, ambiguous, unmatched };
}

async function main(): Promise<void> {
  const { oystehr, outDir, days, chunkDays, locationIds } = initFromEnv();

  const manifestPath = join(outDir, 'manifest.json');
  if (!existsSync(manifestPath)) {
    console.error('No manifest.json in the output directory — nothing to backfill');
    process.exit(1);
  }
  const manifest = loadManifest(outDir);
  const pendingRecs = manifest.filter((r) => !r.appointmentHash);
  console.log(
    `Cases: ${manifest.length} in manifest, ${manifest.length - pendingRecs.length} already keyed, ${
      pendingRecs.length
    } pending`
  );
  if (pendingRecs.length === 0) {
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

  const tally = { direct: 0, dateMatched: 0, ambiguous: 0, unmatched: 0, missingCase: 0, error: 0 };

  /** Patch appointmentHash into a manifest record + its case file; persists the manifest. */
  const applyPatch = (rec: ManifestRecord, appointmentHash: string, how: string): void => {
    rec.appointmentHash = appointmentHash;
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    const casePath = join(outDir, `${rec.caseId}.json`);
    if (existsSync(casePath)) {
      const caseFile = JSON.parse(readFileSync(casePath, 'utf-8'));
      if (caseFile?.meta?.appointmentHash !== appointmentHash) {
        caseFile.meta = { ...(caseFile.meta ?? {}), appointmentHash };
        writeFileSync(casePath, JSON.stringify(caseFile, null, 2));
      }
    } else {
      tally.missingCase += 1;
    }
    console.log(`${rec.caseId}: appointmentHash patched (${how})`);
  };

  // Phase A: direct encounter-hash matches (works only where the Encounter was not recreated)
  const consumedRows = new Set<number>();
  for (let i = 0; i < ambient.length; i++) {
    if (!pendingRecs.some((r) => !r.appointmentHash)) break;
    const item = ambient[i];
    if (!item.appointmentId) continue;
    try {
      const encBundle = await guarded(() =>
        oystehr.fhir.search<Encounter>({
          resourceType: 'Encounter',
          params: [{ name: 'appointment', value: `Appointment/${item.appointmentId}` }],
        })
      );
      const encounterId = encBundle.unbundle()[0]?.id;
      if (!encounterId) continue;
      const rec = pendingRecs.find((r) => !r.appointmentHash && r.encounterHash === hashId(encounterId));
      if (!rec) continue;
      applyPatch(rec, hashId(String(item.appointmentId)), 'direct encounter match');
      consumedRows.add(i);
      tally.direct += 1;
    } catch (err) {
      if (err instanceof UnauthorizedError) throw err;
      tally.error += 1;
      // no describeError here: per-encounter FHIR errors can embed id-bearing request URLs
      console.log('skipped: error (unexpected failure)');
    }
  }

  // Phase B: unique-(date|aiType|visitType) matches among what's left
  const remainingPending = pendingRecs.filter((r) => !r.appointmentHash);
  const remainingRows = ambient
    .filter((_, i) => !consumedRows.has(i))
    .flatMap((item) =>
      item.appointmentId
        ? [
            {
              appointmentId: String(item.appointmentId),
              appointmentDate: item.appointmentStart
                ? DateTime.fromISO(item.appointmentStart).toFormat('yyyy-LL-dd')
                : undefined,
              aiType: item.aiType,
              visitType: item.visitType,
            },
          ]
        : []
    );
  const { matches, ambiguous, unmatched } = matchPendingByUniqueDate(remainingPending, remainingRows);
  for (const m of matches) {
    const rec = pendingRecs.find((r) => r.caseId === m.caseId);
    if (!rec) continue;
    applyPatch(rec, hashId(m.appointmentId), 'unique-date match');
    tally.dateMatched += 1;
  }
  tally.ambiguous = ambiguous.length;
  tally.unmatched = unmatched.length;

  console.log(
    `Done. direct=${tally.direct} dateMatched=${tally.dateMatched} ambiguous=${tally.ambiguous} ` +
      `unmatched=${tally.unmatched} missingCaseFiles=${tally.missingCase} errors=${tally.error}`
  );
}

// Run only when executed directly, so tests can import matchPendingByUniqueDate without side effects.
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
