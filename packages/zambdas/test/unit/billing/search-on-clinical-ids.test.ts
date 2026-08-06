import Oystehr from '@oystehr/sdk';
import { Patient } from 'fhir/r4b';
import { describe, expect, it, vi } from 'vitest';
import {
  EXCLUDE_WORKING_COPIES_PARAMS,
  searchOnClinicalIDs,
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
