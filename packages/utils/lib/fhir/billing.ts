import { Address, Practitioner, Location, Organization, InsurancePlan } from 'fhir/r4b';
import { getNPI, getTaxID } from './helpers';
import { APIErrorCode, BillingProviderData, BillingProviderResource } from '../types';
import Oystehr from '@oystehr/sdk';
import { getSecret, Secrets, SecretsKeys } from '../secrets';

export interface InsurancePlanResources {
  insurancePlan: InsurancePlan;
  organization: Organization;
}
export interface GetBillingProviderInput {
  appointmentId: string;
  plans: { primary: InsurancePlanResources; secondary?: InsurancePlanResources };
  secrets: Secrets | null;
}

export interface BillingProviderDataObject {
  primary: BillingProviderData;
  secondary?: BillingProviderData;
}

export const getBillingProviderData = async (
  input: GetBillingProviderInput,
  oystehrClient: Oystehr
): Promise<BillingProviderDataObject | undefined> => {
  /*
      In practice, the best FHIR modeling strategy for storing and querying up billing provider data is going to vary widely from one Ottehr user to the
      next.  In general, the provider data is likely to be derivable from the appointment id + the patient's insurance, so those details are taken as
      inputs here. 
      
      A single Organization resource is created in the setup script and used by default. 
      A reference string ("Organization/{uuid}") to that resource is exposed via the DEFAULT_BILLING_RESOURCE variable.
      
      You'll likely want to override this function with your implementation that either grabs the data you're after from some FHIR resource or another,
      or perhaps queries Candid's get-all-contracts endpoint https://docs.joincandidhealth.com/api-reference/contracts/v-2/get-multi.
    */
  const defaultBillingResource = await getDefaultBillingProviderResource(input, oystehrClient);
  const billingData = getBillingProviderDataFromResource(defaultBillingResource);
  if (billingData === undefined) {
    throw APIErrorCode.BILLING_PROVIDER_NOT_FOUND; // todo: better error here
  }
  const dataToReturn: BillingProviderDataObject = { primary: billingData };

  /*
    Because billing provider can vary by insurer/contract, primary and secondary data are sent separately here.
    For simplicity, we assume the default billing resource is appropriate for both primary and secondary provider here,
    but this is another default your use case may require overriding.
  */
  if (input.plans.secondary) {
    dataToReturn.secondary = { ...dataToReturn.primary };
  }
  return dataToReturn;
};

const getDefaultBillingProviderResource = async (
  input: GetBillingProviderInput,
  oystehrClient: Oystehr
): Promise<BillingProviderResource> => {
  const defaultBillingResource = getSecret(SecretsKeys.DEFAULT_BILLING_RESOURCE, input.secrets);
  if (!defaultBillingResource) {
    throw APIErrorCode.BILLING_PROVIDER_NOT_FOUND;
  }

  const defaultBillingResourceType = defaultBillingResource.split('/')[0];
  const defaultBillingResourceId = defaultBillingResource.split('/')[1];

  if (defaultBillingResourceType === undefined || defaultBillingResourceId === undefined) {
    throw APIErrorCode.BILLING_PROVIDER_NOT_FOUND;
  }

  const fetchedResources = await oystehrClient.fhir.search<BillingProviderResource>({
    resourceType: defaultBillingResourceType,
    params: [
      {
        name: '_id',
        value: defaultBillingResourceId,
      },
    ],
  });

  const billingResource = fetchedResources?.unbundle()[0];
  if (!billingResource) {
    throw APIErrorCode.BILLING_PROVIDER_NOT_FOUND;
  }
  return billingResource;
};

const getBillingProviderDataFromResource = (
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
