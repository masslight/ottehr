import Oystehr from '@oystehr/sdk';
import { Account, Encounter, Organization } from 'fhir/r4b';
import { ENCOUNTER_VISIT_OCCUPATIONAL_MEDICINE_EMPLOYER_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { getNioReferenceUrl } from 'utils/lib/helpers/helpers';
import { describe, expect, it, vi } from 'vitest';
import { resolveOccupationalMedicineEmployerName } from '../../src/ehr/visit-details/visit-details-to-pdf';

const NIO_ID = '11111111-1111-4111-8111-111111111111';
const LEGACY_ORG_ID = '22222222-2222-4222-8222-222222222222';

const accountOrg: Organization = { resourceType: 'Organization', id: LEGACY_ORG_ID, name: 'Account Employer Inc' };
const accountWithTokenOwner: Account = {
  resourceType: 'Account',
  status: 'active',
  owner: { reference: getNioReferenceUrl(NIO_ID), display: 'FedEx' },
};

function encounterWithVisitEmployer(reference?: string, display?: string): Encounter {
  return {
    resourceType: 'Encounter',
    status: 'in-progress',
    class: { code: 'AMB' },
    ...(reference
      ? {
          extension: [
            {
              url: ENCOUNTER_VISIT_OCCUPATIONAL_MEDICINE_EMPLOYER_EXTENSION_URL,
              valueReference: { reference, ...(display ? { display } : {}) },
            },
          ],
        }
      : {}),
  };
}

function makeOystehr(org?: Organization): { oystehr: Oystehr; get: ReturnType<typeof vi.fn> } {
  const get = vi.fn().mockResolvedValue(org);
  return { oystehr: { fhir: { get } } as unknown as Oystehr, get };
}

describe('resolveOccupationalMedicineEmployerName', () => {
  it('pre-op: uses the NIO token display with no FHIR read', async () => {
    const { oystehr, get } = makeOystehr();
    const name = await resolveOccupationalMedicineEmployerName({
      oystehr,
      encounter: encounterWithVisitEmployer(getNioReferenceUrl(NIO_ID), 'FedEx'),
      appointmentServiceCategory: 'pre-op',
      occupationalMedicineEmployerOrganization: accountOrg,
    });
    expect(name).toBe('FedEx');
    expect(get).not.toHaveBeenCalled();
  });

  it('pre-op: fetches a legacy visit-level organization by id', async () => {
    const { oystehr, get } = makeOystehr({ resourceType: 'Organization', id: LEGACY_ORG_ID, name: 'Visit Employer' });
    const name = await resolveOccupationalMedicineEmployerName({
      oystehr,
      encounter: encounterWithVisitEmployer(`Organization/${LEGACY_ORG_ID}`),
      appointmentServiceCategory: 'pre-op',
    });
    expect(name).toBe('Visit Employer');
    expect(get).toHaveBeenCalledWith({ resourceType: 'Organization', id: LEGACY_ORG_ID });
  });

  it('pre-op: an unresolvable visit-level reference renders nothing — never the Account employer', async () => {
    const { oystehr } = makeOystehr();
    // A token with no display is present but unresolvable name-wise; the old code fell back to
    // the patient-Account employer here, leaking a different visit's employer onto the PDF.
    const name = await resolveOccupationalMedicineEmployerName({
      oystehr,
      encounter: encounterWithVisitEmployer(getNioReferenceUrl(NIO_ID)),
      appointmentServiceCategory: 'pre-op',
      occupationalMedicineEmployerOrganization: accountOrg,
    });
    expect(name).toBeUndefined();
  });

  it('pre-op: no visit-level employer renders nothing', async () => {
    const { oystehr } = makeOystehr();
    const name = await resolveOccupationalMedicineEmployerName({
      oystehr,
      encounter: encounterWithVisitEmployer(),
      appointmentServiceCategory: 'pre-op',
      occupationalMedicineEmployerOrganization: accountOrg,
    });
    expect(name).toBeUndefined();
  });

  it('non-pre-op: prefers the resolved legacy Account employer', async () => {
    const { oystehr } = makeOystehr();
    const name = await resolveOccupationalMedicineEmployerName({
      oystehr,
      encounter: encounterWithVisitEmployer(),
      appointmentServiceCategory: 'occupational-medicine',
      occupationalMedicineEmployerOrganization: accountOrg,
    });
    expect(name).toBe('Account Employer Inc');
  });

  it('non-pre-op: falls back to the NIO token owner display when no org resolved', async () => {
    const { oystehr, get } = makeOystehr();
    const name = await resolveOccupationalMedicineEmployerName({
      oystehr,
      encounter: encounterWithVisitEmployer(),
      appointmentServiceCategory: 'occupational-medicine',
      occupationalMedicineAccount: accountWithTokenOwner,
    });
    expect(name).toBe('FedEx');
    expect(get).not.toHaveBeenCalled();
  });
});
