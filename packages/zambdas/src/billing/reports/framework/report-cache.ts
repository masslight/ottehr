import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { DocumentReference } from 'fhir/r4b';
import { ottehrCodeSystemUrl, ottehrExtensionUrl, ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { getSecret, Secrets, SecretsKeys } from 'utils/lib/secrets';
import { BillingReportHistoryEntry } from 'utils/lib/types/data/billing/billing.types';
import { REPORT_CACHE_WRITE_FAILED_ERROR } from 'utils/lib/types/errors';
import { gunzipSync, gzipSync } from 'zlib';
import { BILLING_APP_BUCKET } from '../../shared';
import { ReportPayload } from './types';

// Gzipped JSON cache objects in the billing-app Z3 bucket, committed through a DocumentReference
// meta store. Each save writes a new generation-addressed payload object (plus a sanitized
// `.public` sibling when the definition sanitizes); one DocumentReference per cache entry then
// atomically commits the generation — readers always resolve object paths through it. Primary
// report entries carry their kind + params on the DocumentReference, which makes the run history
// of a kind a single FHIR search.

// meta store: one DocumentReference per cache entry, found by this identifier
export const REPORT_CACHE_IDENTIFIER_SYSTEM = ottehrIdentifierSystem('billing-report-cache');
// only primary report entries carry a kind coding; detail/internal entries stay out of history
export const REPORT_CACHE_KIND_SYSTEM = ottehrCodeSystemUrl('billing-report-kind');
const REPORT_CACHE_PARAMS_EXTENSION = ottehrExtensionUrl('billing-report-params');

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
  objectPath: string;
  publicObjectPath?: string;
  // backing DocumentReference, for locked replacement on re-save
  docId?: string;
  docVersionId?: string;
}

// identity of a primary report run, stamped on its meta DocumentReference for history listing
export interface ReportCacheHistoryInfo {
  kind: string;
  params: unknown;
}

const bucketNameOf = (secrets: Secrets | null): string =>
  BILLING_APP_BUCKET(getSecret(SecretsKeys.PROJECT_ID, secrets));

// Z3 object names allow only letters, numbers and + ! - _ ' ( ) . @ $
const objectKeyOf = (cacheKey: string): string => cacheKey.replace(/[^A-Za-z0-9+!\-_'().@$]/g, '_');

const generationPath = (cacheKey: string, revision: string, isPublic: boolean): string =>
  `billing-reports/${objectKeyOf(cacheKey)}/${revision}${isPublic ? '.public' : ''}.json.gz`;

const servedObjectPath = (meta: ReportCacheMeta, definition: { sanitizePayload?: unknown }): string =>
  definition.sanitizePayload ? meta.publicObjectPath ?? meta.objectPath : meta.objectPath;

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
    const meta = await loadReportCacheMeta(oystehr, cacheKey);
    if (!meta) return undefined;
    const gzipBytes = await downloadObject(oystehr, secrets, meta.objectPath);
    if (!gzipBytes) return undefined;
    // plain Uint8Array keeps zlib typings happy across @types/node versions
    const payload = JSON.parse(gunzipSync(new Uint8Array(gzipBytes)).toString('utf8'));
    return { payload, sizeBytes: gzipBytes.length };
  } catch (err) {
    console.warn(`Failed to load report cache ${cacheKey}:`, (err as Error)?.message);
    return undefined;
  }
}

const attachmentByTitle = (doc: DocumentReference, title: string): { url?: string; size?: number } | undefined =>
  doc.content?.find((content) => content.attachment?.title === title)?.attachment;

function metaOf(doc: DocumentReference): ReportCacheMeta | undefined {
  const raw = attachmentByTitle(doc, 'raw');
  if (!raw?.url || !doc.date) return undefined;
  const publicCopy = attachmentByTitle(doc, 'public');
  return {
    generatedAt: doc.date,
    // size of the served copy, mirrored to the frontend status bar
    sizeBytes: (publicCopy ?? raw).size ?? 0,
    objectPath: raw.url,
    ...(publicCopy?.url ? { publicObjectPath: publicCopy.url } : {}),
    docId: doc.id,
    docVersionId: doc.meta?.versionId,
  };
}

// cheap existence + status probe; undefined = never computed
export async function loadReportCacheMeta(oystehr: Oystehr, cacheKey: string): Promise<ReportCacheMeta | undefined> {
  try {
    const bundle = await oystehr.fhir.search<DocumentReference>({
      resourceType: 'DocumentReference',
      params: [
        { name: 'identifier', value: `${REPORT_CACHE_IDENTIFIER_SYSTEM}|${cacheKey}` },
        { name: 'status', value: 'current' },
        { name: '_sort', value: '-_lastUpdated' },
        { name: '_count', value: '2' },
      ],
    });
    for (const doc of bundle.unbundle()) {
      const meta = metaOf(doc);
      if (meta) return meta;
    }
    return undefined;
  } catch (err) {
    console.warn(`Failed to load report cache meta ${cacheKey}:`, (err as Error)?.message);
    return undefined;
  }
}

const paramsOf = (doc: DocumentReference): Record<string, unknown> => {
  const json = doc.extension?.find((extension) => extension.url === REPORT_CACHE_PARAMS_EXTENSION)?.valueString;
  try {
    return json ? JSON.parse(json) : {};
  } catch {
    return {};
  }
};

// All cached runs of one kind at its current cacheVersion, newest first. One FHIR search:
// primary saves stamp kind + params on their meta DocumentReference.
export async function listReportCacheHistory(
  oystehr: Oystehr,
  definition: { kind: string; cacheVersion: string }
): Promise<BillingReportHistoryEntry[]> {
  const bundle = await oystehr.fhir.search<DocumentReference>({
    resourceType: 'DocumentReference',
    params: [
      { name: 'type', value: `${REPORT_CACHE_KIND_SYSTEM}|${definition.kind}` },
      { name: 'status', value: 'current' },
      { name: '_sort', value: '-date' },
      { name: '_count', value: '100' },
    ],
  });
  const keyPrefix = `${definition.kind}:${definition.cacheVersion}:`;
  return bundle
    .unbundle()
    .filter(
      (doc) =>
        doc.identifier?.some(
          (identifier) =>
            identifier.system === REPORT_CACHE_IDENTIFIER_SYSTEM && identifier.value?.startsWith(keyPrefix)
        )
    )
    .flatMap((doc) => {
      const meta = metaOf(doc);
      if (!meta) return [];
      return [{ params: paramsOf(doc), generatedAt: meta.generatedAt, sizeBytes: meta.sizeBytes }];
    });
}

// Short-lived presigned URL for the served object the given meta committed, minted on demand at
// display time. Callers must have loaded the meta first — presigning does not verify existence.
export async function getReportDownloadUrl(
  oystehr: Oystehr,
  secrets: Secrets | null,
  definition: { sanitizePayload?: unknown },
  meta: ReportCacheMeta
): Promise<string> {
  return presignDownload(oystehr, secrets, servedObjectPath(meta, definition));
}

// builds the meta DocumentReference that commits one saved generation
function buildCacheDoc(input: {
  cacheKey: string;
  generatedAt: string;
  raw: { url: string; size: number };
  publicCopy?: { url: string; size: number };
  history?: ReportCacheHistoryInfo;
}): DocumentReference {
  const { cacheKey, generatedAt, raw, publicCopy, history } = input;
  const window = (history?.params ?? {}) as { dateFrom?: unknown; dateTo?: unknown };
  const period = {
    ...(typeof window.dateFrom === 'string' && window.dateFrom ? { start: window.dateFrom } : {}),
    ...(typeof window.dateTo === 'string' && window.dateTo ? { end: window.dateTo } : {}),
  };
  const attachment = (copy: { url: string; size: number }, title: string): { attachment: Record<string, unknown> } => ({
    attachment: { url: copy.url, size: copy.size, contentType: 'application/gzip', title },
  });
  return {
    resourceType: 'DocumentReference',
    status: 'current',
    identifier: [{ system: REPORT_CACHE_IDENTIFIER_SYSTEM, value: cacheKey }],
    date: generatedAt,
    ...(history
      ? {
          type: { coding: [{ system: REPORT_CACHE_KIND_SYSTEM, code: history.kind }] },
          extension: [{ url: REPORT_CACHE_PARAMS_EXTENSION, valueString: JSON.stringify(history.params ?? {}) }],
          ...(Object.keys(period).length > 0 ? { context: { period } } : {}),
        }
      : {}),
    content: [attachment(raw, 'raw'), ...(publicCopy ? [attachment(publicCopy, 'public')] : [])],
  } as DocumentReference;
}

// a failed write throws: the cache is the delivery mechanism, so the refresh Task must fail
// visibly instead of completing over stale or missing data
export async function saveReportCache<Payload extends ReportPayload>(
  oystehr: Oystehr,
  secrets: Secrets | null,
  definition: { sanitizePayload?: (payload: Payload) => Payload },
  cacheKey: string,
  payload: Payload,
  history?: ReportCacheHistoryInfo
): Promise<void> {
  let previousMeta: ReportCacheMeta | undefined;
  try {
    previousMeta = await loadReportCacheMeta(oystehr, cacheKey);
    const revision = `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
    const objectPath = generationPath(cacheKey, revision, false);
    const rawBytes = gzipJson(payload);
    await uploadObject(oystehr, secrets, objectPath, rawBytes, 'application/gzip');
    let publicCopy: { url: string; size: number } | undefined;
    if (definition.sanitizePayload) {
      const publicBytes = gzipJson(definition.sanitizePayload(payload));
      publicCopy = { url: generationPath(cacheKey, revision, true), size: publicBytes.length };
      await uploadObject(oystehr, secrets, publicCopy.url, publicBytes, 'application/gzip');
    }
    const doc = buildCacheDoc({
      cacheKey,
      generatedAt: payload.generatedAt,
      raw: { url: objectPath, size: rawBytes.length },
      publicCopy,
      history,
    });
    // the DocumentReference write atomically commits the new generation; version-locked so a
    // concurrent save can never be silently overwritten
    const committed = previousMeta?.docId
      ? await oystehr.fhir.update<DocumentReference>(
          { ...doc, id: previousMeta.docId },
          { optimisticLockingVersionId: previousMeta.docVersionId }
        )
      : await oystehr.fhir.create<DocumentReference>(doc, {
          ifNoneExist: [
            { name: 'identifier', value: `${REPORT_CACHE_IDENTIFIER_SYSTEM}|${cacheKey}` },
            { name: 'status', value: 'current' },
          ],
        });
    // conditional create can return a concurrent writer's commit; then our generation lost the race
    if (attachmentByTitle(committed, 'raw')?.url !== objectPath) {
      await deleteObjectQuietly(oystehr, secrets, objectPath);
      if (publicCopy) await deleteObjectQuietly(oystehr, secrets, publicCopy.url);
      return;
    }
  } catch (err) {
    console.error(`Failed to save report cache ${cacheKey}:`, err);
    const apiError = REPORT_CACHE_WRITE_FAILED_ERROR(
      `Failed to save report cache ${cacheKey}: ${(err as Error)?.message ?? String(err)}`
    );
    throw Object.assign(new Error(apiError.message), apiError);
  }
  // superseded generation is unreachable once the DocumentReference committed
  if (previousMeta?.objectPath) await deleteObjectQuietly(oystehr, secrets, previousMeta.objectPath);
  if (previousMeta?.publicObjectPath) await deleteObjectQuietly(oystehr, secrets, previousMeta.publicObjectPath);
}
