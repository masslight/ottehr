import { act, renderHook, RenderHookResult, waitFor } from '@testing-library/react';
import { unzipSync } from 'fflate';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  DocumentsZipWriter,
  DocumentsZipWriterOptions,
} from '../../src/features/visits/shared/components/patient/docs/documentsZip';
import type { PatientDocumentInfo } from '../../src/hooks/useGetPatientDocs';

const { events, mockDownloadBlob, mockFinish, mockGetAccessTokenSilently, writerFactory } = vi.hoisted(() => ({
  events: [] as string[],
  mockDownloadBlob: vi.fn(),
  mockFinish: vi.fn((finish: () => Blob) => finish()),
  mockGetAccessTokenSilently: vi.fn<() => Promise<string>>(),
  writerFactory: { created: 0, failNextWith: undefined as Error | undefined },
}));

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({ getAccessTokenSilently: mockGetAccessTokenSilently }),
}));

vi.mock('../../src/features/visits/shared/components/patient/docs/documentsZip', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../src/features/visits/shared/components/patient/docs/documentsZip')>();
  return {
    ...actual,
    createDocumentsZipWriter: (options?: DocumentsZipWriterOptions): DocumentsZipWriter => {
      writerFactory.created += 1;
      const failure = writerFactory.failNextWith;
      if (failure) {
        writerFactory.failNextWith = undefined;
        throw failure;
      }
      const writer = actual.createDocumentsZipWriter(options);
      return {
        add: (name, bytes) => {
          events.push(`add:${name}`);
          writer.add(name, bytes);
        },
        finish: () => mockFinish(writer.finish),
        discard: () => {
          events.push('discard');
          writer.discard();
        },
      };
    },
  };
});

vi.mock('../../src/helpers/files.helper', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/helpers/files.helper')>();
  return {
    ...actual,
    downloadBlob: (fileName: string, blob: Blob) => {
      mockDownloadBlob(fileName, blob);
      actual.downloadBlob(fileName, blob);
    },
  };
});

import {
  DocumentsZipResult,
  useDownloadDocumentsZip,
  UseDownloadDocumentsZipReturn,
} from '../../src/hooks/useDownloadDocumentsZip';

const ZIP_NAME = 'docs-black_oliver-2026-10-16_14-30.zip';
const USER_TOKEN = 'user-token';

type Gate = { promise: Promise<void>; open: () => void };

const createGate = (): Gate => {
  let open!: () => void;
  const promise = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { promise, open };
};

type FileBehavior =
  | { kind: 'ok'; gate?: Promise<void> }
  | { kind: 'presign-forbidden' }
  | { kind: 'network-error' }
  | { kind: 'http-error'; status: number }
  | { kind: 'body-error'; error: unknown; gate?: Promise<void> }
  | { kind: 'hang' };

let behaviors: Map<string, FileBehavior>;
let presignedFiles: string[];
let requestSignals: AbortSignal[];
let activeRequests: number;
let maxActiveRequests: number;
let objectUrlBlobs: Blob[];
let clickedDownloads: string[];

const fileOf = (url: string): string => url.split('/').pop() ?? '';

const waitForAbort = (signal: AbortSignal, file: string): Promise<never> =>
  new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => {
      events.push(`aborted:${file}`);
      reject(new DOMException('This operation was aborted', 'AbortError'));
    });
  });

const fetchStub = async (input: RequestInfo | URL, init?: RequestInit): Promise<unknown> => {
  const file = fileOf(String(input));
  const behavior = behaviors.get(file) ?? { kind: 'ok' };

  if (init?.method === 'POST') {
    presignedFiles.push(file);
    if (behavior.kind === 'presign-forbidden') return { ok: false, status: 403, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ signedUrl: `https://s3.test/${file}` }) };
  }

  const signal = init?.signal as AbortSignal;
  requestSignals.push(signal);
  activeRequests += 1;
  maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
  try {
    if (behavior.kind === 'network-error') throw new TypeError('Failed to fetch');
    if (behavior.kind === 'hang') await waitForAbort(signal, file);
    if ((behavior.kind === 'ok' || behavior.kind === 'body-error') && behavior.gate) await behavior.gate;
    if (behavior.kind === 'http-error') {
      return { ok: false, status: behavior.status, arrayBuffer: async () => new ArrayBuffer(0) };
    }
    if (behavior.kind === 'body-error') {
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => {
          throw behavior.error;
        },
      };
    }
    return { ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode(`content of ${file}`).buffer };
  } finally {
    activeRequests -= 1;
  }
};

const makeDocument = (file: string, overrides: Partial<PatientDocumentInfo> = {}): PatientDocumentInfo => ({
  id: `doc-${file}`,
  docName: file,
  whenAddedDate: '2026-05-05T10:00:00.000Z',
  attachments: [{ title: file, z3Url: `https://project-api.test/z3/bucket/${file}`, contentType: 'application/pdf' }],
  ...overrides,
});

const readZip = (blob: Blob): Promise<Record<string, string>> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const entries = unzipSync(new Uint8Array(reader.result as ArrayBuffer));
      resolve(
        Object.fromEntries(Object.entries(entries).map(([name, data]) => [name, new TextDecoder().decode(data)]))
      );
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });

const readText = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });

const startDownload = (
  documents: PatientDocumentInfo[]
): { hook: RenderHookResult<UseDownloadDocumentsZipReturn, unknown>; pending: Promise<DocumentsZipResult> } => {
  const hook = renderHook(() => useDownloadDocumentsZip());
  let pending!: Promise<DocumentsZipResult>;
  act(() => {
    pending = hook.result.current.downloadDocumentsZip(documents, ZIP_NAME);
  });
  return { hook, pending };
};

const settle = async (pending: Promise<DocumentsZipResult>): Promise<DocumentsZipResult> => {
  let result!: DocumentsZipResult;
  await act(async () => {
    result = await pending;
  });
  return result;
};

describe('useDownloadDocumentsZip', () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    events.length = 0;
    writerFactory.created = 0;
    writerFactory.failNextWith = undefined;
    behaviors = new Map();
    presignedFiles = [];
    requestSignals = [];
    activeRequests = 0;
    maxActiveRequests = 0;
    objectUrlBlobs = [];
    clickedDownloads = [];
    mockDownloadBlob.mockClear();
    mockFinish.mockClear();
    mockGetAccessTokenSilently.mockReset();
    mockGetAccessTokenSilently.mockResolvedValue(USER_TOKEN);
    vi.stubGlobal('fetch', vi.fn(fetchStub));
    URL.createObjectURL = vi.fn((blob: Blob) => {
      objectUrlBlobs.push(blob);
      return 'blob:http://localhost/zip';
    });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clickedDownloads.push(this.download);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it('saves every selected file in one archive under the exact name, fetched with the user token', async () => {
    const { hook, pending } = startDownload([makeDocument('visit-note.pdf'), makeDocument('lab-result.pdf')]);

    expect(hook.result.current.isDownloading).toBe(true);

    expect(await settle(pending)).toEqual({ status: 'saved', affectedDocumentNames: [] });
    expect(hook.result.current.isDownloading).toBe(false);
    expect(mockDownloadBlob).toHaveBeenCalledTimes(1);
    expect(mockDownloadBlob).toHaveBeenCalledWith(ZIP_NAME, objectUrlBlobs[0]);
    expect(clickedDownloads).toEqual([ZIP_NAME]);
    expect(objectUrlBlobs[0].type).toBe('application/zip');
    expect(await readZip(objectUrlBlobs[0])).toEqual({
      'visit-note.pdf': 'content of visit-note.pdf',
      'lab-result.pdf': 'content of lab-result.pdf',
    });
    const presignCalls = vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === 'POST');
    expect(presignCalls).toHaveLength(2);
    for (const [, init] of presignCalls) {
      expect(init?.headers).toEqual({ Authorization: `Bearer ${USER_TOKEN}` });
    }
  });

  it('leaves out documents whose files cannot be downloaded and saves the rest', async () => {
    behaviors.set('network.pdf', { kind: 'network-error' });
    behaviors.set('forbidden.pdf', { kind: 'presign-forbidden' });
    behaviors.set('server-error.pdf', { kind: 'http-error', status: 500 });

    const { pending } = startDownload([
      makeDocument('network.pdf'),
      makeDocument('forbidden.pdf'),
      makeDocument('visit-note.pdf'),
      makeDocument('server-error.pdf'),
      makeDocument('no-file.pdf', { attachments: [{ title: 'no-file.pdf' }] }),
    ]);

    expect(await settle(pending)).toEqual({
      status: 'saved',
      affectedDocumentNames: ['network.pdf', 'forbidden.pdf', 'server-error.pdf', 'no-file.pdf'],
    });
    expect(clickedDownloads).toEqual([ZIP_NAME]);
    expect(await readZip(objectUrlBlobs[0])).toEqual({ 'visit-note.pdf': 'content of visit-note.pdf' });
  });

  it('saves a single selected document with one file directly under its own name, without an archive', async () => {
    const { pending } = startDownload([makeDocument('visit-note.pdf')]);

    expect(await settle(pending)).toEqual({ status: 'saved', affectedDocumentNames: [] });
    expect(clickedDownloads).toEqual(['visit-note.pdf']);
    expect(mockDownloadBlob).toHaveBeenCalledWith('visit-note.pdf', objectUrlBlobs[0]);
    expect(objectUrlBlobs[0].type).toBe('application/pdf');
    expect(await readText(objectUrlBlobs[0])).toBe('content of visit-note.pdf');
    expect(writerFactory.created).toBe(0);
    expect(events).toEqual([]);
  });

  it('zips a single selected document when one of its attachments has no file, and reports it as affected', async () => {
    const { pending } = startDownload([
      makeDocument('scan.pdf', {
        attachments: [
          { title: 'scan-page-1.pdf', z3Url: 'https://project-api.test/z3/bucket/scan-page-1.pdf' },
          { title: 'scan-page-2.pdf' },
        ],
      }),
    ]);

    expect(await settle(pending)).toEqual({ status: 'saved', affectedDocumentNames: ['scan.pdf'] });
    expect(clickedDownloads).toEqual([ZIP_NAME]);
    expect(await readZip(objectUrlBlobs[0])).toEqual({ 'scan-page-1.pdf': 'content of scan-page-1.pdf' });
  });

  it('cleans up and re-enables downloading when the ZIP writer cannot be created', async () => {
    writerFactory.failNextWith = new Error('writer init failed');

    const { hook, pending } = startDownload([makeDocument('visit-note.pdf'), makeDocument('lab-result.pdf')]);

    await act(async () => {
      await expect(pending).rejects.toThrow('writer init failed');
    });
    expect(hook.result.current.isDownloading).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
    expect(mockDownloadBlob).not.toHaveBeenCalled();
  });

  it('still zips a single selected document that has several files', async () => {
    const { pending } = startDownload([
      makeDocument('scan.pdf', {
        attachments: ['scan-page-1.pdf', 'scan-page-2.pdf'].map((file) => ({
          title: file,
          z3Url: `https://project-api.test/z3/bucket/${file}`,
          contentType: 'application/pdf',
        })),
      }),
    ]);

    expect(await settle(pending)).toEqual({ status: 'saved', affectedDocumentNames: [] });
    expect(clickedDownloads).toEqual([ZIP_NAME]);
    expect(await readZip(objectUrlBlobs[0])).toEqual({
      'scan-page-1.pdf': 'content of scan-page-1.pdf',
      'scan-page-2.pdf': 'content of scan-page-2.pdf',
    });
  });

  it('saves nothing when the only file of a single selected document cannot be downloaded', async () => {
    behaviors.set('visit-note.pdf', { kind: 'http-error', status: 500 });

    const { pending } = startDownload([makeDocument('visit-note.pdf')]);

    expect(await settle(pending)).toEqual({ status: 'none-downloaded' });
    expect(mockDownloadBlob).not.toHaveBeenCalled();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('keeps the files that did download when only part of a document fails, and lists that document once', async () => {
    behaviors.set('scan-page-2.pdf', { kind: 'http-error', status: 500 });
    behaviors.set('scan-page-3.pdf', { kind: 'network-error' });

    const { pending } = startDownload([
      makeDocument('scan.pdf', {
        attachments: ['scan-page-1.pdf', 'scan-page-2.pdf', 'scan-page-3.pdf'].map((file) => ({
          title: file,
          z3Url: `https://project-api.test/z3/bucket/${file}`,
          contentType: 'application/pdf',
        })),
      }),
      makeDocument('visit-note.pdf'),
    ]);

    expect(await settle(pending)).toEqual({ status: 'saved', affectedDocumentNames: ['scan.pdf'] });
    expect(await readZip(objectUrlBlobs[0])).toEqual({
      'scan-page-1.pdf': 'content of scan-page-1.pdf',
      'visit-note.pdf': 'content of visit-note.pdf',
    });
  });

  it('saves nothing when no file could be downloaded', async () => {
    behaviors.set('first.pdf', { kind: 'http-error', status: 500 });
    behaviors.set('second.pdf', { kind: 'network-error' });

    const { pending } = startDownload([makeDocument('first.pdf'), makeDocument('second.pdf')]);

    expect(await settle(pending)).toEqual({ status: 'none-downloaded' });
    expect(mockDownloadBlob).not.toHaveBeenCalled();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(events).toEqual(['discard']);
  });

  it('stops everything and reports the archive as too large when reading a file runs out of memory', async () => {
    const releaseFirst = createGate();
    behaviors.set('first.pdf', {
      kind: 'body-error',
      error: new RangeError('Array buffer allocation failed'),
      gate: releaseFirst.promise,
    });
    behaviors.set('second.pdf', { kind: 'hang' });
    behaviors.set('third.pdf', { kind: 'hang' });
    behaviors.set('fourth.pdf', { kind: 'hang' });

    const { hook, pending } = startDownload(
      ['first.pdf', 'second.pdf', 'third.pdf', 'fourth.pdf', 'fifth.pdf', 'sixth.pdf'].map((file) => makeDocument(file))
    );
    await waitFor(() => expect(requestSignals).toHaveLength(4));
    releaseFirst.open();

    expect(await settle(pending)).toEqual({ status: 'too-large' });
    expect([...presignedFiles].sort()).toEqual(['first.pdf', 'fourth.pdf', 'second.pdf', 'third.pdf']);
    expect(requestSignals.every((signal) => signal.aborted)).toBe(true);
    expect(events).toEqual(['aborted:second.pdf', 'aborted:third.pdf', 'aborted:fourth.pdf', 'discard']);
    expect(mockDownloadBlob).not.toHaveBeenCalled();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(hook.result.current.isDownloading).toBe(false);
  });

  it('reports the archive as too large when building it runs out of memory', async () => {
    mockFinish.mockImplementationOnce(() => {
      throw new RangeError('Array buffer allocation failed');
    });

    const { pending } = startDownload([makeDocument('visit-note.pdf'), makeDocument('lab-result.pdf')]);

    expect(await settle(pending)).toEqual({ status: 'too-large' });
    expect(events.at(-1)).toBe('discard');
    expect(mockDownloadBlob).not.toHaveBeenCalled();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('surfaces a sign-in failure as an error, not as the archive being too large', async () => {
    mockGetAccessTokenSilently.mockRejectedValueOnce(new Error('login_required'));

    const { hook, pending } = startDownload([makeDocument('visit-note.pdf')]);

    await act(async () => {
      await expect(pending).rejects.toThrow('login_required');
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(writerFactory.created).toBe(0);
    expect(hook.result.current.isDownloading).toBe(false);
  });

  it('cancels in-flight and queued downloads when the explorer unmounts', async () => {
    const files = ['first.pdf', 'second.pdf', 'third.pdf', 'fourth.pdf', 'fifth.pdf', 'sixth.pdf'];
    files.forEach((file) => behaviors.set(file, { kind: 'hang' }));

    const { hook, pending } = startDownload(files.map((file) => makeDocument(file)));
    await waitFor(() => expect(requestSignals).toHaveLength(4));
    hook.unmount();

    expect(await settle(pending)).toEqual({ status: 'cancelled' });
    expect(presignedFiles).toHaveLength(4);
    expect(requestSignals.every((signal) => signal.aborted)).toBe(true);
    expect(events).toEqual([
      'aborted:first.pdf',
      'aborted:second.pdf',
      'aborted:third.pdf',
      'aborted:fourth.pdf',
      'discard',
    ]);
    expect(mockDownloadBlob).not.toHaveBeenCalled();
  });

  it('downloads at most four files at a time', async () => {
    const files = ['first.pdf', 'second.pdf', 'third.pdf', 'fourth.pdf', 'fifth.pdf', 'sixth.pdf'];
    const gates = files.map((file) => {
      const gate = createGate();
      behaviors.set(file, { kind: 'ok', gate: gate.promise });
      return gate;
    });

    const { pending } = startDownload(files.map((file) => makeDocument(file)));
    await waitFor(() => expect(requestSignals).toHaveLength(4));

    expect(presignedFiles).toHaveLength(4);
    expect(maxActiveRequests).toBe(4);

    gates.forEach((gate) => gate.open());

    expect(await settle(pending)).toEqual({ status: 'saved', affectedDocumentNames: [] });
    expect(maxActiveRequests).toBe(4);
    expect(Object.keys(await readZip(objectUrlBlobs[0])).sort()).toEqual([...files].sort());
  });
});
