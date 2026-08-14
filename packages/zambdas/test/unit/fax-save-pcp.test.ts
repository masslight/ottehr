import { Patient, Practitioner } from 'fhir/r4b';
import { PRIVATE_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import { describe, expect, it } from 'vitest';
import { getPcpPatchOpsFromDetails } from '../../src/ehr/shared/harvest';

const PRACTICE_NAME_URL = `${PRIVATE_EXTENSION_BASE_URL}/practice-name`;

const existingPcp: Practitioner = {
  resourceType: 'Practitioner',
  id: 'primary-care-physician',
  name: [{ family: 'Green', given: ['Olivia'] }],
  telecom: [
    { system: 'phone', value: '+12125559999' },
    { system: 'fax', value: '+12125551234' },
  ],
  address: [{ text: '1 Main St, New York, NY' }],
  extension: [{ url: PRACTICE_NAME_URL, valueString: 'Green Family Practice' }],
  active: true,
};

const patientWithPcp = (): Patient => ({
  resourceType: 'Patient',
  id: 'patient-1',
  generalPractitioner: [{ reference: '#primary-care-physician', type: 'Practitioner' }],
  contained: [structuredClone(existingPcp)],
});

const containedFromOps = (ops: ReturnType<typeof getPcpPatchOpsFromDetails>): Practitioner => {
  const op = ops.find((entry) => entry.path === '/contained');
  if (!op || !('value' in op)) throw new Error('expected a /contained patch op');
  return (op.value as Practitioner[])[0];
};

describe('getPcpPatchOpsFromDetails', () => {
  it('updating only the fax number preserves the rest of the existing PCP', () => {
    const ops = getPcpPatchOpsFromDetails({ fax: '+13105550000', active: true }, patientWithPcp());
    const updated = containedFromOps(ops);

    expect(updated.telecom).toContainEqual({ system: 'fax', value: '+13105550000' });
    // Everything the fax dialog didn't touch must survive the wholesale Practitioner rewrite.
    expect(updated.telecom).toContainEqual({ system: 'phone', value: '+12125559999' });
    expect(updated.name).toEqual([{ family: 'Green', given: ['Olivia'] }]);
    expect(updated.address).toEqual([{ text: '1 Main St, New York, NY' }]);
    expect(updated.extension).toEqual([{ url: PRACTICE_NAME_URL, valueString: 'Green Family Practice' }]);
  });

  it("applies the supplied fields while still preserving the address that isn't editable here", () => {
    const ops = getPcpPatchOpsFromDetails(
      { firstName: 'Sam', lastName: 'Stone', practiceName: 'Stone Clinic', fax: '+13105550000', active: true },
      patientWithPcp()
    );
    const updated = containedFromOps(ops);

    expect(updated.name).toEqual([{ family: 'Stone', given: ['Sam'] }]);
    expect(updated.extension).toEqual([{ url: PRACTICE_NAME_URL, valueString: 'Stone Clinic' }]);
    expect(updated.telecom).toContainEqual({ system: 'fax', value: '+13105550000' });
    // Address is never exposed in the dialog, so it is carried over untouched.
    expect(updated.address).toEqual([{ text: '1 Main St, New York, NY' }]);
  });
});
