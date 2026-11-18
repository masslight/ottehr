import Oystehr from '@oystehr/sdk';
import { Account, Coverage, DeviceRequest, Encounter, FhirResource, Patient, RelatedPerson } from 'fhir/r4b';
import { DmeOrderFieldsSchema } from 'utils/lib/types/api/dme.types';
import { PatientAccountAndCoverageResources } from 'utils/lib/types/data/account';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { gatherDmeOrderFormInput } from '../../src/ehr/dme/get-dme-order-pdf/helpers';
import { getAccountAndCoverageResourcesForPatient } from '../../src/ehr/shared/harvest';
import { makeDmeDeviceRequest } from '../../src/shared/dme';

vi.mock('../../src/ehr/shared/harvest', () => ({ getAccountAndCoverageResourcesForPatient: vi.fn() }));

const PRACTITIONER_ID = '2b0f5b9e-6a43-4c55-9f5e-6a1d1c7d1a01';
const versioned = <T extends FhirResource>(resource: T): T => ({
  ...resource,
  meta: { ...resource.meta, versionId: '1' },
});

const deviceRequest: DeviceRequest = versioned({
  ...makeDmeDeviceRequest({
    fields: DmeOrderFieldsSchema.parse({ itemName: 'Crutches', quantity: 1, orderedByPractitionerId: PRACTITIONER_ID }),
    encounterId: 'encounter-1',
    patientId: 'patient-1',
  }),
  id: 'device-request-1',
});
const encounter: Encounter = versioned({
  resourceType: 'Encounter',
  id: 'encounter-1',
  status: 'in-progress',
  class: { code: 'AMB' },
});
const patient: Patient = versioned({ resourceType: 'Patient', id: 'patient-1' });
const account: Account = versioned({ resourceType: 'Account', id: 'account-1', status: 'active' });
const coverage = (id: string, subscriber: string): Coverage =>
  versioned({
    resourceType: 'Coverage',
    id,
    status: 'active',
    beneficiary: { reference: 'Patient/patient-1' },
    payor: [{ reference: 'Organization/payer-1' }],
    subscriber: { reference: subscriber },
  });
const parent: RelatedPerson = versioned({
  resourceType: 'RelatedPerson',
  id: 'parent-1',
  patient: { reference: 'Patient/patient-1' },
});

const oystehr = {
  fhir: {
    get: vi.fn(async ({ resourceType }: { resourceType: string }) =>
      resourceType === 'DeviceRequest' ? deviceRequest : encounter
    ),
    search: vi.fn(async () => ({ unbundle: () => [] })),
  },
} as unknown as Oystehr;

describe('DME order form sources', () => {
  beforeEach(() => {
    vi.mocked(getAccountAndCoverageResourcesForPatient).mockResolvedValue({
      patient,
      account,
      insuranceOrgs: [],
      coverages: {
        primary: coverage('coverage-1', '#coverageSubscriber'),
        primarySubscriber: { ...parent, id: 'coverageSubscriber' },
        secondary: coverage('coverage-2', 'RelatedPerson/parent-1'),
        secondarySubscriber: parent,
      },
    } as PatientAccountAndCoverageResources);
  });

  it('versions a standalone subscriber on its own and a contained one through its coverage', async () => {
    const { sources } = await gatherDmeOrderFormInput('device-request-1', oystehr);
    const refs = sources.map((source) => `${source.resourceType}/${source.id}`);

    expect(refs).toEqual(
      expect.arrayContaining([
        'Account/account-1',
        'Coverage/coverage-1',
        'Coverage/coverage-2',
        'RelatedPerson/parent-1',
      ])
    );
    expect(refs).not.toContain('RelatedPerson/coverageSubscriber');
  });
});
