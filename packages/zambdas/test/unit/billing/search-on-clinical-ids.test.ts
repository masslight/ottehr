import Oystehr from '@oystehr/sdk';
import { Patient } from 'fhir/r4b';
import { describe, expect, it, vi } from 'vitest';
import {
  BILLING_WORKING_COPY_TAG,
  clinicalFriendlyIdIdentifier,
  clinicalPatientIdentifier,
  EXCLUDE_WORKING_COPIES_PARAMS,
  identifierSearchToken,
  resolveClinicalPatientIds,
  searchOnClinicalIDs,
  searchPatientsByClinicalIds,
  SOURCE_FRIENDLY_PATIENT_ID_EXTENSION,
  SOURCE_IDENTIFIER_SYSTEM,
} from '../../../src/billing/shared';

function billingPatient(id: string, clinicalPatientId?: string, friendlyId?: string): Patient {
  const extension = [
    ...(clinicalPatientId
      ? [
          {
            url: SOURCE_IDENTIFIER_SYSTEM,
            valueReference: {
              reference: `Patient/${clinicalPatientId}`,
            },
          },
        ]
      : []),
    ...(friendlyId
      ? [
          {
            url: SOURCE_FRIENDLY_PATIENT_ID_EXTENSION,
            valueString: friendlyId,
          },
        ]
      : []),
  ];
  return {
    resourceType: 'Patient',
    id,
    extension: extension.length ? extension : undefined,
  };
}

// A working copy's source-resource extension references the billing Patient it was cloned from,
// which is one hop away from the clinical Patient the identifiers index.
function workingCopy(id: string, sourceBillingPatientId?: string, friendlyId?: string): Patient {
  return {
    ...billingPatient(id, sourceBillingPatientId, friendlyId),
    meta: {
      tag: [BILLING_WORKING_COPY_TAG],
    },
  };
}

function mockOystehr(patients: Patient[]): { oystehr: Oystehr; search: ReturnType<typeof vi.fn> } {
  const search = vi.fn().mockResolvedValue({ unbundle: () => patients });
  return {
    oystehr: {
      fhir: {
        search,
      },
    } as unknown as Oystehr,
    search,
  };
}

describe('searchOnClinicalIDs', () => {
  it('keeps only the copy whose extension matches the clinical patient', async () => {
    const { oystehr } = mockOystehr([
      billingPatient('billing-other', 'clinical-2'),
      billingPatient('billing-match', 'clinical-1'),
      billingPatient('billing-manual'),
    ]);

    const result = await searchOnClinicalIDs(oystehr, [], 0, 10, 'clinical-1');

    expect(result.total).toBe(1);
    expect(result.results.map((p) => p.id)).toEqual(['billing-match']);
  });

  it('finds nothing when no copy points at the clinical patient', async () => {
    const { oystehr } = mockOystehr([billingPatient('billing-other', 'clinical-2')]);

    const result = await searchOnClinicalIDs(oystehr, [], 0, 10, 'clinical-1');

    expect(result.total).toBe(0);
    expect(result.results).toEqual([]);
  });

  it('forwards the caller narrowing params alongside paging', async () => {
    const { oystehr, search } = mockOystehr([billingPatient('billing-match', 'clinical-1')]);

    await searchOnClinicalIDs(
      oystehr,
      [
        {
          name: 'birthdate',
          value: '1990-04-12',
        },
        ...EXCLUDE_WORKING_COPIES_PARAMS,
      ],
      0,
      1,
      'clinical-1'
    );

    expect(search).toHaveBeenCalledWith({
      resourceType: 'Patient',
      params: [
        {
          name: 'birthdate',
          value: '1990-04-12',
        },
        ...EXCLUDE_WORKING_COPIES_PARAMS,
        {
          name: '_count',
          value: '200',
        },
        {
          name: '_offset',
          value: '0',
        },
      ],
    });
  });

  it('filters by clinical friendly id', async () => {
    const { oystehr } = mockOystehr([
      billingPatient('billing-1', 'clinical-1', '1015'),
      billingPatient('billing-2', 'clinical-2', '1017'),
    ]);

    const result = await searchOnClinicalIDs(oystehr, [], 0, 10, undefined, '1017');

    expect(result.results.map((p) => p.id)).toEqual(['billing-2']);
  });

  it('keeps copies matching either id when both are given', async () => {
    const { oystehr } = mockOystehr([
      billingPatient('billing-1', 'clinical-1'),
      billingPatient('billing-2', 'clinical-2', '1015'),
      billingPatient('billing-3', 'clinical-3', '1017'),
    ]);

    const result = await searchOnClinicalIDs(oystehr, [], 0, 10, 'clinical-1', '1015');

    expect(result.results.map((p) => p.id)).toEqual(['billing-1', 'billing-2']);
  });

  it('reports the full match count while returning only the requested page', async () => {
    const { oystehr } = mockOystehr([
      billingPatient('billing-1', 'clinical-1'),
      billingPatient('billing-2', 'clinical-1'),
      billingPatient('billing-3', 'clinical-1'),
    ]);

    const result = await searchOnClinicalIDs(oystehr, [], 0, 1, 'clinical-1');

    expect(result.total).toBe(3);
    expect(result.results.map((p) => p.id)).toEqual(['billing-1']);
  });
});

describe('resolveClinicalPatientIds', () => {
  // The backfill serves parent hops from the Patients it already scanned; production leaves the
  // fetcher out and the default reads the parent from the server.
  const preloaded = (patients: Patient[]) => {
    const byId = new Map(patients.map((patient) => [patient.id!, patient]));
    return async (id: string): Promise<Patient | undefined> => byId.get(id);
  };

  const serverWith = (patients: Patient[]): { oystehr: Oystehr; search: ReturnType<typeof vi.fn> } => {
    const search = vi.fn().mockImplementation(
      ({
        params,
      }: {
        params: {
          name: string;
          value: string;
        }[];
      }) => {
        const id = params.find((param) => param.name === '_id')?.value;
        const found = patients.filter((patient) => patient.id === id);
        return Promise.resolve({ unbundle: () => found });
      }
    );
    return {
      oystehr: {
        fhir: {
          search,
        },
      } as unknown as Oystehr,
      search,
    };
  };

  it('reads a main billing patient straight off its own extensions', async () => {
    const patient = billingPatient('billing-main', 'clinical-1', '1015');
    const { oystehr, search } = serverWith([patient]);

    const ids = await resolveClinicalPatientIds({
      oystehr,
      patient,
    });

    expect(ids).toEqual({
      clinicalId: 'clinical-1',
      clinicalFriendlyId: '1015',
    });
    expect(search).not.toHaveBeenCalled();
  });

  it('hops through the main patient for a working copy, whose extension points at the copy source', async () => {
    const main = billingPatient('billing-main', 'clinical-1', '1015');
    const copy = workingCopy('billing-copy', 'billing-main');
    const { oystehr } = serverWith([main, copy]);

    const ids = await resolveClinicalPatientIds({
      oystehr,
      patient: copy,
    });

    expect(ids).toEqual({
      clinicalId: 'clinical-1',
      clinicalFriendlyId: '1015',
      workingCopyParentId: 'billing-main',
    });
  });

  it('serves the hop from a caller-supplied fetcher instead of the server', async () => {
    const main = billingPatient('billing-main', 'clinical-1', '1015');
    const copy = workingCopy('billing-copy', 'billing-main');
    const { oystehr, search } = serverWith([]);

    const ids = await resolveClinicalPatientIds({
      oystehr,
      patient: copy,
      fetchBillingPatient: preloaded([main, copy]),
    });

    expect(ids.clinicalId).toBe('clinical-1');
    expect(search).not.toHaveBeenCalled();
  });

  it('walks past an intermediate working copy to reach the main patient', async () => {
    const main = billingPatient('billing-main', 'clinical-1', '1015');
    const copy = workingCopy('billing-copy', 'billing-main');
    const copyOfCopy = workingCopy('billing-copy-of-copy', 'billing-copy');
    const { oystehr } = serverWith([main, copy, copyOfCopy]);

    const ids = await resolveClinicalPatientIds({
      oystehr,
      patient: copyOfCopy,
    });

    expect(ids).toEqual({
      clinicalId: 'clinical-1',
      clinicalFriendlyId: '1015',
      workingCopyParentId: 'billing-copy',
    });
  });

  it('resolves no clinical id for a working copy whose extension points at itself', async () => {
    const copy = workingCopy('billing-loop', 'billing-loop');
    const { oystehr } = serverWith([copy]);

    const ids = await resolveClinicalPatientIds({
      oystehr,
      patient: copy,
    });

    expect(ids).toEqual({
      clinicalId: undefined,
      clinicalFriendlyId: undefined,
      workingCopyParentId: 'billing-loop',
    });
  });

  it('resolves no clinical id when the copy chain cycles', async () => {
    const first = workingCopy('billing-first', 'billing-second');
    const second = workingCopy('billing-second', 'billing-first');
    const { oystehr } = serverWith([first, second]);

    const ids = await resolveClinicalPatientIds({
      oystehr,
      patient: first,
    });

    expect(ids.clinicalId).toBeUndefined();
  });

  // The cap is a backstop against an unbounded walk, so a chain deeper than it resolves to nothing
  // rather than hanging. Real chains are one hop, occasionally two.
  it('gives up on a copy chain longer than the hop cap', async () => {
    const main = billingPatient('billing-main', 'clinical-1', '1015');
    const chain = Array.from({ length: 12 }, (_, index) =>
      workingCopy(`billing-copy-${index}`, index === 11 ? 'billing-main' : `billing-copy-${index + 1}`)
    );
    const { oystehr } = serverWith([main, ...chain]);

    const ids = await resolveClinicalPatientIds({
      oystehr,
      patient: chain[0],
    });

    expect(ids.clinicalId).toBeUndefined();
  });

  // A deleted main patient must not fail the copy: there is no clinical patient left to index, the
  // same as a working copy of a manually created billing patient.
  it('degrades rather than throwing when the main patient is gone', async () => {
    const copy = workingCopy('billing-copy', 'billing-gone');
    const { oystehr } = serverWith([copy]);

    const ids = await resolveClinicalPatientIds({
      oystehr,
      patient: copy,
    });

    expect(ids).toEqual({
      clinicalId: undefined,
      clinicalFriendlyId: undefined,
      workingCopyParentId: 'billing-gone',
    });
  });

  it('keeps the working copy own friendly id when the main patient has none', async () => {
    const main = billingPatient('billing-main', 'clinical-1');
    const copy = workingCopy('billing-copy', 'billing-main', '1015');
    const { oystehr } = serverWith([main, copy]);

    const ids = await resolveClinicalPatientIds({
      oystehr,
      patient: copy,
    });

    expect(ids).toEqual({
      clinicalId: 'clinical-1',
      clinicalFriendlyId: '1015',
      workingCopyParentId: 'billing-main',
    });
  });

  it('resolves no clinical id for a working copy of a manually created billing patient', async () => {
    const main = billingPatient('billing-manual');
    const copy = workingCopy('billing-copy', 'billing-manual');
    const { oystehr } = serverWith([main, copy]);

    const ids = await resolveClinicalPatientIds({
      oystehr,
      patient: copy,
    });

    expect(ids).toEqual({
      clinicalId: undefined,
      clinicalFriendlyId: undefined,
      workingCopyParentId: 'billing-manual',
    });
  });

  it('resolves nothing for a manually created billing patient', async () => {
    const patient = billingPatient('billing-manual');
    const { oystehr } = serverWith([patient]);

    const ids = await resolveClinicalPatientIds({
      oystehr,
      patient,
    });

    expect(ids).toEqual({
      clinicalId: undefined,
      clinicalFriendlyId: undefined,
    });
  });
});

describe('searchPatientsByClinicalIds', () => {
  it('searches the clinical patient id as an indexed identifier and does not scan', async () => {
    const search = vi.fn().mockResolvedValueOnce({
      total: 1,
      unbundle: () => [billingPatient('billing-match', 'clinical-1')],
    });
    const oystehr = { fhir: { search } } as unknown as Oystehr;

    const result = await searchPatientsByClinicalIds({
      oystehr,
      baseSearchParams: [...EXCLUDE_WORKING_COPIES_PARAMS],
      offset: 0,
      pageSize: 25,
      uuid: 'clinical-1',
    });

    expect(result).toEqual({
      total: 1,
      results: [billingPatient('billing-match', 'clinical-1')],
    });
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith({
      resourceType: 'Patient',
      params: [
        ...EXCLUDE_WORKING_COPIES_PARAMS,
        {
          name: 'identifier',
          value: identifierSearchToken(clinicalPatientIdentifier('clinical-1')),
        },
        {
          name: '_count',
          value: '25',
        },
        {
          name: '_offset',
          value: '0',
        },
      ],
    });
  });

  it('pages from the server rather than slicing in memory', async () => {
    const search = vi.fn().mockResolvedValueOnce({
      total: 40,
      unbundle: () => [billingPatient('billing-match', 'clinical-1')],
    });
    const oystehr = { fhir: { search } } as unknown as Oystehr;

    const result = await searchPatientsByClinicalIds({
      oystehr,
      baseSearchParams: [],
      offset: 25,
      pageSize: 25,
      uuid: 'clinical-1',
    });

    expect(result.total).toBe(40);
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.arrayContaining([
          {
            name: '_offset',
            value: '25',
          },
        ]),
      })
    );
  });

  it('falls back to the extension scan when the indexed search finds nothing', async () => {
    const search = vi
      .fn()
      .mockResolvedValueOnce({ total: 0, unbundle: () => [] })
      .mockResolvedValueOnce({ unbundle: () => [billingPatient('billing-legacy', 'clinical-1')] });
    const oystehr = { fhir: { search } } as unknown as Oystehr;

    const result = await searchPatientsByClinicalIds({
      oystehr,
      baseSearchParams: [],
      offset: 0,
      pageSize: 25,
      uuid: 'clinical-1',
    });

    expect(result.results.map((p) => p.id)).toEqual(['billing-legacy']);
    expect(search).toHaveBeenCalledTimes(2);
  });

  it('searches the friendly id as an indexed identifier and does not scan', async () => {
    const search = vi.fn().mockResolvedValueOnce({
      total: 1,
      unbundle: () => [billingPatient('billing-1', 'clinical-1', '1015')],
    });
    const oystehr = { fhir: { search } } as unknown as Oystehr;

    const result = await searchPatientsByClinicalIds({
      oystehr,
      baseSearchParams: [],
      offset: 0,
      pageSize: 25,
      friendlyId: '1015',
    });

    expect(result.results.map((p) => p.id)).toEqual(['billing-1']);
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.arrayContaining([
          {
            name: 'identifier',
            value: identifierSearchToken(clinicalFriendlyIdIdentifier('1015')),
          },
        ]),
      })
    );
  });

  it('ORs the two ids into a single identifier param', async () => {
    const search = vi.fn().mockResolvedValueOnce({
      total: 2,
      unbundle: () => [billingPatient('billing-1', 'clinical-1'), billingPatient('billing-2', 'clinical-2', '1015')],
    });
    const oystehr = { fhir: { search } } as unknown as Oystehr;

    const result = await searchPatientsByClinicalIds({
      oystehr,
      baseSearchParams: [],
      offset: 0,
      pageSize: 25,
      uuid: 'clinical-1',
      friendlyId: '1015',
    });

    expect(result.results.map((p) => p.id)).toEqual(['billing-1', 'billing-2']);
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.arrayContaining([
          {
            name: 'identifier',
            value: `${identifierSearchToken(clinicalPatientIdentifier('clinical-1'))},${identifierSearchToken(
              clinicalFriendlyIdIdentifier('1015')
            )}`,
          },
        ]),
      })
    );
  });

  it('falls back to the extension scan for a friendly id that is not indexed yet', async () => {
    const search = vi
      .fn()
      .mockResolvedValueOnce({ total: 0, unbundle: () => [] })
      .mockResolvedValueOnce({ unbundle: () => [billingPatient('billing-legacy', 'clinical-1', '1015')] });
    const oystehr = { fhir: { search } } as unknown as Oystehr;

    const result = await searchPatientsByClinicalIds({
      oystehr,
      baseSearchParams: [],
      offset: 0,
      pageSize: 25,
      friendlyId: '1015',
    });

    expect(result.results.map((p) => p.id)).toEqual(['billing-legacy']);
    expect(search).toHaveBeenCalledTimes(2);
  });
});
