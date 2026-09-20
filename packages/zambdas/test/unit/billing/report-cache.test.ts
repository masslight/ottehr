import Oystehr from '@oystehr/sdk';
import { DocumentReference } from 'fhir/r4b';
import { describe, expect, it, vi } from 'vitest';
import { gunzipSync } from 'zlib';
import {
  listReportCacheHistory,
  loadReportCacheMeta,
  REPORT_CACHE_IDENTIFIER_SYSTEM,
  REPORT_CACHE_KIND_SYSTEM,
  saveReportCache,
} from '../../../src/billing/reports/framework/report-cache';

const CACHE_KEY = 'pipeline:v2:2026-01-01:2026-01-31';
const secrets = { PROJECT_ID: 'test-project' } as never;

const PARAMS_EXTENSION_URL = 'https://fhir.ottehr.com/Extension/billing-report-params';

interface Upload {
  path: string;
  file: Blob;
}

const committedDoc = (overrides: Partial<DocumentReference> = {}): DocumentReference => ({
  resourceType: 'DocumentReference',
  id: 'doc-1',
  meta: { versionId: 'w7' },
  status: 'current',
  identifier: [{ system: REPORT_CACHE_IDENTIFIER_SYSTEM, value: CACHE_KEY }],
  date: '2026-02-01T09:00:00.000Z',
  content: [
    {
      attachment: {
        url: 'billing-reports/pipeline_v2_2026-01-01_2026-01-31/old-rev.json.gz',
        size: 111,
        contentType: 'application/gzip',
        title: 'raw',
      },
    },
  ],
  ...overrides,
});

const clientWith = (
  existing: DocumentReference[]
): {
  oystehr: Oystehr;
  uploads: Upload[];
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  deleteObject: ReturnType<typeof vi.fn>;
} => {
  const uploads: Upload[] = [];
  const uploadFile = vi.fn(async ({ 'objectPath+': path, file }: { 'objectPath+': string; file: Blob }) => {
    uploads.push({ path, file });
    return {};
  });
  const deleteObject = vi.fn(async () => ({}));
  const search = vi.fn(async () => ({ unbundle: () => existing }));
  // echoing the written resource back = our commit won
  const create = vi.fn(async (resource: DocumentReference) => ({ ...resource, id: 'doc-new' }));
  const update = vi.fn(async (resource: DocumentReference) => resource);
  const oystehr = {
    z3: { uploadFile, deleteObject, getPresignedUrl: vi.fn(async () => ({ signedUrl: 'https://z3.test/x' })) },
    fhir: { search, create, update },
  } as unknown as Oystehr;
  return { oystehr, uploads, create, update, deleteObject };
};

const payload = { generatedAt: '2026-02-02T10:00:00.000Z', rows: [1, 2] };

describe('report-cache DocumentReference meta store', () => {
  it('first save uploads a generation and commits it via conditional create with history metadata', async () => {
    const { oystehr, uploads, create, update } = clientWith([]);

    const committed = await saveReportCache(oystehr, secrets, {}, CACHE_KEY, payload, {
      kind: 'pipeline',
      params: { dateFrom: '2026-01-01', dateTo: '2026-01-31' },
    });
    expect(committed).toBe(true);

    expect(uploads).toHaveLength(1);
    expect(uploads[0].path).toMatch(/^billing-reports\/pipeline_v2_2026-01-01_2026-01-31\/.*\.json\.gz$/);
    const written = JSON.parse(
      gunzipSync(new Uint8Array(Buffer.from(await uploads[0].file.arrayBuffer()))).toString('utf8')
    );
    expect(written.rows).toEqual([1, 2]);

    expect(update).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(1);
    const [doc, options] = create.mock.calls[0];
    expect(doc.identifier).toEqual([{ system: REPORT_CACHE_IDENTIFIER_SYSTEM, value: CACHE_KEY }]);
    expect(doc.date).toBe(payload.generatedAt);
    expect(doc.type.coding).toEqual([{ system: REPORT_CACHE_KIND_SYSTEM, code: 'pipeline' }]);
    expect(doc.context.period).toEqual({ start: '2026-01-01', end: '2026-01-31' });
    expect(JSON.parse(doc.extension[0].valueString)).toEqual({ dateFrom: '2026-01-01', dateTo: '2026-01-31' });
    expect(doc.content[0].attachment.url).toBe(uploads[0].path);
    expect(options.ifNoneExist).toEqual([
      { name: 'identifier', value: `${REPORT_CACHE_IDENTIFIER_SYSTEM}|${CACHE_KEY}` },
      { name: 'status', value: 'current' },
    ]);
  });

  it('re-save replaces the existing doc version-locked and deletes the superseded generation', async () => {
    const previous = committedDoc();
    const { oystehr, uploads, create, update, deleteObject } = clientWith([previous]);

    await saveReportCache(oystehr, secrets, {}, CACHE_KEY, payload, { kind: 'pipeline', params: {} });

    expect(create).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);
    const [doc, options] = update.mock.calls[0];
    expect(doc.id).toBe('doc-1');
    expect(options).toEqual({ optimisticLockingVersionId: 'w7' });
    expect(deleteObject).toHaveBeenCalledWith(
      expect.objectContaining({ 'objectPath+': 'billing-reports/pipeline_v2_2026-01-01_2026-01-31/old-rev.json.gz' })
    );
    expect(uploads[0].path).not.toBe('billing-reports/pipeline_v2_2026-01-01_2026-01-31/old-rev.json.gz');
  });

  it('losing a concurrent create race reports not-committed and deletes its own orphaned upload', async () => {
    const { oystehr, uploads, create, deleteObject } = clientWith([]);
    // conditional create answers with the concurrent winner's doc
    create.mockImplementation(async () => committedDoc());

    const committed = await saveReportCache(oystehr, secrets, {}, CACHE_KEY, payload);
    expect(committed).toBe(false);

    expect(deleteObject).toHaveBeenCalledTimes(1);
    expect(deleteObject).toHaveBeenCalledWith(expect.objectContaining({ 'objectPath+': uploads[0].path }));
  });

  it('a failed commit throws REPORT_CACHE_WRITE_FAILED', async () => {
    const { oystehr, create } = clientWith([]);
    create.mockRejectedValue(new Error('boom'));

    await expect(saveReportCache(oystehr, secrets, {}, CACHE_KEY, payload)).rejects.toMatchObject({ code: 5001 });
  });

  it('loadReportCacheMeta parses the committed doc', async () => {
    const { oystehr } = clientWith([committedDoc()]);
    const meta = await loadReportCacheMeta(oystehr, CACHE_KEY);
    expect(meta).toMatchObject({
      generatedAt: '2026-02-01T09:00:00.000Z',
      sizeBytes: 111,
      objectPath: 'billing-reports/pipeline_v2_2026-01-01_2026-01-31/old-rev.json.gz',
      docId: 'doc-1',
      docVersionId: 'w7',
    });
  });

  it('listReportCacheHistory returns current-version runs with parsed params', async () => {
    const currentRun = committedDoc({
      extension: [{ url: PARAMS_EXTENSION_URL, valueString: '{"dateFrom":"2026-01-01"}' }],
    });
    const staleVersionRun = committedDoc({
      identifier: [{ system: REPORT_CACHE_IDENTIFIER_SYSTEM, value: 'pipeline:v1:all' }],
    });
    const { oystehr } = clientWith([currentRun, staleVersionRun]);

    const entries = await listReportCacheHistory(oystehr, { kind: 'pipeline', cacheVersion: 'v2' });
    expect(entries).toEqual([
      { params: { dateFrom: '2026-01-01' }, generatedAt: '2026-02-01T09:00:00.000Z', sizeBytes: 111 },
    ]);
  });

  it('listReportCacheHistory follows pagination links so runs past the first page are not dropped', async () => {
    const runFor = (day: string): DocumentReference =>
      committedDoc({ extension: [{ url: PARAMS_EXTENSION_URL, valueString: `{"dateFrom":"${day}"}` }] });
    const search = vi.fn(async ({ params }: { params: { name: string; value: string }[] }) => {
      const offset = Number(params.find((param) => param.name === '_offset')?.value ?? '0');
      return offset === 0
        ? { link: [{ relation: 'next', url: 'next-page' }], unbundle: () => [runFor('2026-01-01')] }
        : { unbundle: () => [runFor('2026-02-01')] };
    });
    const oystehr = { fhir: { search } } as unknown as Oystehr;

    const entries = await listReportCacheHistory(oystehr, { kind: 'pipeline', cacheVersion: 'v2' });
    expect(search).toHaveBeenCalledTimes(2);
    expect(entries.map((entry) => entry.params.dateFrom)).toEqual(['2026-01-01', '2026-02-01']);
  });
});
