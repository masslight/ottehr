import { Address, Practitioner, Location, Organization } from 'fhir/r4b';
import { getNPI, getTaxID } from './helpers';
import { BillingProviderData } from '../types';

/*
  TODO: make this true
  Every claim submitted to Candid's claim service requires this billing provider data to be included.
  Which resource(s) you store this on is up to you. A single Organization resource is created in the setup script and used
  by default. A reference string ("Organization/{uuid}") to that resource is exposed via the DEFAULT_BILLING_ORG_RESOURCE variable. 
*/
export const getBillingProviderDataFromResource = (
  resource: Location | Practitioner | Organization
): BillingProviderData | undefined => {
  const { address: singleAddressOrList, id } = resource;
  if (!singleAddressOrList || !id) {
    return undefined;
  }
  const address = [singleAddressOrList]
    .flatMap((a) => a)
    .find((addr: Address) => {
      return addr.use === 'billing';
    });
  const npi = getNPI(resource);
  const taxId = getTaxID(resource);

  if (!address || !npi || !taxId) {
    return undefined;
  }
  return {
    resourceType: resource.resourceType,
    id,
    npi,
    taxId,
    address,
  };
};
