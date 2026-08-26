import Oystehr from '@oystehr/sdk';
import { DocumentReference } from 'fhir/r4b';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { gunzipSync, gzipSync } from 'zlib';
import { ReportPayload } from './types';

export const REPORT_IDENTIFIER_SYSTEM = ottehrIdentifierSystem('billing-report');
// stay well under FHIR resource size limits
const MAX_CACHE_BYTES = 4 * 1024 * 1024;

// `<kind>:<cacheVersion>:<paramsKey>` — the DocumentReference identifier value for one cache entry
export function fullCacheKey<Params>(
  definition: { kind: string; cacheVersion: string; cacheKeyOf: (params: Params) => string },
  params: Params
): string {
  return `${definition.kind}:${definition.cacheVersion}:${definition.cacheKeyOf(params) || 'all'}`;
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
  try {
    const document = await findCacheDocument(oystehr, cacheKey);
    const data = document?.content?.[0]?.attachment?.data;
    if (!data) return undefined;
    // plain Uint8Array keeps zlib typings happy across @types/node versions
    return JSON.parse(gunzipSync(new Uint8Array(Buffer.from(data, 'base64'))).toString('utf8'));
  } catch (err) {
    console.warn(`Failed to load report cache ${cacheKey}:`, (err as Error)?.message);
    return undefined;
  }
}

// gzipped JSON in a DocumentReference attachment; oversized payloads run through the definition's
// shrink until they fit (or the save is skipped). The cache is an optimization; a failed write
// must not fail the refresh.
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
    while (data.length > MAX_CACHE_BYTES) {
      toSave = definition.shrink?.(toSave) as Payload | undefined;
      if (!toSave) {
        console.warn(`Report cache ${cacheKey} too large to save (${data.length} bytes); skipping save`);
        return;
      }
      data = encode(toSave);
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
