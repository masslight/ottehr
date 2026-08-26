import Oystehr from '@oystehr/sdk';
import { Patient } from 'fhir/r4b';
import { describe, expect, it, vi } from 'vitest';
import { createWorkingCopies } from '../../../src/billing/create-billing-claim';
import {
  BILLING_WORKING_COPY_TAG,
  clinicalFriendlyIdIdentifier,
  clinicalPatientIdentifier,
  SOURCE_FRIENDLY_PATIENT_ID_EXTENSION,
  SOURCE_IDENTIFIER_SYSTEM,
} from '../../../src/billing/shared';

// The main billing patient a user picks in the Create Claim dialog: its source-resource extension
// references the clinical patient, and its identifiers index the clinical ids.
function mainBillingPatient(clinicalId: string, friendlyId?: string): Patient {
  return {
    resourceType: 'Patient',
    id: 'billing-main',
    name: [
      {
        family: 'Doe',
        given: ['Jane'],
      },
    ],
    birthDate: '1990-01-01',
    extension: [
      {
        url: SOURCE_IDENTIFIER_SYSTEM,
        valueReference: {
          reference: `Patient/${clinicalId}`,
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
    ],
    identifier: [
      clinicalPatientIdentifier(clinicalId),
      ...(friendlyId ? [clinicalFriendlyIdIdentifier(friendlyId)] : []),
    ],
  };
}

function mockOystehr(): {
  oystehr: Oystehr;
  transaction: ReturnType<typeof vi.fn>;
  search: ReturnType<typeof vi.fn>;
} {
  const transaction = vi.fn().mockResolvedValue({
    entry: [
      {
        resource: {
          resourceType: 'Patient',
          id: 'billing-copy',
        },
      },
    ],
  });
  const search = vi.fn().mockResolvedValue({ unbundle: () => [] });
  return {
    oystehr: {
      fhir: {
        transaction,
        search,
      },
    } as unknown as Oystehr,
    transaction,
    search,
  };
}

function postedPatient(transaction: ReturnType<typeof vi.fn>): Patient {
  const { requests } = transaction.mock.calls[0][0];
  return requests.find((request: { url: string }) => request.url === '/Patient').resource;
}

describe('createWorkingCopies', () => {
  it('applies the clinical ids of the billing patient to the claim working copy', async () => {
    const { oystehr, transaction } = mockOystehr();

    await createWorkingCopies(oystehr, { patient: mainBillingPatient('clinical-1', '1015') });

    const copy = postedPatient(transaction);
    expect(copy.identifier).toEqual([clinicalPatientIdentifier('clinical-1'), clinicalFriendlyIdIdentifier('1015')]);
    expect(copy.extension).toEqual([
      {
        url: SOURCE_IDENTIFIER_SYSTEM,
        valueReference: {
          reference: 'Patient/billing-main',
        },
      },
      {
        url: SOURCE_FRIENDLY_PATIENT_ID_EXTENSION,
        valueString: '1015',
      },
    ]);
    expect(copy.meta?.tag).toEqual([BILLING_WORKING_COPY_TAG]);
  });

  it('applies only the clinical patient id when the billing patient has no friendly id', async () => {
    const { oystehr, transaction } = mockOystehr();

    await createWorkingCopies(oystehr, { patient: mainBillingPatient('clinical-1') });

    expect(postedPatient(transaction).identifier).toEqual([clinicalPatientIdentifier('clinical-1')]);
  });

  it('leaves a manually created billing patient with no clinical identifiers to index', async () => {
    const { oystehr, transaction } = mockOystehr();

    await createWorkingCopies(oystehr, {
      patient: {
        resourceType: 'Patient',
        id: 'billing-manual',
        name: [
          {
            family: 'Doe',
            given: ['Jane'],
          },
        ],
      },
    });

    expect(postedPatient(transaction).identifier).toBeUndefined();
  });

  // Claim creation must survive a source patient whose own copy parent has been deleted: there is no
  // clinical patient left to index, which is not a reason to refuse the claim.
  it('still builds the working copy when the source patient is a copy of a deleted patient', async () => {
    const { oystehr, transaction } = mockOystehr();

    await createWorkingCopies(oystehr, {
      patient: {
        ...mainBillingPatient('billing-gone'),
        identifier: undefined,
        meta: {
          tag: [BILLING_WORKING_COPY_TAG],
        },
      },
    });

    expect(postedPatient(transaction).identifier).toBeUndefined();
    expect(postedPatient(transaction).meta?.tag).toEqual([BILLING_WORKING_COPY_TAG]);
  });
});
