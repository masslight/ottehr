import { NonInsuranceOrganizationItem } from 'utils/lib/types/data/billing/non-insurance-org.types';
import { describe, expect, it } from 'vitest';
import { nioFormToInput, nioItemToFormValues } from '../../src/constants/nonInsuranceOrg';

const address = { line1: '1 Main St', city: 'Springfield', state: 'CA', zip: '90210' };

function item(sameAsOrgAddress?: boolean): NonInsuranceOrganizationItem {
  return {
    id: 'nio-1',
    name: 'FedEx',
    employer: true,
    active: true,
    address,
    contacts: [],
    covers: [
      {
        category: 'workers-comp',
        billingMode: 'direct',
        submission: { mailAddress: address },
        ...(sameAsOrgAddress !== undefined ? { sameAsOrgAddress } : {}),
      },
    ],
  };
}

describe('non-insurance org "Same as organization address"', () => {
  it('restores the checkbox from the stored item', () => {
    expect(nioItemToFormValues(item(true)).covers['workers-comp'].sameAsOrgAddress).toBe(true);
    expect(nioItemToFormValues(item()).covers['workers-comp'].sameAsOrgAddress).toBe(false);
  });

  it('sends the flag and copies the org address into the mail address', () => {
    const form = nioItemToFormValues(item(true));
    form.address.line1 = '2 New St';
    const input = nioFormToInput(form);
    expect(input.covers?.[0]).toEqual({
      category: 'workers-comp',
      billingMode: 'direct',
      sameAsOrgAddress: true,
      submission: { mailAddress: { ...address, line1: '2 New St' } },
    });
  });

  it('omits the flag when unchecked', () => {
    const input = nioFormToInput(nioItemToFormValues(item()));
    expect(input.covers?.[0]).not.toHaveProperty('sameAsOrgAddress');
  });
});
