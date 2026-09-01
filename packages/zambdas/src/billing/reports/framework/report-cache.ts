import Oystehr from '@oystehr/sdk';
import { getSecret, Secrets, SecretsKeys } from 'utils/lib/secrets';
import { gunzipSync, gzipSync } from 'zlib';
import { BILLING_APP_BUCKET } from '../../shared';
import { ReportPayload } from './types';

// Report caches are gzipped JSON objects in the billing-app Z3 bucket. The payload object is
// the raw source of truth (worker resume state included); a sanitized `.public` sibling is what
// presigned download URLs point at when the definition sanitizes; a tiny `.meta.json` sidecar
// lets the HTTP zambda report status without downloading the payload.

// `<kind>:<cacheVersion>:<paramsKey>` — the cache key for one report entry
export function fullCacheKey<Params>(
  definition: { kind: string; cacheVersion: string; cacheKeyOf: (params: Params) => string },
  params: Params
): string {
  return `${definition.kind}:${definition.cacheVersion}:${definition.cacheKeyOf(params) || 'all'}`;
}

// sibling cache entry holding a report's full drilldown dataset
export function detailCacheKey<Params>(
  definition: {
    kind: string;
    cacheVersion: string;
    cacheKeyOf: (params: Params) => string;
    detailCacheKeyOf?: (params: Params) => string;
  },
  params: Params
): string {
  const keyOf = definition.detailCacheKeyOf ?? definition.cacheKeyOf;
  return `${definition.kind}:${definition.cacheVersion}:${keyOf(params) || 'all'}:detail`;
}

// wrapper persisted to the detail cache object
export interface ReportDetailEnvelope<Detail> extends ReportPayload {
  detail: Detail;
}

// sidecar written on save; read by the status line instead of the (possibly huge) payload
export interface ReportCacheMeta {
  generatedAt: string;
  // stored (gzip) size of the served payload object
  sizeBytes: number;
  truncated?: boolean;
}

const bucketNameOf = (secrets: Secrets | null): string =>
  BILLING_APP_BUCKET(getSecret(SecretsKeys.PROJECT_ID, secrets));

const payloadPath = (cacheKey: string): string => `billing-reports/${cacheKey}.json.gz`;
const publicPath = (cacheKey: string): string => `billing-reports/${cacheKey}.public.json.gz`;
const metaPath = (cacheKey: string): string => `billing-reports/${cacheKey}.meta.json`;

async function presignDownload(oystehr: Oystehr, secrets: Secrets | null, objectPath: string): Promise<string> {
  const result = await oystehr.z3.getPresignedUrl({
    bucketName: bucketNameOf(secrets),
    'objectPath+': objectPath,
    action: 'download',
  });
  return result.signedUrl;
}

// undefined = object does not exist (a cache miss, not an error)
async function downloadObject(
  oystehr: Oystehr,
  secrets: Secrets | null,
  objectPath: string
): Promise<Buffer | undefined> {
  const signedUrl = await presignDownload(oystehr, secrets, objectPath);
  const response = await fetch(signedUrl);
  // S3-style stores answer 403 for missing keys when list permission is absent
  if (response.status === 404 || response.status === 403) return undefined;
  if (!response.ok) throw new Error(`Z3 download of ${objectPath} failed: ${response.status} ${response.statusText}`);
  return Buffer.from(await response.arrayBuffer());
}

async function uploadObject(
  oystehr: Oystehr,
  secrets: Secrets | null,
  objectPath: string,
  bytes: Buffer,
  contentType: string
): Promise<void> {
  await oystehr.z3.uploadFile({
    bucketName: bucketNameOf(secrets),
    'objectPath+': objectPath,
    file: new Blob([new Uint8Array(bytes)], { type: contentType }),
  });
}

const gzipJson = (value: unknown): Buffer => gzipSync(new Uint8Array(Buffer.from(JSON.stringify(value), 'utf8')));

export async function loadReportCache<Payload extends ReportPayload>(
  oystehr: Oystehr,
  secrets: Secrets | null,
  cacheKey: string
): Promise<Payload | undefined> {
  return (await loadReportCacheWithSize<Payload>(oystehr, secrets, cacheKey))?.payload;
}

// raw payload plus its stored (gzip) size; server-side use only (drilldown filtering, previous)
export async function loadReportCacheWithSize<Payload extends ReportPayload>(
  oystehr: Oystehr,
  secrets: Secrets | null,
  cacheKey: string
): Promise<{ payload: Payload; sizeBytes: number } | undefined> {
  try {
    const gzipBytes = await downloadObject(oystehr, secrets, payloadPath(cacheKey));
    if (!gzipBytes) return undefined;
    // plain Uint8Array keeps zlib typings happy across @types/node versions
    const payload = JSON.parse(gunzipSync(new Uint8Array(gzipBytes)).toString('utf8'));
    return { payload, sizeBytes: gzipBytes.length };
  } catch (err) {
    console.warn(`Failed to load report cache ${cacheKey}:`, (err as Error)?.message);
    return undefined;
  }
}

// cheap existence + status probe; undefined = never computed
export async function loadReportCacheMeta(
  oystehr: Oystehr,
  secrets: Secrets | null,
  cacheKey: string
): Promise<ReportCacheMeta | undefined> {
  try {
    const bytes = await downloadObject(oystehr, secrets, metaPath(cacheKey));
    if (!bytes) return undefined;
    return JSON.parse(bytes.toString('utf8'));
  } catch (err) {
    console.warn(`Failed to load report cache meta ${cacheKey}:`, (err as Error)?.message);
    return undefined;
  }
}

// Short-lived presigned URL for the served payload object, minted on demand at display time.
// Callers must check loadReportCacheMeta first — presigning does not verify existence.
export async function getReportDownloadUrl(
  oystehr: Oystehr,
  secrets: Secrets | null,
  definition: { sanitizePayload?: unknown },
  cacheKey: string
): Promise<string> {
  const objectPath = definition.sanitizePayload ? publicPath(cacheKey) : payloadPath(cacheKey);
  return presignDownload(oystehr, secrets, objectPath);
}

// a failed cache write must not fail the refresh
export async function saveReportCache<Payload extends ReportPayload>(
  oystehr: Oystehr,
  secrets: Secrets | null,
  definition: { sanitizePayload?: (payload: Payload) => Payload },
  cacheKey: string,
  payload: Payload
): Promise<void> {
  try {
    const rawBytes = gzipJson(payload);
    await uploadObject(oystehr, secrets, payloadPath(cacheKey), rawBytes, 'application/gzip');
    // downloads serve the sanitized copy; the raw object keeps worker-only state
    let servedBytes = rawBytes;
    if (definition.sanitizePayload) {
      servedBytes = gzipJson(definition.sanitizePayload(payload));
      await uploadObject(oystehr, secrets, publicPath(cacheKey), servedBytes, 'application/gzip');
    }
    const meta: ReportCacheMeta = {
      generatedAt: payload.generatedAt,
      sizeBytes: servedBytes.length,
      ...(payload.truncated ? { truncated: true } : {}),
    };
    // meta written last: its presence signals a complete save
    await uploadObject(
      oystehr,
      secrets,
      metaPath(cacheKey),
      Buffer.from(JSON.stringify(meta), 'utf8'),
      'application/json'
    );
  } catch (err) {
    console.error(`Failed to save report cache ${cacheKey}:`, err);
  }
}
