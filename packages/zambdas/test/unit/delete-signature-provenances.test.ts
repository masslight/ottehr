import { Provenance } from 'fhir/r4b';
import { PARTICIPATION_CODE_SYSTEM } from 'utils';
import { describe, expect, test, vi } from 'vitest';
import { getSignatureProvenanceDeleteRequests } from '../../src/shared/deleteSignatureProvenances';

const provenance = (id: string, role: string, target = 'Encounter/enc-1'): Provenance => ({
  resourceType: 'Provenance',
  id,
  target: [{ reference: target }],
  recorded: '2026-06-07T15:30:00.000Z',
  agent: [
    {
      role: [{ coding: [{ system: PARTICIPATION_CODE_SYSTEM, code: role, display: role }] }],
      who: { reference: 'Practitioner/p1' },
    },
  ],
});

const mockOystehr = (resourcesByEncounter: Record<string, Provenance[]>): any => {
  const search = vi.fn(async ({ params }: { params: { name: string; value: string }[] }) => {
    const target = params.find((p) => p.name === 'target')?.value ?? '';
    const encounterId = target.split('/')[1];
    return { unbundle: () => resourcesByEncounter[encounterId] ?? [] };
  });
  return { oystehr: { fhir: { search } }, search };
};

describe('getSignatureProvenanceDeleteRequests', () => {
  test('builds DELETE requests for author and verifier provenances', async () => {
    const { oystehr } = mockOystehr({
      'enc-1': [provenance('prov-author', 'author'), provenance('prov-verifier', 'verifier')],
    });

    const requests = await getSignatureProvenanceDeleteRequests(oystehr, ['enc-1']);

    expect(requests).toEqual([
      { method: 'DELETE', url: '/Provenance/prov-author' },
      { method: 'DELETE', url: '/Provenance/prov-verifier' },
    ]);
  });

  test('ignores provenances that are not signature (author/verifier) provenances', async () => {
    const { oystehr } = mockOystehr({
      'enc-1': [provenance('prov-author', 'author'), provenance('prov-other', 'informant')],
    });

    const requests = await getSignatureProvenanceDeleteRequests(oystehr, ['enc-1']);

    expect(requests).toEqual([{ method: 'DELETE', url: '/Provenance/prov-author' }]);
  });

  test('collects provenances across multiple encounters and dedupes/filters empty ids', async () => {
    const { oystehr, search } = mockOystehr({
      'enc-1': [provenance('prov-1', 'author', 'Encounter/enc-1')],
      'enc-2': [provenance('prov-2', 'verifier', 'Encounter/enc-2')],
    });

    const requests = await getSignatureProvenanceDeleteRequests(oystehr, ['enc-1', 'enc-2', 'enc-1', '']);

    expect(requests).toEqual([
      { method: 'DELETE', url: '/Provenance/prov-1' },
      { method: 'DELETE', url: '/Provenance/prov-2' },
    ]);
    // enc-1 deduped, empty id dropped → only two searches
    expect(search).toHaveBeenCalledTimes(2);
  });

  test('returns an empty array when there are no encounter ids', async () => {
    const { oystehr, search } = mockOystehr({});

    const requests = await getSignatureProvenanceDeleteRequests(oystehr, []);

    expect(requests).toEqual([]);
    expect(search).not.toHaveBeenCalled();
  });

  test('returns an empty array when there are no signature provenances', async () => {
    const { oystehr } = mockOystehr({ 'enc-1': [] });

    const requests = await getSignatureProvenanceDeleteRequests(oystehr, ['enc-1']);

    expect(requests).toEqual([]);
  });
});
