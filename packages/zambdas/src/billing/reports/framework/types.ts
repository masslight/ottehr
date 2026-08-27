import Oystehr from '@oystehr/sdk';
import { RefreshReportKind } from 'utils/lib/types/data/billing/billing.constants';
import { ZodType } from 'zod';
import { ZambdaInput } from '../../../shared/types/common';

export type ProgressFn = (message: string) => Promise<void>;

export interface ReportContext {
  // billing-tagged client
  oystehr: Oystehr;
  // clinical (untagged) resources in the same store
  untaggedClient: Oystehr;
  secrets: ZambdaInput['secrets'];
}

export interface ReportPayload {
  generatedAt: string;
  // set by definitions whose compute or shrink dropped data
  truncated?: boolean;
}

// One cached report kind: the HTTP zambda and the worker are generic over this contract.
export interface ReportDefinition<Params, Payload extends ReportPayload, Detail = unknown, DrillParams = unknown> {
  kind: RefreshReportKind;
  // bump to invalidate stale-shape caches
  cacheVersion: string;
  paramsSchema: ZodType<Params>;
  // params part of the cache key ('' for unparameterized kinds)
  cacheKeyOf: (params: Params) => string;
  emptyPayload: () => Payload;
  // full recomputation (worker-side); detail is the optional drilldown dataset
  compute: (
    ctx: ReportContext,
    params: Params,
    onProgress: ProgressFn
  ) => Promise<{ payload: Payload; detail?: Detail }>;
  // compute persists its own cache (e.g. resumable drain state); worker skips the central save
  savesOwnCache?: boolean;
  // strip internal state before a cached payload leaves the server
  sanitizePayload?: (payload: Payload) => Payload;
  // shed data until an oversized payload fits the cache cap; undefined = skip the save
  shrink?: (payload: Payload) => Payload | undefined;
  shrinkDetail?: (detail: Detail) => Detail | undefined;
  // when the detail keys differently than the report (e.g. window-independent)
  detailCacheKeyOf?: (params: Params) => string;
  // drilldowns are pure filters over the cached detail
  drilldown?: {
    paramsSchema: ZodType<DrillParams>;
    select: (detail: Detail, params: DrillParams) => Record<string, unknown>;
    empty: () => Record<string, unknown>;
  };
  // one-liner for the Task's completion statusReason
  summarize: (payload: Payload) => string;
}

export type AnyReportDefinition = ReportDefinition<any, any, any, any>;
