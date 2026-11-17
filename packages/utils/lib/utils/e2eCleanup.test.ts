import Oystehr from '@oystehr/sdk';
import { DocumentReference, Location, Schedule } from 'fhir/r4b';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanupIntegrationTestDocumentReferences, cleanupStaleIntegrationTestLocations } from './e2eCleanup';

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
    const url = `${Z3_BASE}pdf-form-instances/patient-1/form.pdf`;
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
    const { client, transaction } = oystehrWith([docRef('doc-1', `${Z3_BASE}pdf-form-templates/x.pdf`)]);
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' } as Response);

    await cleanupIntegrationTestDocumentReferences(client, 'tok', Z3_BASE);

    expect(transaction).toHaveBeenCalledOnce();
  });

  it('still removes the records when an object delete fails outright', async () => {
    const { client, transaction } = oystehrWith([docRef('doc-1', `${Z3_BASE}pdf-form-templates/x.pdf`)]);
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

describe('cleanupStaleIntegrationTestLocations', () => {
  const NOW = new Date('2026-10-30T12:00:00.000Z');

  const location = (id: string): Location => ({ resourceType: 'Location', id });
  const schedule = (id: string, locationId: string): Schedule => ({
    resourceType: 'Schedule',
    id,
    actor: [{ reference: `Location/${locationId}` }],
  });

  const oystehrWith = (
    resources: (Location | Schedule)[]
  ): { client: Oystehr; search: ReturnType<typeof vi.fn>; batch: ReturnType<typeof vi.fn> } => {
    const search = vi.fn().mockResolvedValue({ unbundle: () => resources, total: resources.length });
    const batch = vi.fn().mockResolvedValue({});
    return { client: { fhir: { search, batch } } as unknown as Oystehr, search, batch };
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('only looks at tagged Locations untouched for a day, with the Schedules that act for them', async () => {
    const { client, search } = oystehrWith([]);

    await cleanupStaleIntegrationTestLocations(client);

    // An hour, as the other sweeps use, could catch a Location a slow run on the shared env still needs.
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'Location',
        params: expect.arrayContaining([
          { name: '_tag', value: 'INTEGRATION_TEST_PROCESS_ID_SYSTEM|' },
          { name: '_lastUpdated', value: 'lt2026-10-29T12:00:00.000Z' },
          { name: '_revinclude', value: 'Schedule:actor' },
        ]),
      })
    );
  });

  it('deletes the Schedules before the Locations they point at', async () => {
    const { client, batch } = oystehrWith([location('loc-1'), schedule('sch-1', 'loc-1'), location('loc-2')]);

    await cleanupStaleIntegrationTestLocations(client);

    expect(batch).toHaveBeenCalledWith({
      requests: [
        { method: 'DELETE', url: 'Schedule/sch-1' },
        { method: 'DELETE', url: 'Location/loc-1' },
        { method: 'DELETE', url: 'Location/loc-2' },
      ],
    });
  });

  it('splits a large backlog into batches and keeps going past a failed one', async () => {
    const locations = Array.from({ length: 150 }, (_, i) => location(`loc-${i}`));
    const { client, batch } = oystehrWith(locations);
    batch.mockRejectedValueOnce(new Error('boom'));

    await cleanupStaleIntegrationTestLocations(client);

    expect(batch).toHaveBeenCalledTimes(2);
    expect(batch.mock.calls[0][0].requests).toHaveLength(100);
    expect(batch.mock.calls[1][0].requests).toHaveLength(50);
  });

  it('does nothing when there is nothing to sweep', async () => {
    const { client, batch } = oystehrWith([]);

    await cleanupStaleIntegrationTestLocations(client);

    expect(batch).not.toHaveBeenCalled();
  });
});
