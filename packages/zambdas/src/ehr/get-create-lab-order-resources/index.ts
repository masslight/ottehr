import { APIGatewayProxyResult } from 'aws-lambda';
import { validateRequestParameters } from './validateRequestParameters';
import { ZambdaInput } from '../../shared/types';
import { checkOrCreateM2MClientToken, topLevelCatch } from '../../shared';
import { createOystehrClient } from '../../shared/helpers';
import {
  LAB_ORG_TYPE_CODING,
  OYSTEHR_LAB_GUID_SYSTEM,
  flattenBundleResources,
  OYSTEHR_LAB_ORDERABLE_ITEM_SEARCH_API,
  OrderableItemSearchResult,
  LabOrderResourcesRes,
  CODE_SYSTEM_COVERAGE_CLASS,
} from 'utils';
import { BatchInputRequest, Bundle } from '@oystehr/sdk';
import { Coverage, Account, Organization, FhirResource } from 'fhir/r4b';
import { getPrimaryInsurance } from '../shared/labs';

let m2mtoken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { encounter, secrets } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);
    const oystehr = createOystehrClient(m2mtoken, secrets);

    const patientId = encounter.subject?.reference?.replace('Patient/', '');
    if (!patientId) throw new Error('Encounter is misconfigured and does not contain a patient subject');

    const coverageSearchRequest: BatchInputRequest<Coverage> = {
      method: 'GET',
      url: `/Coverage?patient=Patient/${patientId}&status=active`,
    };
    const accountSearchRequest: BatchInputRequest<Account> = {
      method: 'GET',
      url: `/Account?subject=Patient/${patientId}&status=active`,
    };
    const organizationSearchRequest: BatchInputRequest<Organization> = {
      method: 'GET',
      url: `/Organization?type=${LAB_ORG_TYPE_CODING.system}|${LAB_ORG_TYPE_CODING.code}`,
    };

    const searchResults: Bundle<FhirResource> = await oystehr.fhir.batch({
      requests: [coverageSearchRequest, accountSearchRequest, organizationSearchRequest],
    });
    const resources = flattenBundleResources<Coverage | Account | Organization>(searchResults);

    const coverages: Coverage[] = [];
    const accounts: Account[] = [];
    const organizations: Organization[] = [];
    const labOrgsGuids: string[] = [];

    resources.forEach((resource) => {
      if (resource.resourceType === 'Organization') {
        const fhirOrg = resource as Organization;
        organizations.push(fhirOrg);
        const labGuid = fhirOrg.identifier?.find((id) => id.system === OYSTEHR_LAB_GUID_SYSTEM)?.value;
        if (labGuid) labOrgsGuids.push(labGuid);
      }
      if (resource.resourceType === 'Coverage') coverages.push(resource as Coverage);
      if (resource.resourceType === 'Account') accounts.push(resource as Account);
    });

    if (accounts.length !== 1)
      // there should only be one active account
      throw new Error('patient must have one active account record to represent a guarantor to order labs');
    const patientAccount = accounts[0];
    if (!patientAccount.guarantor) {
      throw new Error('patient must have an account with a guarantor resource to order labs');
    }
    const isSelfPay = !patientAccount.coverage?.length ? true : false;
    const patientPrimaryInsurance = getPrimaryInsurance(patientAccount, coverages);
    const primaryInsuranceName = patientPrimaryInsurance?.class?.find(
      (c) => c.type.coding?.find((code) => code.system === CODE_SYSTEM_COVERAGE_CLASS)
    )?.name;
    if (!patientPrimaryInsurance && !isSelfPay)
      throw new Error('patient must have insurance or have designated self pay to order labs');
    if (patientPrimaryInsurance && !primaryInsuranceName)
      throw new Error('insurance appears to be malformed, cannot reconcile insurance class name');
    const coverageName = primaryInsuranceName ?? 'Self Pay';

    const labs = await getLabs(labOrgsGuids, m2mtoken);

    const response: LabOrderResourcesRes = {
      coverageName,
      labs,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    await topLevelCatch('admin-get-create-lab-order-resources', error, input.secrets);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: `Error getting resources for create lab order: ${error}` }),
    };
  }
};

const getLabs = async (labOrgsGuids: string[], m2mtoken: string): Promise<OrderableItemSearchResult[]> => {
  const labIds = labOrgsGuids.join(',');
  let cursor = '';
  const items: OrderableItemSearchResult[] = [];

  do {
    const url = `${OYSTEHR_LAB_ORDERABLE_ITEM_SEARCH_API}?labIds=${labIds}&limit=100&cursor=${cursor}`;
    const orderableItemsSearch = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${m2mtoken}`,
      },
    });
    const response = await orderableItemsSearch.json();
    const orderableItemRes = response.orderableItems as OrderableItemSearchResult[];
    items.push(...orderableItemRes);
    cursor = response?.metadata?.nextCursor || '';
  } while (cursor);

  return items;
};
