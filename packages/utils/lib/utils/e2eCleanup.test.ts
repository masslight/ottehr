import Oystehr from '@oystehr/sdk';
import { DocumentReference } from 'fhir/r4b';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanupIntegrationTestDocumentReferences } from './e2eCleanup';

/**
 * The nightly sweep that removes what a crashed integration run left behind.
 *
 * Worth testing rather than trusting because it deletes: it sends the machine identity's token to a URL
 * taken from a stored resource, and it removes records nothing else will. Both halves are easy to get
 * subtly wrong in ways nothing would report.
 */
const Z3_BASE = 'https://project-api.example.com/v1/z3/proj-1-';

const docRef = (id: string, ...urls: string[]): DocumentReference =>
  ({
    resourceType: 'DocumentReference',
    id,
    status: 'current',
    content: urls.map((url) => ({ attachment: { url } })),
  }) as DocumentReference;

const oystehrWith = (documents: DocumentReference[]): { client: Oystehr; transaction: ReturnType<typeof vi.fn> } => {
  const transaction = vi.fn().mockResolvedValue({});
  const client = {
    fhir: {
      // `getAllFhirSearchPages` drives this; one page is enough to exercise the sweep.
      search: vi.fn().mockResolvedValue({ unbundle: () => documents, total: documents.length }),
      transaction,
    },
  } as unknown as Oystehr;
  return { client, transaction };
};

describe('cleanupIntegrationTestDocumentReferences', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK' }));
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('deletes the stored object before the record that names it', async () => {
    const url = `${Z3_BASE}form-instances/patient-1/form.pdf`;
    const { client, transaction } = oystehrWith([docRef('doc-1', url)]);

    const order: string[] = [];
    vi.mocked(fetch).mockImplementation(async () => {
      order.push('object');
      return { ok: true, status: 200, statusText: 'OK' } as Response;
    });
    transaction.mockImplementation(async () => {
      order.push('record');
      return {};
    });

    await cleanupIntegrationTestDocumentReferences(client, 'tok', Z3_BASE);

    // Reversed, the URL is gone before anything uses it and the bytes are orphaned for good.
    expect(order).toEqual(['object', 'record']);
    expect(transaction).toHaveBeenCalledWith({ requests: [{ method: 'DELETE', url: 'DocumentReference/doc-1' }] });
  });

  it('never sends the token to a URL outside this project', async () => {
    // A test may legitimately record a DocumentReference pointing anywhere — one in this repo uses
    // example.com — and a DELETE here carries the M2M token.
    const { client, transaction } = oystehrWith([docRef('doc-1', 'https://attacker.example/collect')]);

    await cleanupIntegrationTestDocumentReferences(client, 'tok', Z3_BASE);

    expect(fetch).not.toHaveBeenCalled();
    // The record is still removed; only its foreign attachment is left alone.
    expect(transaction).toHaveBeenCalledOnce();
  });

  it('treats an object that is already gone as success', async () => {
    const { client, transaction } = oystehrWith([docRef('doc-1', `${Z3_BASE}form-templates/x.pdf`)]);
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' } as Response);

    await cleanupIntegrationTestDocumentReferences(client, 'tok', Z3_BASE);

    expect(transaction).toHaveBeenCalledOnce();
  });

  it('still removes the records when an object delete fails outright', async () => {
    const { client, transaction } = oystehrWith([docRef('doc-1', `${Z3_BASE}form-templates/x.pdf`)]);
    vi.mocked(fetch).mockRejectedValue(new Error('network down'));

    await expect(cleanupIntegrationTestDocumentReferences(client, 'tok', Z3_BASE)).resolves.toBeUndefined();
    expect(transaction).toHaveBeenCalledOnce();
  });

  it('does nothing when there is nothing to sweep', async () => {
    const { client, transaction } = oystehrWith([]);

    await cleanupIntegrationTestDocumentReferences(client, 'tok', Z3_BASE);

    expect(fetch).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });
});
