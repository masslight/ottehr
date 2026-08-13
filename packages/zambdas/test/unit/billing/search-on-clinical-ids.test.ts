import Oystehr from '@oystehr/sdk';
import { Patient } from 'fhir/r4b';
import { describe, expect, it, vi } from 'vitest';
import {
  clinicalFriendlyIdIdentifier,
  clinicalPatientIdentifier,
  EXCLUDE_WORKING_COPIES_PARAMS,
  identifierSearchToken,
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
