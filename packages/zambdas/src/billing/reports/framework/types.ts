import Oystehr from '@oystehr/sdk';
import { RefreshReportKind } from 'utils/lib/types/data/billing/billing.constants';
import { ZodType } from 'zod';
import { ZambdaInput } from '../../../shared/types/common';

export type ProgressFn = (message: string) => Promise<void>;

export interface ReportContext {
  // billing-tagged client
  oystehr: Oystehr;
  // clinical (untagged) resources living in the same store: patients, encounters, appointments, ERAs
  untaggedClient: Oystehr;
  secrets: ZambdaInput['secrets'];
}

// payload persisted to / served from the cache; generatedAt drives the status line
export interface ReportPayload {
  generatedAt: string;
}

// Everything the framework needs to serve, refresh, and cache one report kind. The HTTP zambda
// and the subscription worker are generic over this contract; adding a report means adding a
// definition (and registering it) — no new zambdas.
export interface ReportDefinition<Params, Payload extends ReportPayload, Detail = unknown, DrillParams = unknown> {
  kind: RefreshReportKind;
  // bump when the cached payload shape changes, so stale-shape caches are never reused
  cacheVersion: string;
  // validates params from both the HTTP request and the refresh Task input
  paramsSchema: ZodType<Params>;
  // params part of the cache key ('' for unparameterized kinds)
  cacheKeyOf: (params: Params) => string;
  // served when the report has never been computed (while the first refresh runs)
  emptyPayload: () => Payload;
  // full recomputation; runs inside the subscription worker's long timeout. `detail` is the
  // full drilldown dataset, persisted separately and served as filtered slices by `drilldown`.
  compute: (
    ctx: ReportContext,
    params: Params,
    onProgress: ProgressFn
  ) => Promise<{ payload: Payload; detail?: Detail }>;
  // compute manages its own cache writes (e.g. resumable drain state); the worker skips the central save
  savesOwnCache?: boolean;
  // strip internal state (e.g. pending lookup queues) before a cached payload leaves the server
  sanitizePayload?: (payload: Payload) => Payload;
  // shed data until an oversized payload fits the cache cap; return undefined to give up on saving
  shrink?: (payload: Payload) => Payload | undefined;
  // same, for an oversized detail dataset
  shrinkDetail?: (detail: Detail) => Detail | undefined;
  // params part of the detail cache key, when it differs from the report's (e.g. payments detail
  // spans all ERAs regardless of the report's date window)
  detailCacheKeyOf?: (params: Params) => string;
  // serves drilldown requests as pure filters over the cached detail; never computes
  drilldown?: {
    paramsSchema: ZodType<DrillParams>;
    select: (detail: Detail, params: DrillParams) => Record<string, unknown>;
    // served while the detail has never been computed
    empty: () => Record<string, unknown>;
  };
  // one-line completion summary for the refresh Task's statusReason
  summarize: (payload: Payload) => string;
}

// registry entry type: params/payload are validated at the definition boundary
export type AnyReportDefinition = ReportDefinition<any, any, any, any>;
