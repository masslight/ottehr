import Oystehr from '@oystehr/sdk';
import { Patient } from 'fhir/r4b';
import { describe, expect, it, vi } from 'vitest';
import {
  BILLING_WORKING_COPY_TAG,
  clinicalFriendlyIdIdentifier,
  clinicalPatientIdentifier,
  SOURCE_FRIENDLY_PATIENT_ID_EXTENSION,
  SOURCE_IDENTIFIER_SYSTEM,
} from '../../../src/billing/shared';
import { backfillBillingPatientClinicalIdentifiers } from '../../../src/scripts/backfill-billing-patient-clinical-identifiers.helpers';

function billingPatient(patient: Partial<Patient> & Pick<Patient, 'id'>): Patient {
  return {
    resourceType: 'Patient',
    meta: {
      versionId: '1',
    },
    ...patient,
  };
}

// A claim working copy's source-resource extension points at its billing main Patient, not at the
// clinical Patient, so its clinical ids resolve one hop up the chain.
function workingCopyOf(patient: Partial<Patient> & Pick<Patient, 'id'>): Patient {
  return {
    ...billingPatient(patient),
    meta: {
      versionId: '1',
      tag: [BILLING_WORKING_COPY_TAG],
    },
  };
}

function copyOf(clinicalPatientId: string, friendlyId?: string): Patient['extension'] {
  return [
    {
      url: SOURCE_IDENTIFIER_SYSTEM,
      valueReference: {
        reference: `Patient/${clinicalPatientId}`,
      },
    },
    ...(friendlyId
      ? [
          {
            url: SOURCE_FRIENDLY_PATIENT_ID_EXTENSION,
            valueString: friendlyId,
          },
        ]
      : []),
  ];
}

function mockOystehr(patients: Patient[]): {
  oystehr: Oystehr;
  search: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
} {
  const search = vi.fn().mockResolvedValue({
    total: patients.length,
    entry: patients.map((patient) => ({
      resource: patient,
      search: {
        mode: 'match',
      },
    })),
    unbundle: () => patients,
  });
  const patch = vi.fn().mockResolvedValue(undefined);
  return {
    oystehr: {
      fhir: {
        search,
        patch,
      },
    } as unknown as Oystehr,
    search,
    patch,
  };
}

describe('backfillBillingPatientClinicalIdentifiers', () => {
  it('adds both clinical identifiers to a copy that only has the extensions', async () => {
    const { oystehr, patch } = mockOystehr([
      billingPatient({
        id: 'billing-1',
        extension: copyOf('clinical-1', '1015'),
      }),
    ]);

    const stats = await backfillBillingPatientClinicalIdentifiers(oystehr, false);

    expect(stats).toEqual({
      examined: 1,
      patched: 1,
      alreadyIndexed: 0,
      skipped: 0,
      failed: 0,
    });
    expect(patch).toHaveBeenCalledWith(
      {
        resourceType: 'Patient',
        id: 'billing-1',
        operations: [
          {
            op: 'add',
            path: '/identifier',
            value: [clinicalPatientIdentifier('clinical-1'), clinicalFriendlyIdIdentifier('1015')],
          },
        ],
      },
      {
        optimisticLockingVersionId: '1',
      }
    );
  });

  it('appends only the identifier a partially indexed copy is missing', async () => {
    const { oystehr, patch } = mockOystehr([
      billingPatient({
        id: 'billing-1',
        extension: copyOf('clinical-1', '1015'),
        identifier: [clinicalPatientIdentifier('clinical-1')],
      }),
    ]);

    const stats = await backfillBillingPatientClinicalIdentifiers(oystehr, false);

    expect(stats.patched).toBe(1);
    expect(patch).toHaveBeenCalledWith(
      expect.objectContaining({
        operations: [
          {
            op: 'add',
            path: '/identifier/-',
            value: clinicalFriendlyIdIdentifier('1015'),
          },
        ],
      }),
      expect.anything()
    );
  });

  it('scans working copies alongside main billing patients', async () => {
    const { oystehr, search } = mockOystehr([]);

    await backfillBillingPatientClinicalIdentifiers(oystehr, false);

    expect(search).toHaveBeenCalledWith({
      resourceType: 'Patient',
      params: [
        {
          name: '_count',
          value: '200',
        },
        {
          name: '_total',
          value: 'accurate',
        },
        {
          name: '_offset',
          value: '0',
        },
      ],
    });
  });

  it('indexes a working copy against the clinical ids of the main patient it was copied from', async () => {
    const { oystehr, patch } = mockOystehr([
      billingPatient({
        id: 'billing-main',
        extension: copyOf('clinical-1', '1015'),
        identifier: [clinicalPatientIdentifier('clinical-1'), clinicalFriendlyIdIdentifier('1015')],
      }),
      workingCopyOf({
        id: 'billing-copy',
        extension: copyOf('billing-main'),
      }),
    ]);

    const stats = await backfillBillingPatientClinicalIdentifiers(oystehr, false);

    expect(stats).toEqual({
      examined: 2,
      patched: 1,
      alreadyIndexed: 1,
      skipped: 0,
      failed: 0,
    });
    expect(patch).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'billing-copy',
        operations: [
          {
            op: 'add',
            path: '/identifier',
            value: [clinicalPatientIdentifier('clinical-1'), clinicalFriendlyIdIdentifier('1015')],
          },
        ],
      }),
      expect.anything()
    );
  });

  it('leaves a working copy that already carries the clinical ids alone', async () => {
    const { oystehr, patch } = mockOystehr([
      billingPatient({
        id: 'billing-main',
        extension: copyOf('clinical-1', '1015'),
        identifier: [clinicalPatientIdentifier('clinical-1'), clinicalFriendlyIdIdentifier('1015')],
      }),
      workingCopyOf({
        id: 'billing-copy',
        extension: copyOf('billing-main', '1015'),
        identifier: [clinicalPatientIdentifier('clinical-1'), clinicalFriendlyIdIdentifier('1015')],
      }),
    ]);

    const stats = await backfillBillingPatientClinicalIdentifiers(oystehr, false);

    expect(stats.alreadyIndexed).toBe(2);
    expect(patch).not.toHaveBeenCalled();
  });

  it('skips a working copy whose main patient has no clinical source', async () => {
    const { oystehr, patch } = mockOystehr([
      billingPatient({
        id: 'billing-manual',
      }),
      workingCopyOf({
        id: 'billing-copy',
        extension: copyOf('billing-manual'),
      }),
    ]);

    const stats = await backfillBillingPatientClinicalIdentifiers(oystehr, false);

    expect(stats.skipped).toBe(2);
    expect(patch).not.toHaveBeenCalled();
  });

  it('leaves already indexed copies and manually created patients alone', async () => {
    const { oystehr, patch } = mockOystehr([
      billingPatient({
        id: 'billing-indexed',
        extension: copyOf('clinical-1', '1015'),
        identifier: [clinicalPatientIdentifier('clinical-1'), clinicalFriendlyIdIdentifier('1015')],
      }),
      billingPatient({
        id: 'billing-manual',
      }),
    ]);

    const stats = await backfillBillingPatientClinicalIdentifiers(oystehr, false);

    expect(stats).toEqual({
      examined: 2,
      patched: 0,
      alreadyIndexed: 1,
      skipped: 1,
      failed: 0,
    });
    expect(patch).not.toHaveBeenCalled();
  });

  it('reports what it would patch without writing during a dry run', async () => {
    const { oystehr, patch } = mockOystehr([
      billingPatient({
        id: 'billing-1',
        extension: copyOf('clinical-1'),
      }),
    ]);

    const stats = await backfillBillingPatientClinicalIdentifiers(oystehr, true);

    expect(stats.patched).toBe(1);
    expect(patch).not.toHaveBeenCalled();
  });

  it('counts a failed patch and keeps going', async () => {
    const { oystehr, patch } = mockOystehr([
      billingPatient({
        id: 'billing-1',
        extension: copyOf('clinical-1'),
      }),
      billingPatient({
        id: 'billing-2',
        extension: copyOf('clinical-2'),
      }),
    ]);
    patch.mockRejectedValueOnce(new Error('boom'));

    const stats = await backfillBillingPatientClinicalIdentifiers(oystehr, false);

    expect(stats.patched).toBe(1);
    expect(stats.failed).toBe(1);
    expect(patch).toHaveBeenCalledTimes(2);
  });
});
