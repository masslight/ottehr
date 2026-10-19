import Oystehr from '@oystehr/sdk';
import { Coverage, Organization, Patient } from 'fhir/r4b';
import { getCustomInsuranceOrgReferenceUrl } from 'utils/lib/helpers/helpers';
import { CUSTOM_INSURANCE_ORG_ID_SYSTEM } from 'utils/lib/types/data/billing/custom-insurance-org.types';
import { describe, expect, it, vi } from 'vitest';
import { makeCoveragePromise } from '../../src/ehr/lab/external/submit-lab-order/helpers';

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const TOKEN = getCustomInsuranceOrgReferenceUrl(ORG_ID);
const PATIENT_ID = 'patient-123';

const patient: Patient = { resourceType: 'Patient', id: PATIENT_ID };
const coverage: Coverage = {
  resourceType: 'Coverage',
  id: 'coverage-custom',
  status: 'active',
  beneficiary: { reference: `Patient/${PATIENT_ID}` },
  payor: [{ reference: TOKEN }],
};

function makeOystehr(execute: ReturnType<typeof vi.fn>): {
  oystehr: Oystehr;
  getPayerByUrl: ReturnType<typeof vi.fn>;
} {
  // Coverage:payor can't _include a token, so the search returns only the Coverage and beneficiary.
  const search = vi.fn().mockResolvedValue({ unbundle: () => [coverage, patient] });
  const getPayerByUrl = vi.fn();
  const oystehr = { fhir: { search }, rcm: { getPayerByUrl }, zambda: { execute } } as unknown as Oystehr;
  return { oystehr, getPayerByUrl };
}

describe('submit-lab-order makeCoveragePromise — custom insurance organizations', () => {
  it('resolves a custom insurance org token through the billing zambda door instead of RCM', async () => {
    const execute = vi.fn().mockResolvedValue({
      output: {
        organizations: [{ id: ORG_ID, reference: TOKEN, orgId: 'OTR-ACME', name: 'Acme Insurance', active: true }],
      },
    });
    const { oystehr, getPayerByUrl } = makeOystehr(execute);

    const result = await makeCoveragePromise(oystehr, 'sr-1', PATIENT_ID, [`Coverage/${coverage.id}`]);

    expect(execute).toHaveBeenCalledWith({ id: 'list-custom-insurance-organizations', insuranceOrgId: ORG_ID });
    expect(getPayerByUrl).not.toHaveBeenCalled();
    expect(result.coveragesAndOrgs).toHaveLength(1);
    const payorOrg = result.coveragesAndOrgs![0].payorOrg as Organization;
    expect(result.coveragesAndOrgs![0].coverage).toBe(coverage);
    // The order-form PDF reads the payer's name from this org.
    expect(payorOrg.name).toBe('Acme Insurance');
    expect(payorOrg.id).toBe(ORG_ID);
    expect(payorOrg.identifier).toEqual([{ system: CUSTOM_INSURANCE_ORG_ID_SYSTEM, value: 'OTR-ACME' }]);
  });

  it('fails with a lab error naming the custom org when the token no longer resolves', async () => {
    const execute = vi.fn().mockResolvedValue({ output: { organizations: [] } });
    const { oystehr, getPayerByUrl } = makeOystehr(execute);

    await expect(makeCoveragePromise(oystehr, 'sr-1', PATIENT_ID, [`Coverage/${coverage.id}`])).rejects.toMatchObject({
      message: expect.stringContaining(`Unable to resolve custom insurance organization ${TOKEN}`),
    });
    expect(getPayerByUrl).not.toHaveBeenCalled();
  });
});
