import Oystehr from '@oystehr/sdk';
import { Claim, DocumentReference } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { ReportDateWindowParams, ReportDateWindowParamsSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { GetBillingPipelineReportResponse, PipelineReportRow } from 'utils/lib/types/data/billing/billing.types';
import { AR_STAGE, getActiveStatusGroup, getClaimStatusValues } from 'utils/lib/types/data/billing/claim-status';
import { gunzipSync, gzipSync } from 'zlib';
import { ReportDefinition } from '../framework/types';

const REPORT_IDENTIFIER_SYSTEM = ottehrIdentifierSystem('billing-report');
const HISTORY_KEY = 'pipeline-report-history:v1';
// stay well under FHIR resource size limits
const MAX_CACHE_BYTES = 4 * 1024 * 1024;
const HISTORY_MAX_DAYS = 180;
// insurance AR claims with no update for this long count as stale
const STALE_DAYS = 30;

interface PipelineSnapshot {
  // ISO date the snapshot was taken (one per day, latest run wins)
  date: string;
  rows: PipelineReportRow[];
}

type PipelineReportPayload = Omit<GetBillingPipelineReportResponse, 'fromCache' | 'status'>;

export const pipelineReport: ReportDefinition<ReportDateWindowParams, PipelineReportPayload> = {
  kind: 'pipeline',
  cacheVersion: 'v1',
  paramsSchema: ReportDateWindowParamsSchema,
  cacheKeyOf: (params) => `${params.dateFrom ?? 'all'}:${params.dateTo ?? 'all'}`,
  emptyPayload: () => ({
    rows: [],
    totals: { claims: 0, totalBilled: 0 },
    insuranceBreakout: {
      denied: { claimCount: 0, totalBilled: 0 },
      rejected: { claimCount: 0, totalBilled: 0 },
      stale: { claimCount: 0, totalBilled: 0 },
      staleDays: STALE_DAYS,
      staleBefore: '',
    },
    generatedAt: '',
  }),
  compute: async (ctx, params, onProgress) => {
    await onProgress('scanning claims…');
    return computePipelineReport(ctx.oystehr, params);
  },
  summarize: (payload) => `pipeline report cached (${payload.totals.claims} claims)`,
};

async function computePipelineReport(oystehr: Oystehr, params: ReportDateWindowParams): Promise<PipelineReportPayload> {
  const searchParams = [{ name: '_elements', value: 'id,meta,total' }];
  if (params.dateFrom) searchParams.push({ name: 'created', value: `ge${params.dateFrom}` });
  if (params.dateTo) searchParams.push({ name: 'created', value: `le${params.dateTo}` });

  // meta carries the AR stage/status tags; total is the claim's billed charges
  const claims = await getAllFhirSearchPages<Claim>(
    {
      resourceType: 'Claim',
      params: searchParams,
    },
    oystehr
  );

  const cellByKey = new Map<string, PipelineReportRow>();
  let totalBilled = 0;
  const staleBefore = DateTime.now().toUTC().minus({ days: STALE_DAYS }).toISO();
  const insuranceBreakout = {
    denied: { claimCount: 0, totalBilled: 0 },
    rejected: { claimCount: 0, totalBilled: 0 },
    stale: { claimCount: 0, totalBilled: 0 },
    staleDays: STALE_DAYS,
    staleBefore,
  };
  for (const claim of claims) {
    const statuses = getClaimStatusValues(claim);
    const arStage = statuses.arStage;
    // revenue is billed charges (Claim.total) for every stage — no allowed/expected amounts here
    const billed = claim.total?.value ?? 0;
    const group = getActiveStatusGroup(arStage);
    const status = group ? statuses[group.primaryFieldKey] : '';
    const key = `${arStage}|${status}`;
    const cell = cellByKey.get(key) ?? { arStage, status, claimCount: 0, totalBilled: 0 };
    cell.claimCount += 1;
    cell.totalBilled += billed;
    cellByKey.set(key, cell);
    totalBilled += billed;

    if (arStage === AR_STAGE.insurancePayer) {
      if (statuses.adjudicationStatus === 'denied') {
        insuranceBreakout.denied.claimCount += 1;
        insuranceBreakout.denied.totalBilled += billed;
      }
      if (statuses.adjudicationStatus === 'rejected') {
        insuranceBreakout.rejected.claimCount += 1;
        insuranceBreakout.rejected.totalBilled += billed;
      }
      // UTC ISO strings compare lexicographically
      const lastUpdated = claim.meta?.lastUpdated ?? '';
      if (lastUpdated && lastUpdated <= staleBefore) {
        insuranceBreakout.stale.claimCount += 1;
        insuranceBreakout.stale.totalBilled += billed;
      }
    }
  }

  const rows = [...cellByKey.values()];
  const dateFiltered = !!(params.dateFrom || params.dateTo);
  // snapshots track the whole pipeline; a filtered view neither records nor compares history
  const today = DateTime.now().toUTC().toISODate();
  const previous = dateFiltered ? undefined : await recordSnapshotAndFindLastWeek(oystehr, { date: today, rows });

  return {
    rows,
    totals: { claims: claims.length, totalBilled },
    insuranceBreakout,
    ...(previous && { previous: { snapshotDate: previous.date, rows: previous.rows } }),
    generatedAt: DateTime.now().toUTC().toISO(),
  };
}

// Upserts today's snapshot into the history document and returns the comparison snapshot:
// the most recent one at least 7 days old, else the oldest one before today.
async function recordSnapshotAndFindLastWeek(
  oystehr: Oystehr,
  snapshot: PipelineSnapshot
): Promise<PipelineSnapshot | undefined> {
  const history = await loadHistory(oystehr);
  const cutoff = DateTime.fromISO(snapshot.date).minus({ days: 7 }).toISODate() ?? '';
  const past = history.filter((s) => s.date < snapshot.date).sort((a, b) => a.date.localeCompare(b.date));
  const previous = [...past].reverse().find((s) => s.date <= cutoff) ?? past[0];

  const keepAfter = DateTime.fromISO(snapshot.date).minus({ days: HISTORY_MAX_DAYS }).toISODate() ?? '';
  const updated = [...past.filter((s) => s.date >= keepAfter), snapshot];
  await saveHistory(oystehr, updated);

  return previous;
}

async function findHistoryDocument(oystehr: Oystehr): Promise<DocumentReference | undefined> {
  const bundle = await oystehr.fhir.search<DocumentReference>({
    resourceType: 'DocumentReference',
    params: [
      { name: 'identifier', value: `${REPORT_IDENTIFIER_SYSTEM}|${HISTORY_KEY}` },
      { name: '_sort', value: '-_lastUpdated' },
      { name: '_count', value: '1' },
    ],
  });
  return bundle.unbundle()[0];
}

async function loadHistory(oystehr: Oystehr): Promise<PipelineSnapshot[]> {
  try {
    const document = await findHistoryDocument(oystehr);
    const data = document?.content?.[0]?.attachment?.data;
    if (!data) return [];
    // plain Uint8Array keeps zlib typings happy across @types/node versions
    return JSON.parse(gunzipSync(new Uint8Array(Buffer.from(data, 'base64'))).toString('utf8'));
  } catch (err) {
    console.warn('Failed to load pipeline report history:', (err as Error)?.message);
    return [];
  }
}

// gzipped JSON in a DocumentReference attachment, same pattern as the other report caches
async function saveHistory(oystehr: Oystehr, history: PipelineSnapshot[]): Promise<void> {
  try {
    const data = gzipSync(new Uint8Array(Buffer.from(JSON.stringify(history), 'utf8'))).toString('base64');
    if (data.length > MAX_CACHE_BYTES) {
      console.warn(`Pipeline report history too large to save (${data.length} bytes); skipping save`);
      return;
    }
    const document: DocumentReference = {
      resourceType: 'DocumentReference',
      status: 'current',
      identifier: [{ system: REPORT_IDENTIFIER_SYSTEM, value: HISTORY_KEY }],
      date: DateTime.now().toUTC().toISO(),
      content: [
        {
          attachment: {
            contentType: 'application/gzip',
            title: 'pipeline-report-history.json.gz',
            data,
          },
        },
      ],
    };
    const existing = await findHistoryDocument(oystehr);
    if (existing?.id) {
      await oystehr.fhir.update<DocumentReference>({ ...document, id: existing.id });
    } else {
      await oystehr.fhir.create<DocumentReference>(document);
    }
  } catch (err) {
    // history is an enhancement; a failed write must not fail the report
    console.error('Failed to save pipeline report history:', err);
  }
}
