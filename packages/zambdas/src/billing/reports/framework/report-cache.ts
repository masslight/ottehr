import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { getSecret, Secrets, SecretsKeys } from 'utils/lib/secrets';
import { REPORT_CACHE_WRITE_FAILED_ERROR } from 'utils/lib/types/errors';
import { gunzipSync, gzipSync } from 'zlib';
import { BILLING_APP_BUCKET } from '../../shared';
import { ReportPayload } from './types';

// Gzipped JSON cache objects in the billing-app Z3 bucket. Each save writes a new
// generation-addressed payload object (plus a sanitized `.public` sibling when the definition
// sanitizes); the fixed-path `.meta.json` is written last and atomically commits the new
// generation — readers always resolve object paths through it.

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

export interface ReportCacheMeta {
  generatedAt: string;
  sizeBytes: number;
  objectPath?: string;
  publicObjectPath?: string;
}

const bucketNameOf = (secrets: Secrets | null): string =>
  BILLING_APP_BUCKET(getSecret(SecretsKeys.PROJECT_ID, secrets));

// Z3 object names allow only letters, numbers and + ! - _ ' ( ) . @ $
const objectKeyOf = (cacheKey: string): string => cacheKey.replace(/[^A-Za-z0-9+!\-_'().@$]/g, '_');

const metaPath = (cacheKey: string): string => `billing-reports/${objectKeyOf(cacheKey)}.meta.json`;
const generationPath = (cacheKey: string, revision: string, isPublic: boolean): string =>
  `billing-reports/${objectKeyOf(cacheKey)}/${revision}${isPublic ? '.public' : ''}.json.gz`;
const legacyPayloadPath = (cacheKey: string): string => `billing-reports/${objectKeyOf(cacheKey)}.json.gz`;
const legacyPublicPath = (cacheKey: string): string => `billing-reports/${objectKeyOf(cacheKey)}.public.json.gz`;

const rawObjectPath = (meta: ReportCacheMeta, cacheKey: string): string =>
  meta.objectPath ?? legacyPayloadPath(cacheKey);
const servedObjectPath = (
  meta: ReportCacheMeta,
  definition: { sanitizePayload?: unknown },
  cacheKey: string
): string =>
  definition.sanitizePayload ? meta.publicObjectPath ?? legacyPublicPath(cacheKey) : rawObjectPath(meta, cacheKey);

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

// best-effort: an orphaned generation costs storage, not correctness
async function deleteObjectQuietly(oystehr: Oystehr, secrets: Secrets | null, objectPath: string): Promise<void> {
  try {
    await oystehr.z3.deleteObject({ bucketName: bucketNameOf(secrets), 'objectPath+': objectPath });
  } catch (err) {
    console.warn(`Failed to delete old report cache object ${objectPath}:`, (err as Error)?.message);
  }
}

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
    const meta = await loadReportCacheMeta(oystehr, secrets, cacheKey);
    if (!meta) return undefined;
    const gzipBytes = await downloadObject(oystehr, secrets, rawObjectPath(meta, cacheKey));
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

// Short-lived presigned URL for the object the given meta committed, minted on demand at
// display time. Callers must have loaded the meta first — presigning does not verify existence.
export async function getReportDownloadUrl(
  oystehr: Oystehr,
  secrets: Secrets | null,
  definition: { sanitizePayload?: unknown },
  cacheKey: string,
  meta: ReportCacheMeta
): Promise<string> {
  return presignDownload(oystehr, secrets, servedObjectPath(meta, definition, cacheKey));
}

// a failed write throws: the cache is the delivery mechanism, so the refresh Task must fail
// visibly instead of completing over stale or missing data
export async function saveReportCache<Payload extends ReportPayload>(
  oystehr: Oystehr,
  secrets: Secrets | null,
  definition: { sanitizePayload?: (payload: Payload) => Payload },
  cacheKey: string,
  payload: Payload
): Promise<void> {
  let previousMeta: ReportCacheMeta | undefined;
  try {
    previousMeta = await loadReportCacheMeta(oystehr, secrets, cacheKey);
    const revision = `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
    const objectPath = generationPath(cacheKey, revision, false);
    const rawBytes = gzipJson(payload);
    await uploadObject(oystehr, secrets, objectPath, rawBytes, 'application/gzip');
    let servedBytes = rawBytes;
    let publicObjectPath: string | undefined;
    if (definition.sanitizePayload) {
      publicObjectPath = generationPath(cacheKey, revision, true);
      servedBytes = gzipJson(definition.sanitizePayload(payload));
      await uploadObject(oystehr, secrets, publicObjectPath, servedBytes, 'application/gzip');
    }
    const meta: ReportCacheMeta = {
      generatedAt: payload.generatedAt,
      sizeBytes: servedBytes.length,
      objectPath,
      ...(publicObjectPath ? { publicObjectPath } : {}),
    };
    // single fixed-path PUT atomically commits the new generation
    await uploadObject(
      oystehr,
      secrets,
      metaPath(cacheKey),
      Buffer.from(JSON.stringify(meta), 'utf8'),
      'application/json'
    );
  } catch (err) {
    console.error(`Failed to save report cache ${cacheKey}:`, err);
    const apiError = REPORT_CACHE_WRITE_FAILED_ERROR(
      `Failed to save report cache ${cacheKey}: ${(err as Error)?.message ?? String(err)}`
    );
    throw Object.assign(new Error(apiError.message), apiError);
  }
  // superseded generation is unreachable once meta committed
  if (previousMeta?.objectPath) await deleteObjectQuietly(oystehr, secrets, previousMeta.objectPath);
  if (previousMeta?.publicObjectPath) await deleteObjectQuietly(oystehr, secrets, previousMeta.publicObjectPath);
}
