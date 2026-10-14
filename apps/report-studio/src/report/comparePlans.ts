// The speed pass's measuring stick: two plan variants fetched back to back over the same date range,
// compared on timings and on whether they brought back the same resources — the same ids per type, and
// for trimmed variants the same values in the fields the report code read in the last render.
import type { FhirResource } from 'fhir/r4b';
import type { FetchStepStats, RunFetchPlanOutput } from 'utils/lib/types/adhoc/plan/fetch-plan';

export interface PlanRunSummary {
  totalMs: number;
  totalBytes: number;
  requests: number;
  countsByType: Record<string, number>;
  steps: {
    id: string;
    resourceType: string;
    ms: number;
    bytes: number;
    count: number;
    mode: string;
    requests: number;
    error?: string;
  }[];
}

export interface PlanComparison {
  a: PlanRunSummary;
  b: PlanRunSummary;
  /** Same ids per type (and same read fields when `fieldsRead` is given). */
  equivalent: boolean;
  differences: string[];
  faster: 'a' | 'b' | 'same';
}

type Fetched = RunFetchPlanOutput & { resources: Record<string, FhirResource[]> };

export function summarizeRun(output: Fetched): PlanRunSummary {
  const countsByType: Record<string, number> = {};
  for (const stat of output.stats) {
    for (const [type, n] of Object.entries(stat.byType)) countsByType[type] = (countsByType[type] ?? 0) + n;
  }
  return {
    totalMs: output.totalMs,
    totalBytes: output.totalBytes,
    requests: output.stats.reduce((n, s) => n + s.requests, 0),
    countsByType,
    steps: output.stats.map(({ id, resourceType, ms, bytes, count, mode, requests, error }: FetchStepStats) => ({
      id,
      resourceType,
      ms,
      bytes,
      count,
      mode,
      requests,
      error,
    })),
  };
}

/** "Type/id" → resource across all steps of a run (a resource an _include brought twice counts once). */
const byRef = (output: Fetched): Map<string, FhirResource> => {
  const out = new Map<string, FhirResource>();
  for (const list of Object.values(output.resources))
    for (const r of list) if (r.id) out.set(`${r.resourceType}/${r.id}`, r);
  return out;
};

/**
 * Compare two runs. `fieldsRead` (resourceType → top-level fields the code read) turns on the field check:
 * a trimmed variant is equivalent when those fields carry the same values on every shared resource.
 */
export function comparePlanRuns(a: Fetched, b: Fetched, fieldsRead?: Record<string, string[]>): PlanComparison {
  const differences: string[] = [];
  const refsA = byRef(a);
  const refsB = byRef(b);
  const missing = (from: Map<string, FhirResource>, inOther: Map<string, FhirResource>, label: string): void => {
    const counts: Record<string, number> = {};
    for (const key of from.keys())
      if (!inOther.has(key)) counts[key.split('/')[0]] = (counts[key.split('/')[0]] ?? 0) + 1;
    for (const [type, n] of Object.entries(counts)) differences.push(`${n} ${type}(s) only in ${label}`);
  };
  missing(refsA, refsB, 'A');
  missing(refsB, refsA, 'B');

  if (fieldsRead) {
    const changed: Record<string, number> = {};
    for (const [key, ra] of refsA) {
      const rb = refsB.get(key);
      if (!rb) continue;
      for (const field of fieldsRead[ra.resourceType] ?? []) {
        if (field === 'resourceType' || field === 'meta') continue;
        const va = (ra as unknown as Record<string, unknown>)[field];
        const vb = (rb as unknown as Record<string, unknown>)[field];
        if (JSON.stringify(va) !== JSON.stringify(vb))
          changed[`${ra.resourceType}.${field}`] = (changed[`${ra.resourceType}.${field}`] ?? 0) + 1;
      }
    }
    for (const [field, n] of Object.entries(changed))
      differences.push(`${field} differs on ${n} resource(s) the code reads`);
  }

  const sa = summarizeRun(a);
  const sb = summarizeRun(b);
  return {
    a: sa,
    b: sb,
    equivalent: differences.length === 0,
    differences,
    faster: Math.abs(sa.totalMs - sb.totalMs) < 500 ? 'same' : sa.totalMs < sb.totalMs ? 'a' : 'b',
  };
}
