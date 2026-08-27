import Oystehr from '@oystehr/sdk';
import { DocumentReference } from 'fhir/r4b';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { gunzipSync, gzipSync } from 'zlib';
import { ReportPayload } from './types';

export const REPORT_IDENTIFIER_SYSTEM = ottehrIdentifierSystem('billing-report');
// caps the base64 attachment string, which is what counts toward FHIR resource size limits
const MAX_CACHE_BASE64_BYTES = 4 * 1024 * 1024;

// `<kind>:<cacheVersion>:<paramsKey>` — the DocumentReference identifier value for one cache entry
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

// wrapper persisted to the detail cache document
export interface ReportDetailEnvelope<Detail> extends ReportPayload {
  detail: Detail;
}

export async function findCacheDocument(oystehr: Oystehr, cacheKey: string): Promise<DocumentReference | undefined> {
  const bundle = await oystehr.fhir.search<DocumentReference>({
    resourceType: 'DocumentReference',
    params: [
      { name: 'identifier', value: `${REPORT_IDENTIFIER_SYSTEM}|${cacheKey}` },
      { name: '_sort', value: '-_lastUpdated' },
      { name: '_count', value: '1' },
    ],
  });
  return bundle.unbundle()[0];
}

export async function loadReportCache<Payload extends ReportPayload>(
  oystehr: Oystehr,
  cacheKey: string
): Promise<Payload | undefined> {
  return (await loadReportCacheWithSize<Payload>(oystehr, cacheKey))?.payload;
}

// payload plus the stored (gzip) size of the cache document, for the status line
export async function loadReportCacheWithSize<Payload extends ReportPayload>(
  oystehr: Oystehr,
  cacheKey: string
): Promise<{ payload: Payload; sizeBytes: number } | undefined> {
  try {
    const document = await findCacheDocument(oystehr, cacheKey);
    const data = document?.content?.[0]?.attachment?.data;
    if (!data) return undefined;
    // plain Uint8Array keeps zlib typings happy across @types/node versions
    const gzipBytes = Buffer.from(data, 'base64');
    const payload = JSON.parse(gunzipSync(new Uint8Array(gzipBytes)).toString('utf8'));
    return { payload, sizeBytes: gzipBytes.length };
  } catch (err) {
    console.warn(`Failed to load report cache ${cacheKey}:`, (err as Error)?.message);
    return undefined;
  }
}

// gzipped JSON in a DocumentReference attachment; a failed write must not fail the refresh
export async function saveReportCache<Payload extends ReportPayload>(
  oystehr: Oystehr,
  definition: { shrink?: (payload: Payload) => Payload | undefined },
  cacheKey: string,
  payload: Payload
): Promise<void> {
  try {
    const encode = (value: Payload): string =>
      gzipSync(new Uint8Array(Buffer.from(JSON.stringify(value), 'utf8'))).toString('base64');
    let toSave: Payload | undefined = payload;
    let data = encode(toSave);
    while (data.length > MAX_CACHE_BASE64_BYTES) {
      toSave = definition.shrink?.(toSave) as Payload | undefined;
      if (!toSave) {
        console.warn(`Report cache ${cacheKey} too large to save (${data.length} base64 bytes); skipping save`);
        return;
      }
      const shrunk = encode(toSave);
      // a shrink that makes no progress would loop forever
      if (shrunk.length >= data.length) {
        console.warn(`Report cache ${cacheKey} shrink made no progress (${shrunk.length} base64 bytes); skipping save`);
        return;
      }
      data = shrunk;
    }
    const document: DocumentReference = {
      resourceType: 'DocumentReference',
      status: 'current',
      identifier: [{ system: REPORT_IDENTIFIER_SYSTEM, value: cacheKey }],
      date: payload.generatedAt,
      content: [
        {
          attachment: {
            contentType: 'application/gzip',
            title: `${cacheKey}.json.gz`,
            data,
          },
        },
      ],
    };
    const existing = await findCacheDocument(oystehr, cacheKey);
    if (existing?.id) {
      await oystehr.fhir.update<DocumentReference>({ ...document, id: existing.id });
    } else {
      await oystehr.fhir.create<DocumentReference>(document);
    }
  } catch (err) {
    console.error(`Failed to save report cache ${cacheKey}:`, err);
  }
}
